# STM — Currency & Profit Calculator

STM converts a unit cost to Egyptian pounds, adds a selected profit markup, and rounds the final selling price to the nearest EGP 5. The website uses React, TypeScript, Vite, Tailwind CSS, Decimal.js, and a PWA app shell. SAR is the default currency on every page load. English, Arabic RTL, dark mode, and browser-local calculation history are supported.

## Development

Use Node.js 22.12+ and npm:

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

The optional browser QA script is `scripts/browser-qa.mjs`. Run the preview server at `http://127.0.0.1:4173/stm/` first, then run `node scripts/browser-qa.mjs` with Microsoft Edge installed. Screenshots are written under ignored `.qa/`.

## Exchange rates

STM uses [exchangerate.dev](https://exchangerate.dev/docs/api-reference) exclusively through its documented keyless endpoint:

```text
GET https://api.exchangerate.dev/v1/latest/{BASE}?symbols=EGP
```

For example, SAR uses `/v1/latest/SAR?symbols=EGP`. The rate comes from `rates.EGP`. STM validates the response base, positive rate, and pair observation time in `effective_at.EGP`. The Exchange Rate section shows only Provider, Updated (the browser retrieval time), and Pair. Provider freshness metadata remains in the saved rate for calculation and cache integrity. The [free plan](https://exchangerate.dev/free-plan-limits) can provide delayed indicative data, so STM does not present it as a real-time trading quote. Attribution is linked next to the rate. No API credential is placed in browser code.

Every valid **Calculate Final Price** click for a foreign currency makes a new `cache: 'no-store'` request. There are no STM time, weekday, or cache freshness gates. EGP uses an exact identity rate of 1 locally. A successful response replaces the saved rate and metadata for that specific pair; old provider cache entries are ignored.

On HTTP 429, STM reads the provider error code and browser-exposed `Retry-After`, `X-RateLimit-Reset`, `X-RateLimit-Scope`, and `X-RateLimit-Remaining` headers. It recognizes minute, IP/hour, and account quota codes. A valid provider-supplied future reset is saved across page loads and prevents requests until it passes. A reset is never estimated from an IP restriction or missing header. If a saved rate for the selected pair exists, calculation continues automatically with a prominent warning showing the saved rate, retrieval time, and known reset. Without a matching saved rate, calculation is blocked. Ordinary network failures continue to offer the explicit **Calculate Using Cached Rate** action. Neither case calls another provider.

The keyless plan is subject to [provider limits](https://exchangerate.dev/free-plan-limits), including anonymous per-IP limits. If higher volume is needed, review the provider's current plan and display rights before adding credentials. A credentialed integration would need a server-side proxy; public Vite variables and GitHub Pages assets are unsuitable for secrets.

Supported codes: EGP, USD, EUR, GBP, SAR, AED, KWD, QAR, BHD, OMR, JPY, CNY, TRY, CHF, CAD, AUD.

## Calculation

```text
ConvertedCostEGP = UnitPrice × ExchangeRate
ProfitAmountEGP = ConvertedCostEGP × ProfitPercentage / 100
UnroundedFinalPriceEGP = ConvertedCostEGP + ProfitAmountEGP
RoundedFinalPriceEGP = RoundHalfUp(UnroundedFinalPriceEGP / 5) × 5
```

Decimal.js retains full precision through calculation. Only the final selling price is rounded. The result, copy action, and history show that same whole-number price. The exact unrounded total is available in the breakdown. A small positive total can mathematically round to EGP 0 and is labeled as such. Price accepts up to 18 integer and 12 fractional digits; profit accepts 0–1000%.

## Storage and deployment

Rates, provider cooldown, the latest 20 calculations, language, and theme are stored in this browser's local storage. Currency selection is not persisted. The PWA service worker caches the built app shell and has no runtime cache rule for exchange-rate requests.

Vite's production base is `/stm/`. GitHub Actions runs lint, tests, build, and Pages deployment after a push to `main`. The site is published at [medomamesh99.github.io/stm](https://medomamesh99.github.io/stm/). No credentials or `node_modules/` should be committed.
