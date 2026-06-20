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
  bike_time?: string;
  run_time?: string;
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
  split_rank?: number;
  race_distance_km?: number;
  cum_time_seconds?: number;
};
