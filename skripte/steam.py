"""
Prebere moj seznam želja s Steama in ga shrani v podatki/igre.json.

GitHub Actions ga zažene vsak dan (glej .github/workflows/objavi.yml).
Doma ga lahko zaženeš z:  python skripte/steam.py
"""

import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MAPA = Path(__file__).resolve().parent.parent
NASTAVITVE = MAPA / "podatki" / "nastavitve.json"
IZHOD = MAPA / "podatki" / "igre.json"


def prenesi(url):
    for poskus in range(3):
        try:
            zahteva = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (seznam-zelja)"})
            with urllib.request.urlopen(zahteva, timeout=30) as odgovor:
                return odgovor.read().decode("utf-8")
        except urllib.error.HTTPError as napaka:
            # 429 = prehitro sprašujem, malo počakam
            if napaka.code == 429 and poskus < 2:
                print("Steam pravi, da sprašujem prehitro. Čakam 60 sekund ...")
                time.sleep(60)
            else:
                raise


def najdi_steam_id(profil):
    """Iz povezave do profila dobi 17-mestni Steam ID."""
    profil = (profil or "").strip()
    if re.fullmatch(r"\d{17}", profil):
        return profil
    m = re.search(r"/profiles/(\d{17})", profil)
    if m:
        return m.group(1)
    m = re.search(r"/id/([^/?#]+)", profil)
    if m:
        xml = prenesi(f"https://steamcommunity.com/id/{m.group(1)}/?xml=1")
        m2 = re.search(r"<steamID64>(\d{17})</steamID64>", xml)
        if m2:
            return m2.group(1)
    return None


def seznam_zelja(steam_id):
    podatki = json.loads(prenesi(f"https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid={steam_id}"))
    predmeti = podatki.get("response", {}).get("items", [])
    # najprej po mojem vrstnem redu na Steamu
    predmeti.sort(key=lambda p: (p.get("priority") or 999999, -p.get("date_added", 0)))
    return predmeti


def brez_html(besedilo):
    besedilo = re.sub(r"<[^>]+>", " ", besedilo or "")
    return re.sub(r"\s+", " ", html.unescape(besedilo)).strip()


def podrobnosti(appid):
    podatki = json.loads(prenesi(f"https://store.steampowered.com/api/appdetails?appids={appid}&cc=si&l=english"))
    vnos = podatki.get(str(appid)) or {}
    if not vnos.get("success"):
        return None
    d = vnos["data"]
    cena = d.get("price_overview") or {}
    izid = d.get("release_date") or {}
    return {
        "appid": appid,
        "ime": d.get("name", f"Igra {appid}"),
        "slika": d.get("header_image", ""),
        "brezplacna": bool(d.get("is_free")),
        "cena": cena["final"] / 100 if "final" in cena else None,
        "cenaPrej": cena["initial"] / 100 if cena.get("discount_percent") else None,
        "popust": cena.get("discount_percent", 0),
        "zvrsti": [z["description"] for z in d.get("genres", [])][:3],
        "opis": brez_html(d.get("short_description")),
        "izid": izid.get("date", ""),
        "kmalu": bool(izid.get("coming_soon")),
    }


def shrani(igre, steam_id=None):
    podatki = {
        "posodobljeno": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "steamId": steam_id,
        "igre": igre,
    }
    IZHOD.write_text(json.dumps(podatki, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Shranjeno {len(igre)} iger v {IZHOD.name}")


def main():
    nastavitve = json.loads(NASTAVITVE.read_text(encoding="utf-8"))
    profil = nastavitve.get("steamProfil", "")
    if not profil:
        print("V nastavitvah ni Steam profila, zato je seznam iger prazen.")
        shrani([])
        return

    steam_id = najdi_steam_id(profil)
    if not steam_id:
        sys.exit("Iz povezave ne najdem Steam ID-ja: " + profil)

    predmeti = seznam_zelja(steam_id)
    if not predmeti:
        print("Seznam želja je prazen ali ni javen.")

    igre = []
    for i, predmet in enumerate(predmeti, 1):
        appid = predmet["appid"]
        try:
            igra = podrobnosti(appid)
        except Exception as napaka:
            print(f"  {appid}: napaka ({napaka}), preskočim")
            igra = None
        if igra:
            igre.append(igra)
            print(f"  {i}/{len(predmeti)} {igra['ime']}")
        time.sleep(1.5)  # da Steam ne misli, da ga napadam

    shrani(igre, steam_id)


if __name__ == "__main__":
    main()
