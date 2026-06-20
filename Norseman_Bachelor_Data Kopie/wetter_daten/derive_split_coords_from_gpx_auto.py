import csv
import math
from typing import List, Tuple
import pandas as pd
import gpxpy

SPLITS_PATH = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten_neuer_verusch/splitstation_and_km.csv"
BIKE_GPX    = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten_neuer_verusch/norseman_bike_route.gpx"
RUN_GPX     = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten_neuer_verusch/norseman_run_route.gpx"
OUT_SPLIT   = "/Users/manuelmiethke/Norseman_Bachelor/wetter_daten_neuer_verusch/split_points.csv"
TOLERANCE_KM = 0.10

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def load_gpx_points(gpx_path: str) -> List[Tuple[float, float]]:
    with open(gpx_path, "r", encoding="utf-8") as f:
        gpx = gpxpy.parse(f)
    pts = []
    for trk in gpx.tracks:
        for seg in trk.segments:
            for p in seg.points:
                if p.latitude is not None and p.longitude is not None:
                    pts.append((float(p.latitude), float(p.longitude)))
    for rte in gpx.routes:
        for p in rte.points:
            if p.latitude is not None and p.longitude is not None:
                pts.append((float(p.latitude), float(p.longitude)))
    if len(pts) < 2:
        raise ValueError(f"GPX {gpx_path} has too few points.")
    return pts

def cumulative_km(points: List[Tuple[float, float]]) -> List[float]:
    cum = [0.0]
    for i in range(1, len(points)):
        d = haversine_km(points[i-1][0], points[i-1][1], points[i][0], points[i][1])
        cum.append(cum[-1] + d)
    return cum

def interpolate_point(p1, p2, t: float) -> Tuple[float, float]:
    lat = p1[0] + (p2[0] - p1[0]) * t
    lon = p1[1] + (p2[1] - p1[1]) * t
    return lat, lon

def snap_km_to_track(target_km, points, cum_km, tolerance_km):
    total = cum_km[-1]
    if target_km < 0 - 1e-6:
        raise ValueError(f"Requested km {target_km:.3f} < 0.")
    if target_km > total + tolerance_km:
        raise ValueError(f"Requested km {target_km:.3f} exceeds track length {total:.3f} km.")
    target_km = max(0.0, min(target_km, total))

    lo, hi = 0, len(cum_km) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if abs(cum_km[mid] - target_km) <= 1e-9:
            return points[mid][0], points[mid][1], cum_km[mid], mid
        if cum_km[mid] < target_km:
            lo = mid + 1
        else:
            hi = mid - 1

    i = max(0, hi)
    if i >= len(points) - 1:
        return points[-1][0], points[-1][1], cum_km[-1], len(points) - 1

    seg_len = cum_km[i+1] - cum_km[i]
    if seg_len <= 0:
        return points[i][0], points[i][1], cum_km[i], i

    t = (target_km - cum_km[i]) / seg_len
    lat, lon = interpolate_point(points[i], points[i+1], t)
    return lat, lon, target_km, i

def normalize_segment(s: str) -> str:
    if s is None:
        return ""
    s = s.strip().lower()
    if s.startswith("bike") or s.startswith("rad"):
        return "bike"
    if s.startswith("run") or s in {"lauf", "marathon"}:
        return "run"
    return s

def load_splits_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, sep=None, engine="python")

    df = df.dropna(axis=1, how="all")

    clean_cols = []
    for c in df.columns:
        c = str(c).replace("\ufeff", "")  
        c = c.strip().lower()
        clean_cols.append(c)
    df.columns = clean_cols

    seg_col  = next((c for c in df.columns if c in ("segment", "leg", "abschnitt")), None)
    name_col = next((c for c in df.columns if c in ("split_name", "split_station_name", "station", "split", "label", "name")), None)
    km_col   = next((c for c in df.columns if c in ("km", "km_marker", "kilometer", "kilometre", "dist_km", "distance_km")), None)

    if not all([seg_col, name_col, km_col]):
        raise ValueError(f"Missing one of required columns after cleaning.\n"
                         f"Found columns: {df.columns.tolist()}")

    out = pd.DataFrame({
        "segment": df[seg_col].astype(str).map(lambda s: s.strip().lower()).map(
            lambda s: "bike" if s.startswith(("bike","rad")) else ("run" if s.startswith("run") or s in {"lauf","marathon"} else s)
        ),
        "split_name": df[name_col].astype(str).str.strip(),
        "km_marker": pd.to_numeric(df[km_col], errors="coerce")
    }).dropna(subset=["km_marker"])

    out = out[out["segment"].isin(["bike", "run"])].reset_index(drop=True)
    if out.empty:
        raise ValueError("No valid bike/run split rows found after cleaning.")
    return out


def main():
    print("Loading data...")
    bike_points = load_gpx_points(BIKE_GPX)
    run_points  = load_gpx_points(RUN_GPX)
    bike_cum = cumulative_km(bike_points)
    run_cum  = cumulative_km(run_points)

    splits = load_splits_csv(SPLITS_PATH)

    rows = []
    for _, r in splits.iterrows():
        seg, km, name = r["segment"], float(r["km_marker"]), r["split_name"]
        if seg == "bike":
            lat, lon, exact_km, idx = snap_km_to_track(km, bike_points, bike_cum, TOLERANCE_KM)
        else:
            lat, lon, exact_km, idx = snap_km_to_track(km, run_points, run_cum, TOLERANCE_KM)
        rows.append({
            "segment": seg,
            "split_name": name,
            "km_marker": km,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "cum_km": round(exact_km, 3),
            "source_index": int(idx)
        })

    out_df = pd.DataFrame(rows).sort_values(["segment", "km_marker"])
    out_df.to_csv(OUT_SPLIT, index=False, quoting=csv.QUOTE_MINIMAL)

    n_bike = (out_df["segment"] == "bike").sum()
    n_run  = (out_df["segment"] == "run").sum()
    print(f"\n✅ Written: {OUT_SPLIT}")
    print(f"   Bike splits: {n_bike} | Run splits: {n_run} | Total: {len(out_df)}\n")
    print(out_df.to_string(index=False))

if __name__ == "__main__":
    main()
