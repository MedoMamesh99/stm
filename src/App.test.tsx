import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

let quote = 12;
let fail = false;
beforeEach(() => {
  localStorage.clear();
  quote = 12; fail = false;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
    expect(options.cache).toBe('no-store');
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => ({ date: '2026-11-02', base: 'SAR', quote: 'EGP', rate: quote }) };
  }));
  Element.prototype.scrollIntoView = vi.fn();
});

it('keeps one compact language selector and an accessible icon-only theme control in the header', async () => {
  const user = userEvent.setup();
  render(<App />);
  const header = screen.getByRole('banner');
  expect(header.querySelector('.brand-title')).toHaveTextContent(/^STM$/);
  expect(header.querySelector('.brand-dot')).toBeNull();
  expect(within(header).getByRole('group', { name: 'Language / اللغة' })).toBeInTheDocument();
  expect(within(screen.getByRole('contentinfo')).queryByRole('group', { name: 'Language / اللغة' })).toBeNull();
  expect(within(header).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(header).getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'false');
  const theme = within(header).getByRole('button', { name: 'Switch to dark mode' });
  expect(theme).toHaveAttribute('title', 'Switch to dark mode');
  expect(theme).toHaveTextContent('');
  expect(theme.querySelector('svg')).toBeInTheDocument();
  await user.click(theme);
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(within(header).getByRole('button', { name: 'Switch to light mode' }))
    .toHaveAttribute('title', 'Switch to light mode');
  await user.click(within(header).getByRole('button', { name: 'العربية' }));
  expect(within(header).getByRole('button', { name: 'التبديل إلى الوضع الفاتح' })).toBeInTheDocument();
  expect(header.querySelector('.brand-title')).toHaveTextContent(/^STM$/);
});

it('starts with SAR and fetches a fresh rate for every calculation', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12.0000 EGP')).toBeInTheDocument());
  expect(screen.getByText(/Provider: Frankfurter/)).toBeInTheDocument();
  expect(screen.getByText(/Status: Latest retrieved/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  expect(screen.getByText('Enter a valid unit price.')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Unit Price'), '100');
  await user.clear(screen.getByLabelText('Profit %'));
  await user.type(screen.getByLabelText('Profit %'), '30');
  quote = 13;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,690.00'));
  expect(fetch).toHaveBeenCalledTimes(2);
  quote = 14;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,820.00'));
  expect(fetch).toHaveBeenCalledTimes(3);
  fireEvent.change(screen.getByLabelText('Unit Price'), { target: { value: '101' } });
  expect(document.querySelector('.final-number')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /reset fields/i }));
  expect(screen.getByLabelText('Unit Price')).toHaveValue('');
});

it('blocks stale calculation after failure and offers an explicit saved-rate choice', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12.0000 EGP')).toBeInTheDocument());
  await user.type(screen.getByLabelText('Unit Price'), '100');
  fail = true;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate Using Cached Rate' })).toBeInTheDocument());
  expect(document.querySelector('.final-number')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Calculate Using Cached Rate' }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,200.00'));
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('switches to Arabic RTL and remembers only the language and theme preferences', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: 'العربية' }));
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  expect(document.documentElement).toHaveAttribute('lang', 'ar');
  expect(screen.getByLabelText('سعر الوحدة')).toBeInTheDocument();
  expect(localStorage.getItem('stm-language')).toBe('ar');
  expect(document.title).toContain('حاسبة العملات');
  view.unmount();
  render(<App />);
  expect(screen.getByLabelText('سعر الوحدة')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /العملة: SAR/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(screen.getByLabelText('Unit Price')).toBeInTheDocument();
});

it('switches currency and uses the EGP identity rate without another request', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12.0000 EGP')).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /currency: sar/i }));
  const dialog = screen.getByRole('dialog', { name: /choose currency/i });
  await user.type(within(dialog).getByRole('searchbox'), 'Egyptian');
  await user.click(within(dialog).getByRole('button', { name: /EGP Egyptian Pound/i }));
  await waitFor(() => expect(screen.getByText('1 EGP = 1.0000 EGP')).toBeInTheDocument());
  expect(screen.getByText('EGP converts to itself at exactly 1. No rate provider is contacted.')).toBeInTheDocument();
  expect(within(screen.getByRole('contentinfo')).queryByText('Frankfurter')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Unit Price'), '100');
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('100.00'));
  expect(fetch).toHaveBeenCalledTimes(1);
});
