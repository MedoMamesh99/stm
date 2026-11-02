import Decimal from 'decimal.js';
import { isCurrency, type CurrencyCode } from '../domain/currencies';

/** Server-only contract. The licensed upstream request is supplied after onboarding. */
export type MorningstarQuote = {
  provider: 'Morningstar';
  pair: string;
  rate: string;
  rateTimestamp: string;
};

type ProxyDependencies = {
  allowedOrigin: string;
  /** Must obtain a real quote using credentials held in the server's secret store. */
  getLicensedQuote?: (code: CurrencyCode) => Promise<unknown>;
  /** Server-side rate limit or abuse check; an Origin header is not authentication. */
  allowRequest?: (request: Request) => Promise<boolean>;
};

function validQuote(value: unknown, code: CurrencyCode): value is MorningstarQuote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Record<string, unknown>;
  if (quote.provider !== 'Morningstar' || quote.pair !== `${code}/EGP` ||
      typeof quote.rate !== 'string' || !/^\d+(?:\.\d+)?$/.test(quote.rate) ||
      typeof quote.rateTimestamp !== 'string' ||
      !/(?:Z|[+-]\d\d:\d\d)$/.test(quote.rateTimestamp) ||
      !Number.isFinite(Date.parse(quote.rateTimestamp))) return false;
  try { return new Decimal(quote.rate).isFinite() && new Decimal(quote.rate).gt(0); }
  catch { return false; }
}

/** Adapt this handler to a serverless platform only after the Morningstar feed is verified. */
export function createMorningstarProxy(dependencies: ProxyDependencies) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff' });
    if (!dependencies.getLicensedQuote || !dependencies.allowRequest) {
      return new Response('Provider not configured', { status: 503, headers });
    }
    if (request.headers.get('Origin') !== dependencies.allowedOrigin) {
      return new Response('Forbidden', { status: 403, headers });
    }
    headers.set('Access-Control-Allow-Origin', dependencies.allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (url.pathname !== '/rate' || url.searchParams.size !== 1 || !code ||
        !isCurrency(code) || code === 'EGP') {
      return new Response('Unsupported pair', { status: 400, headers });
    }
    if (!await dependencies.allowRequest(request)) {
      return new Response('Too many requests', { status: 429, headers });
    }
    try {
      const quote = await dependencies.getLicensedQuote(code);
      if (!validQuote(quote, code)) return new Response('Invalid provider quote', { status: 502, headers });
      headers.set('Content-Type', 'application/json');
      return new Response(JSON.stringify(quote), { status: 200, headers });
    } catch {
      return new Response('Provider unavailable', { status: 502, headers });
    }
  };
}
