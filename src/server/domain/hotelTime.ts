/**
 * Aster House Guest Assistant - Hotel Time Domain Logic
 * Handles property-specific timezone, date-only string manipulation,
 * check-in/out night math, leap years, DST boundaries, and "today at property".
 */

export interface PropertyTimeConfig {
  propertyId: string;
  timeZone: string; // e.g. "America/New_York"
}

export const DEFAULT_PROPERTY_CONFIG: PropertyTimeConfig = {
  propertyId: "aster-house-main",
  timeZone: "America/New_York",
};

/**
 * Returns today's date formatted as YYYY-MM-DD in the property's local timezone.
 */
export function getTodayAtProperty(timeZone: string = DEFAULT_PROPERTY_CONFIG.timeZone): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Validates whether a string is a valid calendar date in YYYY-MM-DD format.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return day >= 1 && day <= daysInMonth;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Calculates number of nights between check-in and check-out purely using date math,
 * unaffected by daylight saving time shifts or local browser timezone.
 */
export function calculateStayNights(checkIn: string, checkOut: string): number {
  if (!isValidCalendarDate(checkIn) || !isValidCalendarDate(checkOut)) {
    throw new Error(`Invalid calendar date format (expected YYYY-MM-DD): ${checkIn}, ${checkOut}`);
  }

  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);

  // UTC midnight conversion to avoid local DST hour offsets
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const diffMs = utc2 - utc1;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    throw new Error(`Check-out (${checkOut}) must be strictly after check-in (${checkIn})`);
  }

  return diffDays;
}

/**
 * Adds N days to a date-only string in YYYY-MM-DD format.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  if (!isValidCalendarDate(dateStr)) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
