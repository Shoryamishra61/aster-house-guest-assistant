import { describe, it, expect } from "vitest";
import {
  calculateNights,
  validateAvailabilityQuery,
  mergeAvailabilitySlots,
  findSuitableRooms,
  checkAvailability,
  DomainValidationError,
} from "../../src/server/domain/availability";

describe("Deterministic Domain - Date & Night Logic", () => {
  it("calculates positive nights accurately", () => {
    expect(calculateNights("2026-10-01", "2026-10-05")).toBe(4);
    expect(calculateNights("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("throws DomainValidationError when checkout is before or same as checkin", () => {
    expect(() => calculateNights("2026-10-05", "2026-10-01")).toThrow(DomainValidationError);
    expect(() => calculateNights("2026-10-01", "2026-10-01")).toThrow(DomainValidationError);
  });

  it("throws DomainValidationError for invalid date strings", () => {
    expect(() => calculateNights("not-a-date", "2026-10-05")).toThrow(DomainValidationError);
  });
});

describe("Deterministic Domain - Query Validation", () => {
  it("accepts a valid query", () => {
    const res = validateAvailabilityQuery(
      { checkIn: "2026-10-10", checkOut: "2026-10-12", adults: 2 },
      { today: "2026-09-01" }
    );
    expect(res).toEqual({ checkIn: "2026-10-10", checkOut: "2026-10-12", adults: 2 });
  });

  it("rejects check-in date in the past relative to today", () => {
    expect(() =>
      validateAvailabilityQuery(
        { checkIn: "2026-08-01", checkOut: "2026-08-05", adults: 2 },
        { today: "2026-09-01" }
      )
    ).toThrow(DomainValidationError);
  });

  it("rejects non-positive or excessive party size", () => {
    expect(() =>
      validateAvailabilityQuery(
        { checkIn: "2026-10-10", checkOut: "2026-10-12", adults: 0 },
        { today: "2026-09-01" }
      )
    ).toThrow(DomainValidationError);

    expect(() =>
      validateAvailabilityQuery(
        { checkIn: "2026-10-10", checkOut: "2026-10-12", adults: 20 },
        { today: "2026-09-01" }
      )
    ).toThrow(DomainValidationError);
  });
});

describe("Deterministic Domain - Slot Merging", () => {
  it("overwrites existing slots with explicit new values while preserving unmentioned ones", () => {
    const existing = { checkIn: "2026-10-10", checkOut: "2026-10-14", adults: 2 };
    const incoming = { adults: 4 };

    const merged = mergeAvailabilitySlots(existing, incoming);
    expect(merged).toEqual({
      checkIn: "2026-10-10",
      checkOut: "2026-10-14",
      adults: 4,
    });
  });

  it("handles empty initial state cleanly", () => {
    const merged = mergeAvailabilitySlots(undefined, { checkIn: "2026-11-01" });
    expect(merged).toEqual({ checkIn: "2026-11-01" });
  });
});

describe("Deterministic Domain - Room Suitability vs Availability", () => {
  it("finds rooms based on capacity without availability checks", () => {
    const suitableFor3 = findSuitableRooms(3);
    expect(suitableFor3.length).toBeGreaterThan(0);
    // Every suitable room must hold at least 3 guests
    for (const r of suitableFor3) {
      expect(r.maxOccupancy).toBeGreaterThanOrEqual(3);
    }

    const suitableFor5 = findSuitableRooms(5);
    expect(suitableFor5.length).toBe(1);
    expect(suitableFor5[0].id).toBe("executive-family-suite");
  });

  it("returns deterministic identical availability across multiple runs", () => {
    const res1 = checkAvailability("2026-11-10", "2026-11-13", 2);
    const res2 = checkAvailability("2026-11-10", "2026-11-13", 2);

    expect(res1).toEqual(res2);
    expect(res1.query.nights).toBe(3);
    for (const room of res1.rooms) {
      expect(room.totalPrice).toBe(room.nightlyRate * 3);
      expect(room.maxOccupancy).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns zero rooms on known sold-out fixture dates", () => {
    const res = checkAvailability("2026-12-24", "2026-12-26", 2);
    expect(res.rooms).toHaveLength(0);
    expect(res.query.nights).toBe(2);
  });
});
