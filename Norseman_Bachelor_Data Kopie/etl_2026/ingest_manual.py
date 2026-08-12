"""
Rohdaten einspeisen, die nicht ueber extract.py geholt wurden.

Wird gebraucht, wenn die RACE-RESULT-API vom ausfuehrenden Rechner aus nicht
erreichbar ist (Firewall, Proxy, Sandbox) und die JSON-Antworten stattdessen
aus dem Browser kommen.

Erzeugt exakt dieselbe Ordnerstruktur wie extract.dump_raw(), damit die
Pipeline anschliessend normal weiterlaufen kann:

    python run_pipeline.py --year 2026 --skip-extract

Verwendung
----------
    # Einzeldateien
    python ingest_manual.py --year 2026 --event-id 393558 \
        --config config.json --list "03 - Finale results|01 - Final results=final.json"

    # Oder: Chunks zusammensetzen, die stueckweise abgeholt wurden
    python ingest_manual.py --year 2026 --event-id 393558 \
        --config config.json --chunks chunks/ --list-name "03 - Finale results|01 - Final results"
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import config as C
from extract import dump_raw


def _load_json(path: Path):
    text = path.read_text(encoding="utf-8").strip()
    return json.loads(text)


def _join_chunks(folder: Path) -> str:
    """Dateien der Form chunk_000.txt, chunk_001.txt ... in Reihenfolge verketten."""
    parts = sorted(folder.glob("chunk_*"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0))
    if not parts:
        raise SystemExit(f"Keine chunk_*-Dateien in {folder}")
    text = "".join(p.read_text(encoding="utf-8") for p in parts)
    print(f"[ingest] {len(parts)} Chunks, {len(text)} Zeichen zusammengesetzt")
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--event-id", type=int, required=True)
    ap.add_argument("--config", type=Path, required=True, help="config.json der RACE-RESULT-API")
    ap.add_argument("--list", action="append", default=[],
                    help='"<listname>=<pfad zur json>" - mehrfach moeglich')
    ap.add_argument("--chunks", type=Path, default=None, help="Ordner mit chunk_*-Dateien")
    ap.add_argument("--list-name", type=str, default=None, help="Listenname fuer --chunks")
    args = ap.parse_args()

    C.ensure_dirs()
    cfg = _load_json(args.config)
    print(f"[ingest] Config: {cfg.get('eventname')} - {len(cfg.get('splits', []))} Splits")

    lists: dict[str, object] = {}

    for spec in args.list:
        if "=" not in spec:
            raise SystemExit(f"--list erwartet '<listname>=<pfad>', bekam: {spec}")
        name, path = spec.split("=", 1)
        lists[name] = _load_json(Path(path))
        print(f"[ingest] Liste geladen: {name}")

    if args.chunks:
        if not args.list_name:
            raise SystemExit("--chunks braucht zusaetzlich --list-name")
        lists[args.list_name] = json.loads(_join_chunks(args.chunks))
        print(f"[ingest] Liste aus Chunks: {args.list_name}")

    if not lists:
        raise SystemExit("Keine Liste angegeben (--list oder --chunks).")

    target = dump_raw(args.year, args.event_id, cfg, {"lists": lists, "errors": {}},
                      tag="manual")
    print(f"[ingest] Rohdaten geschrieben: {target}")
    print(f"\nWeiter mit:\n  python run_pipeline.py --year {args.year} --skip-extract --dry-run")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
