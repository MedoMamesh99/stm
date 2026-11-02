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

For an optional browser smoke test on a machine with Microsoft Edge installed, keep `npm run preview -- --host 127.0.0.1 --port 4173` running and execute `node scripts/browser-qa.mjs`. It checks a mocked calculation, horizontal overflow, and dark mode at phone and desktop widths. Screenshots are saved under ignored `.qa/`.

## Rates and calculation

STM requests Frankfurter API v2's documented [single currency pair endpoint](https://frankfurter.dev/) at `https://api.frankfurter.dev/v2/rate/{currency}/EGP`. The response is checked for the selected base currency, EGP quote, positive rate, and an ISO provider date. Frankfurter publishes daily reference rates. The site shows the **provider rate date** and the separate **browser fetch time**. EGP uses an exact rate of 1 without a request.

Supported codes: EGP, USD, EUR, GBP, SAR, AED, KWD, QAR, BHD, OMR, JPY, CNY, TRY, CHF, CAD, AUD.

The formula uses markup on cost:

```text
converted cost EGP = unit price × EGP per selected currency unit
profit EGP         = converted cost EGP × profit percentage / 100
final unit price   = converted cost EGP + profit EGP
```

The engine retains decimal precision until display, then rounds EGP values to 2 decimals using half-up rounding. Rate display uses 4 decimals, while calculations use the full returned value. Input limits are 18 integer digits and 12 fractional digits. Markup must be 0–1000%.

## Cache and privacy

Rates are stored per currency pair in browser `localStorage` with the provider date and fetch time. A saved rate is reused for **4 hours**, matching the daily update cadence without repeated requests on every visit. The interface labels reused rates. If a request fails, an available cached rate can be used with a visible offline warning. If no rate is available, calculation is blocked and a retry action is shown. Manual Refresh bypasses the freshness period. No fabricated rates are used.

The latest 20 successful calculations and theme choice are also stored only in this browser. Clear History removes the calculation list. No login, analytics, advertising, or personal data collection is implemented. Requests to Frankfurter reveal the currency pair and ordinary connection metadata to the service and its network infrastructure. Review the current provider privacy terms before publication.

## GitHub Pages

The Vite `base` is `./`, so built assets resolve from a project site such as `https://USERNAME.github.io/stm/` without hard-coding a username. The original logo remains in the header. Browser and install icons are resized from a separate, simplified bag mark derived from that logo. `npm run icons` regenerates their sizes. The lightweight PWA service worker caches only the built app shell; it has no runtime rule for Frankfurter requests. The website works normally without installation, and the rate service always labels browser-cached rates itself.

1. Create an empty GitHub repository, ideally named `stm`.
2. Add it as `origin`, push `main`, then enable **Settings → Pages → Build and deployment → GitHub Actions**.
3. Pushing to `main` runs `.github/workflows/deploy.yml`: `npm ci`, lint, tests, production build, upload of `dist/`, and the official Pages deployment action.
4. Check the workflow result and the URL shown in the deployment environment. Add a canonical URL and `og:url` only after the final address is confirmed.

Example commands after creating the empty repository:

```sh
git remote add origin https://github.com/USERNAME/stm.git
git push -u origin main
```

To update the site, commit changes and push to `main`; the workflow publishes the new `dist/` build. Never commit credentials or `node_modules/`.

## Troubleshooting

- **Rate unavailable:** Verify the browser's connection, retry, or use a clearly labeled saved rate if available.
- **Logo or scripts missing on Pages:** Confirm the workflow deployed `dist/` and Vite's `base: './'` remains set.
- **Clipboard unavailable:** Use the site over HTTPS or localhost and grant the browser permission if prompted.
- **No Pages URL:** Confirm the GitHub repository exists, Pages uses GitHub Actions, and the deploy workflow completed successfully.

No public URL exists until a repository is created and the workflow is deployed.
