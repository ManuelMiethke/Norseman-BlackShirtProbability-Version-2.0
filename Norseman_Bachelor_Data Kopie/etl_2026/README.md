# Norseman ETL – automatisiert

Ersetzt den bisherigen manuellen Ablauf (IDs in Chrome suchen → Aid-Stations
angleichen → Zeiten interpolieren → per Auge auf Plausibilität prüfen) durch
einen Befehl.

## Schnellstart

```bash
cd "Norseman_Bachelor_Data Kopie/etl_2026"
pip install -r requirements.txt

# 1) Heute: alles testen, ohne Renndaten
python selftest.py

# 2) Heute: sehen, ob die Zeitnahme das Event 2026 schon online hat
python run_pipeline.py --year 2026 --probe

# 3) Sonntag: kompletter Lauf, ohne Master-Dateien zu verändern
python run_pipeline.py --year 2026 --dry-run

# 4) Wenn die Reports gut aussehen: echter Lauf
python run_pipeline.py --year 2026
```

Alle Befehle müssen aus dem Ordner `etl_2026` heraus laufen.

## Was passiert in welchem Schritt

| Schritt | Modul | Bisher manuell | Jetzt |
| --- | --- | --- | --- |
| 1 Extract | `extract.py` | Event- und Split-IDs im Browser suchen | Event-ID wird über RaceTracker/nxtri.com gefunden und gegen die RACE-RESULT-Config verifiziert; alle Splits kommen als JSON |
| 2 Transform | `transform.py` | Aid-Stations an Vorjahre angleichen, Zeiten interpolieren | Spalten werden automatisch auf die historischen Namen gemappt, Lücken feldbasiert interpoliert |
| 3 Validate | `validate.py` | „zu schnell? zu langsam? komisch?" | Regelbasiert, harte Fehler werden korrigiert, weiche gemeldet |
| 4 Enrich | `enrich.py` | 4 Skripte nacheinander | Wetter, Höhenprofil und Windeffekt in einem Lauf |
| 5 Merge | `merge_master.py` | von Hand zusammenkopieren | idempotenter Merge mit Backup |

## Datenquelle

Norseman wird von **RaceTracker** über **RACE RESULT** getimt. Deren
öffentliche API liefert alles, was bisher aus dem Browser abgetippt wurde:

```
https://my.raceresult.com/<EVENT_ID>/RRPublish/data/config?page=results
https://my.raceresult.com/<EVENT_ID>/RRPublish/data/list?key=…&listname=…
```

Die `config`-Antwort enthält den Session-Key und alle Split-Definitionen.
Bekannte Event-IDs stehen in `config.py` (`KNOWN_EVENT_IDS`: 2025 = 321377,
2026 = 393558).

**Wichtig, im Browser verifiziert:** `data/list` liefert nur die Leg-Zeiten
(Swim/T1/Bike/T2/Run). Die 37 Aid-Station-Splits stehen ausschließlich in der
Athleten-Detailansicht:

```
GET /<event>/details/view?pid=<recordid>&standalone=1&noVisitor=1&lang=en
    -> Data.SplitsAndLegs.Splits = [{Name, Exists, TOD, Gun, Sector, RG}, …]
```

`Gun` ist die kumulierte Rennzeit, `RG` der Rang an der Station. `extract.py`
holt beides und baut daraus eine synthetische Ergebnisliste, damit der Rest der
Pipeline unverändert arbeitet.

Zweiter Fallstrick: der `contest`-Wert aus der Config führt bei den Listen zu
404 – es muss `contest=0` gesetzt werden.

Dritter Punkt: die Finalliste enthält **zwei Wertungen hintereinander** –
erst Black Shirt (Frauen, Männer), dann White Shirt. Daraus leitet die Pipeline
`finish_type` ab. Die Zielmatte allein reicht nicht: 2026 sind 40 White-Shirt-
Athleten über die Gausta-Matte gelaufen, lagen aber außerhalb der 160er-Grenze.

Findet `discover_event_id` die ID für 2026 nicht automatisch, hilft:

```bash
python run_pipeline.py --year 2026 --event-id 3XXXXX --probe
```

Die ID steht in der URL der Ergebnisseite (`my.raceresult.com/<ID>/results`).

## Wie interpoliert wird

Nicht linear nach Distanz, sondern nach der **Median-Segmentdauer des Feldes**.
Ein Kilometer Zombie Hill dauert deutlich länger als ein Kilometer in Atrå –
eine Distanz-Interpolation würde dort systematisch zu schnelle Zwischenzeiten
erzeugen. Fehlt ein Teilstück komplett (weniger als 5 Vergleichswerte), wird auf
Distanz zurückgefallen.

