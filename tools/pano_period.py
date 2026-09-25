"""Mide el periodo de 360° de cada panorámica (dónde la imagen vuelve a empezar).

Busca varias franjas del inicio de la imagen dentro del resto y toma el consenso.
El periodo P (px de la imagen original) da la focal del cilindro: f = P / 2π.
Uso: .venv/bin/python tools/pano_period.py panoramas/*.jpg
"""
import json
import sys

import cv2
import numpy as np

SCALE = 0.125


def prep(img):
    g = cv2.GaussianBlur(img, (3, 3), 0).astype(np.float32)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)
    return cv2.magnitude(gx, gy)


def period(path):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    h, w = img.shape
    small = cv2.resize(img, (int(w * SCALE), int(h * SCALE)), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape
    band = prep(small)[int(sh * 0.2): int(sh * 0.8)]
    tw = max(30, int(sw * 0.025))
    cands = []
    for x0 in [int(sw * f) for f in (0.005, 0.03, 0.06, 0.09, 0.12)]:
        tpl = band[:, x0:x0 + tw]
        start = x0 + int(sw * 0.35)
        region = band[:, start:]
        if region.shape[1] <= tw:
            continue
        res = cv2.matchTemplate(region, tpl, cv2.TM_CCOEFF_NORMED)[0]
        i = int(np.argmax(res))
        cands.append((start + i - x0, float(res[i])))
    good = [c for c in cands if c[1] > 0.5]
    if len(good) >= 2:
        ps = np.array([c[0] for c in good])
        med = np.median(ps)
        agree = [c for c in good if abs(c[0] - med) <= 3]
        if len(agree) >= 2:
            p = float(np.mean([c[0] for c in agree])) / SCALE
            return {"width": w, "height": h, "period": round(p), "votes": len(agree),
                    "score": round(float(np.mean([c[1] for c in agree])), 3)}
    return {"width": w, "height": h, "period": None, "votes": 0,
            "cands": [(round(c[0] / SCALE), round(c[1], 2)) for c in cands]}


if __name__ == "__main__":
    out = {}
    for p in sys.argv[1:]:
        r = period(p)
        r["f"] = round(r["period"] / (2 * np.pi), 1) if r["period"] else None
        name = p.split("/")[-1]
        out[name] = r
        print(name, r)
    json.dump(out, open("tools/pano_period.json", "w"), indent=1)
