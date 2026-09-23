import { z } from "zod";
import rawKnowledgeBase from "./knowledge-base.json";
import rawRooms from "./rooms.json";

export const HotelInfoSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  currency: z.literal("USD"),
});

export const KnowledgeItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["property", "policies", "amenities", "rooms", "faqs"]),
  title: z.string().min(1),
  aliases: z.array(z.string()),
  facts: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  summary: z.string().min(1),
});

export const RoomTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  maxOccupancy: z.number().int().positive(),
  bedConfiguration: z.string().min(1),
  baseRate: z.number().int().positive(),
  currency: z.literal("USD"),
  baseInventory: z.number().int().positive(),
  amenities: z.array(z.string()),
});

export const KnowledgeBaseFileSchema = z.object({
  hotelInfo: HotelInfoSchema,
  knowledgeBase: z.array(KnowledgeItemSchema),
});

export const RoomsFileSchema = z.object({
  rooms: z.array(RoomTypeSchema),
});

export type HotelInfo = z.infer<typeof HotelInfoSchema>;
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;
export type RoomType = z.infer<typeof RoomTypeSchema>;

/**
 * Validates and loads hotel data from literal JSON files at runtime.
 * Fails fast with descriptive errors if JSON fails schema validation.
 */
function loadValidatedHotelData() {
  const kbParsed = KnowledgeBaseFileSchema.safeParse(rawKnowledgeBase);
  if (!kbParsed.success) {
    throw new Error(
      `Knowledge base JSON schema validation failed: ${JSON.stringify(kbParsed.error.issues, null, 2)}`
    );
  }

  const roomsParsed = RoomsFileSchema.safeParse(rawRooms);
  if (!roomsParsed.success) {
    throw new Error(
      `Rooms JSON schema validation failed: ${JSON.stringify(roomsParsed.error.issues, null, 2)}`
    );
  }

  return {
    hotelInfo: kbParsed.data.hotelInfo,
    knowledgeBase: kbParsed.data.knowledgeBase,
    rooms: roomsParsed.data.rooms,
  };
}

const data = loadValidatedHotelData();

export const HOTEL_INFO = data.hotelInfo;
export const KNOWLEDGE_BASE = data.knowledgeBase;
export const ROOM_TYPES = data.rooms;
