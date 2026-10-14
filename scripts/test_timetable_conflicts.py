#!/usr/bin/env python3
"""
test_timetable_conflicts.py - Automated verification for KIT Campus timetable conflict detection
Tests:
1. Server startup and port binding
2. End-to-end schedule fetching from local server /api/schedule
3. Smart term fallback & Brick traversal (testing SS course M-ETIT-106953)
4. Batch schedule retrieval from /api/schedule/batch
5. Terms resolution from /api/terms
6. Timetable collision logic simulation
"""

import urllib.request
import urllib.parse
import json
import subprocess
import time
import sys
import os

BASE_URL = "http://localhost:8080"
SERVER_PROC = None

def ensure_server_running():
    global SERVER_PROC
    try:
        urllib.request.urlopen(f"{BASE_URL}/api/terms", timeout=1)
        print("Server is already running.")
        return
    except Exception:
        pass

    print("Launching server.py for verification...")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    SERVER_PROC = subprocess.Popen(["python3", "server.py"], cwd=base_dir)
    time.sleep(1.2)
    print("Server launched.")

def test_terms_endpoint():
    print("Testing GET /api/terms...")
    req = urllib.request.urlopen(f"{BASE_URL}/api/terms", timeout=8)
    data = json.loads(req.read().decode("utf-8"))
    assert data.get("success") is True, "Expected success: true"
    terms = data.get("terms", {})
    assert len(terms) > 0, "Terms dictionary should not be empty"
    print(f"  ✓ Terms endpoint passed ({len(terms)} terms available)")

def test_single_schedule_endpoint():
    print("Testing GET /api/schedule?id=M-ETIT-106815...")
    req = urllib.request.urlopen(f"{BASE_URL}/api/schedule?id=M-ETIT-106815", timeout=8)
    data = json.loads(req.read().decode("utf-8"))
    assert data.get("success") is True, "Expected success: true"
    sched = data.get("schedule", {})
    assert sched.get("found") is True, "Module should be found"
    assert len(sched.get("events", [])) > 0, "Module should have events"
    print(f"  ✓ Single schedule passed ({len(sched['events'])} events extracted)")

def test_strict_term_scoping():
    print("Testing strict term scoping: SS course M-ETIT-106953 in upcoming WS 26/27...")
    req = urllib.request.urlopen(f"{BASE_URL}/api/schedule?id=M-ETIT-106953&term=WS", timeout=25)
    data = json.loads(req.read().decode("utf-8"))
    assert data.get("success") is True, "Expected success: true"
    sched = data.get("schedule", {})
    assert sched.get("found") is True, "Module should be found"
    assert len(sched.get("events", [])) == 0, f"M-ETIT-106953 should NOT have events in WS 26/27, got: {sched.get('events')}"
    assert sched.get("offeredInTerm") is False, "offeredInTerm should be False"
    assert "Not offered" in sched.get("termNote", ""), f"termNote should state not offered, got: {sched.get('termNote')}"
    print(f"  ✓ Strict term scoping verified: {sched.get('moduleTitle')} correctly has 0 events and offeredInTerm=False in WS 26/27")

def test_batch_schedule_endpoint():
    print("Testing POST /api/schedule/batch...")
    payload = json.dumps({
        "modules": ["M-ETIT-106815", "M-ETIT-103802", "M-ETIT-106974"],
        "term": "WS",
        "year": 2026
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/schedule/batch",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(req, timeout=12)
    data = json.loads(res.read().decode("utf-8"))
    assert data.get("success") is True, "Expected success: true"
    schedules = data.get("schedules", {})
    assert "M-ETIT-106815" in schedules, "M-ETIT-106815 should be in batch results"
    assert "M-ETIT-103802" in schedules, "M-ETIT-103802 should be in batch results"
    print(f"  ✓ Batch schedules passed ({len(schedules)} modules returned)")

def test_interval_collision_logic():
    print("Testing timetable interval collision solver...")
    def collides(s1, s2):
        if s1["day"] != s2["day"]:
            return False
        return max(s1["start"], s2["start"]) < min(s1["end"], s2["end"])

    slot1 = {"day": "Di", "start": 690, "end": 780}
    slot2 = {"day": "Di", "start": 720, "end": 810}
    slot3 = {"day": "Di", "start": 840, "end": 930}
    slot4 = {"day": "Mo", "start": 690, "end": 780}

    assert collides(slot1, slot2) is True, "Slot 1 and 2 should collide"
    assert collides(slot1, slot3) is False, "Slot 1 and 3 should not collide"
    assert collides(slot1, slot4) is False, "Different days should not collide"
    print("  ✓ Collision interval logic passed")

def test_custom_module_schedule_resolution():
    print("Testing schedule resolution for custom module code (M-INFO-106812)...")
    req = urllib.request.urlopen(f"{BASE_URL}/api/schedule?id=M-INFO-106812&term=WS&year=2026", timeout=25)
    data = json.loads(req.read().decode("utf-8"))
    assert data.get("success") is True, "Expected success: true"
    sched = data.get("schedule", {})
    assert sched.get("found") is True, "Custom module code M-INFO-106812 should be found"
    assert len(sched.get("events", [])) > 0, "Custom module code should have events in WS 26/27"
    print(f"  ✓ Custom module code schedule resolution passed ({len(sched['events'])} events extracted)")

if __name__ == "__main__":
    try:
        ensure_server_running()
        test_terms_endpoint()
        test_single_schedule_endpoint()
        test_strict_term_scoping()
        test_batch_schedule_endpoint()
        test_custom_module_schedule_resolution()
        test_interval_collision_logic()
        print("\nAll automated timetable verification tests PASSED! ✓")
    except Exception as e:
        print(f"\n❌ Test failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if SERVER_PROC:
            print("Shutting down test server...")
            SERVER_PROC.terminate()
            SERVER_PROC.wait()
            print("Server stopped.")
