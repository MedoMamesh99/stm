import Decimal from 'decimal.js';
import { isCurrency, type CurrencyCode } from '../domain/currencies';
import type { MessageKey } from '../i18n';

export type RateSourceStatus = 'network' | 'cache' | 'offline' | 'identity';
export type ExchangeRate = {
  pair: string;
  code: CurrencyCode;
  value: string;
  provider: 'Frankfurter' | 'Twelve Data' | 'Local';
  rateDate: string | null;
  rateTimestamp: string | null;
  fetchedAt: string;
  source: RateSourceStatus;
};

export class RateError extends Error {
  constructor(readonly key: MessageKey) { super(key); }
}

export interface ExchangeRateSource {
  readonly provider: ExchangeRate['provider'];
  fetch(code: CurrencyCode, signal: AbortSignal): Promise<ExchangeRate>;
}

const CACHE_PREFIX = 'stm-rate-v2-';
const OLD_CACHE_PREFIX = 'stm-rate-v1-';
export const CACHE_FRESH_MS = 4 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
};
const positiveRate = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') throw new RateError('rateInvalid');
  try {
    const decimal = new Decimal(value);
    if (!decimal.isFinite() || decimal.lte(0)) throw new RateError('rateInvalid');
    return decimal.toString();
  } catch { throw new RateError('rateInvalid'); }
};
const validTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value));

export function parseFrankfurterResponse(payload: unknown, code: CurrencyCode): ExchangeRate {
  if (!payload || typeof payload !== 'object') throw new RateError('rateInvalid');
  const data = payload as Record<string, unknown>;
  if (data.base !== code || data.quote !== 'EGP' ||
      typeof data.rate !== 'number' || typeof data.date !== 'string' || !validDate(data.date)) {
    throw new RateError('rateInvalid');
  }
  return { pair: `${code}/EGP`, code, value: positiveRate(data.rate), provider: 'Frankfurter',
    rateDate: data.date, rateTimestamp: null, fetchedAt: new Date().toISOString(), source: 'network' };
}

export function parseProxyResponse(payload: unknown, code: CurrencyCode): ExchangeRate {
  if (!payload || typeof payload !== 'object') throw new RateError('rateInvalid');
  const data = payload as Record<string, unknown>;
  if (data.provider !== 'Twelve Data' || data.pair !== `${code}/EGP` ||
      !validTimestamp(data.rateTimestamp)) throw new RateError('rateInvalid');
  return { pair: `${code}/EGP`, code, value: positiveRate(data.rate), provider: 'Twelve Data',
    rateDate: data.rateTimestamp.slice(0, 10), rateTimestamp: data.rateTimestamp,
    fetchedAt: new Date().toISOString(), source: 'network' };
}

const proxyUrl = import.meta.env.VITE_FX_PROXY_URL?.trim() ?? '';
function activeSource(): ExchangeRateSource {
  if (!proxyUrl) return frankfurterSource;
  try {
    const url = new URL(proxyUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
      throw new Error('Invalid protocol');
    }
    return {
      provider: 'Twelve Data',
      async fetch(code, signal) {
        const requestUrl = new URL(url);
        requestUrl.searchParams.set('code', code);
        const response = await fetch(requestUrl, { signal, cache: 'no-store',
          headers: { Accept: 'application/json' } });
        if (response.status === 429) throw new RateError('rateBusy');
        if (!response.ok) throw new RateError('rateServiceError');
        return parseProxyResponse(await response.json(), code);
      },
    };
  } catch { throw new RateError('proxyConfiguration'); }
}

const frankfurterSource: ExchangeRateSource = {
  provider: 'Frankfurter',
  async fetch(code, signal) {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${code}/EGP`,
      { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (response.status === 429) throw new RateError('rateBusy');
    if (!response.ok) throw new RateError('rateServiceError');
    return parseFrankfurterResponse(await response.json(), code);
  },
};

export function activeProviderName(): ExchangeRate['provider'] {
  return activeSource().provider;
}

function cacheKey(provider: ExchangeRate['provider'], code: CurrencyCode): string {
  return `${CACHE_PREFIX}${provider}-${code}-EGP`;
}

export function readCachedRate(code: CurrencyCode): ExchangeRate | null {
  try {
    const provider = activeProviderName();
    const raw = localStorage.getItem(cacheKey(provider, code)) ??
      (provider === 'Frankfurter' ? localStorage.getItem(`${OLD_CACHE_PREFIX}${code}-EGP`) : null);
    if (!raw) return null;
    const data = JSON.parse(raw) as ExchangeRate;
    if (data.pair !== `${code}/EGP` || data.code !== code ||
        (data.provider && data.provider !== provider) ||
        typeof data.value !== 'string' ||
        typeof data.fetchedAt !== 'string' || !validTimestamp(data.fetchedAt) ||
        Date.parse(data.fetchedAt) > Date.now() + 60000 ||
        typeof data.rateDate !== 'string' || !validDate(data.rateDate) ||
        (data.rateTimestamp != null && !validTimestamp(data.rateTimestamp))) return null;
    positiveRate(data.value);
    return { ...data, provider, rateTimestamp: data.rateTimestamp ?? null, source: 'cache' };
  } catch { return null; }
}

function saveRate(rate: ExchangeRate): void {
  try { localStorage.setItem(cacheKey(rate.provider, rate.code), JSON.stringify(rate)); }
  catch { /* The latest response still works when browser storage is disabled. */ }
}

export async function getExchangeRate(
  code: CurrencyCode,
  options: { force?: boolean; allowCachedFallback?: boolean; signal?: AbortSignal } = {},
): Promise<ExchangeRate> {
  if (!isCurrency(code)) throw new RateError('unsupportedCurrency');
  if (code === 'EGP') return { pair: 'EGP/EGP', code, value: '1', provider: 'Local',
    rateDate: null, rateTimestamp: null, fetchedAt: new Date().toISOString(), source: 'identity' };
  const cached = readCachedRate(code);
  const source = activeSource();
  const freshness = source.provider === 'Twelve Data' ? 30000 : CACHE_FRESH_MS;
  if (!options.force && cached && Date.now() - Date.parse(cached.fetchedAt) < freshness) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  try {
    const rate = await source.fetch(code, controller.signal);
    saveRate(rate);
    return rate;
  } catch (error) {
    if (options.signal?.aborted) throw new RateError('rateCancelled');
    if (options.allowCachedFallback !== false && cached) return { ...cached, source: 'offline' };
    if (error instanceof RateError) throw error;
    throw new RateError('rateUnavailableError');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
