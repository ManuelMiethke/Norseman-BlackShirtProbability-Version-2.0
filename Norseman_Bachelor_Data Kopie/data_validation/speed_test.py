import pandas as pd
import numpy as np
from pathlib import Path
import re


# ---------------------------------------------------
# 1. Hilfsfunktionen
# ---------------------------------------------------

def load_data(csv_path: str) -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {path.resolve()}")
    print("📁 Lade Datei von:", path.resolve())
    df = pd.read_csv(path)
    print("✅ Daten geladen")
    print(f"Shape: {df.shape[0]} Zeilen, {df.shape[1]} Spalten\n")
    return df


def parse_time_series(series: pd.Series) -> pd.Series:
    s = series.astype("string")
    s = s.replace({"": pd.NA, "nan": pd.NA, "NaN": pd.NA})
    return pd.to_timedelta(s, errors="coerce")


def convert_time_columns(df: pd.DataFrame) -> pd.DataFrame:
    time_cols = [c for c in df.columns if c.endswith("_time")]
    print(f"⏱ Konvertiere {len(time_cols)} Zeitspalten in Timedelta ...")
    for col in time_cols:
        df[col] = parse_time_series(df[col])
    return df


def extract_km_from_col(col: str) -> float | None:
    """
    Sucht nach Mustern wie:
      - 6km
      - 11km
      - 32_5km  -> 32.5 km
    und gibt die Distanz als float zurück.
    """
    m = re.search(r"(\d+)(?:_(\d+))?km", col)
    if not m:
        return None
    whole = int(m.group(1))
    frac = m.group(2)
    if frac is None:
        return float(whole)
    # 32_5km -> 32.5
    return whole + int(frac) / (10 ** len(frac))


# ---------------------------------------------------
# 2. Segment-Plausibilitäts-Check
# ---------------------------------------------------

