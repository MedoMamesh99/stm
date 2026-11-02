import Decimal from 'decimal.js';
import type { CurrencyCode } from './currencies';

Decimal.set({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

export type Calculation = {
  id: string;
  createdAt: string;
  currency: CurrencyCode;
  original: string;
  rate: string;
  profitPercent: string;
  converted: string;
  profitAmount: string;
  finalPrice: string;
  unroundedFinalPrice?: string;
  rateDate: string | null;
  rateTimestamp?: string | null;
  provider?: string;
  fetchedAt: string;
  source: 'network' | 'cache' | 'offline' | 'identity';
};

const decimalPattern = /^\d+(?:\.\d+)?$/;

export function parseInput(value: string, label: string): Decimal {
  const trimmed = value.trim();
  if (!decimalPattern.test(trimmed)) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  const [whole, fraction = ''] = trimmed.split('.');
  if (whole.length > 18 || fraction.length > 12) {
    throw new Error(`${label} is too large or has too many decimal places.`);
  }
  return new Decimal(trimmed);
}

export function validatePrice(value: string): 'priceInvalid' | 'priceNonpositive' | 'priceTooLarge' | null {
  const trimmed = value.trim();
  if (!decimalPattern.test(trimmed)) return 'priceInvalid';
  const [whole, fraction = ''] = trimmed.split('.');
  if (whole.length > 18 || fraction.length > 12) return 'priceTooLarge';
  return new Decimal(trimmed).lte(0) ? 'priceNonpositive' : null;
}

export function validateProfit(value: string): 'profitInvalid' | 'profitTooLarge' | null {
  const trimmed = value.trim();
  if (!decimalPattern.test(trimmed)) return 'profitInvalid';
  const [whole, fraction = ''] = trimmed.split('.');
  if (whole.length > 18 || fraction.length > 12 || new Decimal(trimmed).gt(1000)) return 'profitTooLarge';
  return null;
}

export function calculate(
  price: string,
  profit: string,
  rate: string,
  currency: CurrencyCode,
  rateDate: string | null,
  fetchedAt: string,
  source: Calculation['source'],
  provider = 'exchangerate.dev',
  rateTimestamp: string | null = null,
): Calculation {
  const priceError = validatePrice(price);
  const profitError = validateProfit(profit);
  if (priceError || profitError) throw new Error(priceError ?? profitError ?? 'Invalid input.');
  const exchange = parseInput(rate, 'exchange rate');
  if (exchange.lte(0)) throw new Error('Exchange rate must be greater than zero.');
  const original = new Decimal(price.trim());
  const percentage = new Decimal(profit.trim());
  const converted = original.mul(exchange);
  const profitAmount = converted.mul(percentage).div(100);
  const unroundedFinalPrice = converted.plus(profitAmount);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(), currency,
    original: original.toString(), rate: exchange.toString(),
    profitPercent: percentage.toString(), converted: converted.toString(),
    profitAmount: profitAmount.toString(),
    unroundedFinalPrice: unroundedFinalPrice.toString(),
    finalPrice: roundToNearestFive(unroundedFinalPrice).toString(),
    rateDate, rateTimestamp, provider, fetchedAt, source,
  };
}

export function roundToNearestFive(value: Decimal.Value): Decimal {
  return new Decimal(value).div(5).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(5);
}

export function formatMoney(value: string): string {
  const fixed = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const [whole, fraction] = fixed.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}

export function formatRate(value: string): string {
  return new Decimal(value).toString();
}

export function formatExactMoney(value: string): string {
  const [whole, fraction] = new Decimal(value).toFixed().split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}

export function formatWholeMoney(value: string): string {
  return new Decimal(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
