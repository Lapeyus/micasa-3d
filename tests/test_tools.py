"""Pruebas de las herramientas de tools/ y de la integridad de casa.default.json.

Sin red externa ni Blender. Correr desde la raíz del repo:
  .venv/bin/python -m unittest discover -s tests -v
"""
import http.client
import json
import pathlib
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
CASA = ROOT / "src/core/casa.default.json"
sys.path.insert(0, str(ROOT / "tools"))


class CasaDefaultTest(unittest.TestCase):
    """Integridad referencial del borrador que se publica con la app."""

    @classmethod
    def setUpClass(cls):
        cls.casa = json.loads(CASA.read_text())

    def test_campos_raiz(self):
        for k in ("version", "revision", "units", "defaults", "rooms", "openings", "fixtures",
                  "outdoor", "roofs", "panoramas"):
            self.assertIn(k, self.casa)
        self.assertEqual(self.casa["units"], "m")
        for k in ("wallThickness", "ceiling", "doorHeight", "wallColor", "floor", "ceilingFinish"):
            self.assertIn(k, self.casa["defaults"])

    def test_ids_unicos_por_coleccion(self):
        for col in ("rooms", "openings", "fixtures", "outdoor", "roofs", "panoramas"):
            ids = [x["id"] for x in self.casa[col]]
            self.assertEqual(len(ids), len(set(ids)), f"ids repetidos en {col}")

    def test_rectangulos_bien_formados(self):
        def rects():
            for r in self.casa["rooms"]:
                yield r["id"], r["rect"]
                for p in r.get("parts", []):
                    yield r["id"], p
            for col in ("fixtures", "outdoor", "roofs"):
                for x in self.casa[col]:
                    yield x["id"], x["rect"]
        for ident, rc in rects():
            self.assertEqual(len(rc), 4, ident)
            self.assertLess(rc[0], rc[2], f"{ident}: x0 >= x1")
            self.assertLess(rc[1], rc[3], f"{ident}: z0 >= z1")

    def test_referencias(self):
        cuartos = {r["id"] for r in self.casa["rooms"]}
        # 'lote' es el valor especial «Lote (perímetro)» que ofrece el inspector (src/app.js)
        areas = cuartos | {o["id"] for o in self.casa["outdoor"]} | {"lote"}
        for o in self.casa["openings"]:
            self.assertIn(o["room"], cuartos, o["id"])
            self.assertIn(o["side"], ("S", "N", "W", "E"), o["id"])
            self.assertGreater(o["width"], 0, o["id"])
        for f in self.casa["fixtures"]:
            self.assertIn(f["room"], areas, f["id"])
        for p in self.casa["panoramas"]:
            self.assertEqual(len(p["at"]), 2, p["id"])
            self.assertTrue(p["file"].lower().endswith(".jpg"), p["id"])

    def test_techos(self):
        for rf in self.casa["roofs"]:
            self.assertIn(rf["kind"], ("hip", "gable"), rf["id"])
            if "ridge" in rf:
                self.assertIn(rf["ridge"], ("x", "z"), rf["id"])


class PanoPeriodTest(unittest.TestCase):
    """tools/pano_period.py sobre imágenes sintéticas (sin fotos reales)."""

    @classmethod
    def setUpClass(cls):
        try:
            import cv2  # noqa: F401
            import numpy  # noqa: F401
        except ImportError as e:  # pragma: no cover
            raise unittest.SkipTest(f"falta dependencia: {e}")
        import pano_period
        cls.pp = pano_period

    def _imagen(self, periodo, ancho, alto=400, semilla=1):
        import cv2
        import numpy as np
        rng = np.random.default_rng(semilla)
        base = rng.integers(0, 256, size=(alto // 8, periodo // 8), dtype=np.uint8)
        base = cv2.resize(base, (periodo, alto), interpolation=cv2.INTER_NEAREST)
        reps = -(-ancho // periodo)
        return np.tile(base, (1, reps))[:, :ancho]

    def test_detecta_el_periodo_de_una_imagen_que_se_repite(self):
        import cv2
        periodo, ancho = 4000, 5600
        with tempfile.TemporaryDirectory() as d:
            ruta = str(pathlib.Path(d) / "sintetica.jpg")
            cv2.imwrite(ruta, self._imagen(periodo, ancho))
            r = self.pp.period(ruta)
        self.assertEqual((r["width"], r["height"]), (ancho, 400))
        self.assertIsNotNone(r["period"])
        self.assertLessEqual(abs(r["period"] - periodo), 16)
        self.assertGreaterEqual(r["votes"], 2)

    def test_sin_repeticion_no_inventa_periodo(self):
        import cv2
        import numpy as np
        rng = np.random.default_rng(7)
        img = cv2.resize(rng.integers(0, 256, size=(50, 700), dtype=np.uint8), (5600, 400),
                         interpolation=cv2.INTER_NEAREST)
        with tempfile.TemporaryDirectory() as d:
            ruta = str(pathlib.Path(d) / "ruido.jpg")
            cv2.imwrite(ruta, img)
            r = self.pp.period(ruta)
        self.assertIsNone(r["period"])
        self.assertEqual(r["votes"], 0)


def _puerto_libre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ServeTest(unittest.TestCase):
    """tools/serve.py en 127.0.0.1: sin caché y PUT /__save/ limitado a assets/."""

    @classmethod
    def setUpClass(cls):
        cls.port = _puerto_libre()
        cls.proc = subprocess.Popen([sys.executable, str(ROOT / "tools/serve.py"), str(cls.port)],
                                    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                socket.create_connection(("127.0.0.1", cls.port), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        cls.carpeta = ROOT / "assets" / f"_prueba-{uuid.uuid4().hex[:8]}"

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=5)
        if cls.carpeta.exists():
            for f in cls.carpeta.iterdir():
                f.unlink()
            cls.carpeta.rmdir()

    def _req(self, metodo, ruta, cuerpo=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request(metodo, ruta, body=cuerpo)
        r = c.getresponse()
        datos = r.read()
        c.close()
        return r, datos

    def test_get_sin_cache(self):
        r, _ = self._req("GET", "/index.html")
        self.assertEqual(r.status, 200)
        self.assertEqual(r.getheader("Cache-Control"), "no-store")

    def test_put_guarda_dentro_de_assets(self):
        ruta = f"/__save/{self.carpeta.name}/x.bin"
        r, datos = self._req("PUT", ruta, b"\x00\x01glb")
        self.assertEqual(r.status, 201)
        self.assertEqual((self.carpeta / "x.bin").read_bytes(), b"\x00\x01glb")
        self.assertEqual(datos.decode(), f"assets/{self.carpeta.name}/x.bin")

    def test_put_fuera_de_assets_se_rechaza(self):
        r, _ = self._req("PUT", "/__save/../tests/no-deberia.txt", b"x")
        self.assertEqual(r.status, 403)
        self.assertFalse((ROOT / "tests/no-deberia.txt").exists())

    def test_put_en_otra_ruta_da_404(self):
        r, _ = self._req("PUT", "/index.html", b"x")
        self.assertEqual(r.status, 404)


if __name__ == "__main__":
    unittest.main()
