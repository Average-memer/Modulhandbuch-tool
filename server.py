#!/usr/bin/env python3
"""
server.py - Lightweight Zero-Dependency Server for Universal KIT Master Study Planner
Provides:
- Static file server for public/
- REST API for degree discovery and retrieval (/api/degrees, /api/degree)
- PDF upload endpoint (/api/upload) to dynamically parse and register new KIT handbooks
"""

import os
import sys
import json
import time
import mimetypes
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Import universal parser from scripts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
try:
    from universal_parser import parse_pdf_file, save_degree_data
except ImportError:
    parse_pdf_file = None
    save_degree_data = None

PORT = int(os.environ.get("PORT", 8080))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "data")
DEGREES_DIR = os.path.join(DATA_DIR, "degrees")
HANDBOOKS_DIR = os.path.join(BASE_DIR, "modulhandbücher")

os.makedirs(DEGREES_DIR, exist_ok=True)
os.makedirs(HANDBOOKS_DIR, exist_ok=True)

class UniversalPlannerHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Filename')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. API: List all installed degrees
        if path == "/api/degrees":
            index_file = os.path.join(DEGREES_DIR, "degrees_index.json")
            self.serve_json_file(index_file, fallback=[])
            return

        # 2. API: Get complete degree package (metadata + modules)
        if path == "/api/degree":
            degree_id = query.get("id", ["etit-msc-2025"])[0]
            deg_file = os.path.join(DEGREES_DIR, degree_id, "degree.json")
            mod_file = os.path.join(DEGREES_DIR, degree_id, "modules.json")

            if os.path.exists(deg_file) and os.path.exists(mod_file):
                try:
                    with open(deg_file, "r", encoding="utf-8") as f:
                        deg_data = json.load(f)
                    with open(mod_file, "r", encoding="utf-8") as f:
                        mod_data = json.load(f)
                    res = {"success": True, "degree": deg_data, "modules": mod_data}
                    self.send_json_response(res)
                    return
                except Exception as e:
                    self.send_json_response({"success": False, "error": str(e)}, status=500)
                    return
            else:
                self.send_json_response({"success": False, "error": f"Degree '{degree_id}' not found."}, status=404)
                return

        # 3. Legacy compatibility endpoints
        if path == "/api/modules":
            degree_id = query.get("degree", ["etit-msc-2025"])[0]
            mod_file = os.path.join(DEGREES_DIR, degree_id, "modules.json")
            self.serve_json_file(mod_file, fallback={})
            return

        if path == "/api/specializations":
            degree_id = query.get("degree", ["etit-msc-2025"])[0]
            deg_file = os.path.join(DEGREES_DIR, degree_id, "degree.json")
            if os.path.exists(deg_file):
                with open(deg_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.send_json_response(data.get("specializations", []))
            else:
                self.send_json_response([])
            return

        if path == "/api/rules":
            degree_id = query.get("degree", ["etit-msc-2025"])[0]
            deg_file = os.path.join(DEGREES_DIR, degree_id, "degree.json")
            if os.path.exists(deg_file):
                with open(deg_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.send_json_response(data.get("rules", {}))
            else:
                self.send_json_response({})
            return

        # 4. Static file serving from public/
        if path == "/" or path == "":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        else:
            rel_path = path.lstrip("/")
            file_path = os.path.join(PUBLIC_DIR, rel_path)

        # Prevent directory traversal
        norm_file = os.path.abspath(file_path)
        if not norm_file.startswith(os.path.abspath(PUBLIC_DIR)) and not norm_file.startswith(os.path.abspath(DATA_DIR)):
            self.send_error(403, "Forbidden")
            return

        if os.path.exists(norm_file) and os.path.isfile(norm_file):
            content_type, _ = mimetypes.guess_type(norm_file)
            if content_type is None:
                content_type = "application/octet-stream"
            try:
                with open(norm_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self.send_error(500, f"Error reading file: {e}")
        else:
            self.send_error(404, "File Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/upload":
            content_len = int(self.headers.get("Content-Length", 0))
            if content_len == 0:
                self.send_json_response({"success": False, "error": "Empty file received"}, status=400)
                return

            # Read upload body
            body = self.rfile.read(content_len)
            content_type = self.headers.get("Content-Type", "")

            # Filename header or default
            raw_filename = self.headers.get("X-Filename", "")
            if not raw_filename:
                raw_filename = f"uploaded_handbook_{int(time.time())}.pdf"

            pdf_bytes = body

            # If multipart/form-data, extract raw PDF boundary
            if "multipart/form-data" in content_type:
                boundary_match = content_type.split("boundary=")
                if len(boundary_match) > 1:
                    boundary = boundary_match[1].strip().encode('utf-8')
                    parts = body.split(b"--" + boundary)
                    for p in parts:
                        if b"%PDF" in p:
                            pdf_start = p.find(b"%PDF")
                            pdf_bytes = p[pdf_start:]
                            # Strip trailing CRLF
                            if pdf_bytes.endswith(b"\r\n"):
                                pdf_bytes = pdf_bytes[:-2]
                            break

            # Save uploaded PDF
            safe_name = os.path.basename(raw_filename)
            saved_pdf_path = os.path.join(HANDBOOKS_DIR, safe_name)
            with open(saved_pdf_path, "wb") as f:
                f.write(pdf_bytes)

            print(f"Saved uploaded PDF to {saved_pdf_path} ({len(pdf_bytes)} bytes)")

            # Run universal parser
            try:
                parsed_res = parse_pdf_file(saved_pdf_path)
                deg_id = save_degree_data(parsed_res, DEGREES_DIR)

                # Rebuild degrees index
                self.rebuild_degrees_index()

                self.send_json_response({
                    "success": True,
                    "id": deg_id,
                    "degree": parsed_res["degree"],
                    "moduleCount": parsed_res["degree"]["moduleCount"]
                })
            except Exception as e:
                print(f"Error parsing uploaded handbook: {e}")
                self.send_json_response({"success": False, "error": str(e)}, status=500)
            return

        self.send_error(404, "Endpoint Not Found")

    def rebuild_degrees_index(self):
        index = []
        for item in sorted(os.listdir(DEGREES_DIR)):
            deg_json = os.path.join(DEGREES_DIR, item, "degree.json")
            if os.path.isfile(deg_json):
                try:
                    with open(deg_json, "r", encoding="utf-8") as f:
                        deg = json.load(f)
                    index.append({
                        "id": deg["id"],
                        "title": deg["title"],
                        "spo": deg["spo"],
                        "term": deg["term"],
                        "faculty": deg["faculty"],
                        "totalCredits": deg["totalCredits"],
                        "semestersCount": deg["semestersCount"],
                        "moduleCount": deg["moduleCount"],
                        "specializations": deg.get("specializations", []),
                        "categories": deg.get("categories", [])
                    })
                except Exception:
                    pass
        index_file = os.path.join(DEGREES_DIR, "degrees_index.json")
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)

    def serve_json_file(self, filepath, fallback):
        if os.path.exists(filepath):
            try:
                with open(filepath, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            except Exception:
                pass
        self.send_json_response(fallback)

    def send_json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def run(port=PORT):
    server_address = ("", port)
    httpd = HTTPServer(server_address, UniversalPlannerHandler)
    print(f"Universal KIT Study Planner server running at http://localhost:{port}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()

if __name__ == "__main__":
    run()
