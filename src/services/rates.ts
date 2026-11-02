import Decimal from 'decimal.js';
import { isCurrency, type CurrencyCode } from '../domain/currencies';

export type ExchangeRate = {
  pair: string;
  code: CurrencyCode;
  value: string;
  rateDate: string | null;
  fetchedAt: string;
  source: 'network' | 'cache' | 'offline' | 'identity';
};

export class RateError extends Error {}

const CACHE_PREFIX = 'stm-rate-v1-';
export const CACHE_FRESH_MS = 4 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
};

export function parseFrankfurterResponse(payload: unknown, code: CurrencyCode): ExchangeRate {
  if (!payload || typeof payload !== 'object') throw new RateError('The rate service returned invalid data.');
  const data = payload as Record<string, unknown>;
  if (data.base !== code || data.quote !== 'EGP' ||
      typeof data.rate !== 'number' || !Number.isFinite(data.rate) || data.rate <= 0 ||
      typeof data.date !== 'string' || !validDate(data.date)) {
    throw new RateError('The rate service returned an invalid exchange rate.');
  }
  return { pair: `${code}/EGP`, code, value: String(data.rate),
    rateDate: data.date, fetchedAt: new Date().toISOString(), source: 'network' };
}

export function readCachedRate(code: CurrencyCode): ExchangeRate | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${code}-EGP`);
    if (!raw) return null;
    const data = JSON.parse(raw) as ExchangeRate;
    if (data.pair !== `${code}/EGP` || data.code !== code ||
        typeof data.value !== 'string' || !new Decimal(data.value).isFinite() ||
        new Decimal(data.value).lte(0) ||
        typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)) ||
        Date.parse(data.fetchedAt) > Date.now() + 60000 ||
        typeof data.rateDate !== 'string' || !validDate(data.rateDate)) return null;
    return { ...data, source: 'cache' };
  } catch { return null; }
}

function saveRate(rate: ExchangeRate): void {
  try { localStorage.setItem(`${CACHE_PREFIX}${rate.code}-EGP`, JSON.stringify(rate)); }
  catch { /* Storage can be disabled; the current rate still works. */ }
}

export async function getExchangeRate(
  code: CurrencyCode,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<ExchangeRate> {
  if (!isCurrency(code)) throw new RateError('Unsupported currency.');
  if (code === 'EGP') return { pair: 'EGP/EGP', code, value: '1',
    rateDate: null, fetchedAt: new Date().toISOString(), source: 'identity' };
  const cached = readCachedRate(code);
  if (!options.force && cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_FRESH_MS) return cached;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${code}/EGP`,
      { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new RateError(response.status === 429
      ? 'Rate service is busy. Please retry shortly.' : 'Could not retrieve the exchange rate.');
    const rate = parseFrankfurterResponse(await response.json(), code);
    saveRate(rate);
    return rate;
  } catch (error) {
    if (options.signal?.aborted) throw new RateError('Rate request cancelled.');
    if (cached) return { ...cached, source: 'offline' };
    if (error instanceof RateError) throw error;
    throw new RateError('No rate is available. Check your connection and retry.');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
