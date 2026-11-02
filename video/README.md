# MealBridge submission video

A Remotion project: real footage of the app, the ElevenLabs premade "Eric" voice and an original synthesised music bed (`make-music.py`), so there is no third-party music.

1. **Footage.** Start a freshly seeded production build (`npx next build`, then `npx next start --port 3100` with an empty `PGLITE_DIR`), then `npm run capture`. Playwright runs one guided rescue with Chrome and writes `public/clips/*.mp4`. It uses real Gemini and the PayPal sandbox, so `.env.local` needs its keys.
2. **Voice.** Put `ELEVENLABS_API_KEY=…` in `video/.env` (gitignored) and run `npm run voice`. It reads the script from `VOICEOVER.md`. Library voices such as Mike (the Bouncer voice) need a paid ElevenLabs plan; pass its id to use it.
3. **Render.** `npm run render` writes `out/mealbridge-demo.mp4` (1080p, 30 fps). Scenes stretch to fit each voice line.
