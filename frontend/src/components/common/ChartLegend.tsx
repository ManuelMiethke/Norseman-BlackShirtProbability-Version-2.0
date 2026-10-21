export type ChartLegendItem = {
  label: string;
  color: string;
  /** Optional outline for very light swatches. */
  borderColor?: string;
  /** "hatched" draws diagonal stripes (used for "missed due to competition"). */
  pattern?: "hatched";
  /** "line" renders a short stroke instead of a square (for line charts). */
  shape?: "square" | "line" | "dash";
};

/**
 * HTML legend rendered outside the Plotly canvas. Used where a Plotly legend
 * would eat into a small chart panel or overlap the data.
 */
export function ChartLegend({
  items,
  className,
  ariaLabel = "Chart legend",
}: {
  items: ChartLegendItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={className ? `chart-legend ${className}` : "chart-legend"} aria-label={ariaLabel}>
      {items.map((item) => (
        <span key={item.label} className="chart-legend__item">
          <span
            className={[
              "chart-legend__swatch",
              item.pattern === "hatched" ? "chart-legend__swatch--hatched" : "",
              item.shape === "line" ? "chart-legend__swatch--line" : "",
              item.shape === "dash" ? "chart-legend__swatch--dash" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              background: item.pattern === "hatched" ? undefined : item.color,
              color: item.color,
              borderColor: item.borderColor ?? "transparent",
            }}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
