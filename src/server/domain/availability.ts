import { ROOM_TYPES, RoomType } from "../data/hotelData";
import { AvailabilityQuery, AvailabilityResult, AvailabilitySlots, RoomResult } from "../../shared/contracts";

export class DomainValidationError extends Error {
  constructor(public code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "DomainValidationError";
  }
}

/**
 * Calculates number of nights between checkIn and checkOut (YYYY-MM-DD)
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn + "T00:00:00Z");
  const outDate = new Date(checkOut + "T00:00:00Z");

  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
    throw new DomainValidationError("INVALID_DATES", "Dates must be valid calendar dates (YYYY-MM-DD)");
  }

  const diffMs = outDate.getTime() - inDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    throw new DomainValidationError("INVALID_DATES", "Check-out date must be strictly after check-in date");
  }

  return diffDays;
}

/**
 * Validates an availability query against business rules
 */
export function validateAvailabilityQuery(
  query: Partial<AvailabilityQuery>,
  options: { today?: string; maxStayNights?: number } = {}
): AvailabilityQuery {
  const { today = new Date().toISOString().slice(0, 10), maxStayNights = 30 } = options;

  if (!query.checkIn || !query.checkOut || query.adults === undefined || query.adults === null) {
    throw new DomainValidationError("MISSING_FIELDS", "checkIn, checkOut, and adults are all required");
  }

  // Regex validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(query.checkIn) || !dateRegex.test(query.checkOut)) {
    throw new DomainValidationError("INVALID_DATES", "Dates must be in YYYY-MM-DD format");
  }

  // Future check: checkIn cannot be in the past relative to today
  if (query.checkIn < today) {
    throw new DomainValidationError("INVALID_DATES", `Check-in date (${query.checkIn}) cannot be in the past (today is ${today})`);
  }

  const nights = calculateNights(query.checkIn, query.checkOut);

  if (nights > maxStayNights) {
    throw new DomainValidationError("STAY_TOO_LONG", `Maximum stay length is ${maxStayNights} nights`);
  }

  if (typeof query.adults !== "number" || !Number.isInteger(query.adults) || query.adults < 1) {
    throw new DomainValidationError("INVALID_PARTY_SIZE", "Number of guests must be a positive integer");
  }

  const maxHotelCapacity = Math.max(...ROOM_TYPES.map((r) => r.maxOccupancy));
  if (query.adults > maxHotelCapacity) {
    throw new DomainValidationError(
      "CAPACITY_EXCEEDED",
      `We accommodate up to ${maxHotelCapacity} guests per room. For larger groups, please contact the front desk.`
    );
  }

  return {
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    adults: query.adults,
  };
}

/**
 * Merges prior session slots with incoming slots, applying overwrite semantics.
 */
export function mergeAvailabilitySlots(
  existing: AvailabilitySlots | undefined,
  incoming: AvailabilitySlots | undefined
): AvailabilitySlots {
  const merged: AvailabilitySlots = { ...existing };

  if (incoming?.checkIn) {
    merged.checkIn = incoming.checkIn;
  }
  if (incoming?.checkOut) {
    merged.checkOut = incoming.checkOut;
  }
  if (incoming?.adults !== undefined && incoming.adults !== null) {
    merged.adults = incoming.adults;
  }

  return merged;
}

/**
 * Finds rooms suitable by capacity alone without checking date availability.
 */
export function findSuitableRooms(adults: number): RoomType[] {
  if (adults < 1) return [];
  return ROOM_TYPES.filter((r) => r.maxOccupancy >= adults);
}

/**
 * Deterministic hash function for consistent inventory across runs without Math.random.
 */
function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Deterministic availability check based on room capacity and date hash.
 * A specific blackout/sold-out date fixture (e.g. 2026-12-31 to 2027-01-01) is supported for testing.
 */
export function checkAvailability(
  checkIn: string,
  checkOut: string,
  adults: number,
  options: { today?: string; maxStayNights?: number } = {}
): AvailabilityResult {
  const validQuery = validateAvailabilityQuery({ checkIn, checkOut, adults }, options);
  const nights = calculateNights(validQuery.checkIn, validQuery.checkOut);

  // Deterministic sold-out fixture test: December 24-26 or exact NYE sold out
  const isFixtureSoldOut =
    (validQuery.checkIn === "2026-12-24" && validQuery.checkOut === "2026-12-26") ||
    (validQuery.checkIn === "2026-12-31" && validQuery.checkOut === "2027-01-01");

  if (isFixtureSoldOut) {
    return {
      query: { ...validQuery, nights },
      rooms: [],
    };
  }

  // Capacity filter
  const suitableRooms = findSuitableRooms(validQuery.adults);

  // Filter by inventory per night
  const availableRooms: RoomResult[] = [];

  for (const room of suitableRooms) {
    let availableForAllNights = true;

    // Check each night of stay
    const currentDate = new Date(validQuery.checkIn + "T00:00:00Z");
    for (let n = 0; n < nights; n++) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const hashKey = `${room.id}:${dateStr}`;
      const hashVal = stableHash(hashKey);

      // Deterministic availability: baseInventory - (hashVal % (baseInventory + 1))
      // To ensure high realistic availability for typical demo dates while keeping determinism:
      const bookedRooms = hashVal % (room.baseInventory + 1);
      const remainingInventory = room.baseInventory - bookedRooms;

      if (remainingInventory <= 0) {
        availableForAllNights = false;
        break;
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (availableForAllNights) {
      availableRooms.push({
        roomTypeId: room.id,
        name: room.name,
        maxOccupancy: room.maxOccupancy,
        bedConfiguration: room.bedConfiguration,
        nightlyRate: room.baseRate,
        currency: "USD",
        nights,
        totalPrice: room.baseRate * nights,
        amenities: room.amenities,
      });
    }
  }

  return {
    query: { ...validQuery, nights },
    rooms: availableRooms,
  };
}

import { z } from "zod";
import { AvailabilityProvider } from "../../shared/contracts";

export const ProviderRoomResultSchema = z.object({
  roomTypeId: z.string().min(1),
  name: z.string().min(1),
  maxOccupancy: z.number().int().positive().max(20),
  bedConfiguration: z.string().min(1),
  nightlyRate: z.number().int().positive(),
  currency: z.literal("USD"),
  nights: z.number().int().positive(),
  totalPrice: z.number().int().positive(),
  amenities: z.array(z.string()),
});

export const ProviderAvailabilityResultSchema = z.object({
  query: z.object({
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().positive(),
    nights: z.number().int().positive(),
  }),
  rooms: z.array(ProviderRoomResultSchema),
});

/**
 * Validates external or mock provider output against schema, rejecting malformed, negative, or hostile data.
 */
export function validateProviderOutput(data: unknown): AvailabilityResult {
  const parsed = ProviderAvailabilityResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new DomainValidationError(
      "MALFORMED_PROVIDER_OUTPUT",
      `External provider returned invalid availability payload: ${JSON.stringify(parsed.error.issues)}`
    );
  }
  return parsed.data as AvailabilityResult;
}

export class DeterministicMockAvailabilityProvider implements AvailabilityProvider {
  async check(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const rawResult = checkAvailability(query.checkIn, query.checkOut, query.adults);
    return validateProviderOutput(rawResult);
  }
}

export const defaultAvailabilityProvider = new DeterministicMockAvailabilityProvider();

