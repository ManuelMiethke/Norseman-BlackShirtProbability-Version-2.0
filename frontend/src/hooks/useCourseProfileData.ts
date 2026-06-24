import { useCsvRows, type CsvRowsState } from "@/hooks/useCsvRows";
import { loadCourseProfileCsv } from "@/lib/csv";
import type { CourseProfileRow } from "@/types/data";

type CourseProfileState = CsvRowsState<CourseProfileRow>;

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

function isValidCourseProfileRow(row: CourseProfileRow) {
  return Number.isFinite(row.distance_km);
}

function sortCourseProfileRows(left: CourseProfileRow, right: CourseProfileRow) {
  return left.distance_km - right.distance_km;
}

export function useCourseProfileData(): CourseProfileState {
  return useCsvRows({
    loader: loadCourseProfileCsv,
    mapRow: toCourseProfileRow,
    filter: isValidCourseProfileRow,
    sort: sortCourseProfileRows,
    errorMessage: "Failed to load course profile data.",
  });
}
