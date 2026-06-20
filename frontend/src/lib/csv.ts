import Papa from "papaparse";

let wideDataPromise: Promise<Record<string, unknown>[]> | null = null;

function parseCsv(url: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(url, {
      download: true,
      header: true,
      dynamicTyping: true,
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
    wideDataPromise = parseCsv("/nxtri_data_all_years.csv");
  }
  return wideDataPromise;
}
