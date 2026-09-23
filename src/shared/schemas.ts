import { z } from "zod";

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD")
  .refine((val) => {
    const d = new Date(val + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().startsWith(val);
  }, "Invalid calendar date");

export const AvailabilityInputSchema = z.object({
  checkIn: DateStringSchema.optional(),
  checkOut: DateStringSchema.optional(),
  adults: z.number().int().positive().max(10, "Party size exceeds maximum allowable booking size").optional(),
});

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1).max(128).optional(),
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message cannot exceed 2,000 characters"),
  availability: AvailabilityInputSchema.optional(),
});

export const IntentSchema = z.object({
  intent: z.enum([
    "knowledge",
    "room_suitability",
    "availability",
    "out_of_scope",
    "ambiguous",
  ]),
  category: z.enum(["property", "policies", "amenities", "rooms", "faqs"]).nullable(),
  slots: z.object({
    checkIn: z.string().nullable(),
    checkOut: z.string().nullable(),
    adults: z.number().int().positive().nullable(),
  }),
  confidence: z.enum(["high", "medium", "low"]),
});

export const GroundedAnswerSchema = z.object({
  supported: z.boolean(),
  reply: z.string().min(1).max(1000),
  sourceIds: z.array(z.string()).max(4),
});

export const AvailabilityQuerySchema = z.object({
  checkIn: DateStringSchema,
  checkOut: DateStringSchema,
  adults: z.number().int().positive().max(10),
});
