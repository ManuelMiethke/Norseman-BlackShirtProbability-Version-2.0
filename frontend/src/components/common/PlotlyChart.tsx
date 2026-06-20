import { Suspense, lazy } from "react";
import type { Data, Layout, Config } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js"));

export function PlotlyChart({
  data,
  layout,
  config,
  className,
}: {
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  className?: string;
}) {
  return (
    <div className={className ? `plot-card ${className}` : "plot-card"}>
      <Suspense fallback={<div className="plot-card__loading">Loading chart renderer…</div>}>
        <Plot
          data={data}
          layout={{
            autosize: true,
            ...layout,
          }}
          config={{
            displayModeBar: false,
            responsive: true,
            ...config,
          }}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />
      </Suspense>
    </div>
  );
}
