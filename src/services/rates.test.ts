import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMorningstarSource, getExchangeRate, parseFrankfurterResponse, parseProxyResponse,
  readCachedRate, selectRateSource } from './rates';

const response = { date: '2026-11-02', base: 'USD', quote: 'EGP', rate: 50.1234 };

describe('exchange rate service', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  it('parses the documented v2 single-pair response', () => {
    const rate = parseFrankfurterResponse(response, 'USD');
    expect(rate.value).toBe('50.1234');
    expect(rate.rateDate).toBe('2026-11-02');
    expect(() => parseFrankfurterResponse({ ...response, quote: 'EUR' }, 'USD')).toThrow();
    expect(() => parseFrankfurterResponse({ ...response, rate: -1 }, 'USD')).toThrow();
  });
  it('accepts a normalized licensed-provider response only for the configured provider and pair', () => {
    const payload = { provider: 'Morningstar', pair: 'SAR/EGP', rate: '12.345678',
      rateTimestamp: '2026-11-02T12:34:56Z' };
    const rate = parseProxyResponse(payload, 'SAR', 'Morningstar');
    expect(rate.provider).toBe('Morningstar');
    expect(rate.value).toBe('12.345678');
    expect(rate.rateTimestamp).toBe('2026-11-02T12:34:56Z');
    expect(() => parseProxyResponse(payload, 'SAR', 'Twelve Data')).toThrow();
    expect(() => parseProxyResponse({ ...payload, pair: 'USD/EGP' }, 'SAR', 'Morningstar')).toThrow();
    expect(() => parseProxyResponse({ ...payload, rateTimestamp: 'bad' }, 'SAR', 'Morningstar')).toThrow();
  });
  it('never falls back when Morningstar is selected without a secure proxy', () => {
    expect(() => selectRateSource('Morningstar')).toThrowError('providerUnavailable');
    expect(() => selectRateSource('Morningstar', 'https://proxy.example/rate?api_key=secret'))
      .toThrowError('proxyConfiguration');
    expect(() => selectRateSource('Morningstar', 'http://proxy.example/rate'))
      .toThrowError('proxyConfiguration');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows an unconfigured Morningstar selection without fetching Frankfurter', async () => {
    vi.stubEnv('VITE_FX_PROVIDER', 'Morningstar');
    vi.resetModules();
    try {
      const selectedService = await import('./rates');
      expect(selectedService.activeProviderName()).toBe('Morningstar');
      await expect(selectedService.getExchangeRate('SAR', { force: true,
        allowCachedFallback: false })).rejects.toMatchObject({ key: 'providerUnavailable' });
      expect((await selectedService.getExchangeRate('EGP')).source).toBe('identity');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
  it('uses the Morningstar adapter contract with a fresh proxy request and source timestamps', async () => {
    const payload = { provider: 'Morningstar', pair: 'SAR/EGP', rate: '12.345678',
      rateTimestamp: '2026-11-02T12:34:56Z' };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => payload } as Response);
    const source = createMorningstarSource('https://rates.example/quote');
    expect(source.provider).toBe('Morningstar');
    const rate = await source.fetch('SAR', new AbortController().signal);
    expect(fetch).toHaveBeenCalledWith(new URL('https://rates.example/quote?code=SAR'),
      expect.objectContaining({ cache: 'no-store', headers: { Accept: 'application/json' } }));
    expect(rate).toMatchObject({ provider: 'Morningstar', pair: 'SAR/EGP', value: '12.345678',
      rateTimestamp: '2026-11-02T12:34:56Z', source: 'network' });
    expect(Number.isFinite(Date.parse(rate.fetchedAt))).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ...payload, pair: 'USD/EGP' }) } as Response);
    await expect(source.fetch('SAR', new AbortController().signal)).rejects.toMatchObject({ key: 'rateInvalid' });
  });
  it('skips the network for EGP', async () => {
    expect((await getExchangeRate('EGP')).value).toBe('1');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses a fresh cache and refreshes on request', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => response } as Response);
    expect((await getExchangeRate('USD')).source).toBe('network');
    expect(readCachedRate('USD')?.value).toBe('50.1234');
    expect((await getExchangeRate('USD')).source).toBe('cache');
    expect(fetch).toHaveBeenCalledTimes(1);
    await getExchangeRate('USD', { force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('only falls back to cache when explicitly permitted', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => response } as Response);
    await getExchangeRate('USD');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    expect((await getExchangeRate('USD', { force: true })).source).toBe('offline');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(getExchangeRate('USD', { force: true, allowCachedFallback: false }))
      .rejects.toMatchObject({ key: 'rateUnavailableError' });
  });
  it('refreshes an expired cached rate', async () => {
    localStorage.setItem('stm-rate-v1-USD-EGP', JSON.stringify({
      pair: 'USD/EGP', code: 'USD', value: '49', rateDate: '2026-10-31',
      fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), source: 'network',
    }));
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => response } as Response);
    expect((await getExchangeRate('USD')).value).toBe('50.1234');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('blocks when no cache exists', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await expect(getExchangeRate('USD')).rejects.toMatchObject({ key: 'rateUnavailableError' });
  });
});
