import { describe, expect, it } from 'vitest';
import { calculate, formatMoney, validatePrice, validateProfit } from './calculation';

const run = (price: string, profit: string, rate = '50', code: 'USD' | 'EGP' = 'USD') =>
  calculate(price, profit, rate, code, '2026-11-02', '2026-11-02T12:00:00Z', 'network');

describe('markup calculation', () => {
  it('calculates the requested example', () => {
    const result = run('100', '30');
    expect(result.converted).toBe('5000');
    expect(result.profitAmount).toBe('1500');
    expect(result.finalPrice).toBe('6500');
  });
  it('supports 0%, 100%, 250% and EGP identity', () => {
    expect(run('100', '0', '1', 'EGP').finalPrice).toBe('100');
    expect(run('100', '30', '1', 'EGP').finalPrice).toBe('130');
    expect(run('100', '100', '1', 'EGP').finalPrice).toBe('200');
    expect(run('100', '250', '1', 'EGP').finalPrice).toBe('350');
  });
  it('retains decimal precision until display rounding', () => {
    expect(run('3.33', '12.5', '42.123456').finalPrice).toBe('157.80499704');
    expect(formatMoney(run('1', '0', '1.005').finalPrice)).toBe('1.01');
    expect(formatMoney(run('999999999999999999', '1000', '1').finalPrice))
      .toBe('10,999,999,999,999,999,989.00');
  });
  it('rejects invalid values', () => {
    for (const value of ['', '0', '-1', '1.2.3', 'abc']) expect(validatePrice(value)).not.toBeNull();
    expect(validateProfit('1000.1')).not.toBeNull();
    expect(validateProfit('2.5')).toBeNull();
  });
});
