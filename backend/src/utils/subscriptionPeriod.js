/**
 * Authoritative Subscription Period Date Calculator
 * 
 * Accurately calculates subscription periods with calendar month-end safety:
 * e.g., Jan 31 + 1 month = Feb 28 (or Feb 29 on leap year)
 * March 31 + 1 month = April 30
 * 
 * Supports early renewals by extending from existing currentPeriodEnd,
 * and post-expiry renewals by anchoring to the verified activation time.
 */

function addCalendarMonths(startDate, months = 1) {
  const d = new Date(startDate);
  const originalDay = d.getDate();
  const originalHours = d.getHours();
  const originalMinutes = d.getMinutes();
  const originalSeconds = d.getSeconds();
  const originalMs = d.getMilliseconds();

  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  const targetYear = d.getFullYear();
  const targetMonth = d.getMonth();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  d.setDate(Math.min(originalDay, daysInTargetMonth));
  d.setHours(originalHours, originalMinutes, originalSeconds, originalMs);
  return d;
}

function addCalendarYears(startDate, years = 1) {
  const d = new Date(startDate);
  const originalMonth = d.getMonth();
  const originalDay = d.getDate();
  const originalHours = d.getHours();
  const originalMinutes = d.getMinutes();
  const originalSeconds = d.getSeconds();
  const originalMs = d.getMilliseconds();

  d.setFullYear(d.getFullYear() + years);

  // Leap year safety for Feb 29
  if (originalMonth === 1 && originalDay === 29) {
    const daysInFeb = new Date(d.getFullYear(), 2, 0).getDate();
    d.setDate(Math.min(originalDay, daysInFeb));
  }

  d.setHours(originalHours, originalMinutes, originalSeconds, originalMs);
  return d;
}

/**
 * Calculates start and end dates for a subscription renewal or activation.
 * 
 * @param {Object} options
 * @param {Date} [options.activationDate=new Date()]
 * @param {'MONTHLY'|'YEARLY'} [options.billingCycle='MONTHLY']
 * @param {Object} [options.existingSubscription=null]
 * @param {number} [options.durationCycles=1]
 * @returns {{ periodStart: Date, periodEnd: Date, isExtension: boolean }}
 */
function calculateSubscriptionPeriod({
  activationDate = new Date(),
  billingCycle = 'MONTHLY',
  existingSubscription = null,
  durationCycles = 1,
  activationDurationDays = null,
  allowTrialExtension = false,
}) {
  const isYearly = String(billingCycle || '').toUpperCase() === 'YEARLY';
  const now = new Date(activationDate);

  let anchorDate = now;
  let isExtension = false;

  // Early renewal extension: extend from currentPeriodEnd ONLY when existing subscription is ACTIVE paid
  // (never extend a TRIAL unless explicitly requested so Trial -> Paid starts a fresh paid cycle)
  const canExtendStatus =
    existingSubscription &&
    (existingSubscription.status === 'ACTIVE' ||
      (allowTrialExtension && existingSubscription.status === 'TRIAL'));

  if (
    canExtendStatus &&
    existingSubscription.currentPeriodEnd &&
    new Date(existingSubscription.currentPeriodEnd) > now
  ) {
    anchorDate = new Date(existingSubscription.currentPeriodEnd);
    isExtension = true;
  }

  let periodEnd;
  if (activationDurationDays && Number(activationDurationDays) > 0) {
    periodEnd = new Date(anchorDate.getTime() + Number(activationDurationDays) * 24 * 60 * 60 * 1000);
  } else {
    periodEnd = isYearly
      ? addCalendarYears(anchorDate, durationCycles)
      : addCalendarMonths(anchorDate, durationCycles);
  }

  const periodStart = isExtension
    ? (existingSubscription.currentPeriodStart || now)
    : now;

  return {
    periodStart,
    periodEnd,
    isExtension,
  };
}

module.exports = {
  addCalendarMonths,
  addCalendarYears,
  calculateSubscriptionPeriod,
};
