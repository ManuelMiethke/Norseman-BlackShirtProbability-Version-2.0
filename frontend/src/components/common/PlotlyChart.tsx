import { Suspense, lazy, useState } from "react";
import type { Data, Layout, Config } from "plotly.js";

import { FONT_BODY, PALETTE } from "@/lib/theme";

const Plot = lazy(() => import("react-plotly.js"));

type LooseLayout = Record<string, any>;

const AXIS_KEY = /^[xy]axis\d*$/;
const SCENE_KEY = /^scene\d*$/;

/**
 * Applies the shared dark chart theme on top of each chart's own layout.
 * Backgrounds become transparent (the panel colour comes from `.plot-card`
 * in global.css), and grid lines, fonts and hover labels are unified so every
 * chart reads as part of one system. Chart-specific colours for traces and
 * annotations are left untouched.
 */
function applyTheme(layout: Partial<Layout>): Partial<Layout> {
  const source = layout as LooseLayout;
  const next: LooseLayout = {
    ...source,
    paper_bgcolor: PALETTE.transparent,
    plot_bgcolor: PALETTE.transparent,
    font: {
      ...(source.font ?? {}),
      family: FONT_BODY,
      color: source.font?.color ?? PALETTE.text,
    },
    hoverlabel: {
      bgcolor: PALETTE.hoverBg,
      bordercolor: "rgba(255, 255, 255, 0.18)",
      ...(source.hoverlabel ?? {}),
      font: {
        family: FONT_BODY,
        color: PALETTE.text,
        size: 12,
        ...(source.hoverlabel?.font ?? {}),
      },
    },
  };

  if (source.legend) {
    next.legend = {
      ...source.legend,
      font: { ...(source.legend.font ?? {}), family: FONT_BODY },
    };
  }

  for (const key of Object.keys(source)) {
    if (AXIS_KEY.test(key) && source[key]) {
      next[key] = {
        ...source[key],
        gridcolor: PALETTE.grid,
        zerolinecolor: PALETTE.axisLine,
        linecolor: PALETTE.axisLine,
      };
    } else if (SCENE_KEY.test(key) && source[key]) {
      next[key] = { ...source[key], bgcolor: PALETTE.transparent };
    }
  }

  return next as Partial<Layout>;
}

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
  const mergedPreviewLayout = applyTheme({
    autosize: true,
    ...defaultLayoutWithoutFixedHeight,
    ...previewLayoutWithoutFixedHeight,
  });
  const mergedExpandedLayout = applyTheme({
    autosize: true,
    ...defaultLayoutWithoutFixedHeight,
    ...expandedLayoutWithoutFixedHeight,
  });
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
