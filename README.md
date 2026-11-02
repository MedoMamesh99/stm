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

STM uses [CxRates](https://cxrates.com/api) exclusively through its documented, keyless endpoint:

```text
GET https://cxrates.com/api/v1/rates?base={BASE}&quote=EGP
```

For example, SAR uses `/api/v1/rates?base=SAR&quote=EGP`. The rate comes from `rates.EGP.value`. STM validates the response base, positive rate, provider feed retrieval timestamp in `fetched_at`, and the pair's source and stale flag. Only `open_er_api` and `cross:open_er_api+open_er_api` sources are accepted; this prevents the CxRates aggregator from switching STM to a Frankfurter-backed quote. Stale quotes are rejected. CxRates' `fetched_at` is when its feed fetched the rate, **not** the underlying market observation time. The Exchange Rate section shows only Provider, Updated (the browser retrieval time), and Pair. [Provider attribution](https://cxrates.com/) is linked next to the rate. CxRates describes its values as indicative mid-market references, not executable trading quotes. See [provider evaluation](docs/FX_PROVIDER_REVIEW.md) for live verification and limitations.

Every valid **Calculate Final Price** click for a foreign currency makes a new `cache: 'no-store'` request. There are no STM time, weekday, or cache freshness gates. EGP uses an exact identity rate of 1 locally. A successful response replaces the saved rate and metadata for that specific pair; old provider cache entries are ignored.

On HTTP 429, STM reads any browser-exposed `Retry-After`, `X-RateLimit-Reset`, `X-RateLimit-Scope`, and `X-RateLimit-Remaining` headers. A valid provider-supplied future reset is saved across page loads and prevents requests until it passes. STM does not infer a reset from a missing header. If a saved CxRates rate for the selected pair exists, calculation continues automatically with a prominent warning showing the saved rate, retrieval time, and known reset. Without a matching saved rate, calculation is blocked. Ordinary network failures continue to offer the explicit **Calculate Using Cached Rate** action. Neither case calls another provider.

CxRates documents no account, key, or request quota, asks for linked attribution where the rate appears, and prohibits resale of upstream data. STM makes a new HTTP request on each Calculate click; the provider may serve an unchanged quote until its feed updates.

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
