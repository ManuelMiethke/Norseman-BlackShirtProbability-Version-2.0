/**
 * Central colour + typography tokens for all Plotly charts.
 *
 * The CSS side (src/styles/global.css) mirrors these values as custom
 * properties. Keep both in sync when changing the palette.
 *
 * Chart panels sit on a mid-tone slate (see `--plot-bg` in global.css) so that
 * the two signature marks of the race – pure black (Black Shirt) and white
 * (White Shirt) – both keep ≥3:1 contrast against the panel.
 */
export const PALETTE = {
  // Outcome groups
  top10: "#4ade80",
  black: "#0b0c0e",
  white: "#f4f5f6",
  dnf: "#f2594b",
  other: "#9aa3ad",

  // Signal colours
  accent: "#ff9f1c", // medians, frontier pace, highlights
  accentSoft: "rgba(255, 159, 28, 0.18)",
  mean: "#5ab0ff",

  // Race legs
  swim: "#5aa9e6",
  bike: "#2a2f35",
  run: "#3fbf74",

  // Terrain
  elevationLine: "rgba(138, 196, 236, 0.85)",
  elevationFill: "rgba(138, 196, 236, 0.16)",

  // Demographics
  men: "#5aa9e6",
  women: "#e879b9",

  // Chart chrome
  text: "#eef1f4",
  textMuted: "rgba(238, 241, 244, 0.68)",
  grid: "rgba(255, 255, 255, 0.11)",
  axisLine: "rgba(255, 255, 255, 0.28)",
  transparent: "rgba(0,0,0,0)",
  hoverBg: "#0f1215",
} as const;

export const FONT_BODY = "Inter, 'IBM Plex Sans', system-ui, sans-serif";
export const FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
