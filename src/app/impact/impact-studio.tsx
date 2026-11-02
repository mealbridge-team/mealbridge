"use client";

import { useMemo, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import {
  AgStudioAiModule,
  createAiHarness,
  directLlmRunner,
  studioTheme,
  type AgAiTool,
  type AgDataSourcesDefinition,
  type AgReportState,
  type AgStudioMode,
} from "ag-studio";
import type { FundRow, MoneyRow, RescueRow } from "@/lib/impact-data";
import { Sparkles } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { geminiAdapter } from "./gemini-adapter";

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

const INITIAL_STATE = {
  selectedPageId: "impact",
  pages: [
    {
      id: "impact",
      widgets: {
        areaFilter: {
          type: "button-filter",
          dataMapping: { value: [{ id: "rescues.area" }] },
          format: { title: { enabled: false }, subtitle: { enabled: false }, style: { selection: { type: "multiple" } } },
        },
        meals: { type: "value", dataMapping: { value: [{ id: "rescues.meals", aggregation: "sum" }] }, format: title("Meals delivered") },
        pounds: { type: "value", dataMapping: { value: [{ id: "rescues.pounds", aggregation: "sum" }] }, format: title("Pounds of food saved") },
        paid: { type: "value", dataMapping: { value: [{ id: "rescues.reimbursementUsd", aggregation: "sum" }] }, format: title("Reimbursed to drivers") },
        speed: { type: "value", dataMapping: { value: [{ id: "rescues.minutesToDeliver", aggregation: "avg" }] }, format: title("Minutes, post to plate") },
        weekly: {
          type: "column-chart-stacked",
          dataMapping: { categoryKey: [{ id: "rescues.week" }], valueKey: [{ id: "rescues.meals", aggregation: "sum" }], legendKey: [{ id: "rescues.area" }] },
          format: title("Meals delivered each week", "By the area the food came from"),
        },
        funders: {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "rescues.fundedBy" }], valueKey: [{ id: "rescues.reimbursementUsd", aggregation: "sum" }] },
          format: title("Who paid for the drives", "Restaurants never pay per pickup"),
        },
        restaurants: {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [{ id: "rescues.restaurant" }], valueKey: [{ id: "rescues.meals", aggregation: "sum" }] },
          format: title("Meals by restaurant"),
        },
        weekdays: {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [{ id: "rescues.weekday" }], valueKey: [{ id: "rescues.meals", aggregation: "sum" }] },
          format: title("Busiest nights"),
        },
        outcomes: {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "rescues.outcome" },
              { id: "rescues.meals", aggregation: "sum" },
              { id: "rescues.reimbursementUsd", aggregation: "sum" },
            ],
          },
          format: title("Outcomes", "Food the safety rules turned away is counted too"),
        },
      },
      widgetLayout: {
        areaFilter: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 6 },
        meals: { xTrack: 0, yTrack: 6, xSpan: 6, ySpan: 7 },
        pounds: { xTrack: 6, yTrack: 6, xSpan: 6, ySpan: 7 },
        paid: { xTrack: 12, yTrack: 6, xSpan: 6, ySpan: 7 },
        speed: { xTrack: 18, yTrack: 6, xSpan: 6, ySpan: 7 },
        weekly: { xTrack: 0, yTrack: 13, xSpan: 15, ySpan: 20 },
        funders: { xTrack: 15, yTrack: 13, xSpan: 9, ySpan: 20 },
        restaurants: { xTrack: 0, yTrack: 33, xSpan: 9, ySpan: 18 },
        weekdays: { xTrack: 9, yTrack: 33, xSpan: 8, ySpan: 18 },
        outcomes: { xTrack: 17, yTrack: 33, xSpan: 7, ySpan: 18 },
      },
    },
    {
      id: "money",
      widgets: {
        moneyIn: {
          type: "column-chart-stacked",
          dataMapping: { categoryKey: [{ id: "money.week" }], valueKey: [{ id: "money.amountUsd", aggregation: "sum" }], legendKey: [{ id: "money.flow" }] },
          format: title("Money in and out each week", "Every dollar in is spent on a verified delivery"),
        },
        fundsNow: {
          type: "grid",
          dataMapping: { cols: [{ id: "funds.fund" }, { id: "funds.kind" }, { id: "funds.availableUsd", aggregation: "sum" }] },
          format: title("Funds right now"),
        },
        flows: {
          type: "pie-chart",
          dataMapping: { categoryKey: [{ id: "money.flow" }], valueKey: [{ id: "money.amountUsd", aggregation: "sum" }] },
          format: title("Where the money moves"),
        },
      },
      widgetLayout: {
        moneyIn: { xTrack: 0, yTrack: 0, xSpan: 16, ySpan: 22 },
        flows: { xTrack: 16, yTrack: 0, xSpan: 8, ySpan: 22 },
        fundsNow: { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 18 },
      },
    },
  ],
} as unknown as AgReportState;

