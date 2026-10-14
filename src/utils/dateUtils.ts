/**
 * Date Formatting Utilities
 *
 * Implements strict DD/MM/YYYY formatting with leading zeros for day and month,
 * four-digit year, safe fallback for missing/null values ('—'), and timezone-safe
 * parsing to prevent day shifting on date-only ISO strings (e.g. '2026-10-14').
 */

/**
 * Formats a date string, Date object, or timestamp as DD/MM/YYYY.
 *
 * @param dateInput - string, Date, number, null, or undefined
 * @param fallback - Placeholder to display if date is missing or invalid (default: '—')
 * @returns string formatted as 'DD/MM/YYYY' or fallback
 */
export function formatDateDMY(dateInput?: string | Date | number | null, fallback = '—'): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return fallback;
  }

  try {
    let year: number;
    let month: number;
    let day: number;

    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed === 'null' || trimmed === 'undefined') {
        return fallback;
      }

      // Timezone-safe match for standard YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
      const isoDateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoDateOnlyMatch) {
        year = parseInt(isoDateOnlyMatch[1], 10);
        month = parseInt(isoDateOnlyMatch[2], 10);
        day = parseInt(isoDateOnlyMatch[3], 10);
      } else {
        const parsed = new Date(trimmed);
        if (isNaN(parsed.getTime())) return fallback;
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
      }
    } else if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return fallback;
      year = dateInput.getFullYear();
      month = dateInput.getMonth() + 1;
      day = dateInput.getDate();
    } else if (typeof dateInput === 'number') {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) return fallback;
      year = parsed.getFullYear();
      month = parsed.getMonth() + 1;
      day = parsed.getDate();
    } else {
      return fallback;
    }

    // Guard against invalid/epoch dates like 1970-01-01 for missing values
    if (isNaN(year) || isNaN(month) || isNaN(day) || year < 1971) {
      return fallback;
    }

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);

    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return fallback;
  }
}
