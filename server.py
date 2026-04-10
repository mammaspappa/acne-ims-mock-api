#!/usr/bin/env python3
import http.server
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

print(f"Russian Roulette server running at http://localhost:{PORT}")
http.server.HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
