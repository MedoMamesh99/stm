import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

let quote = 12;
let fail = false;
let limited = false;
beforeEach(() => {
  localStorage.clear();
  quote = 12; fail = false; limited = false;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
    expect(options.cache).toBe('no-store');
    if (fail) throw new Error('offline');
    if (limited) return { ok: false, status: 429,
      headers: new Headers({ 'Retry-After': '120', 'X-RateLimit-Scope': 'minute' }),
      json: async () => ({ error: { code: 'rate_limited' } }) };
    return { ok: true, status: 200, headers: new Headers(),
      json: async () => ({ base: 'SAR', fetched_at: '2026-11-02T17:00:00Z',
        rates: { EGP: { value: String(quote), source: 'cross:open_er_api+open_er_api',
          stale: false, as_of: null } } }) };
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
  await waitFor(() => expect(screen.getByText('1 SAR = 12 EGP')).toBeInTheDocument());
  expect([...document.querySelectorAll('.rate-meta > span')].map((item) =>
    item.textContent?.split(':')[0])).toEqual(['Provider', 'Updated', 'Pair']);
  expect(screen.getByText(/Provider: CxRates/)).toBeInTheDocument();
  expect(document.querySelector('.rate-meta')?.textContent).toContain('Pair: SAR/EGP');
  expect(fetch).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  expect(screen.getByText('Enter a valid unit price.')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Unit Price'), '100');
  await user.clear(screen.getByLabelText('Profit %'));
  await user.type(screen.getByLabelText('Profit %'), '30');
  quote = 13;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,690'));
  expect([...document.querySelectorAll('.breakdown-row > span')].map((item) => item.textContent))
    .toEqual(['Original unit price', 'Selected currency', 'Exchange rate', 'Converted cost',
      'Profit markup', 'Profit amount', 'Exact final price before rounding']);
  expect(fetch).toHaveBeenCalledTimes(2);
  quote = 14;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,820'));
  expect(fetch).toHaveBeenCalledTimes(3);
  fireEvent.change(screen.getByLabelText('Unit Price'), { target: { value: '101' } });
  expect(document.querySelector('.final-number')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /reset fields/i }));
  expect(screen.getByLabelText('Unit Price')).toHaveValue('');
});

it('blocks stale calculation after failure and offers an explicit saved-rate choice', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12 EGP')).toBeInTheDocument());
  await user.type(screen.getByLabelText('Unit Price'), '100');
  fail = true;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate Using Cached Rate' })).toBeInTheDocument());
  expect(document.querySelector('.final-number')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Calculate Using Cached Rate' }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,200'));
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
  await waitFor(() => expect([...document.querySelectorAll('.rate-meta > span')].map((item) =>
    item.textContent?.split(':')[0])).toEqual(['مزود السعر', 'آخر تحديث', 'زوج العملات']));
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(screen.getByLabelText('Unit Price')).toBeInTheDocument();
});

it('switches currency and uses the EGP identity rate without another request', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12 EGP')).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /currency: sar/i }));
  const dialog = screen.getByRole('dialog', { name: /choose currency/i });
  await user.type(within(dialog).getByRole('searchbox'), 'Egyptian');
  await user.click(within(dialog).getByRole('button', { name: /EGP Egyptian Pound/i }));
  await waitFor(() => expect(screen.getByText('1 EGP = 1 EGP')).toBeInTheDocument());
  expect(screen.getByText('EGP converts to itself at exactly 1. No rate provider is contacted.')).toBeInTheDocument();
  expect(within(screen.getByRole('contentinfo')).queryByText('CxRates')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Unit Price'), '100');
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('100'));
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('automatically calculates with the saved quote on 429 and shows the English warning', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12 EGP')).toBeInTheDocument());
  await user.type(screen.getByLabelText('Unit Price'), '100');
  limited = true;
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('1,200'));
  expect(screen.getByText('Exchange-rate API limit reached')).toBeInTheDocument();
  expect(screen.getByText(/Your calculation is using the latest saved exchange rate/)).toBeInTheDocument();
  expect(screen.getByText(/API available again in/)).toBeInTheDocument();
  expect([...document.querySelectorAll('.rate-meta > span')].map((item) =>
    item.textContent?.split(':')[0])).toEqual(['Provider', 'Updated', 'Pair']);
  expect(fetch).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('copies and saves the rounded final price', async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<App />);
  await waitFor(() => expect(screen.getByText('1 SAR = 12 EGP')).toBeInTheDocument());
  await user.type(screen.getByLabelText('Unit Price'), '302.6075');
  await user.click(screen.getByRole('button', { name: /calculate final price/i }));
  await waitFor(() => expect(document.querySelector('.final-number')?.textContent).toContain('3,630'));
  expect(screen.getAllByText(/3,631.29/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Copy Result' }));
  expect(writeText).toHaveBeenCalledWith('EGP 3,630');
  const saved = JSON.parse(localStorage.getItem('stm-history-v1') ?? '[]');
  expect(saved[0].finalPrice).toBe('3630');
});

it('shows the Arabic rate-limit warning and blocks when no quote was saved', async () => {
  const user = userEvent.setup();
  limited = true;
  render(<App />);
  await waitFor(() => expect(screen.getByText('Exchange-rate API limit reached')).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'العربية' }));
  expect(screen.getByText('تم الوصول إلى الحد المسموح لطلبات سعر الصرف')).toBeInTheDocument();
  await user.type(screen.getByLabelText('سعر الوحدة'), '100');
  await user.click(screen.getByRole('button', { name: /احسب السعر النهائي/i }));
  expect(document.querySelector('.final-number')).not.toBeInTheDocument();
  expect(screen.getByText(/ولا يوجد سعر محفوظ لهذه العملة/)).toBeInTheDocument();
});
