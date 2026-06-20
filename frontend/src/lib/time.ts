export function timeToSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const text = String(value).trim();
  const parts = text.split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  const numericParts = parts.map((part) => Number(part));
  if (numericParts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (numericParts.length === 2) {
    const [minutes, seconds] = numericParts;
    return minutes * 60 + Math.round(seconds);
  }

  const [hours, minutes, seconds] = numericParts;
  return hours * 3600 + minutes * 60 + Math.round(seconds);
}

export function secondsToHms(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "";
  }

  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function secondsToPaddedHms(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "";
  }

  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function secondsToMinutesLabel(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "";
  }

  return `${(value / 60).toFixed(1)} min`;
}

export function formatDelta(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "";
  }
  if (Math.round(value) === 0) {
    return "Δ +00:00:00";
  }
  const sign = value > 0 ? "+" : "-";
  return `Δ ${sign}${secondsToHms(Math.abs(value))}`;
}
