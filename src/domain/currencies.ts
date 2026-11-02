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
const arabicNames: Record<CurrencyCode, string> = {
  EGP: 'الجنيه المصري', USD: 'الدولار الأمريكي', EUR: 'اليورو',
  GBP: 'الجنيه الإسترليني', SAR: 'الريال السعودي', AED: 'الدرهم الإماراتي',
  KWD: 'الدينار الكويتي', QAR: 'الريال القطري', BHD: 'الدينار البحريني',
  OMR: 'الريال العُماني', JPY: 'الين الياباني', CNY: 'اليوان الصيني',
  TRY: 'الليرة التركية', CHF: 'الفرنك السويسري', CAD: 'الدولار الكندي',
  AUD: 'الدولار الأسترالي',
};
export const currencyName = (code: CurrencyCode, language: 'en' | 'ar' = 'en') =>
  language === 'ar' ? arabicNames[code] :
    currencies.find(([candidate]) => candidate === code)?.[1] ?? code;
