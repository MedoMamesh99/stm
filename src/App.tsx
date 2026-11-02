import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Clipboard, Clock3, History, Moon, RefreshCw, RotateCcw, ShieldCheck, Sun, Trash2, TrendingUp } from 'lucide-react';
import CurrencyPicker from './components/CurrencyPicker';
import { calculate, formatMoney, formatRate, validatePrice, validateProfit, type Calculation } from './domain/calculation';
import { currencyName, type CurrencyCode } from './domain/currencies';
import { providerLabel, t, type Language, type MessageKey } from './i18n';
import { addHistory, clearHistory, loadHistory } from './services/history';
import { activeProviderName, getExchangeRate, RateError, readCachedRate, type ExchangeRate } from './services/rates';

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
    setRate(null); setRateError(null); setFailedCalculation(false); setLoading(true);
    getExchangeRate(currency, { signal: controller.signal }).then(setRate)
      .catch((error: unknown) => { if (!controller.signal.aborted) setRateError(issue(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currency]);

  async function refreshRate() {
    if (busyRef.current || loading) return;
    setLoading(true); setRateError(null); setResult(null); setFailedCalculation(false);
    try { setRate(await getExchangeRate(currency, { force: true, allowCachedFallback: false })); }
    catch (error) { setRate(null); setRateError(issue(error)); }
    finally { setLoading(false); }
  }
  async function performCalculation(useCached = false) {
    if (busyRef.current || loading) return;
    const p = validatePrice(price) as MessageKey | null;
    const m = validateProfit(profit) as MessageKey | null;
    setPriceError(p); setProfitError(m);
    if (p || m) return;
    busyRef.current = true; setCalculating(true); setRateError(null); setResult(null); setFailedCalculation(false);
    try {
      const current = useCached ? readCachedRate(currency) :
        await getExchangeRate(currency, { force: true, allowCachedFallback: false });
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
      await navigator.clipboard.writeText(`EGP ${formatMoney(result.finalPrice)}`);
      setCopied(true); setCopyError(false); setTimeout(() => setCopied(false), 2200);
    } catch { setCopied(false); setCopyError(true); }
  }
  const cached = rate?.source === 'cache' || rate?.source === 'offline';
  const cacheForRetry = failedCalculation ? readCachedRate(currency) : null;
  const currentProvider = rate?.provider ?? activeProviderName();
  return <div className="site-shell">
    <header className="site-header"><div className="brand-lockup">
      <img src={asset} alt={l('logoAlt')} className="brand-logo" />
      <div><div className="brand-title">STM<span className="brand-dot">.</span></div><div className="brand-subtitle">{l('subtitle')}</div></div>
    </div><button type="button" className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={l(theme === 'light' ? 'switchDark' : 'switchLight')}>
      {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
      <span>{l(theme === 'light' ? 'themeDark' : 'themeLight')}</span></button></header>
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
                <span>{l('pair')}: <bdi dir="ltr">{rate.pair}</bdi></span>
                <span>{l('rateStatus')}: {l(rate.source === 'network' ? 'fresh' : rate.source === 'identity' ? 'identity' : rate.source === 'cache' ? 'cached' : 'offline')}</span>
                <span>{l('rateDate')}: {dateText(rate.rateDate, language)}</span>
                {rate.rateTimestamp && <span>{l('providerUpdated')}: {dateText(rate.rateTimestamp, language)}</span>}
                {rate.source !== 'identity' && <span>{l('fetched')}: {dateText(rate.fetchedAt, language)}</span>}</div>}
              {cached && <p className="cache-warning" role="status">
                {l(rate?.source === 'offline' ? 'unavailableSavedRate' : 'savedRate')} {l('verifyRate')}</p>}
              {rateError && <p className="rate-error" role="alert">{l(rateError)} <button type="button"
                onClick={failedCalculation ? () => void performCalculation() : refreshRate}>{l('retry')}</button></p>}
              {cacheForRetry && <button type="button" className="cached-calculate-button"
                onClick={() => void performCalculation(true)}>{l('calculateCached')}</button>}
              <p className="rate-note">{l(currentProvider === 'Twelve Data' ? 'twelveNote' : 'frankfurterNote')}</p></div>
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
              <div className="final-number"><bdi dir="ltr"><span>EGP</span> {formatMoney(result.finalPrice)}</bdi></div>
              <div className="final-caption">{l('finalCaption')}</div></div>
            <div className="breakdown-list">
              <Row label={l('originalUnitPrice')}><bdi dir="ltr">{result.currency} {formatMoney(result.original)}</bdi></Row>
              <Row label={l('selectedCurrency')}>{currencyName(result.currency, language)} · <bdi dir="ltr">{result.currency}</bdi></Row>
              <Row label={l('exchangeRate')}><bdi dir="ltr">1 {result.currency} = {formatRate(result.rate)} EGP</bdi></Row>
              <Row label={l('convertedCost')}><bdi dir="ltr">EGP {formatMoney(result.converted)}</bdi></Row>
              <Row label={l('profitMarkup')}><bdi dir="ltr">{result.profitPercent}%</bdi></Row>
              <Row label={l('profitAmount')}><bdi dir="ltr">EGP {formatMoney(result.profitAmount)}</bdi></Row>
              <Row label={l('provider')}>{providerLabel(language, result.provider ?? 'Frankfurter')}</Row>
              <Row label={l('providerRateDate')}>{dateText(result.rateTimestamp ?? result.rateDate, language)}</Row>
              <Row label={l('fetched')}>{dateText(result.fetchedAt, language)}</Row></div>
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
            <div className="history-detail"><strong><bdi dir="ltr">{item.currency} {formatMoney(item.original)} + {item.profitPercent}%</bdi></strong>
              <small>{dateText(item.createdAt, language)} · {l('rate')} <bdi dir="ltr">{formatRate(item.rate)}</bdi> · {item.rateDate ? `${l('rateDate')} ${dateText(item.rateDate, language)}` : l('identityRate')}</small></div>
            <div className="history-total"><small>{l('finalPrice')}</small><strong><bdi dir="ltr">EGP {formatMoney(item.finalPrice)}</bdi></strong></div>
          </div>)}</div>}</section>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} STM · {l('footerBrand')}</span>
      <div className="footer-language" role="group" aria-label="Language / اللغة">
        <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
        <button type="button" lang="ar" aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>العربية</button></div>
      <span>{l('footerRates')} <a href={currentProvider === 'Twelve Data' ? 'https://twelvedata.com/' : 'https://frankfurter.dev/'}
        target="_blank" rel="noreferrer">{providerLabel(language, currentProvider)}</a></span></footer>
  </div>;
}
