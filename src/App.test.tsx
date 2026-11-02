import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

const response = { date: '2026-11-02', base: 'USD', quote: 'EGP', rate: 50 };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
});

it('validates, calculates, invalidates results, and resets', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 USD = 50.0000 EGP')).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  expect(screen.getByText('Enter a valid unit price.')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Unit Price'), '100');
  await user.clear(screen.getByLabelText('Profit %'));
  await user.type(screen.getByLabelText('Profit %'), '30');
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(screen.getByText('6,500.00')).toBeInTheDocument());
  expect(screen.getByText('EGP 6,500.00')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Copy Result' }));
  expect(await navigator.clipboard.readText()).toBe('EGP 6,500.00');
  fireEvent.change(screen.getByLabelText('Unit Price'), { target: { value: '101' } });
  expect(screen.queryByText('6,500.00')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /reset fields/i }));
  expect(screen.getByLabelText('Unit Price')).toHaveValue('');
});

it('switches currency and shows EGP identity rate', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /currency: usd/i }));
  const dialog = screen.getByRole('dialog', { name: /choose currency/i });
  await user.type(within(dialog).getByRole('searchbox'), 'Egyptian');
  await user.click(within(dialog).getByRole('button', { name: /EGP Egyptian Pound/i }));
  await waitFor(() => expect(screen.getByText('1 EGP = 1.0000 EGP')).toBeInTheDocument());
});
