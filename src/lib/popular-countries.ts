/**
 * A curated bootstrap list for the admin's "add popular markets" action on
 * /admin/countries — NOT a hardcoded country list read by app logic. Every
 * user-facing path (registration, filtering, the picker) still reads only
 * from the Country table via src/lib/countries.ts; this is just a starting
 * point an admin can accept, edit or ignore, one click instead of twenty-five
 * forms. See src/lib/countries.ts for why a hardcoded list is normally the
 * bug this table exists to prevent.
 *
 * Mixes popular treatment destinations (clinic supply) with popular
 * patient-origin markets (demand) — dental tourism needs both sides. Every
 * entry defaults to English (the only non-Hebrew locale this site serves),
 * no insurer list (payer names vary too much to guess), and a single generic
 * "dental_licence" required document — an admin can refine any of this later
 * at /admin/countries, same as a country added by hand.
 */

export type PopularCountry = {
  code: string;
  nameEn: string;
  currency: string;
  callingCode: string;
};

export const POPULAR_COUNTRIES: PopularCountry[] = [
  { code: "TR", nameEn: "Turkey", currency: "TRY", callingCode: "90" },
  { code: "HU", nameEn: "Hungary", currency: "HUF", callingCode: "36" },
  { code: "PL", nameEn: "Poland", currency: "PLN", callingCode: "48" },
  { code: "RO", nameEn: "Romania", currency: "RON", callingCode: "40" },
  { code: "HR", nameEn: "Croatia", currency: "EUR", callingCode: "385" },
  { code: "CZ", nameEn: "Czech Republic", currency: "CZK", callingCode: "420" },
  { code: "RS", nameEn: "Serbia", currency: "RSD", callingCode: "381" },
  { code: "AL", nameEn: "Albania", currency: "ALL", callingCode: "355" },
  { code: "GE", nameEn: "Georgia", currency: "GEL", callingCode: "995" },
  { code: "MX", nameEn: "Mexico", currency: "MXN", callingCode: "52" },
  { code: "CR", nameEn: "Costa Rica", currency: "CRC", callingCode: "506" },
  { code: "CO", nameEn: "Colombia", currency: "COP", callingCode: "57" },
  { code: "TH", nameEn: "Thailand", currency: "THB", callingCode: "66" },
  { code: "IN", nameEn: "India", currency: "INR", callingCode: "91" },
  { code: "GR", nameEn: "Greece", currency: "EUR", callingCode: "30" },
  { code: "PT", nameEn: "Portugal", currency: "EUR", callingCode: "351" },
  { code: "ES", nameEn: "Spain", currency: "EUR", callingCode: "34" },
  { code: "DE", nameEn: "Germany", currency: "EUR", callingCode: "49" },
  { code: "GB", nameEn: "United Kingdom", currency: "GBP", callingCode: "44" },
  { code: "US", nameEn: "United States", currency: "USD", callingCode: "1" },
  { code: "FR", nameEn: "France", currency: "EUR", callingCode: "33" },
  { code: "IT", nameEn: "Italy", currency: "EUR", callingCode: "39" },
  { code: "NL", nameEn: "Netherlands", currency: "EUR", callingCode: "31" },
  { code: "CA", nameEn: "Canada", currency: "CAD", callingCode: "1" },
  { code: "AU", nameEn: "Australia", currency: "AUD", callingCode: "61" },
];
