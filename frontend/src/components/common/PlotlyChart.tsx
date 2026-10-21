import { Suspense, lazy, useState, type ReactNode } from "react";
import type { Data, Layout, Config } from "plotly.js";

import { ChartLegend, type ChartLegendItem } from "@/components/common/ChartLegend";
import { FONT_BODY, PALETTE } from "@/lib/theme";

const Plot = lazy(() => import("react-plotly.js"));

type LooseLayout = Record<string, any>;
type Variant = "preview" | "expanded";

const AXIS_KEY = /^[xy]axis\d*$/;
const SCENE_KEY = /^scene\d*$/;

/** One type scale for every chart; the fullscreen view gets a larger step. */
const TYPE_SCALE: Record<Variant, {
  base: number;
  tick: number;
  axisTitle: number;
  legend: number;
  title: number;
  annotationMax: number;
}> = {
  preview: { base: 11, tick: 10.5, axisTitle: 11.5, legend: 11, title: 12.5, annotationMax: 13 },
  expanded: { base: 13, tick: 12.5, axisTitle: 14, legend: 13, title: 16, annotationMax: 17 },
};

function withFontSize(font: LooseLayout | undefined, size: number) {
  return { ...(font ?? {}), family: FONT_BODY, size };
}

function themeAxis(axis: LooseLayout, scale: (typeof TYPE_SCALE)[Variant]) {
  const title =
    typeof axis.title === "string"
      ? { text: axis.title }
      : axis.title
        ? { ...axis.title }
        : undefined;
  if (title) {
    title.font = withFontSize(title.font, scale.axisTitle);
    title.standoff = title.standoff ?? 6;
  }

  return {
    ...axis,
    ...(title ? { title } : {}),
    automargin: true,
    tickfont: withFontSize(axis.tickfont, scale.tick),
    gridcolor: PALETTE.grid,
    zerolinecolor: PALETTE.axisLine,
    linecolor: PALETTE.axisLine,
  };
}

/**
 * Applies the shared chart theme on top of each chart's own layout.
 *
 * - Backgrounds become transparent (the panel colour comes from `.plot-card`).
 * - Fonts, grid lines and hover labels follow one type scale.
 * - Every axis uses `automargin`, so tick labels are never clipped.
 * - Legends are placed horizontally above the plot area so they never cover
 *   data. A chart can opt out with `layout.meta = { legend: "keep" }`.
 */
