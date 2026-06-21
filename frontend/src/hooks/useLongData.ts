import { useEffect, useState } from "react";

import { loadLongCsv } from "@/lib/csv";
import type { LongRow } from "@/types/data";

type LongDataState = {
  rows: LongRow[];
  isLoading: boolean;
  error: string | null;
};

function toLongRow(record: Record<string, unknown>): LongRow {
  return {
    year: Number(record.year),
    bib: Number(record.bib),
    name: String(record.name ?? ""),
    finish_type: String(record.finish_type ?? ""),
    overall_rank:
      record.overall_rank === undefined || record.overall_rank === null || record.overall_rank === ""
        ? undefined
        : Number(record.overall_rank),
    leg: record.leg ? String(record.leg).toLowerCase() : undefined,
    split_key: String(record.split_key ?? ""),
    station_name: record.station_name ? String(record.station_name) : undefined,
    split_rank:
      record.split_rank === undefined || record.split_rank === null || record.split_rank === ""
        ? undefined
        : Number(record.split_rank),
    split_distance_km:
      record.split_distance_km === undefined ||
      record.split_distance_km === null ||
      record.split_distance_km === ""
        ? undefined
        : Number(record.split_distance_km),
    race_distance_km:
      record.race_distance_km === undefined ||
      record.race_distance_km === null ||
      record.race_distance_km === ""
        ? undefined
        : Number(record.race_distance_km),
    segment_speed_kmh:
      record.segment_speed_kmh === undefined ||
      record.segment_speed_kmh === null ||
      record.segment_speed_kmh === ""
        ? undefined
        : Number(record.segment_speed_kmh),
    segment_time_s:
      record.segment_time_s === undefined ||
      record.segment_time_s === null ||
      record.segment_time_s === ""
        ? undefined
        : Number(record.segment_time_s),
    cum_time_seconds:
      record.cum_time_seconds === undefined ||
      record.cum_time_seconds === null ||
      record.cum_time_seconds === ""
        ? undefined
        : Number(record.cum_time_seconds),
    temperature_2m:
      record.temperature_2m === undefined ||
      record.temperature_2m === null ||
      record.temperature_2m === ""
        ? undefined
        : Number(record.temperature_2m),
    wind_direction_10m:
      record.wind_direction_10m === undefined ||
      record.wind_direction_10m === null ||
      record.wind_direction_10m === ""
        ? undefined
        : Number(record.wind_direction_10m),
    wind_effect: record.wind_effect ? String(record.wind_effect) : undefined,
    weather_emoji: record.weather_emoji ? String(record.weather_emoji) : undefined,
  };
}

export function useLongData(): LongDataState {
  const [state, setState] = useState<LongDataState>({
    rows: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    loadLongCsv()
      .then((records) => {
        if (isCancelled) {
          return;
        }

        const rows = records
          .map(toLongRow)
          .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.bib) && row.split_key.length > 0);

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
          error: error instanceof Error ? error.message : "Failed to load split data.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
