# Free FX provider review — 2 November 2026

STM evaluated the four requested candidates with live, read-only HTTP requests around 17:50–17:56 UTC. These were real responses, separate from the mocked automated tests. Google Currency Converter did not provide a permitted, independently verified quote at the same time; no equivalence or closeness to a contemporaneous Google quote is claimed.

| Provider | Actual SAR/EGP | Provider observation or update time | API result | STM foreign currencies with an EGP rate |
| --- | ---: | --- | --- | ---: |
| [currency-converter.live](https://currency-converter.live/api) | None | None | HTTP 400 for SAR/EGP; USD/EUR succeeded, confirming API availability | SAR/EGP unavailable |
| [Daleelak](https://getdaleelak.com/en/api) | 14.92 global benchmark | `observedAt` 16:00 UTC; feed generated 17:00 UTC | HTTP 200, CORS; global benchmark is distinct from bank buy/sell quotes | 11/15 with global values; KWD null; JPY, TRY, CHF absent |
| [ExchangeRate.fun](https://www.exchangerate.fun/docs/) | 14.703621 | API `timestamp` 17:00 UTC; underlying observation time undisclosed | HTTP 200, CORS; hourly reference feed, upstream source undisclosed | 15/15 |
| [CxRates](https://cxrates.com/api) | 14.9229 | `fetched_at` 17:00 UTC; underlying observation time undisclosed | HTTP 200, CORS; quote source `cross:open_er_api+open_er_api`, `stale:false` | 15/15, all from `open_er_api` on verification |

The EGP identity pair is calculated locally at exactly 1, making 16 supported STM currencies in total.

## Decision

CxRates was selected because it returned all STM pairs, provides the upstream source for each pair, labels the current quotes as nonstale indicative mid-market rates, allows keyless browser access with CORS, and permits public display with linked attribution. Its SAR/EGP value was independently corroborated by the named upstream [open.er-api.com](https://open.er-api.com/v6/latest/SAR), which returned 14.922852, and by Daleelak's global benchmark of 14.92. This agreement does **not** prove equivalence to Google or establish an executable market price.

CxRates aggregates several feeds, including Frankfurter. STM accepts only quote sources `open_er_api` or `cross:open_er_api+open_er_api`. If CxRates changes a pair to Frankfurter or any other source, STM rejects that response and offers its existing explicit saved-rate action for an ordinary fetch failure. It does not silently mix feed types across currencies.

CxRates documents that `fetched_at` is when its feed fetched the data, not the moment STM requested it or the original market observation. The named upstream's SAR response listed its last update as **00:02:31 UTC** on 2 November, so the CxRates 17:00 feed retrieval does not imply a 17:00 market observation. ExchangeRate.fun lists an hourly update time but does not disclose its upstream source or per-pair observation time. These timing limits prevent a rigorous freshness comparison with Google.

All STM pairs were verified as `open_er_api` on the review date. Future upstream changes can make a pair unavailable under STM's source guard. The application does not invent a replacement rate; only a previously successful CxRates rate for the same pair can be used after an HTTP 429, and ordinary failures require the user's explicit saved-rate choice.

Sources: [CxRates API and usage terms](https://cxrates.com/api), [ExchangeRate.fun API and commercial-use policy](https://www.exchangerate.fun/docs/), [currency-converter.live API and terms](https://currency-converter.live/api), [Daleelak API](https://getdaleelak.com/en/api).
