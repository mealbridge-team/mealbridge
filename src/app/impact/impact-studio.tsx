"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { studioTheme, type AgDataSourcesDefinition, type AgReportState } from "ag-studio";
import type { FundRow, MoneyRow, RescueRow } from "@/lib/impact-data";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Rows arrive as JSON, so dates are strings; Studio wants Date values for date fields.
const asDate = (key: string) => (row: Record<string, unknown>) => (row[key] ? new Date(`${row[key]}T12:00:00`) : null);

function dataSources(rescues: RescueRow[], money: MoneyRow[], funds: FundRow[]): AgDataSourcesDefinition {
  return {
    description: "MealBridge food rescues in the San Francisco Bay Area: surplus restaurant food delivered to shelters by volunteer drivers, who are reimbursed through PayPal.",
    sources: [
      {
        id: "rescues",
        name: "Rescues",
        description: "One row per rescue trip (or listing turned away for food safety).",
        data: rescues,
        fields: [
          { id: "rescueId", name: "Rescue", format: "textFormat", cardinality: "high" },
          { id: "date", name: "Date", format: "dateFormat", accessor: asDate("date") as never },
          { id: "week", name: "Week", format: "dateFormat", accessor: asDate("week") as never },
          { id: "weekday", name: "Weekday", format: "textFormat", cardinality: "low" },
          { id: "area", name: "Area", format: "textFormat", cardinality: "low" },
          { id: "restaurant", name: "Restaurant", format: "textFormat", cardinality: "low" },
          { id: "shelter", name: "Shelter", format: "textFormat", cardinality: "low", description: "Public label; confidential shelters are never named." },
          { id: "driver", name: "Driver", format: "textFormat", cardinality: "low" },
          { id: "outcome", name: "Outcome", format: "textFormat", cardinality: "low" },
          { id: "meals", name: "Meals delivered", format: "integerFormat" },
          { id: "pounds", name: "Pounds of food", format: "integerFormat", description: "Estimated at 0.75 lb per portion." },
          { id: "distanceKm", name: "Distance (km)", format: "decimalFormat" },
          { id: "reimbursementUsd", name: "Driver reimbursement", format: "currencyFormat", formatOptions: { format: USD } },
          { id: "fundedBy", name: "Funded by", format: "textFormat", cardinality: "low" },
          { id: "minutesToDeliver", name: "Minutes to deliver", format: "integerFormat", formatOptions: { format: WHOLE } },
        ],
      },
      {
        id: "money",
        name: "Money",
        description: "Every completed ledger entry: donations, restaurant plan payments and sponsor invoices in; driver reimbursements out.",
        data: money,
        fields: [
          { id: "date", name: "Date", format: "dateFormat", accessor: asDate("date") as never },
          { id: "week", name: "Week", format: "dateFormat", accessor: asDate("week") as never },
          { id: "direction", name: "Direction", format: "textFormat", cardinality: "low" },
          { id: "flow", name: "Flow", format: "textFormat", cardinality: "low" },
          { id: "fund", name: "Fund", format: "textFormat", cardinality: "low" },
          { id: "area", name: "Area", format: "textFormat", cardinality: "low" },
          { id: "amountUsd", name: "Amount", format: "currencyFormat", formatOptions: { format: USD } },
        ],
      },
      {
        id: "funds",
        name: "Funds now",
        description: "What each rescue fund can spend right now, after money held for trips on the road.",
        data: funds,
        fields: [
          { id: "fund", name: "Fund", format: "textFormat" },
          { id: "kind", name: "Kind", format: "textFormat", cardinality: "low" },
          { id: "availableUsd", name: "Available", format: "currencyFormat", formatOptions: { format: USD } },
        ],
      },
    ],
  };
}

const title = (text: string, subtitle?: string) => ({
  title: { enabled: true, text },
  ...(subtitle ? { subtitle: { enabled: true, text: subtitle } } : {}),
});

// Three charts and a filter, laid straight onto the page: no tabs, no editor, no inner scroll.
const WIDGETS = {
  areaFilter: {
    type: "button-filter",
    dataMapping: { value: [{ id: "rescues.area" }] },
    format: { title: { enabled: false }, subtitle: { enabled: false }, style: { selection: { type: "multiple" } } },
  },
  weekly: {
    type: "column-chart-stacked",
    dataMapping: { categoryKey: [{ id: "rescues.week" }], valueKey: [{ id: "rescues.meals", aggregation: "sum" }], legendKey: [{ id: "rescues.area" }] },
    format: title("Meals delivered each week", "By the area the food came from"),
  },
  moneyWeekly: {
    type: "column-chart-stacked",
    dataMapping: { categoryKey: [{ id: "money.week" }], valueKey: [{ id: "money.amountUsd", aggregation: "sum" }], legendKey: [{ id: "money.flow" }] },
    format: title("Money in and out each week", "Every dollar in pays for a verified delivery"),
  },
  fundsNow: {
    type: "grid",
    dataMapping: { cols: [{ id: "funds.fund" }, { id: "funds.availableUsd", aggregation: "sum" }] },
    format: title("Funds right now"),
  },
};

