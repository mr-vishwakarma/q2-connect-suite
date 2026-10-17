/**
 * Billing Cycle & Due Date Engine
 * 
 * Computes calendar-month billing cycles anchored to each student's joining date.
 * Features:
 * - Deterministic calendar-month arithmetic (not fixed ms or 30-day approximations)
 * - Safe month-end date handling (e.g. 31st joining date -> 28/29 Feb, 30 Apr, 31 May)
 * - Grace period and per-day late fee calculations
 * - Authoritative billing period representation (periodStart, periodEnd, dueDate, feeMonth)
 * - Immune to UTC timezone day-shift conversion errors
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Extracts year, 0-indexed month, and day safely from string or Date.
 */
function parseDateParts(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return {
        year: parseInt(isoMatch[1], 10),
        month: parseInt(isoMatch[2], 10) - 1, // 0-indexed
        day: parseInt(isoMatch[3], 10),
      };
    }
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  };
}

/**
 * Returns the number of days in a given year and month (0-indexed month: 0 = Jan, 11 = Dec).
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Normalizes any date input to a local date-only Date object at 00:00:00.000.
 */
function normalizeToDateOnly(dateInput) {
  const parts = parseDateParts(dateInput);
  if (!parts) return null;
  return new Date(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

/**
 * Calculates the exact due date for a given cycle index starting from the student's anchor joining date.
 * Cycle 0: Admission month
 * Cycle 1: Month 1 (+1 month from admission)
 * Cycle 2: Month 2 (+2 months from admission)
 * 
 * Month-end handling:
 * A student joining on the 31st receives the last valid calendar date in shorter months (e.g. Feb 28/29, Apr 30),
 * and restores to the 31st in longer months (e.g. May 31).
 * 
 * @param {Date|string} joiningDateInput - Student's canonical joining date
 * @param {number} cycleIndex - 0-based cycle index
 * @returns {Date} Date-only Date object
 */
function calculateCycleDueDate(joiningDateInput, cycleIndex = 0) {
  const parts = parseDateParts(joiningDateInput) || parseDateParts(new Date());
  const anchorDay = parts.day;
  const anchorMonth = parts.month;
  const anchorYear = parts.year;

  const totalMonths = anchorMonth + cycleIndex;
  const targetYear = anchorYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(anchorDay, maxDays);

  return new Date(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
}

/**
 * Derives the next monthly due date for a student given their joining date.
 * If student joined on 05/10/2026, next monthly due date is 05/11/2026.
 * If student joined on 31/01/2026, next monthly due date is 28/02/2026 (or 29/02 in leap year).
 * 
 * @param {Date|string} joiningDateInput
 * @param {number} [cycleOffset=1] - Offset from joining cycle (default 1 for next month)
 * @returns {Date}
 */
function getNextMonthlyDueDate(joiningDateInput, cycleOffset = 1) {
  return calculateCycleDueDate(joiningDateInput, cycleOffset);
}

/**
 * Calculates complete billing period boundaries for a cycle.
 * 
 * @param {Date|string} joiningDateInput
 * @param {number} cycleIndex
 * @returns {{ periodStart: Date, periodEnd: Date, dueDate: Date, feeMonth: string, cycleNumber: number, cycleIndex: number }}
 */
function calculateBillingPeriod(joiningDateInput, cycleIndex = 0) {
  const periodStart = calculateCycleDueDate(joiningDateInput, cycleIndex);
  const nextCycleStart = calculateCycleDueDate(joiningDateInput, cycleIndex + 1);

  // Period end is the day before the next cycle starts
  const periodEnd = new Date(nextCycleStart.getTime() - 24 * 60 * 60 * 1000);

  const monthName = MONTH_NAMES[periodStart.getMonth()];
  const year = periodStart.getFullYear();
  const feeMonth = `${monthName} ${year}`;

  return {
    periodStart,
    periodEnd,
    dueDate: periodStart,
    feeMonth,
    cycleNumber: cycleIndex,
    cycleIndex,
  };
}

/**
 * Alias for calculateBillingPeriod
 */
const deriveBillingCycle = calculateBillingPeriod;

/**
 * Centralized Authoritative Late-Fee Calculation Engine
 * 
 * Formula:
 * D = applicable fee due date
 * G = configured grace period in days
 * R = configured late-fee penalty per chargeable day
 * E = current policy-based calculation date (asOfDate)
 * 
 * overdueDays = max(0, E - D) in whole calendar days
 * chargeableDays = max(0, overdueDays - G)
 * lateFee = chargeableDays × R
 * 
 * Rules:
 * - No penalty on or before due date (overdueDays = 0)
 * - No penalty during configured grace interval (overdueDays <= G -> chargeableDays = 0)
 * - Daily penalty begins only after grace period expires
 * 
 * @param {Date|string} dueDateInput
 * @param {number} [gracePeriodDays=5]
 * @param {number} [lateFeePerDay=20]
 * @param {Date|string} [asOfDateInput=new Date()]
 * @returns {{ overdueDays: number, chargeableDays: number, lateFee: number, isOverdue: boolean }}
 */
function calculateLateFeeBreakdown(dueDateInput, gracePeriodDays = 5, lateFeePerDay = 20, asOfDateInput = new Date()) {
  let dueDate = dueDateInput;
  let grace = gracePeriodDays;
  let rate = lateFeePerDay;
  let asOf = asOfDateInput;
  let isPaid = false;
  let historicalLateFee = 0;

  // Polymorphic support: Handle options object as first argument
  if (typeof dueDateInput === 'object' && dueDateInput !== null && !(dueDateInput instanceof Date)) {
    dueDate = dueDateInput.dueDate;
    grace = dueDateInput.gracePeriodDays !== undefined ? dueDateInput.gracePeriodDays : 5;
    rate = dueDateInput.lateFeePerDay !== undefined ? dueDateInput.lateFeePerDay : 20;
    asOf = dueDateInput.asOfDate !== undefined ? dueDateInput.asOfDate : new Date();
    isPaid = Boolean(dueDateInput.isPaid);
    historicalLateFee = Number(dueDateInput.historicalLateFee || 0);
  }

  if (isPaid) {
    return {
      overdueDays: 0,
      chargeableDays: 0,
      lateFee: historicalLateFee,
      isOverdue: false,
    };
  }

  const normDueDate = normalizeToDateOnly(dueDate);
  const normAsOf = normalizeToDateOnly(asOf);

  if (!normDueDate || !normAsOf) {
    return {
      overdueDays: 0,
      chargeableDays: 0,
      lateFee: 0,
      isOverdue: false,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((normAsOf.getTime() - normDueDate.getTime()) / msPerDay);
  const overdueDays = Math.max(0, diffDays);

  const graceDays = Math.max(0, Number(grace) || 0);
  const dailyRate = Math.max(0, Number(rate) || 0);

  let chargeableDays = 0;
  let lateFee = 0;
  let isOverdue = false;

  if (overdueDays > graceDays) {
    chargeableDays = overdueDays - graceDays;
    lateFee = chargeableDays * dailyRate;
    isOverdue = true;
  }

  return {
    overdueDays,
    chargeableDays,
    lateFee,
    isOverdue,
  };
}

module.exports = {
  parseDateParts,
  getDaysInMonth,
  normalizeToDateOnly,
  calculateCycleDueDate,
  getNextMonthlyDueDate,
  calculateBillingPeriod,
  deriveBillingCycle,
  calculateLateFeeBreakdown,
  MONTH_NAMES,
};