// Matches the site: white surfaces, hairline borders, one brand green. The chart palette leads with
// the green and stays distinguishable for colour-blind readers (blue, orange, then neutrals).
const mealbridgeTheme = studioTheme.withParams({
  accentColor: "#0d5a3b",
  backgroundColor: "#ffffff",
  foregroundColor: "#111412",
  textColor: "#111412",
  subtleTextColor: "#5b605c",
  borderColor: "#e3e2dc",
  borderRadius: 8,
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  studioCanvasBackgroundColor: "#f6f5f1",
  studioWidgetBackgroundColor: "#ffffff",
  studioWidgetBorderRadius: 12,
  studioWidgetTitleFontFamily: "var(--font-inter-tight), var(--font-inter), system-ui, sans-serif",
  studioWidgetTitleFontSize: 15,
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
  chartFontFamily: "var(--font-inter), system-ui, sans-serif",
});

// A MealBridge tool the built-in agents don't have: what's happening on the road right now.
const tonightTool: AgAiTool = {
  name: "get_tonight",
  description: "Live MealBridge operations right now: tonight's rescues and their status, drivers on the road with ETAs, and how much each fund can still spend.",
  kind: "client",
  schema: () => ({
    name: "get_tonight",
    description: "Live MealBridge operations right now: tonight's rescues, drivers on the road, and fund balances.",
    parameters: { type: "object", properties: {} },
  }),
  async execute(_call, ctx) {
    try {
      const res = await fetch("/api/insights/tonight", { signal: ctx.signal });
      return ctx.success(JSON.stringify(await res.json()));
    } catch {
      return ctx.error("Couldn't reach the live operations feed.");
    }
  },
};

const INSIGHTS_INSTRUCTIONS = `You are the MealBridge Insights agent, an analyst for a food-rescue nonprofit in the San Francisco Bay Area.
Restaurants post surplus food; a Matcher picks a shelter; the trip's driver reimbursement is reserved before dispatch from (1) the restaurant's compliance plan, (2) area donors, (3) sponsors and city grants, (4) the general fund; drivers are reimbursed through PayPal Payouts once photo, GPS and the shelter's confirmation agree.
Answer questions about impact, money and operations with numbers from the dashboard data (use view_schema and execute_query) or from get_tonight for what is happening right now.
When the user wants a chart, table or page built or changed, delegate to the lead agent with a clear, specific brief (which fields, which aggregation, which chart type), then check the result with view_report before telling the user what changed. If the delegate failed or the widget isn't there, say so plainly.
Be concise and warm. Lead with the answer and the number. Never invent figures; say when the data can't answer something. Shelter labels are deliberately approximate for privacy; never speculate about locations.`;

export default function ImpactStudio({ rescues, money, funds }: { rescues: RescueRow[]; money: MoneyRow[]; funds: FundRow[] }) {
  const [mode, setMode] = useState<AgStudioMode>("view");
  const data = useMemo(() => dataSources(rescues, money, funds), [rescues, money, funds]);

  return (
    <AgStudioProvider modules={[AgStudioAiModule]} licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {mode === "view"
            ? "Filter, cross-filter and drill in. Click any bar or slice to filter the rest."
            : "Ask the Insights agent anything, or drag fields to build your own view. Changes stay in your browser."}
        </p>
        <button
          type="button"
          onClick={() => setMode(mode === "view" ? "edit" : "view")}
          className={mode === "view" ? buttonClass.primary : buttonClass.secondary}
        >
          {mode === "view" ? (
            <>
              <Sparkles className="h-4 w-4" aria-hidden /> Ask the Insights agent
            </>
          ) : (
            "Back to the dashboard"
          )}
        </button>
      </div>
      <div className="h-[860px] overflow-hidden rounded-2xl border border-line">
        <AgStudio
          data={data}
          initialState={INITIAL_STATE}
          mode={mode}
          theme={mealbridgeTheme}
          panels={{ edit: { left: ["data"], right: ["ai", "edit"] }, view: { left: [], right: [] } }}
          ai={({ api }) =>
            createAiHarness(api, ({ tools, builtIn }) => {
              const adapter = geminiAdapter();
              const insights = directLlmRunner({
                id: "insights",
                name: "Insights",
                description: "MealBridge's analyst: impact, money and live operations. Builds charts by briefing Studio's agents.",
                adapter,
                instructions: () => INSIGHTS_INSTRUCTIONS,
                tools: (ctx) => [ctx.studio.viewSchema(), ctx.studio.executeQuery(), ctx.studio.viewReport(), tonightTool, tools.delegateTo(["lead"])],
                maxTurns: 14,
              });
              const studioAgents = (["lead", "data", "page", "planning", "widget"] as const).map((id) => directLlmRunner({ ...builtIn[id], adapter }));
              return {
                agents: [insights, ...studioAgents],
                primary: "insights",
                promptStarters: [
                  { label: "What's happening tonight?", prompt: "What's happening on the road tonight, and is any rescue stuck waiting for money?" },
                  { label: "Which area needs donors?", prompt: "Which area relies most on donors and the general fund, and how much did that cost over the last six weeks?" },
                  { label: "Chart meals per driver", prompt: "Add a bar chart of meals delivered per driver to this page." },
                  { label: "Explain the money", prompt: "In three sentences, explain where the money came from and where it went over the last six weeks." },
                ],
              };
            })
          }
        />
      </div>
    </AgStudioProvider>
  );
}
