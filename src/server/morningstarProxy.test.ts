import { describe, expect, it, vi } from 'vitest';
import { createMorningstarProxy } from './morningstarProxy';

const origin = 'https://medomamesh99.github.io';
const request = (url = 'https://fx.example/rate?code=SAR', headers = { Origin: origin }) =>
  new Request(url, { headers });
const quote = { provider: 'Morningstar', pair: 'SAR/EGP', rate: '12.345678',
  rateTimestamp: '2026-11-02T12:34:56Z' };

describe('Morningstar server proxy contract', () => {
  it('fails closed without an authenticated upstream adapter and request limiter', async () => {
    const handler = createMorningstarProxy({ allowedOrigin: origin });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('accepts only the expected origin, supported pair, and an approved request', async () => {
    const getLicensedQuote = vi.fn().mockResolvedValue(quote);
    const handler = createMorningstarProxy({ allowedOrigin: origin,
      getLicensedQuote, allowRequest: async () => true });
    expect((await handler(request('https://fx.example/rate?code=XYZ'))).status).toBe(400);
    expect((await handler(request('https://fx.example/rate?code=EGP'))).status).toBe(400);
    expect((await handler(request('https://fx.example/rate?code=SAR&token=leak'))).status).toBe(400);
    expect((await handler(request(undefined, { Origin: 'https://attacker.example' }))).status).toBe(403);
    expect(getLicensedQuote).not.toHaveBeenCalled();
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual(quote);
    expect(getLicensedQuote).toHaveBeenCalledWith('SAR');
  });
  it('rejects mismatched or invalid upstream data without exposing it', async () => {
    const handler = createMorningstarProxy({ allowedOrigin: origin,
      getLicensedQuote: async () => ({ ...quote, pair: 'USD/EGP' }), allowRequest: async () => true });
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(await response.text()).toBe('Invalid provider quote');
  });
  it('enforces the server-provided request limiter', async () => {
    const getLicensedQuote = vi.fn().mockResolvedValue(quote);
    const handler = createMorningstarProxy({ allowedOrigin: origin,
      getLicensedQuote, allowRequest: async () => false });
    expect((await handler(request())).status).toBe(429);
    expect(getLicensedQuote).not.toHaveBeenCalled();
  });
});
