import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { currencies, currencyName, type CurrencyCode } from '../domain/currencies';
import { t, type Language } from '../i18n';

type Props = { value: CurrencyCode; onChange: (value: CurrencyCode) => void;
  language: Language; disabled?: boolean };

export default function CurrencyPicker({ value, onChange, language, disabled }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const element = dialog.current;
    const focus = () => search.current?.focus();
    element?.addEventListener('close', focus);
    return () => element?.removeEventListener('close', focus);
  }, []);

  const matches = currencies.filter(([code]) =>
    `${code} ${currencyName(code, language)} ${currencyName(code, 'en')}`
      .toLowerCase().includes(query.toLowerCase()));

  return <>
    <button type="button" className="currency-trigger" onClick={() => {
      setQuery(''); dialog.current?.showModal();
      setTimeout(() => search.current?.focus(), 0);
    }} disabled={disabled} aria-haspopup="dialog"
      aria-label={`${t(language, 'currency')}: ${value}, ${currencyName(value, language)}`}>
      <span className="currency-code">{value}</span>
      <span className="currency-name">{currencyName(value, language)}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="currency-dialog" aria-label={t(language, 'chooseCurrency')}>
      <div className="dialog-head">
        <div><h2>{t(language, 'chooseCurrency')}</h2><p>{t(language, 'supportedCurrencies')}</p></div>
        <button type="button" className="icon-button" aria-label={t(language, 'closeCurrencyList')}
          onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      <div className="search-wrap"><Search size={19} aria-hidden="true" />
        <input ref={search} type="search" placeholder={t(language, 'searchPlaceholder')}
          aria-label={t(language, 'searchCurrencies')} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="currency-list">
        {matches.map(([code]) => <button type="button" key={code} className="currency-option"
          aria-label={`${code} ${currencyName(code, language)}`}
          onClick={() => { onChange(code); dialog.current?.close(); }}>
          <span className="currency-code">{code}</span><span>{currencyName(code, language)}</span>
          {code === value && <Check size={18} className="selected-check" aria-label={t(language, 'selected')} />}
        </button>)}
        {matches.length === 0 && <p className="empty-list">{t(language, 'noMatchingCurrency')}</p>}
      </div>
    </dialog>
  </>;
}
