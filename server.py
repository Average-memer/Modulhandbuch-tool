#!/usr/bin/env python3
"""
Lightweight HTTP Server for KIT M.Sc. ETIT Degree Planner & Modulhandbuch Tool.
Runs with zero external dependencies (Python 3 standard library only).
"""

import os
import sys
import json
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "data")

class PlannerRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API Endpoints
        if path == "/api/modules":
            self.serve_json_file(os.path.join(DATA_DIR, "modules.json"), fallback={})
            return

        if path == "/api/specializations":
            self.serve_json_file(os.path.join(DATA_DIR, "specializations.json"), fallback=[])
            return

        if path == "/api/rules":
            self.serve_json_file(os.path.join(DATA_DIR, "rules.json"), fallback={})
            return

        # Static files in public/
        if path == "/" or path == "":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        else:
            rel_path = path.lstrip("/")
            file_path = os.path.join(PUBLIC_DIR, rel_path)

        # Normalize and prevent directory traversal
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
            except Exception as e:
                pass
        fallback_bytes = json.dumps(fallback).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(fallback_bytes)))
        self.end_headers()
        self.wfile.write(fallback_bytes)

def run(port=PORT):
    server_address = ("", port)
    httpd = HTTPServer(server_address, PlannerRequestHandler)
    print(f"KIT ETIT Study Planner server running at http://localhost:{port}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()

if __name__ == "__main__":
    run()
