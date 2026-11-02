import { roundToNearestFive, type Calculation } from '../domain/calculation';
import Decimal from 'decimal.js';
import { isCurrency } from '../domain/currencies';

const KEY = 'stm-history-v1';

export function loadHistory(): Calculation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is Calculation =>
      entry && typeof entry === 'object' &&
      typeof entry.id === 'string' && typeof entry.finalPrice === 'string' &&
      typeof entry.currency === 'string' && isCurrency(entry.currency) &&
      typeof entry.original === 'string' && typeof entry.rate === 'string' &&
      typeof entry.profitPercent === 'string' && typeof entry.createdAt === 'string' &&
      [entry.finalPrice, entry.original, entry.rate, entry.profitPercent]
        .every((number) => { try { return new Decimal(number).isFinite(); } catch { return false; } })
    ).slice(0, 20).map((entry) => ({
      ...entry,
      unroundedFinalPrice: entry.unroundedFinalPrice ?? entry.finalPrice,
      finalPrice: roundToNearestFive(entry.unroundedFinalPrice ?? entry.finalPrice).toString(),
    }));
  } catch { return []; }
}

export function addHistory(entry: Calculation): Calculation[] {
  const next = [entry, ...loadHistory()].slice(0, 20);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* optional storage */ }
  return next;
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* optional storage */ }
}
