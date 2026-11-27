/**
 * The operator details every legal page names. Each one is null until the
 * operator is registered (company / licensed dealer) — a null renders as a
 * highlighted «placeholder» on the page, so nothing ships looking finished
 * when it is not. Fill these once here; every legal page reads them.
 */
export const LEGAL_ENTITY = {
  /** Registered name of the company or dealer that operates the site. */
  name: null as string | null,
  /** Company number (ח.פ.) or dealer number (ע.מ.). */
  idNumber: null as string | null,
  /** Registered address. */
  address: null as string | null,
  /** City whose courts have jurisdiction, e.g. "תל אביב-יפו" / "Tel Aviv-Jaffa". */
  jurisdictionCityHe: null as string | null,
  jurisdictionCityEn: null as string | null,
  /** Accessibility coordinator (required by Israeli accessibility regulations). */
  accessibilityCoordinator: {
    name: null as string | null,
    email: null as string | null,
    phone: null as string | null,
  },
  /** Data protection officer / privacy contact, if one is appointed. */
  privacyOfficer: null as string | null,
  /** Date the site's accessibility was last actually audited, e.g. "נובמבר 2026". */
  accessibilityAuditDateHe: null as string | null,
  accessibilityAuditDateEn: null as string | null,
};
