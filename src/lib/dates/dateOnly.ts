const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parses a Postgres `date` ("2026-11-01") as a LOCAL date.
 *
 * `new Date('2026-11-01')` is read as UTC midnight, which in the Americas
 * (UTC-3…-5) is still the previous day, so it rendered as "31 oct". Timestamps
 * with a time part are left to the native parser.
 */
export function parseDateOnly(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}
