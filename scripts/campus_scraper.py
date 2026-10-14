#!/usr/bin/env python3
"""
campus_scraper.py - KIT Campus Management & Vorlesungsverzeichnis (VVZ) Scraper
Extracts lecture, exercise, and tutorial timeslots for modules using module codes (e.g., M-ETIT-106815).

Supports:
- Zero-dependency Python standard library execution (urllib, re, json, html, http.cookiejar)
- Instant Public Mode: Retrieves official timeslots from public Vorlesungsverzeichnis without credentials
- Authenticated Mode: Optional KIT Shibboleth SSO login (in-memory session) for restricted courses
- Automatic client challenge solving ((seed * 7) % 100000 + seed % 3)
- Multi-term resolution (WS, SS, academic years)
- Local persistent caching under data/schedules/
"""

import os
import sys
import re
import json
import time
import html
import urllib.request
import urllib.parse
import http.cookiejar
from typing import Dict, List, Optional, Any

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULES_CACHE_DIR = os.path.join(BASE_DIR, "data", "schedules")
os.makedirs(SCHEDULES_CACHE_DIR, exist_ok=True)

CAMPUS_BASE = "https://cascampus.studium.kit.edu"
TERMS_URL = f"{CAMPUS_BASE}/server/services/kit/terms.asp"
QUICKSEARCH_URL = f"{CAMPUS_BASE}/server/services/kit/quicksearch.asp"
MODULE_VIEW_URL = f"{CAMPUS_BASE}/campus/all/abstractModuleView.asp"
EVENT_VIEW_URL = f"{CAMPUS_BASE}/campus/all/event.asp"
LOGIN_URL = f"{CAMPUS_BASE}/campus/login/login.asp"

DAY_MAP = {
    "Mo": {"name": "Monday", "index": 1},
    "Di": {"name": "Tuesday", "index": 2},
    "Mi": {"name": "Wednesday", "index": 3},
    "Do": {"name": "Thursday", "index": 4},
    "Fr": {"name": "Friday", "index": 5},
    "Sa": {"name": "Saturday", "index": 6},
    "So": {"name": "Sunday", "index": 7},
}

