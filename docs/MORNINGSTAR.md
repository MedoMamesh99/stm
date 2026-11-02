# Morningstar FX integration: prepared, not activated

## What is verified

- [Google Finance](https://www.google.com/googlefinance/disclaimer/) attributes its currency prices to Morningstar and lists a three-minute delay for global currency quotes. This does not identify the Morningstar product, entitlement, or endpoint Google uses.
- Morningstar's [Equity Data API catalog](https://equityapi.morningstar.com/) lists **Currency Pair**. A [Morningstar release note](https://advisor.morningstar.com/ReleaseNewsLive/releasePopUp.aspx?Id=362&name=Licensed+Data&type=Release+Notes) names Currency Pair Coverage List, Snapshot, and History catalogs. Neither source establishes SAR/EGP or all STM pairs.
- Morningstar's [API overview](https://equityapi.morningstar.com/OverView.html) describes account authentication and a token for entitled APIs. Its [equity API upgrade notice](https://advisor.morningstar.com/Enterprise/VTC/EquityData/EquityDataUpgradeEquityAPIClientInfo.pdf) says the old Equity Data API service would be retired at the end of September 2026. Do not build a new integration against a legacy example without Morningstar confirming a supported replacement.
- [Morningstar's licensing explanation](https://shareholders.morningstar.com/investor-resources/investor-qa/qa-details/2026/How-does-revenue-per-user-compare-when-licensing-data-as-a-feed-vs--through-Morningstar-Direct-/default.aspx) says external integrations and redistribution rights are priced by scope and entitlement. A public STM website needs those rights in writing.

## Unknowns that prevent activation

The exact purchasable subscription, current supported **Currency Pair** endpoint and method, authentication flow for that product, response fields, SAR/EGP and all other STM/EGP pairs, provider quote timestamp, refresh interval, quota, price, and public-display rights have not been supplied or verified. The available documentation does not establish that the purchasable feed is the same feed Google receives. No authenticated SAR/EGP response has been obtained. A price or endpoint cannot be stated precisely without Morningstar's product specification and quote.

Request from Morningstar:

1. A currently supported licensed product and endpoint specification for on-demand FX pair snapshots, including authentication and a real sample response.
2. A coverage list or entitlement check for SAR, USD, EUR, GBP, AED, KWD, QAR, BHD, OMR, JPY, CNY, TRY, CHF, CAD, AUD against EGP.
3. Quote timestamp semantics, actual update frequency, whether it is the same licensed feed used by Google Finance, and how non-trading periods are represented.
4. Pricing, request limits, and written permission to display the rates and source attribution on a public commercial website.
5. Test credentials through a secure channel, never in this repository or a Vite variable.

## Prepared architecture

`src/services/rates.ts` implements `createMorningstarSource`, an `ExchangeRateSource` adapter that calls **only an STM-owned HTTPS proxy**. The response contract is `{ provider: "Morningstar", pair: "SAR/EGP", rate: "12.345678", rateTimestamp: "2026-11-02T12:34:56Z" }`. The browser records a separate `fetchedAt` timestamp and rejects mismatched providers, pairs, invalid rates, and invalid timestamps. Each normal Calculate request bypasses saved rates and uses `cache: 'no-store'`.

`src/server/morningstarProxy.ts` provides a server-only, fail-closed HTTP handler. It validates the origin, pair, and rate-limit decision; requires an injected licensed upstream adapter; validates the normalized quote; emits `Cache-Control: no-store`; and returns generic errors without upstream details. It is **not deployed**. The injected `getLicensedQuote` function must be implemented against Morningstar's verified current endpoint after onboarding. The serverless platform must hold credentials in its secret store, apply durable rate limits, and restrict network egress to Morningstar. An Origin header alone is not authentication or abuse protection.

The public GitHub Pages bundle contains no commercial credential. To test a future licensed integration, set `VITE_FX_PROVIDER=Morningstar` and `VITE_FX_PROXY_URL=https://<STM-owned-proxy>/rate` in a **nonpublic test build** after the proxy is ready. These are public routing settings, never secrets. Selecting Morningstar without a proxy produces an explicit unavailable error and does not call Frankfurter. After an authenticated SAR/EGP response and the full pair checklist pass, the owner can approve a production provider change. The current production build remains on Frankfurter.
