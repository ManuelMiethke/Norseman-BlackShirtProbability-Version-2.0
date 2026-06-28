import { Suspense, lazy, useState } from "react";
import type { Data, Layout, Config } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js"));

function stripHeight(layout: Partial<Layout> | undefined) {
  if (!layout) {
    return {};
  }

  const next = { ...layout };
  delete next.height;
  return next;
}

export function PlotlyChart({
  data,
  layout,
  previewLayout,
  expandedLayout,
  config,
  className,
}: {
  data: Data[];
  layout: Partial<Layout>;
  previewLayout?: Partial<Layout>;
  expandedLayout?: Partial<Layout>;
  config?: Partial<Config>;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const defaultLayoutWithoutFixedHeight = stripHeight(layout);
  const previewLayoutWithoutFixedHeight =
    previewLayout ? stripHeight(previewLayout) : defaultLayoutWithoutFixedHeight;
  const expandedLayoutWithoutFixedHeight =
    expandedLayout ? stripHeight(expandedLayout) : defaultLayoutWithoutFixedHeight;
  const mergedPreviewLayout = {
    autosize: true,
    ...defaultLayoutWithoutFixedHeight,
    ...previewLayoutWithoutFixedHeight,
  };
  const mergedExpandedLayout = {
    autosize: true,
    ...defaultLayoutWithoutFixedHeight,
    ...expandedLayoutWithoutFixedHeight,
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
        aria-label="Open chart fullscreen"
        onClick={() => setIsExpanded(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded(true);
          }
        }}
      >
        <Suspense fallback={<div className="plot-card__loading">Loading chart…</div>}>
          <Plot
            data={data}
            layout={mergedPreviewLayout}
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
                layout={mergedExpandedLayout}
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