Gefüllt wird ausschließlich **zwischen zwei gemessenen Zeiten**. Wer nach einer
Station keine weitere Messung mehr hat (DNF, Cut-off), behält leere Felder.
Jede gefüllte Zelle steht in `reports/<jahr>_interpolation_log.csv` und ist im
Long-Format über `is_interpolated` markiert.

## Validierungsregeln

**Hart** (wird automatisch korrigiert – Wert wird verworfen und aus den
Nachbarstationen rekonstruiert):

- Zeit läuft rückwärts
- Segmenttempo außerhalb der physikalischen Grenzen
  (Schwimmen 1–6 km/h, Rad 3–75 km/h, Laufen 1–25 km/h, steile Abschnitte 0,5–18 km/h)
- doppelte oder fehlende Startnummer

**Weich** (nur Report, keine Änderung):

- auffälliges, aber mögliches Tempo
- Wechselzeit unter 5 s oder über 45 min
- robuster Ausreißer je Segment (MAD, z > 6)

Steile Abschnitte erkennt die Validierung über `GPX_data/split_elevation_grade.csv`
(≥ 6 % Durchschnittssteigung) – auf Zombie Hill sind 3 km/h normal, in der Ebene nicht.

Grenzen anpassen: `SPEED_BOUNDS` in `config.py`.

## Ausgaben

```
etl_2026/
  raw/     <jahr>_<eventid>_<zeitstempel>/   unveränderte API-Antworten
  build/   <jahr>_wide_raw.csv, <jahr>_long_raw.csv, <jahr>_long_enriched.csv
  reports/ <jahr>_validation.md              ← zuerst hier reinschauen
           <jahr>_validation_issues.csv
           <jahr>_validation_fixes.csv
           <jahr>_interpolation_log.csv
           <jahr>_mapping_report.json
           <jahr>_pipeline_summary.json
  backups/ Sicherungen der Master-Dateien vor jedem Merge
```

Die Rohdaten bleiben liegen. Korrigiert die Zeitnahme später Ergebnisse, lässt
sich jeder Stand mit `--skip-extract --raw-dir …` erneut verarbeiten.

## Ziel-Dateien

- `dashboard/assets/nxtri_data_all_years.csv` (wide)
- `dashboard/assets/nxtri_data_all_years_long_ready_featured.csv` (long)

Die Spalten der Master-Datei geben die Reihenfolge vor. Spalten, die für das
neue Jahr fehlen, bleiben leer und werden im Log genannt. Der Merge ist
idempotent: ein zweiter Lauf ersetzt `year == 2026`, statt zu duplizieren.

Am Ende gibt die Pipeline den fertigen `RaceYearConfig`-Eintrag für
`dashboard/core/config.py` aus, inklusive der automatisch gezählten
Starterzahl nach dem Schwimmen. Der Platzhalter für 2026 ist dort bereits
eingetragen (`import_status="pending"`) – ohne ihn würde
`validate_dashboard_assets()` nach dem Merge fehlschlagen.

### Noch offen: die Modell-Datei

`dashboard/core/validators.py` verlangt, dass **Long, Wide und
`xgb_black_probs_long_with_errors.csv` dieselben Jahre enthalten**. Diese
Modell-Datei entsteht im XGBoost-Notebook und wird von der ETL *nicht* erzeugt.
Nach dem Merge weist die Pipeline darauf hin. Solange 2026 dort fehlt, läuft das
Dashboard zwar, aber `validate_dashboard_assets()` schlägt an.

## Wenn etwas nicht passt

| Symptom | Ursache | Lösung |
| --- | --- | --- |
| „Keine RACE-RESULT-Event-ID gefunden" | Event noch nicht veröffentlicht | `--event-id` setzen |
| „Keine einzige Ergebnisliste konnte geladen werden" | Listen noch nicht freigeschaltet | später erneut, `--probe` zeigt den Stand |
| Stationen fehlen im Mapping-Report | Zeitnahme hat umbenannt | Name in `SPLIT_NAME_MAP` (`config.py`) ergänzen; der Kilometer-Fallback fängt kleinere Umbenennungen schon ab |
| Open-Meteo liefert nichts | ERA5-Archiv hinkt ein paar Tage hinterher | die Pipeline fällt automatisch auf die Forecast-API zurück; alternativ `--skip-weather` und später nachziehen |

## Annahmen für 2026

In `config.py` als `RACE_YEAR` hinterlegt und bei Bedarf anzupassen:

- Renndatum 01.08.2026, Start 05:00 Uhr
- Cut-off wie 2024/2025 bei 37,5 km (Stavsrø)
- Streckenprofil unverändert gegenüber 2025

Ändert sich die Strecke, müssen `STATION_ORDER` und `STATION_CUM_KM` in
`config.py` sowie `GPX_data/split_elevation_grade.csv` mitgezogen werden.
