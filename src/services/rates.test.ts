import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getExchangeRate, parseExchangeRateResponse, parseRateLimit, parseRetryAfter,
  parseUnixReset, RateLimitError, readCachedRate } from './rates';

const payload = (base = 'SAR', rate = 14.763) => ({
  result: 'success', base, source: 'live', sources: { EGP: 'live' },
  market_session: 'open', timestamp: '2026-11-02T16:58:54Z',
  data_updated_at: '2026-11-02T16:42:59Z',
  effective_at: { EGP: '2026-11-02T16:42:59Z' },
  rates: { EGP: rate }, stale: { EGP: false },
});
const ok = (base = 'SAR', rate = 14.763) => ({
  ok: true, status: 200, headers: new Headers({ 'X-Price-Delay-Seconds': '900' }),
  json: async () => payload(base, rate),
}) as Response;
const limited = (code: string, headers: Record<string, string> = {}) => ({
  ok: false, status: 429, headers: new Headers(headers),
  json: async () => ({ error: { code } }),
}) as Response;

describe('exchangerate.dev service', () => {
  beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
  it('parses the documented response and validates the requested pair', () => {
    expect(parseExchangeRateResponse(payload(), 'SAR', 900)).toMatchObject({
      value: '14.763', provider: 'exchangerate.dev', pair: 'SAR/EGP',
      rateTimestamp: '2026-11-02T16:42:59Z', delaySeconds: 900, marketSession: 'open',
    });
    expect(() => parseExchangeRateResponse(payload('USD'), 'SAR')).toThrow();
    expect(() => parseExchangeRateResponse(payload('SAR', -1), 'SAR')).toThrow();
    expect(() => parseExchangeRateResponse({ ...payload(), effective_at: {} }, 'SAR')).toThrow();
  });
  it('makes a new no-store request for every call and updates the pair cache', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok('SAR', 12)).mockResolvedValueOnce(ok('SAR', 13));
    expect((await getExchangeRate('SAR')).value).toBe('12');
    expect(readCachedRate('SAR')?.value).toBe('12');
    expect((await getExchangeRate('SAR')).value).toBe('13');
    expect(readCachedRate('SAR')?.value).toBe('13');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('https://api.exchangerate.dev/v1/latest/SAR?symbols=EGP',
      expect.objectContaining({ cache: 'no-store' }));
  });
  it('honors the provider cooldown and preserves cached rates', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok()).mockResolvedValueOnce(
      limited('rate_limited', { 'Retry-After': '120', 'X-RateLimit-Scope': 'minute' }));
    await getExchangeRate('SAR');
    await expect(getExchangeRate('SAR')).rejects.toBeInstanceOf(RateLimitError);
    expect(readCachedRate('SAR')?.value).toBe('14.763');
    await expect(getExchangeRate('SAR')).rejects.toBeInstanceOf(RateLimitError);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(readCachedRate('USD')).toBeNull();
  });
  it('tries the API again after the provider cooldown expires', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
      vi.mocked(fetch).mockResolvedValueOnce(limited('rate_limited', { 'Retry-After': '60' }))
        .mockResolvedValueOnce(ok());
      await expect(getExchangeRate('SAR')).rejects.toBeInstanceOf(RateLimitError);
      expect(fetch).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date('2026-11-02T12:01:01Z'));
      expect((await getExchangeRate('SAR')).source).toBe('network');
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('does not invent a reset or use a different pair on 429', async () => {
    vi.mocked(fetch).mockResolvedValue(limited('ip_rate_limited'));
    await expect(getExchangeRate('USD')).rejects.toMatchObject({
      limit: { kind: 'hour', resetAt: null },
    });
    expect(readCachedRate('USD')).toBeNull();
  });
  it('parses delta seconds, HTTP dates, Unix seconds, and limit types', () => {
    const now = Date.parse('2026-11-02T12:00:00Z');
    expect(parseRetryAfter('90', now)).toBe('2026-11-02T12:01:30.000Z');
    expect(parseRetryAfter('Mon, 02 Nov 2026 13:00:00 GMT', now))
      .toBe('2026-11-02T13:00:00.000Z');
    expect(parseUnixReset(String((now + 3600000) / 1000), now))
      .toBe('2026-11-02T13:00:00.000Z');
    expect(parseRateLimit(limited('quota_exceeded', { 'X-RateLimit-Reset': String((now + 3600000) / 1000) }),
      { error: { code: 'quota_exceeded' } }, now))
      .toMatchObject({ kind: 'monthly', resetAt: '2026-11-02T13:00:00.000Z' });
    expect(parseRateLimit(limited('ip_rate_limited'), null, now))
      .toMatchObject({ kind: 'unknown', resetAt: null });
  });
  it('never substitutes cache for ordinary network failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok()).mockRejectedValueOnce(new Error('offline'));
    await getExchangeRate('SAR');
    await expect(getExchangeRate('SAR')).rejects.toMatchObject({ key: 'rateUnavailableError' });
    expect(readCachedRate('SAR')?.value).toBe('14.763');
  });
  it('uses the EGP identity without an external request', async () => {
    expect((await getExchangeRate('EGP')).value).toBe('1');
    expect(fetch).not.toHaveBeenCalled();
  });
});
