# MealBridge

MealBridge turns tonight's surplus restaurant food into tonight's shelter meals, and pays the
volunteer who drives it there before they get home. Built for the PayPal AI Hackathon.

> Hackathon prototype. All money is PayPal **sandbox** money, and every business, shelter and
> person in the demo data is fictional. The demo is set in the San Francisco Bay Area.

## How the money works

Restaurants never pay per pickup, because a fee at the moment they decide whether to bin the food
works against donating. Instead, every trip's fuel reimbursement is **reserved before a driver is
dispatched**, from the first source that can cover it:

1. the restaurant's own monthly compliance plan (PayPal Subscriptions), if it has one
2. donors who earmarked that area (PayPal Orders)
3. sponsors and city food-recovery grants (PayPal Invoicing), area-specific first
4. the general rescue fund

A trip nobody can fund yet waits as **unfunded** and donors are asked to cover it. When a
delivery is verified, the reserved money is sent to the driver with the PayPal Payouts API
(PayPal or Venmo), and PayPal webhooks settle the ledger.

Why restaurants still sign up for the plan: California's SB 1383 requires large food businesses to
donate edible surplus to food recovery organisations and keep records. The plan produces those
records, plus donation receipts.

## Run it locally

Needs Node 22+. No database or API keys required.

```bash
npm install
npm run setup   # creates the embedded database and loads the demo evening
npm run dev
```

Without keys the app runs in **demo mode**: PayPal calls are mocked and the Intake agent reads
notes with simple rules. `GET /api/health` shows which mode each part is in. To use the real
services, copy `.env.example` to `.env.local` and fill in a Gemini key and PayPal sandbox credentials.

```bash
npm test          # safety, matching and funding rules, plus whole rescues end to end
npm run check:keys  # confirms your Gemini and PayPal keys work (never prints them)
```

### PayPal sandbox setup

The app's REST app must belong to a **US sandbox business account**. PayPal refuses payouts from
accounts in some countries (`PAYOUT_NOT_AVAILABLE`), and a sandbox business account defaults to
the developer's own country. In the developer dashboard: Sandbox Accounts, create a Business
account with country United States, then create the REST app under that account and enable Payouts.

## Deploy on Render

`render.yaml` is a Render Blueprint: a Node web service plus a Postgres database. In Render choose
**New → Blueprint**, pick this repo, and fill in the secret values it asks for (the same ones as
`.env.local`, plus `DEMO_PASSCODE`). On first start the app creates its tables and loads the demo
evening. Then add a PayPal sandbox webhook pointing at `https://<your-app>.onrender.com/api/paypal/webhook`
and set `PAYPAL_WEBHOOK_ID`.

On the public demo, the coordinator's actions are behind `DEMO_PASSCODE`; restaurant, driver,
shelter and donor screens are open so anyone can run a rescue. Posting is rate-limited per visitor,
and Gemini calls have a daily cap after which the agents fall back to rules (labelled in the UI).

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

## AI tools used

All AI runs on **Google Gemini Flash** through the Vercel AI SDK. Decisions about money and food
safety are made by plain code; the models handle messy input and explanations, and can only send
something to a human, never approve it.

- **Intake agent:** reads the restaurant's photo and note (any language) into a structured listing:
  portions, allergens, diet tags, how the food is held.
- **Matcher agent:** the shelter is chosen by a deterministic score (diet rules, capacity, distance,
  opening hours); Gemini writes the one-line reason shown to the coordinator and restaurant.
- **Dispatch agent:** books the nearest free driver once a trip is funded, and re-plans when a
  driver drops out.
- **Verification agent:** Gemini checks the drop-off photo against the listing. A payout needs three
  signals: photo, GPS near the shelter, and the shelter's confirmation. Fewer goes to a coordinator.
- **Treasurer:** reserves each trip's money before dispatch and pays the driver with PayPal Payouts.

## License

MIT, see [LICENSE](LICENSE).
