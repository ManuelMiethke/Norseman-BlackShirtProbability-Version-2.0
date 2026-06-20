import gpxpy
import gpxpy.gpx
import pandas as pd
from pathlib import Path
import numpy as np

def gpx_to_profile(gpx_files):
    #Nimmt eine Liste von GPX-Pfaden, klebt sie zusammen und gibt DataFrame mit distance_km & elevation_m zurück
    distances = []
    elevs = []
    cum_dist = 0.0

    for gpx_path in gpx_files:
        with open(gpx_path, "r") as f:
            gpx = gpxpy.parse(f)

        for track in gpx.tracks:
            for segment in track.segments:
                prev_point = None
                for point in segment.points:
                    if prev_point is not None:
                        d = point.distance_3d(prev_point)  
                        cum_dist += d / 1000.0
                    distances.append(cum_dist)
                    elevs.append(point.elevation)
                    prev_point = point

    return pd.DataFrame({"distance_km": distances, "elevation_m": elevs})


def resample_profile(df, step_km=0.5):
    #Resampelt auf gleichmäßige Abstände, damit Norseman & Hawaii vergleichbar sind
    max_d = df["distance_km"].max()
    new_x = np.arange(0, max_d + step_km, step_km)
    new_y = np.interp(new_x, df["distance_km"], df["elevation_m"])
    return pd.DataFrame({"distance_km": new_x, "elevation_m": new_y})


if __name__ == "__main__":

    norse_files = [
         "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/norseman_swim.gpx",
         "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/norseman_bike.gpx",
         "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/norseman_run.gpx",
    ]

    hawaii_files = [
        "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/hawaii_swim.gpx",
        "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/hawaii_bike.gpx",
        "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/hawaii_run.gpx",
    ]

    norse_profile = resample_profile(gpx_to_profile(norse_files), step_km=0.5)
    hawaii_profile = resample_profile(gpx_to_profile(hawaii_files), step_km=0.5)

    # auf gleiche Distanz-Achse bringen (äußerer Merge)
    all_dists = sorted(set(norse_profile["distance_km"]).union(hawaii_profile["distance_km"]))
    course = pd.DataFrame({"distance_km": all_dists})

    course = course.merge(
        norse_profile.rename(columns={"elevation_m": "elev_norseman_m"}),
        on="distance_km",
        how="left",
    )
    course = course.merge(
        hawaii_profile.rename(columns={"elevation_m": "elev_hawaii_m"}),
        on="distance_km",
        how="left",
    )

    out_path = Path("course_profile.csv")
    course.to_csv(out_path, index=False)
    print("Saved:", out_path)
