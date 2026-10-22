import { isBlackFinishType } from "@/lib/groups";
import { timeToSeconds } from "@/lib/time";
import type { WideRow } from "@/types/data";

/**
 * Places planned leg times in the field of the most recent race:
 * "faster than x % of the field" and "faster than x % of Black Shirt finishers".
 *
 * The run is compared only up to the 37.5 km cut-off at Stavsro, because White
 * Shirts finish at a different (lower) place and their full run time is not
 * comparable. Everyone in the field passes Stavsro, so this section is.
 */

export type ComparedLeg = "swim" | "t1" | "bike" | "t2" | "runToCutoff" | "atCutoff";

type LegSamples = { field: number[]; black: number[] };

export type FieldReference = {
  year: number;
  legs: Record<ComparedLeg, LegSamples>;
};

export type FieldPlacement = {
  /** Share of the field (0–1) that was slower than the planned time. */
  fasterThanField: number;
  /** Share of Black Shirt finishers (0–1) that were slower than the planned time. */
  fasterThanBlack: number;
  fieldSize: number;
  blackSize: number;
};

function emptyLegs(): Record<ComparedLeg, LegSamples> {
  return {
    swim: { field: [], black: [] },
    t1: { field: [], black: [] },
    bike: { field: [], black: [] },
    t2: { field: [], black: [] },
    runToCutoff: { field: [], black: [] },
    atCutoff: { field: [], black: [] },
  };
}

/** Collects leg times of the latest year in the data (everyone with a valid time for that leg). */
export function buildFieldReference(rows: WideRow[]): FieldReference | null {
  const years = rows.map((row) => row.year).filter((year) => Number.isFinite(year));
  if (years.length === 0) {
    return null;
  }
  const year = Math.max(...years);
  const legs = emptyLegs();

  for (const row of rows) {
    if (row.year !== year) {
      continue;
    }
    const black = isBlackFinishType(row.finish_type);
    const swim = timeToSeconds(row.swim_time);
    const t1 = timeToSeconds(row.t1_time);
    const bike = timeToSeconds(row.bike_time);
    const t2 = timeToSeconds(row.t2_time);
    const atCutoff = timeToSeconds(row.run_37_5km_stavsro_cut_off_time);
    const runToCutoff =
      atCutoff !== null && swim !== null && t1 !== null && bike !== null && t2 !== null
        ? atCutoff - swim - t1 - bike - t2
        : null;

    const add = (leg: ComparedLeg, value: number | null) => {
      if (value === null || !Number.isFinite(value) || value <= 0) {
        return;
      }
      legs[leg].field.push(value);
      if (black) {
        legs[leg].black.push(value);
      }
    };

    add("swim", swim);
    add("t1", t1);
    add("bike", bike);
    add("t2", t2);
    add("runToCutoff", runToCutoff);
    add("atCutoff", atCutoff);
  }

  return { year, legs };
}

function shareSlower(values: number[], seconds: number) {
  if (values.length === 0) {
    return Number.NaN;
  }
  return values.filter((value) => value > seconds).length / values.length;
}

export function placeInField(
  reference: FieldReference,
  leg: ComparedLeg,
  seconds: number,
): FieldPlacement {
  const samples = reference.legs[leg];
  return {
    fasterThanField: shareSlower(samples.field, seconds),
    fasterThanBlack: shareSlower(samples.black, seconds),
    fieldSize: samples.field.length,
    blackSize: samples.black.length,
  };
}
