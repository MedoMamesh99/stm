import Decimal from 'decimal.js';
import { isCurrency, type CurrencyCode } from '../domain/currencies';
import type { MessageKey } from '../i18n';

export type RateSourceStatus = 'network' | 'cache' | 'offline' | 'identity';
export type ExchangeRate = {
  pair: string;
  code: CurrencyCode;
  value: string;
  provider: 'exchangerate.dev' | 'Local';
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
const CACHE_PREFIX = 'stm-rate-v3-exchangerate.dev-';
const COOLDOWN_KEY = 'stm-rate-limit-v1-exchangerate.dev';
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
const optionalTimestamp = (value: unknown): string | null =>
  validTimestamp(value) ? value : null;

export function parseExchangeRateResponse(payload: unknown, code: CurrencyCode,
  delaySeconds: number | null = null, now = new Date()): ExchangeRate {
  if (!payload || typeof payload !== 'object') throw new RateError('rateInvalid');
  const data = payload as Record<string, unknown>;
  const rates = data.rates as Record<string, unknown> | undefined;
  const effective = data.effective_at as Record<string, unknown> | undefined;
  const sources = data.sources as Record<string, unknown> | undefined;
  const stale = data.stale as Record<string, unknown> | undefined;
  if (data.result !== 'success' || data.base !== code || !rates ||
    !validTimestamp(data.timestamp) || !validTimestamp(effective?.EGP)) {
    throw new RateError('rateInvalid');
  }
  return {
    pair: `${code}/EGP`, code, value: positiveRate(rates.EGP),
    provider: 'exchangerate.dev', rateDate: effective.EGP.slice(0, 10),
    rateTimestamp: effective.EGP, responseTimestamp: data.timestamp,
    dataUpdatedAt: optionalTimestamp(data.data_updated_at),
    quoteSource: typeof sources?.EGP === 'string' ? sources.EGP : null,
    marketSession: typeof data.market_session === 'string' ? data.market_session : null,
    stale: typeof stale?.EGP === 'boolean' ? stale.EGP : null,
    delaySeconds, fetchedAt: now.toISOString(), source: 'network',
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
  const kind: RateLimitKind = code === 'ip_rate_limited' ? 'hour' :
    code === 'rate_limited' ? 'minute' :
      code === 'quota_exceeded' ? 'monthly' : 'unknown';
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
    if (data.provider !== 'exchangerate.dev' || data.code !== code ||
      data.pair !== `${code}/EGP` || !validTimestamp(data.rateTimestamp) ||
      !validTimestamp(data.responseTimestamp) || !validTimestamp(data.fetchedAt) ||
      Date.parse(data.fetchedAt) > Date.now() + 60000 ||
      data.rateDate !== data.rateTimestamp.slice(0, 10)) return null;
    positiveRate(data.value);
    return { ...data, source: 'cache' };
  } catch { return null; }
}
function saveRate(rate: ExchangeRate): void {
  try { localStorage.setItem(cacheKey(rate.code), JSON.stringify(rate)); } catch { /* optional */ }
}
export function activeProviderName(): ExchangeRate['provider'] { return 'exchangerate.dev'; }
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
      `https://api.exchangerate.dev/v1/latest/${code}?symbols=EGP`,
      { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (response.status === 429) {
      const body = await response.json().catch(() => null) as unknown;
      const limit = parseRateLimit(response, body);
      saveRateLimit(limit);
      throw new RateLimitError(limit);
    }
    if (!response.ok) throw new RateError('rateServiceError');
    const delay = response.headers.get('X-Price-Delay-Seconds');
    const delaySeconds = delay && /^\d+$/.test(delay) ? Number(delay) : null;
    const rate = parseExchangeRateResponse(await response.json(), code, delaySeconds);
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
