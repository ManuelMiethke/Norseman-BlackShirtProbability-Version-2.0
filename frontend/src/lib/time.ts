export function timeToSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const text = String(value).trim();
  const parts = text.split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  try {
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return Number(minutes) * 60 + Math.round(Number(seconds));
    }

    const [hours, minutes, seconds] = parts;
    return (
      Number(hours) * 3600 +
      Number(minutes) * 60 +
      Math.round(Number(seconds))
    );
  } catch {
    return null;
  }
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
