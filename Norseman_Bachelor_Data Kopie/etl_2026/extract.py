"""
Extract-Schritt: holt Metadaten und Split-Zeiten automatisch von RACE RESULT.

Ersetzt das manuelle Heraussuchen der Event- und Split-IDs im Browser.

Wichtig (2026 im Browser verifiziert)
-------------------------------------
Die Ergebnislisten unter ``data/list`` enthalten NUR die Leg-Zeiten
(Swim/T1/Bike/T2/Run). Die 37 Aid-Station-Splits liegen ausschliesslich in der
Athleten-Detailansicht:

    GET /<event>/details/view?pid=<recordid>&standalone=1&noVisitor=1&lang=en
    -> Data.SplitsAndLegs.Splits = [{Name, Exists, TOD, Gun, Sector, RG}, ...]

``Gun`` ist die kumulierte Rennzeit, ``RG`` der Rang an dieser Station.
Diese Datei holt beides und baut daraus eine synthetische Ergebnisliste im
RACE-RESULT-Format, damit transform.py unveraendert weiterarbeiten kann.

Zweiter Fallstrick: der ``contest``-Parameter aus der Config funktioniert bei
den Listen nicht - es muss ``contest=0`` gesetzt werden, sonst 404.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

from config import KNOWN_EVENT_IDS, RAW_DIR, ensure_dirs

BASE = "https://my.raceresult.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT = 60
DETAIL_WORKERS = 6

# Name der synthetischen Liste, die transform.py auswertet
SYNTHETIC_LIST = "__details__|Splits aus der Detailansicht"


class ExtractError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _get_json(sess: requests.Session, url: str, params: dict | None = None) -> Any:
    resp = sess.get(url, params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    if not resp.text.strip():
        raise ExtractError(f"Leere Antwort von {url}")
    try:
        return resp.json()
    except ValueError as exc:
        raise ExtractError(f"Keine gueltige JSON-Antwort von {url}: {resp.text[:200]}") from exc


# ---------------------------------------------------------------------------
# Event-ID
# ---------------------------------------------------------------------------

EVENT_ID_RE = re.compile(r"(?:my\.)?raceresult\.com/(\d{4,8})")

DISCOVERY_PAGES = [
    "https://racetracker.no/events/{year}/norseman-xtreme-triathlon/",
    "https://www.nxtri.com/raceday-front",
    "https://www.nxtri.com/how-to-follow-norseman-on-race-day",
    "https://www.nxtri.com/",
]


def fetch_config(sess: requests.Session, event_id: int, page: str = "results") -> dict:
    url = f"{BASE}/{event_id}/RRPublish/data/config"
    return _get_json(sess, url, {"page": page, "noVisitor": 1})


def verify_event(sess: requests.Session, event_id: int, year: int) -> dict | None:
    try:
        cfg = fetch_config(sess, event_id)
    except Exception:
        return None
    name = str(cfg.get("eventname", ""))
    if "norseman" not in name.lower():
        return None
    if str(year) not in name:
        cfg["_weak_match"] = True
    return cfg


def discover_event_id(year: int, sess: requests.Session | None = None) -> tuple[int, dict]:
    sess = sess or _session()

    if year in KNOWN_EVENT_IDS:
        cfg = verify_event(sess, KNOWN_EVENT_IDS[year], year)
        if cfg:
            return KNOWN_EVENT_IDS[year], cfg

    tried: set[int] = set()
    weak: tuple[int, dict] | None = None

    for template in DISCOVERY_PAGES:
        try:
            resp = sess.get(template.format(year=year), timeout=TIMEOUT)
            resp.raise_for_status()
        except Exception:
            continue
        for candidate in dict.fromkeys(int(m.group(1)) for m in EVENT_ID_RE.finditer(resp.text)):
            if candidate in tried:
                continue
            tried.add(candidate)
            cfg = verify_event(sess, candidate, year)
            if cfg is None:
                continue
            if cfg.get("_weak_match"):
                weak = weak or (candidate, cfg)
                continue
            return candidate, cfg

    if weak:
        return weak

    raise ExtractError(
        f"Keine RACE-RESULT-Event-ID fuer {year} gefunden (getestet: {sorted(tried) or 'keine'}). "
        f"Mit --event-id manuell setzen; die ID steht in der URL von my.raceresult.com/<ID>/results."
    )


# ---------------------------------------------------------------------------
# Ergebnislisten
# ---------------------------------------------------------------------------

LIST_PATHS = ("RRPublish/data/list", "results/list")


def fetch_list(sess, event_id: int, key: str, listname: str, contest: int | str = 0,
               page: str = "results") -> Any:
    """Ergebnisliste laden.

    RACE RESULT bedient zwei Pfade parallel: den aelteren ``RRPublish/data/list``
    und den neueren ``results/list``, den die Weboberflaeche selbst benutzt.
    Beide werden probiert, damit ein Umbau auf Anbieterseite nichts bricht.
    """
    params = {
        "key": key, "listname": listname, "page": page,
        "contest": contest, "r": "all", "l": 0,
    }
    last_error: Exception | None = None
    for path in LIST_PATHS:
        try:
            data = _get_json(sess, f"{BASE}/{event_id}/{path}", params)
            if isinstance(data, dict) and data.get("error"):
                last_error = ExtractError(str(data["error"]))
                continue
            return data
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise last_error or ExtractError("Liste konnte nicht geladen werden")


def fetch_all_lists(sess, event_id: int, cfg: dict, page: str = "results") -> dict:
    """Laedt jede Liste. contest=0 ist der funktionierende Wert; der Wert aus der
    Config wird nur als Fallback probiert."""
    key = cfg["key"]
    out: dict[str, Any] = {}
    errors: dict[str, str] = {}

    for entry in cfg.get("lists", []):
        listname = entry["Name"]
        last_error = None
        for contest in (0, entry.get("Contest", 0)):
            try:
                data = fetch_list(sess, event_id, key, listname, contest, page)
                if isinstance(data, dict) and data.get("error"):
                    last_error = str(data["error"])
                    continue
                out[listname] = data
                break
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
        else:
            errors[listname] = last_error or "unbekannt"
        time.sleep(0.2)

    return {"lists": out, "errors": errors}


def _grouped_rows(list_json: dict) -> list[tuple[str, list]]:
    """Zeilen samt Gruppenueberschrift (die traegt bei RACE RESULT das Geschlecht)."""
    out: list[tuple[str, list]] = []

    def walk(node, group: str) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                walk(value, key)
        elif isinstance(node, list):
            if node and all(isinstance(x, list) for x in node):
                for item in node:
                    walk(item, group)
            elif node:
                out.append((group, node))

    walk(list_json.get("data"), "")
    return out


# ---------------------------------------------------------------------------
# Detailansicht: hier liegen die Aid-Station-Splits
# ---------------------------------------------------------------------------

def fetch_detail(sess, event_id: int, pid: str, attempts: int = 4) -> dict:
    """Detailansicht mit Wiederholung.

    Bei ~250 Abrufen kurz hintereinander drosselt RACE RESULT gelegentlich.
    Ohne Wiederholung fehlen dann einzelne Athleten komplett - und ein
    fehlender Athlet ist schlimmer als ein paar Sekunden Wartezeit.
    """
    url = f"{BASE}/{event_id}/details/view"
    params = {"pid": pid, "standalone": 1, "noVisitor": 1, "lang": "en"}
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return _get_json(sess, url, params)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise last_error or ExtractError(f"Detailansicht {pid} nicht ladbar")


def _detail_fields(detail: dict) -> dict:
    """Name, Nation und Club aus dem gerenderten Element-Baum ziehen."""
    values: dict[str, str] = {}

    def walk(node) -> None:
        if node is None:
            return
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        cfg = node.get("Config") or {}
        if cfg.get("Field") is not None:
            title = cfg.get("Title") or ""
            value = str(cfg["Field"])
            key = title or "__name"
            values.setdefault(key, value)  # erstes Vorkommen gewinnt
        walk(node.get("Children"))

    walk(detail.get("Elements"))

    nation = values.get("Nation", "")
    match = re.search(r"flags/([A-Za-z]{2,3})\.", nation)
    return {
        "name": values.get("__name", "").strip(),
        "country": (match.group(1).upper() if match else ""),
        "club": values.get("Club", "").strip(),
        "overall_time": values.get("Time", "").strip(),
    }


def fetch_all_details(sess, event_id: int, pids: list[str]) -> dict[str, dict]:
    """Detailansicht fuer alle Athleten - parallel, aber hoeflich."""
    results: dict[str, dict] = {}
    failed: list[str] = []

    def one(pid: str):
        try:
            detail = fetch_detail(sess, event_id, pid)
        except Exception:
            failed.append(pid)
            return
        splits_legs = (detail.get("Data") or {}).get("SplitsAndLegs") or {}
        results[pid] = {
            **_detail_fields(detail),
            "splits": [
                {"name": s.get("Name"), "gun": s.get("Gun"), "rank": s.get("RG")}
                for s in (splits_legs.get("Splits") or [])
                if s.get("Exists")
            ],
            "legs": [
                {"name": s.get("Name"), "time": s.get("Time"), "rank": s.get("RG")}
                for s in (splits_legs.get("Legs") or [])
                if s.get("Exists")
            ],
        }

    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS) as pool:
        list(pool.map(one, pids))

    if failed:
        print(f"[extract] WARNUNG: {len(failed)} Detailseiten trotz Wiederholung nicht "
              f"ladbar: {failed[:10]}")
        print("[extract] Diese Athleten fehlen im Ergebnis - Lauf bitte wiederholen.")
    return results


# ---------------------------------------------------------------------------
# Synthetische Ergebnisliste bauen
# ---------------------------------------------------------------------------

_GENDER_RE = re.compile(r"(women|female|kvinner|damen|\bw\b|\bf\b)", re.I)
_MALE_RE = re.compile(r"(men|male|menn|herren|\bm\b)", re.I)


def _identity_from_lists(lists: dict) -> tuple[dict[str, dict], list[str]]:
    """Startnummer -> {bib, name, gender, finish_type, country}.

    Schluessel ist bewusst die Startnummer und nicht die Datensatz-ID aus
    Spalte 0: ``details/view?pid=`` erwartet die Startnummer. Mit der
    Datensatz-ID bekommt man einen existierenden, aber falschen Athleten -
    ein Fehler, der ohne Namensabgleich unsichtbar bliebe.
    """
    identity: dict[str, dict] = {}
    order: list[str] = []

    for name, payload in lists.items():
        if not isinstance(payload, dict) or payload.get("error"):
            continue
        rows = _grouped_rows(payload)
        if not rows:
            continue

        groups = list(dict.fromkeys(g for g, _ in rows))
        gendered = any(_GENDER_RE.search(g) or _MALE_RE.search(g) for g in groups)

        for group, row in rows:
            if len(row) < 2 or not str(row[1]).strip().isdigit():
                continue
            bib = str(row[1]).strip()
            entry = identity.setdefault(bib, {"bib": bib, "record_id": str(row[0])})
            if bib not in order:
                order.append(bib)

            if not entry.get("name"):
                # Name = erste laengere, nicht-numerische Spalte
                for cell in row[2:6]:
                    text = str(cell or "")
                    if len(text) > 3 and not text.replace(".", "").isdigit() and "[img" not in text:
                        entry["name"] = text.split(" [")[0].strip()
                        break

            if gendered and not entry.get("gender"):
                if _GENDER_RE.search(group):
                    entry["gender"] = "F"
                elif _MALE_RE.search(group):
                    entry["gender"] = "M"
                # Die Finalliste enthaelt zwei Wertungen hintereinander:
                # erst Black Shirt (Frauen, Maenner), dann White Shirt.
                # 2026 sind das 25+133=158 Black (die 160er-Grenze) und 78 White.
                entry["finish_type"] = "Black" if groups.index(group) < 2 else "White"
                for cell in row:
                    text = str(cell or "")
                    if re.fullmatch(r"[A-Z]{3}", text.strip()):
                        entry.setdefault("country", text.strip())
                        break

    return identity, order


def _name_key(text: Any) -> frozenset:
    """Namen vergleichbar machen: Gross/Klein, Akzente und Reihenfolge egal."""
    normalised = unicodedata.normalize("NFKD", str(text or ""))
    normalised = "".join(c for c in normalised if not unicodedata.combining(c))
    tokens = re.findall(r"[a-z]+", normalised.lower())
    return frozenset(t for t in tokens if len(t) > 1)


def verify_identity(identity: dict[str, dict], details: dict[str, dict],
                    tolerance: float = 0.05) -> dict:
    """Prueft, ob Detailansicht und Ergebnisliste denselben Athleten meinen.

    Ohne diesen Abgleich faellt eine Verwechslung der Schluessel nicht auf:
    man bekommt fuer jede Anfrage plausible Splits, nur eben von der falschen
    Person. Genau das passiert, wenn man die Datensatz-ID statt der
    Startnummer als pid verwendet.
    """
    checked = mismatched = 0
    examples: list[str] = []

    for bib, detail in details.items():
        listed = (identity.get(bib) or {}).get("name")
        if not listed or not detail.get("name"):
            continue
        checked += 1
        a, b = _name_key(listed), _name_key(detail["name"])
        if a and b and not (a & b):
            mismatched += 1
            if len(examples) < 5:
                examples.append(f"Startnr. {bib}: Liste '{listed}' vs Detailseite '{detail['name']}'")

    rate = (mismatched / checked) if checked else 0.0
    result = {"checked": checked, "mismatched": mismatched, "rate": rate, "examples": examples}

    if checked and rate > tolerance:
        raise ExtractError(
            f"Namensabgleich fehlgeschlagen: {mismatched} von {checked} Athleten "
            f"({rate:.0%}) stimmen zwischen Ergebnisliste und Detailansicht nicht ueberein.\n"
            + "\n".join(f"  {e}" for e in examples)
            + "\nDas deutet darauf hin, dass die Detailseiten unter einem anderen "
              "Schluessel liegen als angenommen. Abbruch, bevor falsche Zeiten "
              "in die Master-Dateien wandern."
        )
    return result


def build_synthetic_list(cfg: dict, lists: dict, details: dict[str, dict]) -> dict:
    """Baut aus Detailansichten eine Liste im RACE-RESULT-Format."""
    identity, order = _identity_from_lists(lists)

    split_labels = [
        s["Label"] for s in cfg.get("splits", [])
        if s.get("SplitType") == 0 and s.get("Contest") == 1
    ]
    leg_labels = [
        s["Label"] for s in cfg.get("splits", [])
        if s.get("SplitType") == 9 and s.get("Contest") == 1
    ]

    id_labels = ["Bib", "Name", "M/F", "Nat", "Club", "Shirt", "Total time"]
    fields = [{"Label": label} for label in (*id_labels, *leg_labels, *split_labels)]

    keys = order or list(details)

    # Laendercodes: die Ergebnisliste nennt NOR/GER/USA, die Detailseite liefert
    # nur das zweistellige Flaggenkuerzel NO/DE/US. Die Zuordnung wird aus den
    # Athleten gelernt, bei denen beides vorliegt - so bleibt sie richtig, auch
    # wo IOC- und ISO-Code auseinanderlaufen (GER statt DEU, SUI statt CHE).
    alpha2_to_3: dict[str, str] = {}
    for key in keys:
        detail, ident = details.get(key), identity.get(key, {})
        if not detail:
            continue
        long_code, short_code = ident.get("country"), detail.get("country")
        if long_code and short_code and len(long_code) == 3 and len(short_code) == 2:
            alpha2_to_3.setdefault(short_code, long_code)

    rows = []
    for key in keys:
        detail = details.get(key)
        if not detail:
            continue
        ident = identity.get(key, {})
        pid = ident.get("record_id", key)
        splits = {s["name"]: s["gun"] for s in detail["splits"]}
        legs = {l["name"]: l["time"] for l in detail["legs"]}
        # Die offizielle Wertung aus der Finalliste hat Vorrang. Die Zielmatte
        # allein reicht nicht: 2026 haben 40 White-Shirt-Athleten die
        # Gausta-Matte passiert, waren aber ausserhalb der 160er-Grenze.
        shirt = ident.get("finish_type")
        if not shirt:
            if any("black finish" in str(n).lower() for n in splits):
                shirt = "Black"
            elif not detail.get("overall_time"):
                # Keine Wertung und keine Gesamtzeit -> aufgegeben.
                # 'DNF' ist der Wert, den auch 2018-2025 dafuer verwenden.
                shirt = "DNF"
            else:
                shirt = ""

        short_code = detail.get("country")
        country = ident.get("country") or alpha2_to_3.get(short_code, short_code)

        rows.append([
            pid,
            ident.get("bib"),
            ident.get("name") or detail.get("name"),
            ident.get("gender"),
            country,
            detail.get("club"),
            shirt,
            detail.get("overall_time"),
            *[legs.get(label) for label in leg_labels],
            *[splits.get(label) for label in split_labels],
        ])

    return {"list": {"ListName": SYNTHETIC_LIST, "Fields": fields}, "data": rows}


# ---------------------------------------------------------------------------
# Rohdaten sichern
# ---------------------------------------------------------------------------

def dump_raw(year: int, event_id: int, cfg: dict, lists: dict, tag: str | None = None) -> Path:
    ensure_dirs()
    stamp = tag or datetime.now().strftime("%Y%m%dT%H%M%S")
    target = RAW_DIR / f"{year}_{event_id}_{stamp}"
    target.mkdir(parents=True, exist_ok=True)

    (target / "config.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    (target / "lists.json").write_text(json.dumps(lists, ensure_ascii=False, indent=2), encoding="utf-8")
    (target / "meta.json").write_text(json.dumps({
        "year": year,
        "event_id": event_id,
        "eventname": cfg.get("eventname"),
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
        "n_splits": len(cfg.get("splits", [])),
        "lists_ok": sorted(lists.get("lists", {}).keys()),
        "lists_failed": lists.get("errors", {}),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def latest_raw(year: int) -> Path:
    candidates = sorted(RAW_DIR.glob(f"{year}_*"))
    if not candidates:
        raise ExtractError(f"Keine Rohdaten fuer {year} in {RAW_DIR}. Erst 'extract' laufen lassen.")
    return candidates[-1]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract(year: int, event_id: int | None = None, page: str = "results") -> Path:
    sess = _session()

    if event_id is None:
        event_id, cfg = discover_event_id(year, sess)
        print(f"[extract] Event-ID automatisch gefunden: {event_id} ({cfg.get('eventname')})")
    else:
        cfg = fetch_config(sess, event_id, page)
        print(f"[extract] Event-ID gesetzt: {event_id} ({cfg.get('eventname')})")

    print(f"[extract] {len(cfg.get('splits', []))} Split-Definitionen")

    blob = fetch_all_lists(sess, event_id, cfg, page)
    print(f"[extract] {len(blob['lists'])} Liste(n) geladen, {len(blob['errors'])} fehlgeschlagen")

    identity, bibs = _identity_from_lists(blob["lists"])
    if not bibs:
        raise ExtractError(
            "Keine Startnummern in den Ergebnislisten gefunden - "
            "ohne sie lassen sich die Detailansichten nicht abrufen."
        )

    print(f"[extract] Detailansichten fuer {len(bibs)} Athleten (die Aid-Station-Splits "
          f"stehen nur dort)")
    details = fetch_all_details(sess, event_id, bibs)
    print(f"[extract] {len(details)} Detailansichten geladen")

    check = verify_identity(identity, details)
    print(f"[extract] Namensabgleich Liste/Detailseite: {check['checked'] - check['mismatched']}"
          f"/{check['checked']} stimmen ueberein")

    blob["lists"][SYNTHETIC_LIST] = build_synthetic_list(cfg, blob["lists"], details)
    blob["details_raw"] = details
    blob["identity_check"] = check

    target = dump_raw(year, event_id, cfg, blob)
    print(f"[extract] Rohdaten gespeichert: {target}")
    return target


# ---------------------------------------------------------------------------
# Probe-Modus
# ---------------------------------------------------------------------------

def probe(year: int, event_id: int | None = None) -> None:
    sess = _session()
    if event_id is None:
        event_id, cfg = discover_event_id(year, sess)
    else:
        cfg = fetch_config(sess, event_id)

    print(f"Event {event_id}: {cfg.get('eventname')}  (EventOver={cfg.get('EventOver')})")
    print(f"Contests: {cfg.get('contests')}\n")
    print("Splits:")
    for s in cfg.get("splits", []):
        if s.get("Contest") == 1:
            print(f"  {s['ID']:>3}  {s['Name']:<24} {s['Label']}")

    blob = fetch_all_lists(sess, event_id, cfg)
    print("\nListen:")
    for name, payload in blob["lists"].items():
        labels = [f.get("Label") for f in (payload.get("list") or {}).get("Fields", [])]
        print(f"  [OK]     {name}: {len(_grouped_rows(payload))} Zeilen, Spalten={labels}")
    for name, err in blob["errors"].items():
        print(f"  [FEHLER] {name}: {err}")

    identity, bibs = _identity_from_lists(blob["lists"])
    print(f"\nStartnummern: {len(bibs)}")
    if bibs:
        bib = bibs[0]
        detail = fetch_detail(sess, event_id, bib)
        fields = _detail_fields(detail)
        splits = ((detail.get("Data") or {}).get("SplitsAndLegs") or {}).get("Splits") or []
        listed = (identity.get(bib) or {}).get("name")
        match = "OK" if (_name_key(listed) & _name_key(fields["name"])) else "ABWEICHUNG"
        print(f"Beispiel Startnr. {bib}: Liste '{listed}' / Detailseite '{fields['name']}' -> {match}")
        print(f"  {len([s for s in splits if s.get('Exists')])} von {len(splits)} Splits erfasst")
        for s in splits[:5]:
            print(f"    {str(s.get('Name')):<34} {s.get('Gun')}  (Rang {s.get('RG')})")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Norseman RACE-RESULT Extract")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--event-id", type=int, default=None)
    ap.add_argument("--probe", action="store_true")
    args = ap.parse_args()

    probe(args.year, args.event_id) if args.probe else extract(args.year, args.event_id)
