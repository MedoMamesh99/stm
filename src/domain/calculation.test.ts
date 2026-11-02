import { describe, expect, it } from 'vitest';
import { calculate, formatWholeMoney, roundToNearestFive, validatePrice, validateProfit } from './calculation';

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
  it('rounds only the final price to nearest five with half up', () => {
    for (const [input, output] of [
      ['3631.29', '3630'], ['3634.99', '3635'], ['3635.00', '3635'],
      ['3638.70', '3640'], ['3642.15', '3640'], ['3646.80', '3645'],
      ['3647.50', '3650'], ['2.50', '5'], ['2.499999999999', '0'],
    ]) expect(roundToNearestFive(input).toString()).toBe(output);
    const result = run('3.33', '12.5', '42.123456');
    expect(result.unroundedFinalPrice).toBe('157.80499704');
    expect(result.converted).toBe('140.27110848');
    expect(result.finalPrice).toBe('160');
    expect(formatWholeMoney(result.finalPrice)).toBe('160');
    expect(run('0.01', '0', '1').finalPrice).toBe('0');
  });
  it('rejects invalid values', () => {
    for (const value of ['', '0', '-1', '1.2.3', 'abc']) expect(validatePrice(value)).not.toBeNull();
    expect(validateProfit('1000.1')).not.toBeNull();
    expect(validateProfit('2.5')).toBeNull();
  });
});
