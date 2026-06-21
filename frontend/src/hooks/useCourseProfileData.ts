import { useEffect, useState } from "react";

import { loadCourseProfileCsv } from "@/lib/csv";
import type { CourseProfileRow } from "@/types/data";

type CourseProfileState = {
  rows: CourseProfileRow[];
  isLoading: boolean;
  error: string | null;
};

function toCourseProfileRow(record: Record<string, unknown>): CourseProfileRow {
  return {
    distance_km: Number(record.distance_km),
    elev_norseman_m:
      record.elev_norseman_m === undefined || record.elev_norseman_m === null || record.elev_norseman_m === ""
        ? undefined
        : Number(record.elev_norseman_m),
    elev_hawaii_m:
      record.elev_hawaii_m === undefined || record.elev_hawaii_m === null || record.elev_hawaii_m === ""
        ? undefined
        : Number(record.elev_hawaii_m),
  };
}

export function useCourseProfileData(): CourseProfileState {
  const [state, setState] = useState<CourseProfileState>({
    rows: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    loadCourseProfileCsv()
      .then((records) => {
        if (isCancelled) {
          return;
        }

        const rows = records
          .map(toCourseProfileRow)
          .filter((row) => Number.isFinite(row.distance_km))
          .sort((left, right) => left.distance_km - right.distance_km);

        setState({
          rows,
          isLoading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setState({
          rows: [],
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load course profile data.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
