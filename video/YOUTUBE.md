# YouTube upload

**Video:** `out/mealbridge-demo.mp4` · **Thumbnail:** `out/thumbnail.png` (`npm run thumbnail`) · **Visibility:** Public (the hackathon rules ask for a publicly visible video)

## Title

MealBridge: Restaurant Leftovers to Shelters, Powered by PayPal

## Description

Every night, Bay Area restaurants throw away good, cooked food a few miles from shelters that are short of dinner. The food isn't the problem. The last mile is: someone has to check it's safe, pick a shelter that can use it, and drive it there, and the volunteer driver usually pays for the fuel.

MealBridge handles that last mile. AI agents deal with the messy parts, plain code handles the money and food safety, and PayPal makes sure no volunteer drives for free.

Try it: https://mealbridge-6py5.onrender.com (press Try the demo, then Start the guided rescue)
Code: https://github.com/Sine9945/mealbridge

How a rescue works
1. A restaurant posts tonight's surplus as a photo or a note in any language. Gemini reads the dishes, portions and allergens; fixed food-safety rules decide if it can go; a matcher picks a shelter that can use it tonight.
2. The driver's fuel money is reserved before anyone moves. Restaurants never pay per pickup.
3. A volunteer photographs the food at pickup and again at the shelter. Reused photos are flagged.
4. The shelter taps Received. When the photo, GPS and the shelter's tap agree, PayPal Payouts reimburses the driver to PayPal or Venmo. Anything that doesn't match goes to a person, never an automatic yes.

Four PayPal products, one loop
- Subscriptions: restaurants' SB 1383 compliance plans fund their own pickups
- Checkout: local donors fund a trip that's waiting
- Invoicing: sponsors and city grants top up the fund
- Payouts: drivers are reimbursed

Every meal, mile and dollar is public on the Impact page: real delivery routes on a map, charts built with AG Studio, and an insights agent that answers questions from the live ledger.

Built with Next.js, Google Gemini, the PayPal sandbox (Subscriptions, Checkout, Invoicing, Payouts) and AG Studio. All money in the demo is PayPal sandbox money, and the businesses and people are made up.

Chapters
0:00 The problem
0:26 MealBridge
0:38 Try the guided rescue
0:50 A restaurant posts its surplus
1:06 How a trip is funded
1:22 The volunteer driver
1:37 The shelter confirms, PayPal pays
1:55 Donors and sponsors
2:09 Four PayPal products
2:20 Public impact
2:35 Wrap-up

#PayPal #AI #FoodRescue #Hackathon