class KITCampusScraper:
    def __init__(self, cache_file: Optional[str] = None):
        self.cookie_jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookie_jar))
        self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        self.cache_file = cache_file or os.path.join(SCHEDULES_CACHE_DIR, "modules_cache.json")
        self.cache: Dict[str, Any] = self._load_cache()
        self.terms_cache: Optional[Dict[str, Any]] = None
        self.is_authenticated = False

    def _load_cache(self) -> Dict[str, Any]:
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Scraper] Warning: Could not load cache: {e}", file=sys.stderr)
        return {}

    def _save_cache(self):
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Scraper] Warning: Could not save cache: {e}", file=sys.stderr)

    def _request_with_challenge(self, url: str, method: str = "GET", post_data: Optional[bytes] = None) -> str:
        """Fetches a URL, handling the automated lightweight bot challenge if encountered."""
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
        }
        if method == "POST" and post_data:
            headers["Content-Type"] = "application/x-www-form-urlencoded"

        req = urllib.request.Request(url, data=post_data, headers=headers)
        try:
            res = self.opener.open(req, timeout=12)
            content = res.read().decode("utf-8", errors="ignore")
            return content
        except urllib.error.HTTPError as e:
            err_content = e.read().decode("utf-8", errors="ignore")
            # Check for bot challenge
            m = re.search(r'var seed = (\d+);', err_content)
            if m:
                seed = int(m.group(1))
                answer = ((seed * 7) % 100000) + (seed % 3)
                solve_data = urllib.parse.urlencode({"botchallenge": answer}).encode("utf-8")
                headers["Referer"] = url
                headers["Content-Type"] = "application/x-www-form-urlencoded"
                post_req = urllib.request.Request(url, data=solve_data, headers=headers)
                res2 = self.opener.open(post_req, timeout=12)
                return res2.read().decode("utf-8", errors="ignore")
            raise

    def get_terms(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetches the list of active/past terms with GUIDs and dates from CAS Campus."""
        if self.terms_cache and not force_refresh:
            return self.terms_cache

        terms_cache_file = os.path.join(SCHEDULES_CACHE_DIR, "terms.json")
        if not force_refresh and os.path.exists(terms_cache_file):
            try:
                with open(terms_cache_file, "r", encoding="utf-8") as f:
                    self.terms_cache = json.load(f)
                    return self.terms_cache
            except Exception:
                pass

        try:
            req = urllib.request.Request(TERMS_URL, headers={"User-Agent": self.user_agent})
            res = self.opener.open(req, timeout=8)
            terms = json.loads(res.read().decode("utf-8"))
            self.terms_cache = terms
            with open(terms_cache_file, "w", encoding="utf-8") as f:
                json.dump(terms, f, indent=2, ensure_ascii=False)
            return terms
        except Exception as e:
            print(f"[Scraper] Error fetching terms: {e}", file=sys.stderr)
            return {}

    def resolve_term_guid(self, term_type: str = "WS", year: Optional[int] = None) -> Optional[str]:
        """
        Resolves a term string to a CAS Campus term GUID.
        Strictly scopes resolution to the upcoming Winter Semester 26/27 (WS 26/27).
        Times and locations are not stable across semesters, so no fallback to past
        semesters (e.g. SS 2026) or alternating terms is permitted.
        """
        terms = self.get_terms()
        if not terms:
            return None

        term_type = (term_type or "WS").upper().strip()

        # Currently only data from Winter Semester 26/27 should be collected and displayed
        if term_type != "WS" or (year is not None and year != 2026):
            return None

        # Look specifically for WS 26/27 or the default winter term
        for guid, info in terms.items():
            name = info.get("name", "")
            if "WS 26/27" in name or ("WS" in name and info.get("default")):
                return guid

        # Fallback to default term only if it is a winter term
        for guid, info in terms.items():
            if info.get("default") and "WS" in info.get("name", ""):
                return guid

        return None

    def search_module(self, module_id: str, term_guid: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Searches CAS Campus for a module by code or numeric ID.
        Returns dict with {'id': module_gguid, 'name': full_title} or None.
        Never restricts quicksearch by term_guid so module entity is always discovered.
        """
        # Extract digits: 'M-ETIT-106815' -> '106815'
        digits_match = re.search(r'\d+', module_id)
        search_query = digits_match.group(0) if digits_match else module_id

        params = {"find": search_query, "type": "module"}
        query_url = f"{QUICKSEARCH_URL}?{urllib.parse.urlencode(params)}"
        try:
            req = urllib.request.Request(query_url, headers={"User-Agent": self.user_agent})
            res = self.opener.open(req, timeout=8)
            data = json.loads(res.read().decode("utf-8"))
            results = data.get("result", [])

            if not results:
                return None

            # If exact match found
            for r in results:
                if module_id in r.get("name", ""):
                    return {"id": r["id"], "name": r.get("name", "")}

            return {"id": results[0]["id"], "name": results[0].get("name", "")}
        except Exception as e:
            print(f"[Scraper] Error searching module {module_id}: {e}", file=sys.stderr)
            return None

    def _extract_events_from_html(self, page_html: str, term_guid: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extracts event entries (Vorlesung, Übung, Praktikum) from HTML table rows.
        Filters out examination dates (Schriftliche/Mündliche Prüfung).
        """
        event_matches = re.finditer(
            r'<tr[^>]*>.*?href=[\"\'][^\"\']*event\.asp\?gguid=(0x[A-F0-9]+)[^\"\']*[\"\'][^>]*>(\d+)</a>.*?'
            r'<td class=[\"\']rwev_titleger[\"\'][^>]*>(.*?)</td>.*?'
            r'(?:<td class=[\"\']nomobile[\"\'][^>]*>(.*?)</td>.*?)?'
            r'<td class=[\"\']nomobile[\"\'][^>]*>(.*?)</td>.*?'
            r'<td class=[\"\'][^\"\']*mobileonly[\"\'][^>]*>(.*?)</td>.*?'
            r'</tr>',
            page_html, re.DOTALL
        )

        seen_event_guids = set()
        events = []

        for m in event_matches:
            eguid = m.group(1)
            event_num = m.group(2)
            event_title = html.unescape(re.sub(r'<[^>]+>', '', m.group(3))).strip()
            lecturer = html.unescape(re.sub(r'<[^>]+>', '', m.group(4) or "")).strip()
            event_type = html.unescape(re.sub(r'<[^>]+>', '', m.group(5))).strip()
            event_type_code = html.unescape(re.sub(r'<[^>]+>', '', m.group(6))).strip()

            if eguid in seen_event_guids:
                continue
            seen_event_guids.add(eguid)

            # Skip exams / Klausuren for weekly schedule
            if any(k in event_type.lower() for k in ["prüfung", "klausur", "exam"]):
                continue

            slots = self.parse_event_schedule(eguid, term_guid)

            events.append({
                "eventId": event_num,
                "eventGuid": eguid,
                "title": event_title,
                "type": event_type,
                "typeCode": event_type_code or "V",
                "lecturer": lecturer,
                "slots": slots
            })

        return events

    def parse_event_schedule(self, event_guid: str, term_guid: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches an event's detail page and extracts recurring and single lecture/exercise slots.
        """
        url = f"{EVENT_VIEW_URL}?gguid={event_guid}"
        if term_guid:
            url += f"&tguid={term_guid}"

        try:
            page_html = self._request_with_challenge(url)
        except Exception as e:
            print(f"[Scraper] Error loading event {event_guid}: {e}", file=sys.stderr)
            return []

        # Find schedule table
        schedule_rows = re.findall(r'<tr[^>]*id=[\"\']0x[A-F0-9]+[\"\'][^>]*>(.*?)</tr>', page_html, re.DOTALL)
        slots_map = {}

        for row in schedule_rows:
            cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if len(cols) < 4:
                continue

            # Strip HTML tags
            clean_cols = [html.unescape(re.sub(r'<[^>]+>', ' ', c)).strip() for c in cols]
            day_str = clean_cols[1] if len(clean_cols) > 1 else ""
            time_str = clean_cols[2] if len(clean_cols) > 2 else ""
            room_str = clean_cols[3] if len(clean_cols) > 3 else ""
            notes_str = clean_cols[4] if len(clean_cols) > 4 else ""

            # Extract day code (Mo, Di, Mi, Do, Fr, Sa, So)
            day_match = re.search(r'\b(Mo|Di|Mi|Do|Fr|Sa|So)\b', day_str)
            if not day_match:
                continue
            day_code = day_match.group(1)
            day_info = DAY_MAP.get(day_code, {"name": day_code, "index": 0})

            # Determine recurrence
            frequency = "weekly"
            if "14-täglich" in day_str or "14-taeglich" in day_str:
                frequency = "biweekly"
            elif "Einzeltermin" in day_str or "einzeln" in day_str.lower():
                frequency = "single"
            elif "Block" in day_str:
                frequency = "block"

            # Parse time "11:30 - 13:00"
            time_match = re.search(r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})', time_str)
            if not time_match:
                continue

            start_t = time_match.group(1)
            end_t = time_match.group(2)

            sh, sm = map(int, start_t.split(":"))
            eh, em = map(int, end_t.split(":"))
            start_mins = sh * 60 + sm
            end_mins = eh * 60 + em

            # Extract campus plan room url if present in cols[3]
            campus_link_match = re.search(r'href=[\"\'](http[s]?://[^\"\']*campusplan[^\"\']*)[\"\']', cols[3])
            campus_url = campus_link_match.group(1) if campus_link_match else ""

            # Create a unique key for grouping repeating slot instances
            slot_key = f"{day_code}_{frequency}_{start_t}_{end_t}_{room_str}"
            if slot_key not in slots_map:
                slots_map[slot_key] = {
                    "day": day_code,
                    "dayIndex": day_info["index"],
                    "dayName": day_info["name"],
                    "frequency": frequency,
                    "startTime": start_t,
                    "endTime": end_t,
                    "startMinutes": start_mins,
                    "endMinutes": end_mins,
                    "room": room_str,
                    "campusUrl": campus_url,
                    "notes": notes_str if len(notes_str) < 120 else ""
                }

        return list(slots_map.values())

    def fetch_module_schedule(self, module_id: str, term_type: str = "WS", year: Optional[int] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Main method to retrieve all events and timeslots for a given module ID.
        Scopes extraction strictly to the requested upcoming term (Winter Semester 26/27).
        """
        term_type = (term_type or "WS").upper().strip()
        cache_key = f"{module_id}_{term_type}_{year or 'latest'}"
        if not force_refresh and cache_key in self.cache:
            cached_data = self.cache[cache_key]
            # Return cached data if valid events exist or term offering status was recorded
            if cached_data.get("events") or "offeredInTerm" in cached_data:
                if "offeredInTerm" not in cached_data:
                    cached_data["offeredInTerm"] = len(cached_data.get("events", [])) > 0
                return cached_data

        mod_info = self.search_module(module_id)
        result: Dict[str, Any] = {
            "moduleId": module_id,
            "moduleTitle": mod_info["name"] if mod_info else module_id,
            "term": term_type,
            "termGuid": None,
            "termNote": None,
            "found": False,
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "events": []
        }

        if not mod_info:
            self.cache[cache_key] = result
            self._save_cache()
            return result

        result["found"] = True
        mod_guid = mod_info["id"]

        # Strategy 1: Query requested preferred term
        pref_term_guid = self.resolve_term_guid(term_type, year)
        result["termGuid"] = pref_term_guid

        if not pref_term_guid:
            # Term not valid for active schedule collection (only WS 26/27 data is currently collected)
            result["events"] = []
            result["offeredInTerm"] = False
            result["termNote"] = "No times loaded: schedules are strictly published and collected for Winter Semester 26/27."
            self.cache[cache_key] = result
            self._save_cache()
            return result

        mod_url = f"{MODULE_VIEW_URL}?gguid={mod_guid}&tguid={pref_term_guid}"

        try:
            mod_html = self._request_with_challenge(mod_url)
        except Exception as e:
            print(f"[Scraper] Failed to load module page {mod_guid}: {e}", file=sys.stderr)
            self.cache[cache_key] = result
            self._save_cache()
            return result

        events = self._extract_events_from_html(mod_html, pref_term_guid)

        # Check Teilleistungen (bricks) in requested term if direct events are empty
        if not events:
            brick_guids = set(re.findall(r'abstractBrickView\.asp\?gguid=(0x[A-F0-9]+)', mod_html))
            for b_guid in brick_guids:
                b_url = f"{CAMPUS_BASE}/campus/all/abstractBrickView.asp?gguid={b_guid}"
                if pref_term_guid:
                    b_url += f"&tguid={pref_term_guid}"
                try:
                    b_html = self._request_with_challenge(b_url)
                    events.extend(self._extract_events_from_html(b_html, pref_term_guid))
                except Exception:
                    pass

        # Module times are only valid for the upcoming semester (WS 26/27).
        # Times are unstable across terms, so no fallback across semesters is permitted.
        offered_in_term = len(events) > 0
        term_label = "Winter Semester 26/27" if term_type == "WS" else f"{term_type} {year or ''}"
        term_note = f"Official schedule for {term_label}" if offered_in_term else f"Not offered in {term_label}"

        result["events"] = events
        result["term"] = term_type
        result["offeredInTerm"] = offered_in_term
        result["termNote"] = term_note

        self.cache[cache_key] = result
        self._save_cache()
        return result

    def fetch_batch_schedules(self, module_ids: List[str], term_type: str = "WS", year: Optional[int] = None) -> Dict[str, Any]:
        """Fetches schedules for a list of modules, returning a dict { moduleId: scheduleData }."""
        out = {}
        for mod_id in module_ids:
            try:
                out[mod_id] = self.fetch_module_schedule(mod_id, term_type, year)
            except Exception as e:
                print(f"[Scraper] Error fetching schedule for {mod_id}: {e}", file=sys.stderr)
                out[mod_id] = {"moduleId": mod_id, "found": False, "events": []}
        return out

    def login_shibboleth(self, username: str, password: str) -> bool:
        """
        Authenticates via KIT Shibboleth SSO in-memory.
        Credentials are never stored; only session cookies are retained.
        """
        try:
            # 1. Access login URL
            login_html = self._request_with_challenge(LOGIN_URL)

            # 2. Extract SAML action URL or IdP login form
            idp_match = re.search(r'action=[\"\']([^\"\']*idp\.scc\.kit\.edu[^\"\']*)[\"\']', login_html)
            if not idp_match:
                # Might already be at idp URL
                idp_url = f"https://idp.scc.kit.edu/idp/profile/SAML2/Redirect/SSO?execution=e1s1"
            else:
                idp_url = html.unescape(idp_match.group(1))
                if not idp_url.startswith("http"):
                    idp_url = urllib.parse.urljoin(CAMPUS_BASE, idp_url)

            # 3. Post username and password
            auth_data = urllib.parse.urlencode({
                "j_username": username,
                "j_password": password,
                "_eventId_proceed": "proceed"
            }).encode("utf-8")

            auth_req = urllib.request.Request(
                idp_url,
                data=auth_data,
                headers={
                    "User-Agent": self.user_agent,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            auth_res = self.opener.open(auth_req, timeout=12)
            auth_html = auth_res.read().decode("utf-8", errors="ignore")

            # Check if SAMLResponse form is returned to post back to Shibboleth.sso
            saml_match = re.search(r'<input[^>]+name=[\"\']SAMLResponse[\"\'][^>]+value=[\"\']([^\"\']+)[\"\']', auth_html)
            if saml_match:
                saml_val = saml_match.group(1)
                relay_match = re.search(r'<input[^>]+name=[\"\']RelayState[\"\'][^>]+value=[\"\']([^\"\']+)[\"\']', auth_html)
                relay_val = relay_match.group(1) if relay_match else ""

                action_match = re.search(r'<form[^>]+action=[\"\']([^\"\']+)[\"\']', auth_html)
                action_url = action_match.group(1) if action_match else f"{CAMPUS_BASE}/Shibboleth.sso/SAML2/POST"

                relay_data = urllib.parse.urlencode({
                    "SAMLResponse": saml_val,
                    "RelayState": relay_val
                }).encode("utf-8")

                relay_req = urllib.request.Request(
                    action_url,
                    data=relay_data,
                    headers={"User-Agent": self.user_agent, "Content-Type": "application/x-www-form-urlencoded"}
                )
                self.opener.open(relay_req, timeout=12)

            self.is_authenticated = True
            return True
        except Exception as e:
            print(f"[Scraper] Authentication error: {e}", file=sys.stderr)
            self.is_authenticated = False
            return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 campus_scraper.py <module_id> [term_type] [year]")
        print("Example: python3 campus_scraper.py M-ETIT-106815 WS 2026")
        sys.exit(1)

    mod = sys.argv[1]
    term = sys.argv[2] if len(sys.argv) > 2 else "WS"
    yr = int(sys.argv[3]) if len(sys.argv) > 3 else None

    scraper = KITCampusScraper()
    print(f"Fetching schedule for {mod} ({term} {yr or 'latest'})...")
    res = scraper.fetch_module_schedule(mod, term, yr)
    print(json.dumps(res, indent=2, ensure_ascii=False))
