"""Servidor local sin caché para desarrollo: python3 tools/serve.py [puerto]

Además acepta PUT /__save/<ruta> para guardar archivos generados por la app
(por ejemplo el .glb para Blender). Solo escribe dentro de assets/.
"""
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_PUT(self):
        if not self.path.startswith("/__save/"):
            self.send_error(404)
            return
        target = (ASSETS / self.path[len("/__save/"):]).resolve()
        if ASSETS.resolve() not in target.parents:
            self.send_error(403, "Solo se puede guardar dentro de assets/")
            return
        length = int(self.headers.get("Content-Length", 0))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(self.rfile.read(length))
        self.send_response(201)
        self.end_headers()
        self.wfile.write(str(target.relative_to(ROOT)).encode())


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
