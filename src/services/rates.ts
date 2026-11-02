import Decimal from 'decimal.js';
import { isCurrency, type CurrencyCode } from '../domain/currencies';
import type { MessageKey } from '../i18n';

export type RateSourceStatus = 'network' | 'cache' | 'offline' | 'identity';
export type ExchangeRate = {
  pair: string;
  code: CurrencyCode;
  value: string;
  provider: 'CxRates' | 'Local';
  rateDate: string | null;
  rateTimestamp: string | null;
  responseTimestamp: string | null;
  dataUpdatedAt: string | null;
  quoteSource: string | null;
  marketSession: string | null;
  stale: boolean | null;
  delaySeconds: number | null;
  fetchedAt: string;
  source: RateSourceStatus;
};
export type RateLimitKind = 'minute' | 'hour' | 'monthly' | 'unknown';
export type RateLimitState = {
  kind: RateLimitKind;
  code: string | null;
  scope: string | null;
  resetAt: string | null;
  remaining: number | null;
};
export class RateError extends Error {
  constructor(readonly key: MessageKey) { super(key); }
}
export class RateLimitError extends RateError {
  constructor(readonly limit: RateLimitState) { super('rateLimitReached'); }
}
const CACHE_PREFIX = 'stm-rate-v4-cxrates-';
const COOLDOWN_KEY = 'stm-rate-limit-v2-cxrates';
const validTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value));
const positiveRate = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') throw new RateError('rateInvalid');
  try {
    const number = new Decimal(value);
    if (!number.isFinite() || number.lte(0)) throw new Error();
    return number.toString();
  } catch { throw new RateError('rateInvalid'); }
};
export function parseCxRatesResponse(payload: unknown, code: CurrencyCode,
  now = new Date()): ExchangeRate {
  if (!payload || typeof payload !== 'object') throw new RateError('rateInvalid');
  const data = payload as Record<string, unknown>;
  const rates = data.rates as Record<string, unknown> | undefined;
  const quote = rates?.EGP as Record<string, unknown> | undefined;
  if (data.base !== code || !quote || !validTimestamp(data.fetched_at) ||
    quote.stale !== false || quote.as_of !== null ||
    (quote.source !== 'open_er_api' && quote.source !== 'cross:open_er_api+open_er_api')) {
    throw new RateError('rateInvalid');
  }
  return {
    pair: `${code}/EGP`, code, value: positiveRate(quote.value),
    provider: 'CxRates', rateDate: data.fetched_at.slice(0, 10),
    rateTimestamp: data.fetched_at, responseTimestamp: null,
    dataUpdatedAt: null, quoteSource: quote.source,
    marketSession: null, stale: false, delaySeconds: null,
    fetchedAt: now.toISOString(), source: 'network',
  };
}
export function parseRetryAfter(value: string | null, now = Date.now()): string | null {
  if (!value) return null;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const reset = Number.isFinite(seconds) ? now + seconds * 1000 : Date.parse(value);
  return Number.isFinite(reset) && reset > now ? new Date(reset).toISOString() : null;
}
export function parseUnixReset(value: string | null, now = Date.now()): string | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const reset = Number(value.trim()) * 1000;
  return Number.isFinite(reset) && reset > now ? new Date(reset).toISOString() : null;
}
export function parseRateLimit(response: Response, payload: unknown,
  now = Date.now()): RateLimitState {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const error = body.error && typeof body.error === 'object' ?
    body.error as Record<string, unknown> : body;
  const code = typeof error.code === 'string' ? error.code : null;
  const scope = response.headers.get('X-RateLimit-Scope');
  const kind: RateLimitKind = 'unknown';
  const retryAt = parseRetryAfter(response.headers.get('Retry-After'), now);
  const headerReset = parseUnixReset(response.headers.get('X-RateLimit-Reset'), now);
  // A reset is shown only when the provider supplied a valid value.
  const resetAt = retryAt ?? headerReset;
  const rawRemaining = response.headers.get('X-RateLimit-Remaining');
  const remaining = rawRemaining !== null && /^\d+$/.test(rawRemaining) ?
    Number(rawRemaining) : null;
  return { kind, code, scope, resetAt, remaining };
}
export function readRateLimit(): RateLimitState | null {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RateLimitState;
    if (!validTimestamp(data.resetAt) || Date.parse(data.resetAt) <= Date.now()) {
      localStorage.removeItem(COOLDOWN_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}
function saveRateLimit(limit: RateLimitState): void {
  if (!limit.resetAt) return;
  try { localStorage.setItem(COOLDOWN_KEY, JSON.stringify(limit)); } catch { /* optional */ }
}
function clearRateLimit(): void {
  try { localStorage.removeItem(COOLDOWN_KEY); } catch { /* optional */ }
}
function cacheKey(code: CurrencyCode): string { return `${CACHE_PREFIX}${code}_EGP`; }
export function readCachedRate(code: CurrencyCode): ExchangeRate | null {
  try {
    const raw = localStorage.getItem(cacheKey(code));
    if (!raw) return null;
    const data = JSON.parse(raw) as ExchangeRate;
    if (data.provider !== 'CxRates' || data.code !== code ||
      data.pair !== `${code}/EGP` || !validTimestamp(data.rateTimestamp) ||
      !validTimestamp(data.fetchedAt) ||
      Date.parse(data.fetchedAt) > Date.now() + 60000 ||
      data.rateDate !== data.rateTimestamp.slice(0, 10) ||
      data.stale !== false ||
      (data.quoteSource !== 'open_er_api' && data.quoteSource !== 'cross:open_er_api+open_er_api')) return null;
    positiveRate(data.value);
    return { ...data, source: 'cache' };
  } catch { return null; }
}
function saveRate(rate: ExchangeRate): void {
  try { localStorage.setItem(cacheKey(rate.code), JSON.stringify(rate)); } catch { /* optional */ }
}
export function activeProviderName(): ExchangeRate['provider'] { return 'CxRates'; }
export async function getExchangeRate(code: CurrencyCode,
  options: { signal?: AbortSignal } = {}): Promise<ExchangeRate> {
  if (!isCurrency(code)) throw new RateError('unsupportedCurrency');
  if (code === 'EGP') return {
    pair: 'EGP/EGP', code, value: '1', provider: 'Local',
    rateDate: null, rateTimestamp: null, responseTimestamp: null, dataUpdatedAt: null,
    quoteSource: null, marketSession: null, stale: null, delaySeconds: null,
    fetchedAt: new Date().toISOString(), source: 'identity',
  };
  const cooldown = readRateLimit();
  if (cooldown) throw new RateLimitError(cooldown);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  try {
    const response = await fetch(
      `https://cxrates.com/api/v1/rates?base=${code}&quote=EGP`,
      { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (response.status === 429) {
      const body = await response.json().catch(() => null) as unknown;
      const limit = parseRateLimit(response, body);
      saveRateLimit(limit);
      throw new RateLimitError(limit);
    }
    if (!response.ok) throw new RateError('rateServiceError');
    const rate = parseCxRatesResponse(await response.json(), code);
    saveRate(rate);
    clearRateLimit();
    return rate;
  } catch (error) {
    if (options.signal?.aborted) throw new RateError('rateCancelled');
    if (error instanceof RateError) throw error;
    throw new RateError('rateUnavailableError');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
