export const currencies = [
  ['EGP', 'Egyptian Pound'], ['USD', 'US Dollar'], ['EUR', 'Euro'],
  ['GBP', 'British Pound'], ['SAR', 'Saudi Riyal'], ['AED', 'UAE Dirham'],
  ['KWD', 'Kuwaiti Dinar'], ['QAR', 'Qatari Riyal'], ['BHD', 'Bahraini Dinar'],
  ['OMR', 'Omani Rial'], ['JPY', 'Japanese Yen'], ['CNY', 'Chinese Yuan'],
  ['TRY', 'Turkish Lira'], ['CHF', 'Swiss Franc'], ['CAD', 'Canadian Dollar'],
  ['AUD', 'Australian Dollar'],
] as const;

export type CurrencyCode = (typeof currencies)[number][0];
export const isCurrency = (value: string): value is CurrencyCode =>
  currencies.some(([code]) => code === value);
export const currencyName = (code: CurrencyCode) =>
  currencies.find(([candidate]) => candidate === code)?.[1] ?? code;
