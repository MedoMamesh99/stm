import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currencies, type CurrencyCode } from '../domain/currencies';
import { getExchangeRate, parseCxRatesResponse, parseRateLimit, parseRetryAfter,
  parseUnixReset, RateLimitError, readCachedRate } from './rates';

const payload = (base = 'SAR', value = '14.9229',
  source = 'cross:open_er_api+open_er_api') => ({
  base, fetched_at: '2026-11-02T17:00:00Z',
  attribution: { text: 'Exchange rates by CxRates', url: 'https://cxrates.com' },
  rates: { EGP: { name: 'Egyptian Pound', value, display: value,
    source, stale: false, as_of: null } },
});
const ok = (base = 'SAR', value = '14.9229') => ({
  ok: true, status: 200, headers: new Headers(),
  json: async () => payload(base, value),
}) as Response;
const limited = (headers: Record<string, string> = {}) => ({
  ok: false, status: 429, headers: new Headers(headers),
  json: async () => ({ error: 'rate_limited' }),
}) as Response;

describe('CxRates service', () => {
  beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });

  it('parses the actual pair response, source, and feed retrieval timestamp', () => {
    expect(parseCxRatesResponse(payload(), 'SAR')).toMatchObject({
      value: '14.9229', provider: 'CxRates', pair: 'SAR/EGP',
      rateTimestamp: '2026-11-02T17:00:00Z',
      quoteSource: 'cross:open_er_api+open_er_api', stale: false,
    });
    expect(() => parseCxRatesResponse(payload('USD'), 'SAR')).toThrow();
    expect(() => parseCxRatesResponse(payload('SAR', '-1'), 'SAR')).toThrow();
    expect(() => parseCxRatesResponse({ ...payload(), fetched_at: 'bad' }, 'SAR')).toThrow();
    expect(() => parseCxRatesResponse({ ...payload(), rates: {} }, 'SAR')).toThrow();
  });

  it('rejects stale rates and any upstream other than open.er-api', () => {
    expect(() => parseCxRatesResponse(payload('SAR', '14.9', 'frankfurter'), 'SAR')).toThrow();
    expect(() => parseCxRatesResponse(payload('SAR', '14.9', 'cross:frankfurter+open_er_api'), 'SAR')).toThrow();
    expect(() => parseCxRatesResponse(payload('SAR', '14.9', 'unknown'), 'SAR')).toThrow();
    expect(() => parseCxRatesResponse({ ...payload(), rates: {
      EGP: { value: '14.9', source: 'open_er_api', stale: true, as_of: '2026-11-01' },
    } }, 'SAR')).toThrow();
    expect(parseCxRatesResponse(payload('USD', '55.9607', 'open_er_api'), 'USD').value).toBe('55.9607');
  });

  it('accepts the documented response shape for every STM foreign currency', () => {
    for (const [code] of currencies) {
      if (code === 'EGP') continue;
      expect(parseCxRatesResponse(payload(code, '1'), code).pair).toBe(`${code}/EGP`);
    }
  });

  it('makes a new no-store request for every call and updates only the selected pair cache', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok('SAR', '12')).mockResolvedValueOnce(ok('SAR', '13'));
    expect((await getExchangeRate('SAR')).value).toBe('12');
    expect(readCachedRate('SAR')?.value).toBe('12');
    expect((await getExchangeRate('SAR')).value).toBe('13');
    expect(readCachedRate('SAR')?.value).toBe('13');
    expect(readCachedRate('USD')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('https://cxrates.com/api/v1/rates?base=SAR&quote=EGP',
      expect.objectContaining({ cache: 'no-store' }));
  });

  it('honors a provider-supplied 429 cooldown and preserves the last good rate', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok()).mockResolvedValueOnce(limited({ 'Retry-After': '120' }));
    await getExchangeRate('SAR');
    await expect(getExchangeRate('SAR')).rejects.toBeInstanceOf(RateLimitError);
    expect(readCachedRate('SAR')?.value).toBe('14.9229');
    await expect(getExchangeRate('SAR')).rejects.toBeInstanceOf(RateLimitError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('tries again after the provider cooldown expires', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
      vi.mocked(fetch).mockResolvedValueOnce(limited({ 'Retry-After': '60' })).mockResolvedValueOnce(ok());
      await expect(getExchangeRate('SAR')).rejects.toBeInstanceOf(RateLimitError);
      vi.setSystemTime(new Date('2026-11-02T12:01:01Z'));
      expect((await getExchangeRate('SAR')).source).toBe('network');
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('does not invent a reset or calculate without a saved pair on 429', async () => {
    vi.mocked(fetch).mockResolvedValue(limited());
    await expect(getExchangeRate('USD')).rejects.toMatchObject({
      limit: { kind: 'unknown', resetAt: null },
    });
    expect(readCachedRate('USD')).toBeNull();
  });

  it('parses Retry-After and Unix reset headers only when supplied', () => {
    const now = Date.parse('2026-11-02T12:00:00Z');
    expect(parseRetryAfter('90', now)).toBe('2026-11-02T12:01:30.000Z');
    expect(parseRetryAfter('Mon, 02 Nov 2026 13:00:00 GMT', now))
      .toBe('2026-11-02T13:00:00.000Z');
    expect(parseUnixReset(String((now + 3600000) / 1000), now))
      .toBe('2026-11-02T13:00:00.000Z');
    expect(parseRateLimit(limited(), null, now)).toMatchObject({ kind: 'unknown', resetAt: null });
  });

  it('keeps older provider cache out of the active calculation path', async () => {
    localStorage.setItem('stm-rate-v3-exchangerate.dev-SAR_EGP', JSON.stringify({
      ...payload(), provider: 'exchangerate.dev', value: '99',
    }));
    vi.mocked(fetch).mockResolvedValue(ok());
    expect(readCachedRate('SAR')).toBeNull();
    expect((await getExchangeRate('SAR')).value).toBe('14.9229');
  });

  it('never substitutes cache for an ordinary network failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok()).mockRejectedValueOnce(new Error('offline'));
    await getExchangeRate('SAR');
    await expect(getExchangeRate('SAR')).rejects.toMatchObject({ key: 'rateUnavailableError' });
    expect(readCachedRate('SAR')?.value).toBe('14.9229');
  });

  it('uses EGP identity without an external request', async () => {
    expect((await getExchangeRate('EGP')).value).toBe('1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported currencies', async () => {
    await expect(getExchangeRate('XXX' as CurrencyCode)).rejects.toMatchObject({ key: 'unsupportedCurrency' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
