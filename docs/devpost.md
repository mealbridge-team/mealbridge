# Devpost submission draft

Copy each section into the matching Devpost field and edit it in your own voice.

## Tagline (one line)

Tonight's surplus restaurant food, to tonight's shelter meals. AI agents do the matching; PayPal
reimburses the volunteer driver before they get home.

## Inspiration

In the Bay Area, restaurants throw away cooked food every night a few miles from shelters that need
it. The food isn't the hard part. The hard part is the last mile: someone has to decide where it
goes, check it's safe, find a driver, and make sure that driver isn't out of pocket. California's
SB 1383 now requires large food businesses to donate edible surplus and keep records, but the
logistics still run on phone calls and spreadsheets.

## What it does

A restaurant snaps a photo or types a note. Agents take it from there:

- The **Intake agent** (Gemini) reads dishes, portions, allergens and how the food is held. Plain-code
  food-safety rules decide if it can go.
- The **Matcher** picks the shelter that can use it tonight: diet rules, capacity, distance and
  opening hours, then explains the choice in one sentence.
- The **Treasurer** reserves the driver's fuel reimbursement before anyone moves, from the
  restaurant's compliance plan (PayPal Subscriptions), then area donors (PayPal Checkout), then
  sponsors and city grants (PayPal Invoicing), then a general fund. No volunteer ever drives unpaid.
- **Dispatch** books the nearest free driver. The shelter watches the food arrive on a live map.
- **Verification** needs three signals to agree: the drop-off photo (checked by Gemini), GPS at the
  shelter, and the shelter's tap. Then **PayPal Payouts** sends the reimbursement to PayPal or Venmo.
- A **Nudge agent** drafts friendly reminders for unpaid sponsor invoices from real impact numbers.
- A **sponsor portal** shows each sponsor's fund, the rescues it paid for, and lets them top up
  through a PayPal invoice they can pay straight away.
- **Shelters** can pause deliveries for the night or change how much they can take, and **drivers**
  go on and off duty; the matcher and dispatch respect both.
- A public **impact page** shows every meal, mile and dollar: count-ups, an animated map of delivery
  routes, AG Studio charts that cross-filter, and an **Insights agent** that answers questions from
  the live ledger.

Restaurants never pay per pickup: a fee at the moment they decide whether to bin the food works
against donating.

## How we built it

- **Next.js 16** (App Router, server actions, Cache Components) and React 19, styled with Tailwind 4.
- **PayPal:** Orders v2 with the JS SDK v6 for donations; Payouts (PayPal and Venmo) for drivers;
  Subscriptions for the restaurant plan; Invoicing for sponsors; webhooks with signature
  verification; an idempotent ledger keyed on PayPal references so replays never double-count.
- **AI:** Google Gemini 3.5 Flash-Lite through the Vercel AI SDK. Models only read messy input
  and explain decisions; money and food safety stay in deterministic, tested code.
- **AG Studio:** the impact charts (weekly meals by area, who paid for the drives, money in and out,
  funds right now), themed to the site and laid straight onto the page with cross-filtering.
- **Render:** web service plus Postgres from a Blueprint.
- **Leaflet and OpenStreetMap** for live tracking, with confidential shelters blurred on public maps.

## Challenges we ran into

- Getting the money right: reserving funds before dispatch, all-or-nothing allocation across four
  sources, and settling payouts from webhooks or by asking PayPal, whichever comes first.
- Gemini's free tier allows about five requests a minute on Flash. A multi-agent dashboard run makes
  many calls, and Flash allows only 20 a day, so everything runs on Flash-Lite and calls queue per
  model instead of failing.
- Our first sandbox business account was outside the US, which PayPal doesn't allow for payouts.
- Shelters keep evening hours, but judges try demos at any hour, so the demo has a labelled
  "demo evening" clock for opening hours only.

## Accomplishments that we're proud of

- A full rescue runs end to end on the real PayPal sandbox: listing, match, funding, dispatch,
  live tracking, verification and a real payout.
- Every agent can only escalate to a human, never approve money or unsafe food.
- An Insights agent that answers from live ledger data and never invents a figure.

## What we learned

Agents are most useful at the messy edges (reading a photo, explaining a choice, drafting a kind
reminder), while the parts people must trust, like money and food safety, belong in plain code.

## What's next for MealBridge

Real accounts and sign-in, SMS for drivers, a pilot with one Oakland food-recovery organisation, and
SB 1383 reports in each county's own format.

## Built with

nextjs, react, typescript, tailwindcss, postgresql, drizzle, paypal, paypal-payouts,
paypal-subscriptions, paypal-invoicing, google-gemini, vercel-ai-sdk, ag-grid, ag-studio, leaflet,
openstreetmap, render

## AI tools field

Google Gemini 3.5 Flash-Lite: vision for reading food photos and checking drop-off photos, plus
match explanations, sponsor reminder drafts, and the Insights agent on the impact page, called through the Vercel AI SDK. Claude Code was used as a coding assistant.

## Links

- Live demo: https://mealbridge-6py5.onrender.com
- To try it: open the live demo, press **Try the demo**, then **Start the guided rescue**. A guide at
  the bottom of the screen walks you through one rescue in about two minutes.
- Coordinator passcode for judges: (add it here, not in the public repo)
- Repo: (public GitHub URL)
- Video: https://youtu.be/ySyRben_cPo