def find_segment_speeds(df: pd.DataFrame,
                        prefix: str,
                        min_speed_kmh: float | None,
                        max_speed_kmh: float | None,
                        max_pace_min_per_km: float | None = None,
                        min_pace_min_per_km: float | None = None,
                        discipline_name: str | None = None) -> pd.DataFrame:
    """
    Berechnet Segmentgeschwindigkeiten für alle Spalten mit dem gegebenen Prefix
    (z.B. 'bike_' oder 'run_') basierend auf cumulative times.

    Flaggt Segmente als zu schnell / zu langsam.

    Rückgabe: DataFrame mit verdächtigen Segmenten.
    """

    if discipline_name is None:
        discipline_name = prefix.rstrip("_")

    # Relevante Zeitspalten mit Prefix
    time_cols = [c for c in df.columns if c.startswith(prefix) and c.endswith("_time")]
    if not time_cols:
        print(f"⚠️ Keine Zeitspalten für Prefix '{prefix}' gefunden.")
        return pd.DataFrame()

    # Distanz pro Spalte extrahieren
    cols_with_dist = []
    for col in time_cols:
        km = extract_km_from_col(col)
        if km is not None:
            cols_with_dist.append((col, km))

    if not cols_with_dist:
        print(f"⚠️ Keine km-Angaben in Spaltennamen mit Prefix '{prefix}' gefunden.")
        return pd.DataFrame()

    # Nach Distanz sortieren: wir gehen davon aus, dass es cumulative Splits sind
    cols_with_dist.sort(key=lambda x: x[1])

    sorted_cols = [c for c, _ in cols_with_dist]
    dists = [km for _, km in cols_with_dist]

    print(f"\n🔎 {discipline_name}: gefundene Splits mit Distanz:")
    for c, km in cols_with_dist:
        print(f"  {km:5.1f} km -> {c}")

    # DataFrame mit kumulativen Zeiten
    td = df[sorted_cols].apply(parse_time_series)

    suspicious_rows = []

    for i in range(1, len(sorted_cols)):
        col_prev = sorted_cols[i - 1]
        col_curr = sorted_cols[i]
        dist_prev = dists[i - 1]
        dist_curr = dists[i]

        delta_km = dist_curr - dist_prev
        if delta_km <= 0:
            # Sollte nie passieren, aber wir sind defensiv
            continue

        delta_time = (td[col_curr] - td[col_prev])
        # Nur sinnvolle Segmente betrachten
        mask = delta_time.notna()

        # Sekunden in Stunden
        hours = delta_time[mask].dt.total_seconds() / 3600.0

        # Geschwindigkeiten / Pace
        speed_kmh = delta_km / hours  # km/h
        pace_min_per_km = (hours * 60) / delta_km  # min/km

        # Plausibilitätsmasken
        too_fast = pd.Series(False, index=speed_kmh.index)
        too_slow = pd.Series(False, index=speed_kmh.index)

        if max_speed_kmh is not None:
            too_fast |= speed_kmh > max_speed_kmh
        if min_speed_kmh is not None:
            too_slow |= speed_kmh < min_speed_kmh

        if min_pace_min_per_km is not None:
            too_fast |= pace_min_per_km < min_pace_min_per_km  # extrem schnell
        if max_pace_min_per_km is not None:
            too_slow |= pace_min_per_km > max_pace_min_per_km  # extrem langsam

        problem_mask = too_fast | too_slow

        for idx in speed_kmh[problem_mask].index:
            row = df.loc[idx]
            suspicious_rows.append({
                "index": idx,
                "year": row.get("year", None),
                "bib": row.get("bib", None),
                "name": row.get("name", None),
                "discipline": discipline_name,
                "from_col": col_prev,
                "to_col": col_curr,
                "from_km": dist_prev,
                "to_km": dist_curr,
                "segment_km": delta_km,
                "segment_time_h": float(hours.loc[idx]),
                "speed_kmh": float(speed_kmh.loc[idx]),
                "pace_min_per_km": float(pace_min_per_km.loc[idx]),
                "issue": "too_fast" if too_fast.loc[idx] else "too_slow"
            })

    suspicious_df = pd.DataFrame(suspicious_rows)
    if suspicious_df.empty:
        print(f"\n✅ {discipline_name}: keine unplausiblen Segmente gefunden.")
    else:
        print(f"\n⚠️ {discipline_name}: {len(suspicious_df)} verdächtige Segmente gefunden.")

    return suspicious_df


# ---------------------------------------------------
# 3. Main: Plausibilitäts-Check für Bike & Run
# ---------------------------------------------------

def main():
    # Pfad ggf. anpassen
    csv_path = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_everything_val.csv"
    df = load_data(csv_path)
    df = convert_time_columns(df)

    # Schwellenwerte (kannst du anpassen)
    # Bike:               10–80 km/h
    # Run:  3:00–20:00 min/km (also 3 bis 20 Minuten pro km)
    bike_suspicious = find_segment_speeds(
        df,
        prefix="bike_",
        min_speed_kmh=8.0,
        max_speed_kmh=70.0,
        discipline_name="bike"
    )

    run_suspicious = find_segment_speeds(
        df,
        prefix="run_",
        min_speed_kmh=None,               # Geschwindigkeit hier eher über Pace
        max_speed_kmh=None,
        min_pace_min_per_km=3.0,          # schneller als 3:00/km = zu schnell
        max_pace_min_per_km=25.0,         # langsamer als 20:00/km = zu langsam
        discipline_name="run"
    )

    # Alles zusammenführen
    all_suspicious = pd.concat(
        [bike_suspicious, run_suspicious],
        ignore_index=True
    )

    print("\n=== ZUSAMMENFASSUNG UNPLAUSIBLER SEGMENTE ===")
    if all_suspicious.empty:
        print("✅ Keine unplausiblen Segmente gefunden (nach definierten Schwellenwerten).")
    else:
        print(all_suspicious.head(30))
        out_path = "new_new_all_suspect_splits.csv"
        all_suspicious.to_csv(out_path, index=False)
        print(f"\n📁 Verdächtige Segmente gespeichert in: {out_path}")


if __name__ == "__main__":
    main()
