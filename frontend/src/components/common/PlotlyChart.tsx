import { Suspense, lazy, useState } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { height: _previewHeight, ...layoutWithoutFixedHeight } = layout;
  const mergedLayout = {
    autosize: true,
    ...layoutWithoutFixedHeight,
  };
  const mergedConfig = {
    displayModeBar: false,
    responsive: true,
    ...config,
  };

  return (
    <>
      <div
        className={className ? `plot-card ${className}` : "plot-card"}
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded(true);
          }
        }}
      >
        <button
          type="button"
          className="plot-card__expand"
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded(true);
          }}
          aria-label="Open chart fullscreen"
        >
          ⤢
        </button>

        <Suspense fallback={<div className="plot-card__loading">Loading chart…</div>}>
          <Plot
            data={data}
            layout={mergedLayout}
            config={mergedConfig}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </Suspense>
      </div>

      {isExpanded ? (
        <div
          className="plot-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsExpanded(false)}
        >
          <div className="plot-modal__panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="plot-modal__close"
              onClick={() => setIsExpanded(false)}
              aria-label="Close fullscreen chart"
            >
              ×
            </button>

            <Suspense fallback={<div className="plot-card__loading">Loading chart…</div>}>
              <Plot
                data={data}
                layout={mergedLayout}
                config={mergedConfig}
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
              />
            </Suspense>
          </div>
        </div>
      ) : null}
    </>
  );
}
