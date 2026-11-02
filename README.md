# STM — Currency & Profit Calculator

A responsive website for calculating a final unit selling price in Egyptian pounds from a foreign-currency unit cost and a profit markup. It uses the official Saudi To Masr logo at `public/images/stm_logo.png` and runs entirely in the browser. No account or server database is needed.

## Stack and structure

- React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide icons
- `decimal.js` for exact decimal arithmetic, with 64 significant digits
- Vitest and React Testing Library
- GitHub Actions and GitHub Pages

The main UI is `src/App.tsx`; calculation and currency rules are in `src/domain/`; exchange rates and local history are in `src/services/`; the searchable selector is in `src/components/`. The production build is written to `dist/`.

## Develop and verify

Use Node.js 22.12+ or a current LTS version and npm. Run:

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

The site works in current Chrome, Edge, Firefox, and Safari on phones, tablets, and desktops. Browser clipboard access normally requires HTTPS or localhost.

For an optional browser smoke test on a machine with Microsoft Edge installed, keep `npm run preview -- --host 127.0.0.1 --port 4173` running and execute `node scripts/browser-qa.mjs`. It checks a mocked SAR calculation, the header controls, horizontal overflow, dark mode, and Arabic RTL at 320 px, phone, and desktop widths. Screenshots are saved under ignored `.qa/`.

## Rates and calculation

STM currently requests Frankfurter API v2's documented [single currency pair endpoint](https://frankfurter.dev/) at `https://api.frankfurter.dev/v2/rate/{currency}/EGP`. The response is checked for the selected base currency, EGP quote, positive rate, and an ISO provider date. Frankfurter publishes daily reference rates. The site shows the provider, pair, **provider rate date**, and separate **browser fetch time**. EGP uses an exact rate of 1 without a request. SAR is the default on every page load.

Every **Calculate Final Price** click for a non-EGP currency sends a new request with `cache: 'no-store'` and calculates from that response's full rate precision. On failure, no result is produced and Retry sends another request. When a saved rate exists, **Calculate Using Cached Rate** offers an explicit alternative. Manual Refresh also sends a new request. The visible rate on initial page load may come from browser storage, but calculation never silently reuses it.

The active provider is selected by the public build setting `VITE_FX_PROVIDER` (`Frankfurter` by default; `Morningstar` or `Twelve Data` require a secure proxy). `VITE_FX_PROXY_URL` is the HTTPS proxy address; localhost HTTP is allowed for development. The prior `VITE_FX_PROXY_PROVIDER` setting is still recognized for compatibility. Selecting Morningstar without a proxy produces a localized provider-unavailable error and never silently calls Frankfurter. The proxy accepts `?code=SAR` and returns a normalized response such as `{ "provider": "Morningstar", "pair": "SAR/EGP", "rate": "12.34", "rateTimestamp": "2026-11-02T12:34:56Z" }`. The browser rejects mismatched provider or pair, nonpositive rates, and invalid timestamps. Provider and proxy settings are public routing values, **not** API credentials. See [Morningstar integration status and setup](docs/MORNINGSTAR.md).

Do not put credentials in Vite variables or browser code. A production proxy must keep credentials in a server-side secret store, allow only STM currency codes and the site origin, enforce request limits, and return `Cache-Control: no-store`. Set `VITE_FX_PROXY_PROVIDER=Morningstar` only after a licensed Morningstar product, its actual documented endpoint and response, public display rights, all STM pairs, and timestamp semantics have been verified with the supplier. The same verification is required before enabling Twelve Data. No proxy or commercial credential is currently configured, so Frankfurter remains active.

### Google and Morningstar research

