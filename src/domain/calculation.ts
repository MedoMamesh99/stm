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
  rateDate: string | null;
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

export function validatePrice(value: string): string | null {
  try {
    if (parseInput(value, 'unit price').lte(0)) return 'Unit price must be greater than zero.';
    return null;
  } catch (error) { return (error as Error).message; }
}

export function validateProfit(value: string): string | null {
  try {
    if (parseInput(value, 'profit percentage').gt(1000)) return 'Profit must be between 0% and 1000%.';
    return null;
  } catch (error) { return (error as Error).message; }
}

export function calculate(
  price: string,
  profit: string,
  rate: string,
  currency: CurrencyCode,
  rateDate: string | null,
  fetchedAt: string,
  source: Calculation['source'],
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
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(), currency,
    original: original.toString(), rate: exchange.toString(),
    profitPercent: percentage.toString(), converted: converted.toString(),
    profitAmount: profitAmount.toString(), finalPrice: converted.plus(profitAmount).toString(),
    rateDate, fetchedAt, source,
  };
}

export function formatMoney(value: string): string {
  const fixed = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const [whole, fraction] = fixed.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}

export function formatRate(value: string): string {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}
