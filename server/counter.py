"""Tiny visit counter server — stores counts in a JSON file."""
import json
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'counter.json')
PORT = 8199


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    return {"total": 0}


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    tmp = DATA_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f)
    os.replace(tmp, DATA_FILE)


class CounterHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/counter':
            data = load_data()
            self._json({"total": data["total"]})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/api/counter':
            data = load_data()
            data["total"] += 1
            save_data(data)
            self._json({"total": data["total"]})
        else:
            self.send_error(404)

    def _json(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # silence access logs


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), CounterHandler)
    print(f'Counter server on 127.0.0.1:{PORT}')
    server.serve_forever()
