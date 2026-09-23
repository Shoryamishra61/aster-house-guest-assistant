/**
 * Aster House Guest Assistant - Money Value Object
 * Invariant: Never use floating point dollars for pricing truth.
 * All monetary amounts are stored in minor units (e.g. cents for USD).
 */

export type CurrencyCode = "USD";

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export function createMoney(amountMinor: number, currency: CurrencyCode = "USD"): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money amountMinor must be an integer: received ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function fromDollars(dollars: number, currency: CurrencyCode = "USD"): Money {
  return {
    amountMinor: Math.round(dollars * 100),
    currency,
  };
}

export function toDollars(money: Money): number {
  return money.amountMinor / 100;
}

export function formatMoney(money: Money, locale: string = "en-US"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: money.amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(toDollars(money));
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add money of different currencies: ${a.currency} and ${b.currency}`);
  }
  return {
    amountMinor: a.amountMinor + b.amountMinor,
    currency: a.currency,
  };
}

export function multiplyMoney(money: Money, multiplier: number): Money {
  if (!Number.isInteger(multiplier) || multiplier < 0) {
    throw new Error(`Multiplier must be a non-negative integer: received ${multiplier}`);
  }
  return {
    amountMinor: money.amountMinor * multiplier,
    currency: money.currency,
  };
}
