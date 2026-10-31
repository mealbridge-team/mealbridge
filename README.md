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
npm test        # food-safety, matching and funding rules, plus the money loop end to end
```

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

- **Google Gemini Flash** (via the Vercel AI SDK): reads the restaurant's photo and note into a
  structured listing (portions, allergens, diet tags, holding).

## License

MIT, see [LICENSE](LICENSE).