function applyTheme(layout: Partial<Layout>, variant: Variant): Partial<Layout> {
  const source = layout as LooseLayout;
  const scale = TYPE_SCALE[variant];
  const next: LooseLayout = {
    ...source,
    paper_bgcolor: PALETTE.transparent,
    plot_bgcolor: PALETTE.transparent,
    font: {
      ...(source.font ?? {}),
      family: FONT_BODY,
      size: scale.base,
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

  if (source.title && typeof source.title === "object") {
    next.title = {
      ...source.title,
      font: withFontSize(source.title.font, Math.min(source.title.font?.size ?? scale.title, scale.title)),
    };
  }

  const keepLegend = source.meta?.legend === "keep";
  const legendSource: LooseLayout = source.legend ?? {};
  next.legend = keepLegend
    ? { ...legendSource, font: withFontSize(legendSource.font, scale.legend) }
    : {
        ...legendSource,
        title: undefined,
        orientation: "h",
        x: 0,
        xanchor: "left",
        y: 1.01,
        yanchor: "bottom",
        bgcolor: PALETTE.transparent,
        borderwidth: 0,
        itemsizing: "constant",
        tracegroupgap: 0,
        font: withFontSize(legendSource.font, scale.legend),
      };

  if (Array.isArray(source.annotations)) {
    next.annotations = source.annotations.map((annotation: LooseLayout) => {
      const size = annotation.font?.size;
      if (typeof size !== "number" || size <= scale.annotationMax) {
        return { ...annotation, font: { ...(annotation.font ?? {}), family: FONT_BODY } };
      }
      return { ...annotation, font: { ...annotation.font, family: FONT_BODY, size: scale.annotationMax } };
    });
  }

  for (const key of Object.keys(source)) {
    if (AXIS_KEY.test(key) && source[key]) {
      next[key] = themeAxis(source[key], scale);
    } else if (SCENE_KEY.test(key) && source[key]) {
      next[key] = { ...source[key], bgcolor: PALETTE.transparent };
    }
  }

  return next as Partial<Layout>;
}

function pickColor(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Builds an HTML legend from the chart's own traces (name + colour), so a
 * chart can drop its Plotly legend without losing the information.
 */
function deriveLegend(data: Data[]): ChartLegendItem[] {
  const items: ChartLegendItem[] = [];
  const seen = new Set<string>();

  for (const raw of data) {
    const trace = raw as LooseLayout;
    if (!trace.name || trace.showlegend === false) {
      continue;
    }
    const key = String(trace.legendgroup ?? trace.name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const mode = String(trace.mode ?? "");
    const isLine = (trace.type === "scatter" || trace.type === undefined) && mode.includes("lines") && !trace.fill;
    const color =
      (trace.fill ? pickColor(trace.fillcolor) ?? pickColor(trace.line?.color) : undefined) ??
      pickColor(trace.line?.color) ??
      pickColor(trace.marker?.color) ??
      PALETTE.other;
    const dash = trace.line?.dash && trace.line.dash !== "solid";

    items.push({
      label: String(trace.name),
      color,
      shape: isLine ? (dash ? "dash" : "line") : "square",
      borderColor: color.toLowerCase() === "#ffffff" || color === "white" ? "rgba(0,0,0,0.3)" : undefined,
    });
  }

  return items;
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
  title,
  legend,
  headerExtra,
  htmlLegend = false,
}: {
  data: Data[];
  layout: Partial<Layout>;
  previewLayout?: Partial<Layout>;
  expandedLayout?: Partial<Layout>;
  config?: Partial<Config>;
  className?: string;
  /** Small caption shown above the chart inside the panel. */
  title?: string;
  /** HTML legend shown above the chart instead of the Plotly legend. */
  legend?: ChartLegendItem[];
  /** Extra content on the right of the panel header (e.g. a key figure). */
  headerExtra?: ReactNode;
  /** Replace the Plotly legend with an HTML legend derived from the traces. */
  htmlLegend?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const defaultLayoutWithoutFixedHeight = stripHeight(layout);
  const previewLayoutWithoutFixedHeight =
    previewLayout ? stripHeight(previewLayout) : defaultLayoutWithoutFixedHeight;
  const expandedLayoutWithoutFixedHeight =
    expandedLayout ? stripHeight(expandedLayout) : defaultLayoutWithoutFixedHeight;
  const legendItems = legend ?? (htmlLegend ? deriveLegend(data) : undefined);
  const legendOverride: Partial<Layout> = legendItems?.length ? { showlegend: false } : {};
  const mergedPreviewLayout = applyTheme(
    {
      autosize: true,
      ...defaultLayoutWithoutFixedHeight,
      ...previewLayoutWithoutFixedHeight,
      ...legendOverride,
    },
    "preview",
  );
  const mergedExpandedLayout = applyTheme(
    {
      autosize: true,
      ...defaultLayoutWithoutFixedHeight,
      ...expandedLayoutWithoutFixedHeight,
      ...legendOverride,
    },
    "expanded",
  );
  const mergedConfig = {
    displayModeBar: false,
    responsive: true,
    ...config,
  };
  const hasHeader = Boolean(title || legendItems?.length || headerExtra);
  const header = hasHeader ? (
    <div className="plot-panel__header">
      <div className="plot-panel__lead">
        {title ? <span className="plot-panel__title">{title}</span> : null}
        {legendItems?.length ? <ChartLegend items={legendItems} /> : null}
      </div>
      {headerExtra ? <div className="plot-panel__extra">{headerExtra}</div> : null}
    </div>
  ) : null;

  const card = (
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
  );

  return (
    <>
      {hasHeader ? (
        <div className="plot-panel">
          {header}
          {card}
        </div>
      ) : (
        card
      )}

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

            {header ? <div className="plot-modal__header">{header}</div> : null}

            <div className="plot-modal__body">
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
        </div>
      ) : null}
    </>
  );
}
