import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Clipboard, Clock3, History,
  Moon, RefreshCw, RotateCcw, ShieldCheck, Sun, Trash2, TrendingUp } from 'lucide-react';
import CurrencyPicker from './components/CurrencyPicker';
import { calculate, formatMoney, formatRate, validatePrice, validateProfit,
  type Calculation } from './domain/calculation';
import { currencyName, type CurrencyCode } from './domain/currencies';
import { addHistory, clearHistory, loadHistory } from './services/history';
import { CACHE_FRESH_MS, getExchangeRate, type ExchangeRate } from './services/rates';

const asset = `${import.meta.env.BASE_URL}images/stm_logo.png`;

function formatDate(value: string | null): string {
  if (!value) return 'Not applicable';
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(value.length === 10 ? { timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit' }),
  }).format(date);
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return <div className="breakdown-row"><span>{label}</span><strong>{value}</strong></div>;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('stm-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const [price, setPrice] = useState('');
  const [profit, setProfit] = useState('0');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [rateError, setRateError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [profitError, setProfitError] = useState('');
  const [result, setResult] = useState<Calculation | null>(null);
  const [history, setHistory] = useState<Calculation[]>(loadHistory);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('stm-theme', theme); } catch { /* optional preference */ }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    setRate(null);
    setRateError('');
    setLoading(true);
    getExchangeRate(currency, { signal: controller.signal })
      .then(setRate)
      .catch((error: unknown) => { if (!controller.signal.aborted) setRateError(
        error instanceof Error ? error.message : 'Unable to load the exchange rate.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currency]);

  async function refreshRate() {
    if (loading || calculating) return;
    setLoading(true); setRateError(''); setResult(null);
    try { setRate(await getExchangeRate(currency, { force: true })); }
    catch (error) { setRateError(error instanceof Error ? error.message : 'Unable to load the exchange rate.'); }
    finally { setLoading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || calculating) return;
    const nextPriceError = validatePrice(price);
    const nextProfitError = validateProfit(profit);
    setPriceError(nextPriceError ?? ''); setProfitError(nextProfitError ?? '');
    if (nextPriceError || nextProfitError) return;
    setCalculating(true); setRateError('');
    try {
      const current = rate && rate.code === currency &&
        (rate.source === 'identity' ||
          (rate.source !== 'offline' && Date.now() - Date.parse(rate.fetchedAt) < CACHE_FRESH_MS))
        ? rate : await getExchangeRate(currency);
      const next = calculate(price, profit, current.value, currency,
        current.rateDate, current.fetchedAt, current.source);
      setRate(current); setResult(next); setHistory(addHistory(next));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
    } catch (error) {
      setRateError(error instanceof Error ? error.message : 'Calculation failed. Please retry.');
    } finally { setCalculating(false); }
  }

  function reset() {
    setPrice(''); setProfit('0'); setPriceError(''); setProfitError('');
    setResult(null); setCopied(false);
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`EGP ${formatMoney(result.finalPrice)}`);
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    } catch { setCopied(false); }
  }

  const cached = rate?.source === 'cache' || rate?.source === 'offline';
  return <div className="site-shell">
    <header className="site-header">
      <div className="brand-lockup">
        <img src={asset} alt="Saudi To Masr official logo" className="brand-logo" />
        <div><div className="brand-title">STM<span className="brand-dot">.</span></div>
          <div className="brand-subtitle">Currency & Profit Calculator</div></div>
      </div>
      <button type="button" className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
        {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
      </button>
    </header>

    <main className="main-wrap">
      <div className="intro"><div className="eyebrow"><span className="eyebrow-line" /> THE SMARTER WAY TO PRICE</div>
        <h1>Price with <em>clarity.</em><br />Profit with confidence.</h1>
        <p>Convert your unit cost to Egyptian pounds, add your markup, and see your final selling price in one clear view.</p>
      </div>

      <div className="workspace-grid">
        <section className="panel calculator-panel" aria-labelledby="calculator-heading">
          <div className="panel-heading"><div className="heading-icon"><TrendingUp size={20} /></div>
            <div><div className="section-kicker">CALCULATOR</div><h2 id="calculator-heading">Set your price</h2></div></div>
          <form onSubmit={submit} noValidate>
            <div className="field-group">
              <label htmlFor="unit-price">Unit Price</label>
              <div className="input-wrap"><span className="field-prefix">{currency}</span>
                <input id="unit-price" type="text" inputMode="decimal" autoComplete="off"
                  placeholder="Enter amount" value={price} disabled={calculating}
                  aria-invalid={!!priceError} aria-describedby={priceError ? 'price-error' : undefined}
                  onChange={(event) => { setPrice(event.target.value); setPriceError(''); setResult(null); }} />
              </div>
              {priceError && <p id="price-error" className="field-error" role="alert">{priceError}</p>}
            </div>
            <div className="field-group"><label id="currency-label">Currency</label>
              <CurrencyPicker value={currency} disabled={calculating} onChange={(next) => {
                setCurrency(next); setResult(null);
              }} />
            </div>
            <div className="field-group"><label htmlFor="profit">Profit %</label>
              <div className="input-wrap"><input id="profit" type="text" inputMode="decimal"
                value={profit} disabled={calculating} placeholder="0" aria-invalid={!!profitError}
                aria-describedby={profitError ? 'profit-error' : undefined}
                onChange={(event) => { setProfit(event.target.value); setProfitError(''); setResult(null); }} />
                <span className="field-suffix">%</span></div>
              {profitError && <p id="profit-error" className="field-error" role="alert">{profitError}</p>}
              <p className="field-help">Markup on converted cost · 0% to 1,000%</p>
            </div>

            <div className="rate-box" aria-live="polite">
              <div className="rate-top"><div className="rate-label"><span className="rate-pulse" /> EXCHANGE RATE</div>
                <button type="button" className="refresh-button" onClick={refreshRate}
                  disabled={loading || calculating} aria-label="Refresh exchange rate"><RefreshCw size={16} /> Refresh</button></div>
              <div className="rate-value">{loading ? 'Loading rate…' : rate
                ? `1 ${currency} = ${formatRate(rate.value)} EGP` : 'Rate unavailable'}</div>
              {rate && <div className="rate-meta">
                <span>Rate date: {formatDate(rate.rateDate)}</span>
                {rate.source !== 'identity' && <span>Fetched: {formatDate(rate.fetchedAt)}</span>}
              </div>}
              {cached && <p className="cache-warning" role="status">
                {rate?.source === 'offline' ? 'Service unavailable. Using a saved rate.' : 'Using a locally saved rate.'}
                {' '}Verify its date before pricing.</p>}
              {rateError && <p className="rate-error" role="alert">{rateError} <button type="button" onClick={refreshRate}>Retry</button></p>}
              <p className="rate-note">Daily reference rate from Frankfurter. This is not a live bank quote.</p>
            </div>

            <button type="submit" className="calculate-button" disabled={loading || calculating}>
              {calculating ? 'Calculating…' : 'Calculate Final Price'} <ArrowUpRight size={20} />
            </button>
            <button type="button" className="reset-button" onClick={reset} disabled={calculating}>
              <RotateCcw size={15} /> Reset fields</button>
          </form>
        </section>

        <section ref={resultRef} className={`panel result-panel ${result ? 'has-result' : ''}`}
          aria-labelledby="result-heading" aria-live="polite">
          <div className="panel-heading"><div className="heading-icon orange"><ArrowDownRight size={20} /></div>
            <div><div className="section-kicker">YOUR ESTIMATE</div><h2 id="result-heading">Price breakdown</h2></div></div>
          {result ? <>
            <div className="final-block"><div className="final-label">FINAL UNIT PRICE</div>
              <div className="final-number"><span>EGP</span> {formatMoney(result.finalPrice)}</div>
              <div className="final-caption">Your selling price per unit</div></div>
            <div className="breakdown-list">
              <BreakdownRow label="Original unit price" value={`${result.currency} ${formatMoney(result.original)}`} />
              <BreakdownRow label="Selected currency" value={`${result.currency} · ${currencyName(result.currency)}`} />
              <BreakdownRow label="Exchange rate" value={`1 ${result.currency} = ${formatRate(result.rate)} EGP`} />
              <BreakdownRow label="Converted cost" value={`EGP ${formatMoney(result.converted)}`} />
              <BreakdownRow label="Profit markup" value={`${result.profitPercent}%`} />
              <BreakdownRow label="Profit amount" value={`EGP ${formatMoney(result.profitAmount)}`} />
              <BreakdownRow label="Provider rate date" value={formatDate(result.rateDate)} />
            </div>
            {(result.source === 'offline' || result.source === 'cache') &&
              <p className="result-warning">Calculated with a saved rate fetched {formatDate(result.fetchedAt)}.</p>}
            <button type="button" className="copy-button" onClick={copyResult}>
              {copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? 'Copied to clipboard' : 'Copy Result'}</button>
          </> : <div className="empty-result"><div className="empty-illustration"><TrendingUp size={35} strokeWidth={1.6} /></div>
            <h3>Your final price appears here</h3><p>Enter your unit price and profit percentage, then calculate to see the complete breakdown.</p>
            <div className="empty-rule"><span /><span /><span /></div></div>}
          <div className="result-footer"><ShieldCheck size={17} /> Precise decimal calculations · Rounded to 2 decimals</div>
        </section>
      </div>

      <section className="history-section" aria-labelledby="history-heading">
        <div className="history-head"><div><div className="section-kicker">YOUR ACTIVITY</div>
          <h2 id="history-heading"><History size={23} /> Recent calculations</h2>
          <p>Saved on this browser only. Your latest 20 calculations stay here for quick reference.</p></div>
          {history.length > 0 && <button type="button" className="clear-button" onClick={() => {
            clearHistory(); setHistory([]);
          }}><Trash2 size={16} /> Clear history</button>}</div>
        {history.length === 0 ? <div className="history-empty"><Clock3 size={20} /> No calculations yet</div> :
          <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}>
            <div className="history-currency">{item.currency}</div>
            <div className="history-detail"><strong>{item.currency} {formatMoney(item.original)} <span>+ {item.profitPercent}%</span></strong>
              <small>{formatDate(item.createdAt)} · Rate {formatRate(item.rate)} · {item.rateDate ? `Rate date ${formatDate(item.rateDate)}` : 'EGP identity rate'}</small></div>
            <div className="history-total"><small>FINAL PRICE</small><strong>EGP {formatMoney(item.finalPrice)}</strong></div>
          </div>)}</div>}
      </section>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} STM · Saudi To Masr</span>
      <span>Daily reference rates by <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></span></footer>
  </div>;
}