const WIDE = {
  areaFilter: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 5 },
  weekly: { xTrack: 0, yTrack: 5, xSpan: 24, ySpan: 20 },
  moneyWeekly: { xTrack: 0, yTrack: 25, xSpan: 15, ySpan: 21 },
  fundsNow: { xTrack: 15, yTrack: 25, xSpan: 9, ySpan: 21 },
};
const NARROW = {
  areaFilter: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 6 },
  weekly: { xTrack: 0, yTrack: 6, xSpan: 24, ySpan: 21 },
  moneyWeekly: { xTrack: 0, yTrack: 27, xSpan: 24, ySpan: 21 },
  fundsNow: { xTrack: 0, yTrack: 48, xSpan: 24, ySpan: 18 },
};

const reportState = (narrow: boolean) =>
  ({ selectedPageId: "impact", pages: [{ id: "impact", widgets: WIDGETS, widgetLayout: narrow ? NARROW : WIDE }] }) as unknown as AgReportState;

// Matches the site: cream page, white cards with hairline borders, one brand green. The chart palette
// leads with the green and stays distinguishable for colour-blind readers (blue, orange, then neutrals).
const mealbridgeTheme = studioTheme.withParams({
  accentColor: "#0d5a3b",
  backgroundColor: "#fcfaf6",
  foregroundColor: "#111412",
  textColor: "#111412",
  subtleTextColor: "#595e58",
  borderColor: "#e5dfd3",
  borderRadius: 8,
  fontFamily: "var(--font-body), system-ui, sans-serif",
  studioCanvasBackgroundColor: "#fcfaf6",
  studioWidgetBackgroundColor: "#ffffff",
  studioWidgetBorderRadius: 16,
  studioWidgetTitleFontFamily: "var(--font-display-face), var(--font-body), system-ui, sans-serif",
  studioWidgetTitleFontSize: 16,
  studioWidgetTitleFontWeight: 600,
  chartAccentColor: "#0d5a3b",
  chartPaletteFills1Color: "#0d5a3b",
  chartPaletteFills2Color: "#1d5a9e",
  chartPaletteFills3Color: "#d97a2b",
  chartPaletteFills4Color: "#7fb59a",
  chartPaletteFills5Color: "#8fa9cf",
  chartPaletteFills6Color: "#5b605c",
  chartPaletteFills7Color: "#e8c39a",
  chartPaletteFills8Color: "#b9bdb8",
  chartFontFamily: "var(--font-body), system-ui, sans-serif",
});

export default function ImpactStudio({ rescues, money, funds }: { rescues: RescueRow[]; money: MoneyRow[]; funds: FundRow[] }) {
  const data = useMemo(() => dataSources(rescues, money, funds), [rescues, money, funds]);
  // Client-only component (see impact-client.tsx), so the window is there to pick a layout once.
  const [initialState] = useState(() => reportState(window.innerWidth < 720));
  const [fitRef, fitPx] = useFitHeight();

  return (
    <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
      <div ref={fitRef} className="impact-charts" style={{ height: fitPx }}>
        <AgStudio
          style={{ height: "100%" }}
          data={data}
          initialState={initialState}
          mode="view"
          theme={mealbridgeTheme}
          layout={{ minWidth: 300, pagePadding: 0 }}
          panels={{ view: { left: [], right: [] } }}
        />
      </div>
    </AgStudioProvider>
  );
}

// AG Studio scrolls its canvas inside a fixed-height box, and stretches the canvas to fill it. We'd
// rather the charts sit on the page like any other section, so this grows the box to the bottom of the
// lowest widget (and follows layout changes).
function useFitHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(900);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const measure = () => {
      const widgets = host.querySelectorAll<HTMLElement>(".ag-studio-layout-widget");
      if (!widgets.length) return;
      const top = host.getBoundingClientRect().top;
      const needed = Math.ceil(Math.max(...[...widgets].map((w) => w.getBoundingClientRect().bottom)) - top) + 2;
      setPx((current) => (Math.abs(current - needed) > 2 ? needed : current));
    };
    const resize = new ResizeObserver(measure);
    const mutations = new MutationObserver(() => {
      host.querySelectorAll(".ag-studio-layout-widget").forEach((w) => resize.observe(w));
      measure();
    });
    mutations.observe(host, { childList: true, subtree: true });
    const first = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(first);
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);

  return [ref, px] as const;
}
