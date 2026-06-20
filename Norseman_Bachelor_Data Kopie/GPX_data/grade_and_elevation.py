import gpxpy
import pandas as pd
import numpy as np
from math import radians, sin, cos, sqrt, atan2


# --------- Hilfsfunktionen --------- #

def haversine_distance_m(lat1, lon1, lat2, lon2):
    """
    Haversine-Distanz zwischen zwei GPS-Punkten in Metern.
    """
    R = 6371000  # Erdradius in m
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)

    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def load_track_from_gpx(gpx_path):
    """
    Liest eine GPX-Datei ein und gibt ein DataFrame mit:
    lat, lon, ele (m), cum_dist_m (kumulierte Distanz) zurück.
    """
    with open(gpx_path, "r", encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    points = []
    cum_dist = 0.0

    for track in gpx.tracks:
        for segment in track.segments:
            prev_point = None
            for p in segment.points:
                if prev_point is not None:
                    d = haversine_distance_m(
                        prev_point.latitude, prev_point.longitude,
                        p.latitude, p.longitude
                    )
                    cum_dist += d
                points.append({
                    "lat": p.latitude,
                    "lon": p.longitude,
                    "ele_m": p.elevation,
                    "cum_dist_m": cum_dist
                })
                prev_point = p

    df = pd.DataFrame(points)
    return df


def segment_stats(track_df, start_km, end_km):
    """
    Berechnet Höhenmeter & Steigung für ein Segment zwischen start_km und end_km
    entlang der GPX-Strecke.

    Returns dict mit:
    - start_km, end_km, segment_km
    - elev_gain_m, elev_loss_m, net_elev_m
    - avg_grade_pct
    """
    start_m = start_km * 1000
    end_m = end_km * 1000

    # Punkte innerhalb des Segmentbereichs
    seg = track_df[(track_df["cum_dist_m"] >= start_m) &
                   (track_df["cum_dist_m"] <= end_m)].copy()

    # Falls zu wenig Punkte: nächstgelegene Punkte an den Grenzen ergänzen
    if seg.empty:
        return {
            "start_km": start_km,
            "end_km": end_km,
            "segment_km": end_km - start_km,
            "elev_gain_m": np.nan,
            "elev_loss_m": np.nan,
            "net_elev_m": np.nan,
            "avg_grade_pct": np.nan,
        }

    seg = seg.sort_values("cum_dist_m")
    elev = seg["ele_m"].values
    dist = seg["cum_dist_m"].values

    if len(elev) < 2:
        return {
            "start_km": start_km,
            "end_km": end_km,
            "segment_km": (end_km - start_km),
            "elev_gain_m": np.nan,
            "elev_loss_m": np.nan,
            "net_elev_m": np.nan,
            "avg_grade_pct": np.nan,
        }

    # Höhenunterschiede
    diff = np.diff(elev)
    elev_gain_m = diff[diff > 0].sum() if np.any(diff > 0) else 0.0
    elev_loss_m = -diff[diff < 0].sum() if np.any(diff < 0) else 0.0
    net_elev_m = elev[-1] - elev[0]

    horiz_dist_m = dist[-1] - dist[0]
    if horiz_dist_m > 0:
        avg_grade_pct = (net_elev_m / horiz_dist_m) * 100.0
    else:
        avg_grade_pct = np.nan

    return {
        "start_km": start_km,
        "end_km": end_km,
        "segment_km": (end_km - start_km),
        "elev_gain_m": elev_gain_m,
        "elev_loss_m": elev_loss_m,
        "net_elev_m": net_elev_m,
        "avg_grade_pct": avg_grade_pct,
    }


def build_split_segments(meta_df, track_df, leg_label):
    """
    Erzeugt eine Segment-Tabelle für eine bestimmte Disziplin (leg),
    basierend auf meta_df mit Spalten:
        - leg          (z.B. 'Bike', 'Run')
        - split_name   (z.B. 'Bike - 6km Øvre Eidfjord')
        - distance_km  (kumulative Distanz ab Start der Disziplin)
    """
    meta_leg = (
        meta_df[meta_df["leg"] == leg_label]
        .sort_values("distance_km")
        .reset_index(drop=True)
    )

    rows = []
    for i in range(1, len(meta_leg)):
        prev_row = meta_leg.iloc[i - 1]
        cur_row = meta_leg.iloc[i]

        start_km = float(prev_row["distance_km"])
        end_km = float(cur_row["distance_km"])

        stats = segment_stats(track_df, start_km, end_km)
        stats.update({
            "leg": leg_label,
            "from_split": prev_row["split_name"],
            "to_split": cur_row["split_name"],
        })
        rows.append(stats)

    return pd.DataFrame(rows)


# --------- Hauptlogik --------- #
if __name__ == "__main__":
    SPLITS_META_CSV = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten/splitstation_and_km.csv"        # deine Split-Metatabelle
    BIKE_GPX = "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/bike.gpx"                      # GPX der Radstrecke
    RUN_GPX = "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/run.gpx"

    # 1) Metadaten der Splits laden
    meta = pd.read_csv(SPLITS_META_CSV, sep=";")
    meta = meta.rename(columns={
        "segment": "leg",
        "split_station_name": "split_name",
        "kilometre": "distance_km"
    })
    meta["leg"] = meta["leg"].str.lower()
    meta["distance_km"] = meta["distance_km"].astype(str).str.replace(",", ".", regex=False).astype(float)


    # 2) GPX-Tracks laden
    bike_track = load_track_from_gpx(BIKE_GPX)
    run_track = load_track_from_gpx(RUN_GPX)

    # 3) Segment-Tabellen bauen
    bike_segments = build_split_segments(meta, bike_track, leg_label="bike")
    run_segments = build_split_segments(meta, run_track, leg_label="run")

    # Debug-Ausgabe, damit du siehst, ob da wirklich was drin ist
    print("Bike segments:", bike_segments.shape)
    print("Run segments:", run_segments.shape)

    # 4) Zusammenführen
    all_segments = pd.concat([bike_segments, run_segments], ignore_index=True)

    # Falls wirklich mal leer: nicht crashen
    if all_segments.empty:
        print("WARNUNG: all_segments ist leer – prüfe leg-Werte in der CSV und GPX-Pfade.")
    else:
        # Runden nur, wenn die Spalten existieren
        for col, nd in [
            ("segment_km", 3),
            ("elev_gain_m", 1),
            ("elev_loss_m", 1),
            ("net_elev_m", 1),
            ("avg_grade_pct", 2),
        ]:
            if col in all_segments.columns:
                all_segments[col] = all_segments[col].round(nd)

        all_segments.to_csv("split_elevation_grade.csv", index=False)
        print("Fertig! Datei 'split_elevation_grade.csv' erstellt.")
