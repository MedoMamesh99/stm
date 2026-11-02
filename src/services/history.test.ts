import { expect, it } from 'vitest';
import { calculate } from '../domain/calculation';
import { addHistory, clearHistory, loadHistory } from './history';

it('keeps the latest 20 successful calculations locally and clears them', () => {
  for (let index = 1; index <= 21; index++) {
    addHistory(calculate(String(index), '10', '1', 'EGP', null,
      new Date().toISOString(), 'identity'));
  }
  const items = loadHistory();
  expect(items).toHaveLength(20);
  expect(items[0].original).toBe('21');
  expect(items.at(-1)?.original).toBe('2');
  clearHistory();
  expect(loadHistory()).toEqual([]);
});
