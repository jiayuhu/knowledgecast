"""
MarkItDown HTTP 包装服务
启动: python scripts/markitdown-server.py --port 3001
"""

import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from markitdown import MarkItDown
from urllib.parse import urlparse


class Handler(BaseHTTPRequestHandler):
    md = MarkItDown()

    def do_POST(self):
        if self.path != "/convert":
            self.send_error(404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            url = data.get("url", "")

            if not url:
                self.send_error(400, "Missing 'url' field")
                return

            result = self.md.convert_uri(url)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "content": result.text_content,
                    "title": getattr(result, "title", None)
                }, ensure_ascii=False).encode("utf-8")
            )
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                json.dumps({"error": str(e)}).encode("utf-8")
            )

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        print(f"[markitdown] {args[0]}", flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3001)
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), Handler)
    print(f"[markitdown] listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
