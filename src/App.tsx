import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Clipboard, Clock3, History, Moon, RefreshCw, RotateCcw, ShieldCheck, Sun, Trash2, TrendingUp } from 'lucide-react';
import CurrencyPicker from './components/CurrencyPicker';
import { calculate, formatExactMoney, formatRate, formatWholeMoney, validatePrice, validateProfit, type Calculation } from './domain/calculation';
import { currencyName, type CurrencyCode } from './domain/currencies';
import { providerLabel, t, type Language, type MessageKey } from './i18n';
import { addHistory, clearHistory, loadHistory } from './services/history';
import { getExchangeRate, RateError, RateLimitError, readCachedRate, type ExchangeRate, type RateLimitState } from './services/rates';

const asset = `${import.meta.env.BASE_URL}images/stm_logo.png`;
const issue = (error: unknown): MessageKey => error instanceof RateError ? error.key : 'calculationFailed';
function dateText(value: string | null, language: Language): string {
  if (!value) return t(language, 'notApplicable');
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return t(language, 'notApplicable');
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(value.length === 10 ? { timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit' }),
  }).format(date);
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="breakdown-row"><span>{label}</span><strong>{children}</strong></div>;
}
function LimitWarning({ limit, rate, language }: {
  limit: RateLimitState; rate: ExchangeRate | null; language: Language;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!limit.resetAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [limit.resetAt]);
  const remaining = limit.resetAt ? Math.max(0, Date.parse(limit.resetAt) - now) : null;
  const minutes = remaining === null ? null : Math.ceil(remaining / 60000);
  const days = minutes === null ? null : Math.floor(minutes / 1440);
  const hours = minutes === null ? null : Math.floor((minutes % 1440) / 60);
  const mins = minutes === null ? null : minutes % 60;
  const ageMinutes = rate ? Math.max(0, Math.floor((now - Date.parse(rate.fetchedAt)) / 60000)) : null;
  const ageDays = ageMinutes === null ? null : Math.floor(ageMinutes / 1440);
  const ageHours = ageMinutes === null ? null : Math.floor((ageMinutes % 1440) / 60);
  const ageMins = ageMinutes === null ? null : ageMinutes % 60;
  const l = (key: MessageKey) => t(language, key);
  return <div className="limit-warning" role="alert">
    <strong>{l('rateLimitTitle')}</strong>
    <p>{l(rate ? 'rateLimitBody' : 'rateLimitNoCache')}</p>
    {rate && <div className="limit-details">
      <span>{l('cachedRate')}: <bdi dir="ltr">1 {rate.code} = {formatRate(rate.value)} EGP</bdi></span>
      <span>{l('updated')}: {dateText(rate.fetchedAt, language)}</span>
      <span>{l('savedRateAge')}: {ageDays} {l('days')}, {ageHours} {l('hours')}, {ageMins} {l('minutes')}</span>
    </div>}
    <p>{limit.resetAt && remaining !== null && remaining > 0
      ? <>{l('apiResetAt')}: {dateText(limit.resetAt, language)} · {l('apiAvailableIn')} {days} {l('days')}, {hours} {l('hours')}, {mins} {l('minutes')}.</>
      : l(limit.resetAt ? 'apiReady' : 'resetUnknown')}</p>
  </div>;
}
export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('stm-language') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('stm-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const [price, setPrice] = useState('');
  const [profit, setProfit] = useState('0');
  const [currency, setCurrency] = useState<CurrencyCode>('SAR');
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [rateError, setRateError] = useState<MessageKey | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null);
  const [failedCalculation, setFailedCalculation] = useState(false);
  const [priceError, setPriceError] = useState<MessageKey | null>(null);
  const [profitError, setProfitError] = useState<MessageKey | null>(null);
  const [result, setResult] = useState<Calculation | null>(null);
  const [history, setHistory] = useState<Calculation[]>(loadHistory);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const busyRef = useRef(false);
  const resultRef = useRef<HTMLElement>(null);
  const l = (key: MessageKey) => t(language, key);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('stm-theme', theme); } catch { /* optional */ }
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = t(language, 'pageTitle');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(language, 'pageDescription'));
    try { localStorage.setItem('stm-language', language); } catch { /* optional */ }
  }, [language]);
  useEffect(() => {
    const controller = new AbortController();
    setRate(null); setRateError(null); setRateLimit(null); setFailedCalculation(false); setLoading(true);
    getExchangeRate(currency, { signal: controller.signal }).then(setRate)
      .catch((error: unknown) => { if (!controller.signal.aborted) {
        if (error instanceof RateLimitError) { setRateLimit(error.limit); setRate(readCachedRate(currency)); }
        else setRateError(issue(error));
      } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currency]);

  async function refreshRate() {
    if (busyRef.current || loading) return;
    setLoading(true); setRateError(null); setRateLimit(null); setResult(null); setFailedCalculation(false);
    try { setRate(await getExchangeRate(currency)); }
    catch (error) {
      if (error instanceof RateLimitError) { setRateLimit(error.limit); setRate(readCachedRate(currency)); }
      else { setRate(null); setRateError(issue(error)); }
    }
    finally { setLoading(false); }
  }
  async function performCalculation(useCached = false) {
    if (busyRef.current || loading) return;
    const p = validatePrice(price) as MessageKey | null;
    const m = validateProfit(profit) as MessageKey | null;
    setPriceError(p); setProfitError(m);
    if (p || m) return;
    busyRef.current = true; setCalculating(true); setRateError(null); setRateLimit(null); setResult(null); setFailedCalculation(false);
    try {
      let current: ExchangeRate | null;
      try { current = useCached ? readCachedRate(currency) : await getExchangeRate(currency); }
      catch (error) {
        if (!(error instanceof RateLimitError)) throw error;
        setRateLimit(error.limit);
        current = readCachedRate(currency);
        if (!current) { setRate(null); setFailedCalculation(false); return; }
      }
      if (!current) throw new RateError('rateUnavailableError');
      const chosen = useCached ? { ...current, source: 'offline' as const } : current;
      const next = calculate(price, profit, chosen.value, currency,
        chosen.rateDate, chosen.fetchedAt, chosen.source, chosen.provider, chosen.rateTimestamp);
      setRate(chosen); setResult(next); setHistory(addHistory(next));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
    } catch (error) { setRate(null); setRateError(issue(error)); setFailedCalculation(true); }
    finally { busyRef.current = false; setCalculating(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void performCalculation(); }
  function reset() {
    setPrice(''); setProfit('0'); setPriceError(null); setProfitError(null);
    setResult(null); setCopied(false); setCopyError(false); setFailedCalculation(false);
  }
  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`EGP ${formatWholeMoney(result.finalPrice)}`);
      setCopied(true); setCopyError(false); setTimeout(() => setCopied(false), 2200);
    } catch { setCopied(false); setCopyError(true); }
  }
  const cached = rate?.source === 'cache' || rate?.source === 'offline';
  const cacheForRetry = failedCalculation ? readCachedRate(currency) : null;
  const currentProvider = rate?.provider ?? (currency === 'EGP' ? 'Local' : 'CxRates');
  return <div className="site-shell">
    <header className="site-header"><div className="brand-lockup">
      <img src={asset} alt={l('logoAlt')} className="brand-logo" />
      <div className="brand-copy"><div className="brand-title">STM</div><div className="brand-subtitle">{l('subtitle')}</div></div>
    </div><div className="header-actions">
      <div className="header-language" role="group" aria-label="Language / اللغة">
        <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
        <button type="button" lang="ar" aria-label="العربية" aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>AR</button>
      </div>
      <button type="button" className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={l(theme === 'light' ? 'switchDark' : 'switchLight')}
        title={l(theme === 'light' ? 'switchDark' : 'switchLight')}>
        {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
    </div></header>
    <main className="main-wrap">
      <div className="intro"><div className="eyebrow"><span className="eyebrow-line" /> {l('eyebrow')}</div>
        <h1>{l('heroBefore')} <em>{l('heroAccent')}</em><br />{l('heroAfter')}</h1><p>{l('heroDescription')}</p></div>
      <div className="workspace-grid">
        <section className="panel calculator-panel" aria-labelledby="calculator-heading">
          <div className="panel-heading"><div className="heading-icon"><TrendingUp size={20} /></div>
            <div><div className="section-kicker">{l('calculatorKicker')}</div><h2 id="calculator-heading">{l('calculatorTitle')}</h2></div></div>
          <form onSubmit={submit} noValidate>
            <div className="field-group"><label htmlFor="unit-price">{l('unitPrice')}</label>
              <div className="input-wrap"><span className="field-prefix" dir="ltr">{currency}</span>
                <input id="unit-price" type="text" inputMode="decimal" autoComplete="off" dir="ltr"
                  placeholder={l('amountPlaceholder')} value={price} disabled={calculating}
                  aria-invalid={!!priceError} aria-describedby={priceError ? 'price-error' : undefined}
                  onChange={(event) => { setPrice(event.target.value); setPriceError(null); setResult(null); }} /></div>
              {priceError && <p id="price-error" className="field-error" role="alert">{l(priceError)}</p>}</div>
            <div className="field-group"><label id="currency-label">{l('currency')}</label>
              <CurrencyPicker value={currency} language={language} disabled={loading || calculating}
                onChange={(next) => { setCurrency(next); setResult(null); }} /></div>
            <div className="field-group"><label htmlFor="profit">{l('profit')}</label>
              <div className="input-wrap"><input id="profit" type="text" inputMode="decimal" dir="ltr"
                value={profit} disabled={calculating} placeholder="0" aria-invalid={!!profitError}
                aria-describedby={profitError ? 'profit-error' : undefined}
                onChange={(event) => { setProfit(event.target.value); setProfitError(null); setResult(null); }} />
                <span className="field-suffix">%</span></div>
              {profitError && <p id="profit-error" className="field-error" role="alert">{l(profitError)}</p>}
              <p className="field-help">{l('markupHelp')}</p></div>
            <div className="rate-box" aria-live="polite">
              <div className="rate-top"><div className="rate-label"><span className="rate-pulse" /> {l('exchangeRateKicker')}</div>
                <button type="button" className="refresh-button" onClick={refreshRate} disabled={loading || calculating}
                  aria-label={l('refreshRate')}><RefreshCw size={16} /> {l('refresh')}</button></div>
              <div className="rate-value">{loading || calculating ? l('loadingRate') : rate
                ? <bdi dir="ltr">1 {currency} = {formatRate(rate.value)} EGP</bdi> : l('rateUnavailable')}</div>
              {rate && <div className="rate-meta">
                <span>{l('provider')}: {providerLabel(language, rate.provider)}</span>
                <span>{l('updated')}: {dateText(rate.fetchedAt, language)}</span>
                <span>{l('pair')}: <bdi dir="ltr">{rate.pair}</bdi></span></div>}
              {cached && !rateLimit && <p className="cache-warning" role="status">
                {l(rate?.source === 'offline' ? 'unavailableSavedRate' : 'savedRate')} {l('verifyRate')}</p>}
              {rateLimit && <LimitWarning limit={rateLimit} rate={rate} language={language} />}
              {rateError && <p className="rate-error" role="alert">{l(rateError)} <button type="button"
                onClick={failedCalculation ? () => void performCalculation() : refreshRate}>{l('retry')}</button></p>}
              {cacheForRetry && <button type="button" className="cached-calculate-button"
                onClick={() => void performCalculation(true)}>{l('calculateCached')}</button>}
              <p className="rate-note">{currentProvider === 'Local' ? l('identityNote') : <>
                {l('cxRatesNote')} <a href="https://cxrates.com/" target="_blank" rel="noreferrer">CxRates</a>
              </>}</p></div>
            <button type="submit" className="calculate-button" disabled={loading || calculating}>
              {l(calculating ? 'calculating' : 'calculate')} <ArrowUpRight size={20} /></button>
            <button type="button" className="reset-button" onClick={reset} disabled={calculating}>
              <RotateCcw size={15} /> {l('reset')}</button>
          </form></section>
        <section ref={resultRef} className={`panel result-panel ${result ? 'has-result' : ''}`}
          aria-labelledby="result-heading" aria-live="polite">
          <div className="panel-heading"><div className="heading-icon orange"><ArrowDownRight size={20} /></div>
            <div><div className="section-kicker">{l('estimateKicker')}</div><h2 id="result-heading">{l('breakdownTitle')}</h2></div></div>
          {result ? <>
            <div className="final-block"><div className="final-label">{l('finalUnitPrice')}</div>
              <div className="final-number"><bdi dir="ltr"><span>EGP</span> {formatWholeMoney(result.finalPrice)}</bdi></div>
              <div className="final-caption">{l('finalCaption')}</div></div>
            <div className="breakdown-list">
              <Row label={l('originalUnitPrice')}><bdi dir="ltr">{result.currency} {formatExactMoney(result.original)}</bdi></Row>
              <Row label={l('selectedCurrency')}>{currencyName(result.currency, language)} · <bdi dir="ltr">{result.currency}</bdi></Row>
              <Row label={l('exchangeRate')}><bdi dir="ltr">1 {result.currency} = {formatRate(result.rate)} EGP</bdi></Row>
              <Row label={l('convertedCost')}><bdi dir="ltr">EGP {formatExactMoney(result.converted)}</bdi></Row>
              <Row label={l('profitMarkup')}><bdi dir="ltr">{result.profitPercent}%</bdi></Row>
              <Row label={l('profitAmount')}><bdi dir="ltr">EGP {formatExactMoney(result.profitAmount)}</bdi></Row>
              <Row label={l('unroundedTotal')}><bdi dir="ltr">EGP {formatExactMoney(result.unroundedFinalPrice ?? result.finalPrice)}</bdi></Row></div>
            {result.finalPrice === '0' && <p className="result-warning">{l('zeroRounded')}</p>}
            {(result.source === 'offline' || result.source === 'cache') &&
              <p className="result-warning">{l('calculatedSavedRate')} {dateText(result.fetchedAt, language)}.</p>}
            <button type="button" className="copy-button" onClick={copyResult}>
              {copied ? <Check size={17} /> : <Clipboard size={17} />}{l(copied ? 'copied' : 'copyResult')}</button>
            {copyError && <p className="field-error" role="alert">{l('copyFailed')}</p>}
          </> : <div className="empty-result"><div className="empty-illustration"><TrendingUp size={35} strokeWidth={1.6} /></div>
            <h3>{l('emptyResultTitle')}</h3><p>{l('emptyResultDescription')}</p>
            <div className="empty-rule"><span /><span /><span /></div></div>}
          <div className="result-footer"><ShieldCheck size={17} /> {l('preciseFooter')}</div></section></div>
      <section className="history-section" aria-labelledby="history-heading">
        <div className="history-head"><div><div className="section-kicker">{l('historyKicker')}</div>
          <h2 id="history-heading"><History size={23} /> {l('recentCalculations')}</h2>
          <p>{l('historyDescription')}</p></div>
          {history.length > 0 && <button type="button" className="clear-button" onClick={() => {
            clearHistory(); setHistory([]);
          }}><Trash2 size={16} /> {l('clearHistory')}</button>}</div>
        {history.length === 0 ? <div className="history-empty"><Clock3 size={20} /> {l('noCalculations')}</div> :
          <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}>
            <div className="history-currency" dir="ltr">{item.currency}</div>
            <div className="history-detail"><strong><bdi dir="ltr">{item.currency} {formatExactMoney(item.original)} + {item.profitPercent}%</bdi></strong>
              <small>{dateText(item.createdAt, language)} · {l('rate')} <bdi dir="ltr">{formatRate(item.rate)}</bdi> · {item.rateDate ? `${l('rateDate')} ${dateText(item.rateDate, language)}` : l('identityRate')}</small></div>
            <div className="history-total"><small>{l('finalPrice')}</small><strong><bdi dir="ltr">EGP {formatWholeMoney(item.finalPrice)}</bdi></strong></div>
          </div>)}</div>}</section>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} STM · {l('footerBrand')}</span>
      {rate && rate.provider !== 'Local' && <span>{l('footerRates')} <a
        href="https://cxrates.com/" target="_blank" rel="noreferrer">CxRates</a></span>}</footer>
  </div>;
}
