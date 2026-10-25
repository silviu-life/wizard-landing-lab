"""Landing lab server: intake, clarifying questions, variant rounds, feedback and the winner export.

Run: uv run server.py --workspace DIR [--port 8790] [--host 127.0.0.1] [--assets DIR] [--open]
If the port is taken it uses the next free one; the first line printed has the real URL.

Everything lives on disk in the workspace so agents and the dashboard only share files:
  brief.json, questions.json, answers.json, uploads/, rounds/<n>/{plan.json,<slug>/,feedback.json},
  winner.json, winner/
"""
import argparse
import io
import json
import platform
import re
import shutil
import subprocess
import sys
import webbrowser
import zipfile
from base64 import b64decode
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

DASHBOARD = Path(__file__).resolve().parent.parent / "assets" / "dashboard.html"
MAX_UPLOAD = 25 * 1024 * 1024
REF = re.compile(r"/(uploads|assets)/([^\"')\s?#]+)")


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def inside(root, relative):
    target = (root / unquote(relative)).resolve()
    return target if target.is_relative_to(root.resolve()) else None


class Lab:
    def __init__(self, workspace, assets):
        self.ws = workspace
        self.assets = assets
        self.uploads = workspace / "uploads"
        self.rounds = workspace / "rounds"
        self.uploads.mkdir(parents=True, exist_ok=True)
        self.rounds.mkdir(exist_ok=True)

    def state(self):
        return {
            "workspace": str(self.ws),
            "brief": read_json(self.ws / "brief.json"),
            "questions": read_json(self.ws / "questions.json"),
            "answers": read_json(self.ws / "answers.json"),
            "rounds": self.round_list(),
            "winner": read_json(self.ws / "winner.json"),
            "assets": sorted(p.name for p in self.assets.glob("*") if p.is_file()) if self.assets else [],
        }

    def round_list(self):
        result = []
        dirs = [d for d in self.rounds.glob("*") if d.is_dir() and d.name.isdigit()]
        for d in sorted(dirs, key=lambda d: int(d.name)):
            plan = read_json(d / "plan.json") or {}
            variants = []
            for v in plan.get("variants", []):
                folder = d / v["slug"]
                ready = (folder / "index.html").exists() and (folder / "meta.json").exists()
                variants.append({**v, **(read_json(folder / "meta.json") or {}), "ready": ready})
            result.append({
                "round": int(d.name),
                "summary": plan.get("summary", ""),
                "variants": variants,
                "feedback": read_json(d / "feedback.json"),
            })
        return result

    def save_upload(self, name, data_url):
        data = b64decode(data_url.split(",", 1)[1])
        if len(data) > MAX_UPLOAD:
            raise ValueError("Fișierul e prea mare (maximum 25 MB)")
        safe = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name).name).strip("-.") or "file"
        n = len(list(self.uploads.iterdir())) + 1
        path = self.uploads / f"{n:03d}-{safe}"
        path.write_bytes(data)
        return f"/uploads/{path.name}"

    def export_winner(self, round_no, slug):
        source = self.rounds / str(round_no) / slug
        target = self.ws / "winner"
        shutil.rmtree(target, ignore_errors=True)
        target.mkdir()
        html = (source / "index.html").read_text(encoding="utf-8")
        # The winner must open from any folder, so referenced files are copied next to it and linked relatively.
        for kind, name in set(REF.findall(html)):
            root = self.uploads if kind == "uploads" else self.assets
            file = root and inside(root, name)
            if file and file.is_file():
                (target / kind).mkdir(exist_ok=True)
                shutil.copy2(file, target / kind / file.name)
        (target / "index.html").write_text(REF.sub(lambda m: f"{m[1]}/{Path(unquote(m[2])).name}", html), encoding="utf-8")
        meta = read_json(source / "meta.json") or {}
        winner = {"round": round_no, "slug": slug, "title": meta.get("title", slug), "path": str(target / "index.html")}
        (self.ws / "winner.json").write_text(json.dumps(winner, indent=2), encoding="utf-8")

    def winner_zip(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
            for file in (self.ws / "winner").rglob("*"):
                if file.is_file():
                    z.write(file, file.relative_to(self.ws / "winner"))
        return buffer.getvalue()


def make_handler(lab):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(lab.ws), **kwargs)

        def log_message(self, *args):
            pass

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def translate_path(self, path):
            clean = urlparse(path).path
            if clean.startswith("/assets/") and lab.assets:
                return str(inside(lab.assets, clean[len("/assets/"):]) or lab.ws / "missing")
            if clean.split("/")[1] in ("rounds", "uploads", "winner"):
                return super().translate_path(path)
            return str(lab.ws / "missing")

        def send_bytes(self, data, content_type, status=200, extra=None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(data)

        def send_json(self, body, status=200):
            self.send_bytes(json.dumps(body).encode(), "application/json", status)

        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/":
                return self.send_bytes(DASHBOARD.read_bytes(), "text/html; charset=utf-8")
            if path == "/api/state":
                return self.send_json(lab.state())
            if path == "/api/winner.zip" and (lab.ws / "winner").is_dir():
                return self.send_bytes(lab.winner_zip(), "application/zip", extra={"Content-Disposition": 'attachment; filename="winner.zip"'})
            return super().do_GET()

        def do_POST(self):
            path = urlparse(self.path).path
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_UPLOAD * 2:
                return self.send_json({"error": "Fișierul e prea mare (maximum 25 MB)"}, 413)
            try:
                body = json.loads(self.rfile.read(length))
            except ValueError:
                return self.send_json({"error": "Date invalide"}, 400)

            if path == "/api/upload":
                try:
                    return self.send_json({"path": lab.save_upload(body["name"], body["data"])})
                except (KeyError, IndexError, ValueError) as error:
                    return self.send_json({"error": str(error)}, 400)
            if path in ("/api/brief", "/api/answers"):
                (lab.ws / f"{path.rsplit('/', 1)[1]}.json").write_text(json.dumps(body, indent=2), encoding="utf-8")
                return self.send_json({"ok": True})

            match = re.fullmatch(r"/api/rounds/(\d+)/feedback", path)
            if match and (lab.rounds / match[1]).is_dir():
                round_no = int(match[1])
                if body.get("chosen"):
                    if not (lab.rounds / match[1] / body["chosen"] / "index.html").exists():
                        return self.send_json({"error": "Pagină necunoscută"}, 400)
                    lab.export_winner(round_no, body["chosen"])
                # Written last: wait.py watches for this file, so the winner export must already be on disk.
                (lab.rounds / match[1] / "feedback.json").write_text(json.dumps(body, indent=2), encoding="utf-8")
                return self.send_json({"ok": True})
            return self.send_json({"error": "Nu există"}, 404)

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--assets", type=Path, help="existing image folder served at /assets/ (e.g. the project's public/img)")
    parser.add_argument("--open", action="store_true", help="open the dashboard in the default browser")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    lab = Lab(args.workspace.resolve(), args.assets.resolve() if args.assets else None)
    # On Windows SO_REUSEADDR lets a second server share a busy port silently, so only reuse addresses elsewhere.
    ThreadingHTTPServer.allow_reuse_address = sys.platform != "win32"
    for port in range(args.port, args.port + 50):
        try:
            server = ThreadingHTTPServer((args.host, port), make_handler(lab))
            break
        except OSError:
            continue
    else:
        sys.exit(f"No free port between {args.port} and {args.port + 49}")
    url = f"http://localhost:{port}"
    print(f"Landing lab on {url} (workspace {lab.ws})", flush=True)
    if args.open:
        if "microsoft" in platform.uname().release.lower():  # WSL: the browser lives on the Windows side
            subprocess.run(["cmd.exe", "/c", "start", "", url], stderr=subprocess.DEVNULL)
        else:
            webbrowser.open(url)
    server.serve_forever()
