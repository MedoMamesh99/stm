import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { currencies, currencyName, type CurrencyCode } from '../domain/currencies';

type Props = { value: CurrencyCode; onChange: (value: CurrencyCode) => void; disabled?: boolean };

export default function CurrencyPicker({ value, onChange, disabled }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const element = dialog.current;
    const focus = () => search.current?.focus();
    element?.addEventListener('close', focus);
    return () => element?.removeEventListener('close', focus);
  }, []);

  const matches = currencies.filter(([code, name]) =>
    `${code} ${name}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    <button type="button" className="currency-trigger" onClick={() => {
      setQuery(''); dialog.current?.showModal();
      setTimeout(() => search.current?.focus(), 0);
    }} disabled={disabled} aria-haspopup="dialog" aria-label={`Currency: ${value}, ${currencyName(value)}`}>
      <span className="currency-code">{value}</span>
      <span className="currency-name">{currencyName(value)}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="currency-dialog" aria-label="Choose currency">
      <div className="dialog-head">
        <div><h2>Choose currency</h2><p>16 supported currencies</p></div>
        <button type="button" className="icon-button" aria-label="Close currency list"
          onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      <div className="search-wrap"><Search size={19} aria-hidden="true" />
        <input ref={search} type="search" placeholder="Search code or name"
          aria-label="Search currencies" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="currency-list">
        {matches.map(([code, name]) => <button type="button" key={code} className="currency-option"
          aria-label={`${code} ${name}`}
          onClick={() => { onChange(code); dialog.current?.close(); }}>
          <span className="currency-code">{code}</span><span>{name}</span>
          {code === value && <Check size={18} className="selected-check" aria-label="Selected" />}
        </button>)}
        {matches.length === 0 && <p className="empty-list">No matching currency.</p>}
      </div>
    </dialog>
  </>;
}
