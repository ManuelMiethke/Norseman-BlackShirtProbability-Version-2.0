export type WideRow = {
  year: number;
  bib: number;
  name: string;
  gender: string;
  country: string;
  finish_type: string;
  club?: string;
  overall_rank?: number;
  overall_time?: string;
  swim_time?: string;
  t1_time?: string;
  bike_time?: string;
  t2_time?: string;
  run_time?: string;
  zombie_hill_time?: string;
  run_start_time?: string;
  run_32_5km_langefonn_time?: string;
  run_37_5km_stavsro_cut_off_time?: string;
};

export type LongRow = {
  year: number;
  bib: number;
  name: string;
  finish_type: string;
  overall_rank?: number;
  split_key: string;
  station_name?: string;
  split_rank?: number;
  split_distance_km?: number;
  race_distance_km?: number;
  segment_speed_kmh?: number;
  cum_time_seconds?: number;
  temperature_2m?: number;
  wind_direction_10m?: number;
  wind_effect?: string;
  weather_emoji?: string;
};

export type CourseProfileRow = {
  distance_km: number;
  elev_norseman_m?: number;
  elev_hawaii_m?: number;
};