[Google Finance's disclaimer](https://www.google.com/googlefinance/disclaimer/) names Morningstar for currency prices and lists a three-minute delay for global currencies. [Morningstar's Equity Data API catalog](https://equityapi.morningstar.com/) includes a Currency Pair category, but [Morningstar's upgrade notice](https://advisor.morningstar.com/Enterprise/VTC/EquityData/EquityDataUpgradeEquityAPIClientInfo.pdf) says that legacy Equity Data API service was scheduled for retirement by the end of September 2026. The current replacement's currency-pair coverage and response specification have not been verified. [Morningstar Market Data](https://assets.contentstack.io/v3/assets/blt0b299fb5208b8900/blt5fc92f4f855b3cf0/625f52391f257e4c8da70224/Morningstar_Market_Data_Onepager.pdf) lists currencies among real-time, delayed, and end-of-day offerings. Its [licensed-data explanation](https://shareholders.morningstar.com/investor-resources/investor-qa/qa-details/2026/How-does-revenue-per-user-compare-when-licensing-data-as-a-feed-vs--through-Morningstar-Direct-/default.aspx) says external use and redistribution rights are priced by scope and entitlement. This does not establish that an obtainable Morningstar feed matches Google's specific feed, contains every STM pair, or updates on Google's three-minute schedule. Public pricing for the required feed was not found; contact Morningstar for a commercial quote, current endpoint specification, pair entitlements, and test credentials.

For a separate intraday candidate, [currencyapi documents SAR/EGP](https://currencyapi.com/currency-conversion/egp-sar) and [lists commercial plans](https://currencyapi.com/pricing/) with hourly updates on Small and 60-second updates on Medium. It is **not** Google's or Morningstar's feed. Its public materials do not prove every STM pair works on a purchased account; confirm pair coverage, API response timestamps, quota, and display terms before considering a switch. [Twelve Data](https://twelvedata.com/docs) remains another candidate subject to the same checks and its [terms](https://twelvedata.com/terms).

Supported codes: EGP, USD, EUR, GBP, SAR, AED, KWD, QAR, BHD, OMR, JPY, CNY, TRY, CHF, CAD, AUD.

The formula uses markup on cost:

```text
converted cost EGP = unit price × EGP per selected currency unit
profit EGP         = converted cost EGP × profit percentage / 100
final unit price   = converted cost EGP + profit EGP
```

The engine retains decimal precision until display, then rounds EGP values to 2 decimals using half-up rounding. Rate display uses 4 decimals, while calculations use the full returned value. Input limits are 18 integer digits and 12 fractional digits. Markup must be 0–1000%.

## Cache and privacy

Rates are stored per provider and currency pair in browser `localStorage` with the provider date and fetch time. A saved Frankfurter rate is reused for **4 hours on initial display**; optional proxied quotes use a 30-second display window. The interface labels saved rates. If the initial display request fails, an available saved rate is shown with an offline warning. A calculation failure blocks the result and offers a separately labeled saved-rate action. No fabricated rates are used.

The latest 20 successful calculations, theme, and language choice are also stored only in this browser. English is the initial language; the header toggle persists Arabic or English and updates the document language and direction. Currency always resets to SAR on page load. Clear History removes the calculation list. No login, analytics, advertising, or personal data collection is implemented. Requests to Frankfurter reveal the currency pair and ordinary connection metadata to the service and its network infrastructure.

## GitHub Pages

The Vite `base` is `/stm/`, and the site is published at [medomamesh99.github.io/stm](https://medomamesh99.github.io/stm/). The original logo remains in the header. Browser and install icons are resized from a separate, simplified bag mark derived from that logo. `npm run icons` regenerates their sizes. The lightweight PWA service worker caches only the built app shell; it has no runtime rule for exchange-rate requests. The website works normally without installation, and the rate service labels browser-saved rates itself.

Pushing to `main` runs `.github/workflows/deploy.yml`: `npm ci`, lint, tests, production build, upload of `dist/`, and the official Pages deployment action. Check the workflow result and the published URL after pushing.

To update the site, commit changes and push to `main`; the workflow publishes the new `dist/` build. Never commit credentials or `node_modules/`.

## Troubleshooting

- **Rate unavailable:** Verify the browser's connection, retry, or use a clearly labeled saved rate if available.
- **Logo or scripts missing on Pages:** Confirm the workflow deployed `dist/` and Vite's `base: '/stm/'` remains set.
- **Clipboard unavailable:** Use the site over HTTPS or localhost and grant the browser permission if prompted.
- **No Pages URL:** Confirm Pages uses GitHub Actions and the deploy workflow completed successfully.
