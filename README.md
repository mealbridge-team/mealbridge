# MealBridge

MealBridge turns tonight's surplus restaurant food into tonight's shelter meals, and reimburses the
volunteer who drives it there before they get home. Built for the PayPal AI Hackathon.

**Live demo:** https://mealbridge-6py5.onrender.com

**Demo video (2:45):** https://youtu.be/ySyRben_cPo

> Hackathon prototype. All money is PayPal **sandbox** money, and every business, shelter and
> person in the demo is fictional. The demo is set in the San Francisco Bay Area.

## Try it in two minutes (for judges)

No sign-up. Press **Try the demo**, then **Start the guided rescue**. A guide pinned to the bottom of
the screen walks you through one rescue in four steps and switches you to the next person when it's
their turn (each restaurant, driver, shelter and sponsor has their own private page):

1. **Restaurant posts:** tap an example note (or type one, e.g. "about 30 portions of veg biryani,
   kept hot, ready till 10pm") and press **Post surplus**. Gemini reads it, the food-safety rules
   check it, a shelter is matched, the trip's money is reserved and a driver is booked.
2. **Driver delivers:** press **Demo: simulate the drive**, add a photo of the food, press **I've
   picked it up**. Then **Demo: I'm at the shelter**, add a new photo of the same kind of food and
   press **Delivered**. Gemini checks the drop-off photo; one that shows no food, different food, or
   the pickup photo again is held for a coordinator (the guide says so).
3. **Shelter confirms:** press **Received**. Photo, GPS and the shelter's tap agree, so PayPal
   Payouts reimburses the driver.
4. **Driver paid:** the guide shows the payout and links to **Impact**: count-ups, a map of every
   delivered route, who paid for the drives, AG Studio charts that cross-filter, and the Insights
   agent.

Then explore freely from **Try the demo**: sign in as a **Sponsor** to top up a fund with a PayPal
invoice, or **Donate** to fund a waiting pickup.

**Coordinator console** (top strip): read-only without the passcode. With it you can approve held
   deliveries, invoice sponsors and reset the demo. Passcode for judges: _shared in the Devpost
   submission_.

Shelters keep evening hours in California. So the demo works at any hour from anywhere, the
opening-hours check runs on a labelled **demo clock** that treats daytime as 7pm Pacific.

## How the money works

Restaurants never pay per pickup, because a fee at the moment they decide whether to bin the food
works against donating. Instead, every trip's fuel reimbursement is **reserved before a driver is
dispatched**, from the first source that can cover it:

1. the restaurant's own monthly compliance plan (**PayPal Subscriptions**), if it has one
2. donors who earmarked that area (**PayPal Checkout**, JS SDK v6 and Orders v2)
3. sponsors and city food-recovery grants (**PayPal Invoicing**), area-specific first
4. the general rescue fund

A trip nobody can fund yet waits as **unfunded**, and donors see it on the Donate page. When a
delivery is verified, the reserved money goes to the driver with **PayPal Payouts** (PayPal or
Venmo). **PayPal webhooks** settle the ledger, and every PayPal reference is unique in the ledger,
so a replayed webhook never counts money twice.

Why restaurants still sign up for the plan: California's SB 1383 requires large food businesses to
donate edible surplus to food recovery organisations and keep records. The plan funds their own
pickups first and produces those records as a CSV ready to file.

## What's in it

| Part | What it does |
| --- | --- |
| Restaurants | One photo or note. Live progress of each rescue. Compliance plan via PayPal Subscriptions; SB 1383 records CSV. |
| Drivers | One job at a time, the reimbursement shown up front, live location sharing (or a labelled simulated drive) that doubles as proof of arrival, on/off-duty switch, earnings. |
| Shelters and NGOs | Food arriving with a live map and ETA; one tap to confirm. Pause deliveries or set tonight's capacity; mark needs filled. Confidential shelters never appear exactly on public maps. |
| Sponsors and city grants | Fund balance, rescues and meals funded, self-serve top-up through a PayPal invoice, invoice history with pay links. |
| Coordinator console | Only exceptions: held deliveries, payout failures, unfunded trips. Live map, funds, sponsor invoices with an AI-drafted friendly reminder. Syncs with PayPal every two minutes. |
| Donate | PayPal Checkout tied to a specific waiting rescue or an area fund. |
| Impact (public) | Totals, a map of delivery routes, AG Studio charts over the real ledger and trip records, and an Insights agent to ask about them. |

## AI tools used

All AI runs on **Google Gemini 3.5 Flash-Lite** (free tier) through the Vercel AI SDK: reading
photos and notes, checking drop-off photos, short explanations and the dashboard agents. (Flash's
free tier allows only 20 requests a day; set `GEMINI_MODEL` to use it on a paid key.) Decisions about money and food
safety are made by plain code; the models handle messy input and explanations, and can only send
something to a person, never approve it.

- **Intake agent:** reads the restaurant's photo and note (any language) into a structured listing:
  portions, allergens, diet tags, how the food is held.
- **Matcher agent:** the shelter is chosen by a deterministic score (diet rules, capacity, distance,
  opening hours); Gemini writes the one-line reason shown to the coordinator and restaurant.
- **Dispatch agent:** books the nearest free driver once a trip is funded, and re-plans when a
  driver drops out.
- **Verification agent:** Gemini checks the drop-off photo against the listing. A payout needs three
  signals: photo, GPS near the shelter, and the shelter's confirmation. Fewer goes to a coordinator.
- **Treasurer:** reserves each trip's money before dispatch and pays the driver with PayPal Payouts.
- **Nudge agent:** drafts a warm, specific reminder for an unpaid sponsor invoice from the ledger
  ("your support has funded 31 trips and 1,040 meals"); the coordinator edits it and PayPal sends it.
- **Insights agent:** answers questions on the impact page from the same public-safe ledger and trip
  numbers the page shows, plus what's on the road tonight. It runs on the server
  (`/api/insights/ask`), so the Gemini key never reaches the browser, and it is paced to the free
  tier's limits with a plain-numbers fallback when Gemini is busy.

## Run it locally

Needs Node 22+. No database or API keys required.

```bash
npm install
npm run setup   # creates the embedded database and loads the demo (six weeks of history plus tonight)
npm run dev
```

Without keys the app runs in **demo mode**: PayPal calls are simulated and the agents use simple
rules. `GET /api/health` shows which mode each part is in. To use the real services, copy
`.env.example` to `.env.local` and fill in a Gemini key and PayPal sandbox credentials.

```bash
npm test            # safety, matching, funding, subscriptions, invoices and whole rescues end to end
npm run check:keys  # confirms your Gemini and PayPal keys work (never prints them)
```

### PayPal sandbox setup

The REST app must belong to a **US sandbox business account** (PayPal refuses payouts from some
countries with `PAYOUT_NOT_AVAILABLE`). In the developer dashboard: create a Business sandbox account
with country United States, create the REST app under it, and in the app's features enable
**Payouts**, **Subscriptions** and **Invoicing**.

Webhook events used: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.PAYOUTS-ITEM.SUCCEEDED / FAILED / BLOCKED /
RETURNED / DENIED / UNCLAIMED`, `BILLING.SUBSCRIPTION.ACTIVATED / CANCELLED`, `PAYMENT.SALE.COMPLETED`,
`INVOICING.INVOICE.PAID`. The app also asks PayPal directly (payouts, subscriptions, invoices), so
the ledger catches up even if a webhook is missed.

## Deploy on Render

`render.yaml` is a Render Blueprint: a Node web service plus a Postgres database. In Render choose
**New → Blueprint**, pick this repo, and fill in the secret values it asks for (the same ones as
`.env.local`, plus `DEMO_PASSCODE`). On first start the app creates its tables and loads the demo.
Then add a PayPal sandbox webhook pointing at `https://<your-app>.onrender.com/api/paypal/webhook`
and set `PAYPAL_WEBHOOK_ID`.

On the public demo, the coordinator's actions are behind `DEMO_PASSCODE`; restaurant, driver,
shelter and donor screens are open so anyone can run a rescue. Posting is rate-limited per visitor,
and Gemini calls are paced per minute with a daily cap, after which the agents fall back to rules
(labelled in the UI).

## Food safety rules (assumptions)

Safety decisions are made by code in `src/domain/food-safety.ts`, never by the model. The AI can
send a listing to human review but can't approve one the rules reject.

- Held unrefrigerated: at most 2 hours since cooking. Held hot: 4 hours. Held cold: 24 hours.
  Based on the time-as-a-control approach in the FDA Food Code and California Retail Food Code,
  made stricter for unrefrigerated food.
- Raw meat and raw seafood are never accepted.
- At least 45 minutes of safe time must remain for pickup and delivery.
- Donors are protected by the federal Bill Emerson Good Samaritan Food Donation Act.

This is a prototype, not legal guidance.

## Built with

Next.js 16, React 19, Tailwind CSS 4, Drizzle ORM (Postgres; embedded PGlite locally), Vercel AI
SDK with Google Gemini, PayPal REST APIs and JS SDK v6, AG Studio (AG Grid), Leaflet with
OpenStreetMap, Render.

## License

MIT, see [LICENSE](LICENSE).
