import Papa from "papaparse";

import { assetUrl } from "@/lib/assets";

let wideDataPromise: Promise<Record<string, unknown>[]> | null = null;
let longDataPromise: Promise<Record<string, unknown>[]> | null = null;
let modelDataPromise: Promise<Record<string, unknown>[]> | null = null;
let courseProfilePromise: Promise<Record<string, unknown>[]> | null = null;

function parseCsv(url: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(url, {
      download: true,
      header: true,
      // Bewusst aus: die Hooks (useLongData, useWideData, useModelData,
      // useCourseProfileData) konvertieren jedes Feld ohnehin selbst mit
      // Number() bzw. String() und behandeln "" und null bereits gleich.
      // dynamicTyping wuerde diese Arbeit fuer ueber drei Millionen Zellen
      // ein zweites Mal machen.
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors.map((error) => error.message).join("; ")));
          return;
        }
        resolve(results.data);
      },
      error: (error) => reject(error),
    });
  });
}

export async function loadWideCsv() {
  if (!wideDataPromise) {
    wideDataPromise = parseCsv(assetUrl("nxtri_data_all_years.csv"));
  }
  return wideDataPromise;
}

export async function loadLongCsv() {
  if (!longDataPromise) {
    longDataPromise = parseCsv(assetUrl("nxtri_data_all_years_long_ready_featured.csv"));
  }
  return longDataPromise;
}

export async function loadModelCsv() {
  if (!modelDataPromise) {
    // 2018–2025 from the earlier random-split model, 2026 from the holdout run
    // (see build_dashboard_model_csv.py in the data folder).
    modelDataPromise = parseCsv(assetUrl("xgb_black_probs_dashboard.csv"));
  }
  return modelDataPromise;
}

export async function loadCourseProfileCsv() {
  if (!courseProfilePromise) {
    courseProfilePromise = parseCsv(assetUrl("course_profile.csv"));
  }
  return courseProfilePromise;
}
