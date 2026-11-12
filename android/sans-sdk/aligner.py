#!/usr/bin/env python3
"""Réécrit un APK : les fichiers stockés sans compression (resources.arsc…) alignés sur 4 octets, comme zipalign,
et classes.dex ajouté. python3 aligner.py entree.apk classes.dex sortie.apk"""
import sys, zipfile
src, dex, out = sys.argv[1], sys.argv[2], sys.argv[3]
STORE = (".arsc", ".png", ".so")
with zipfile.ZipFile(src) as zin, open(out, "wb") as f:
    zout = zipfile.ZipFile(f, "w")
    items = [(i, zin.read(i.filename)) for i in zin.infolist()]
    items.append((zipfile.ZipInfo("classes.dex"), open(dex, "rb").read()))
    for info, data in items:
        zi = zipfile.ZipInfo(info.filename, date_time=(2026, 1, 1, 0, 0, 0))
        stored = info.filename.endswith(STORE) or info.filename == "resources.arsc"
        zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
        if stored:
            # l'en-tête local fait 30 octets + nom + extra : on rembourre l'extra pour aligner les données
            off = f.tell() + 30 + len(zi.filename.encode())
            zi.extra = b"\0" * ((4 - off % 4) % 4)
        zout.writestr(zi, data)
    zout.close()
