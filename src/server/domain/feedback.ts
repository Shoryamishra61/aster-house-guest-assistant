/**
 * Aster House Guest Assistant - Guest Feedback Service
 * Captures granular thumbs up/down feedback tied to request context.
 * Deduplicates and updates ratings per requestId to prevent spam.
 */

import { redactPii } from "../security/pii";

export type FeedbackReason =
  | "incorrect"
  | "didnt_answer"
  | "outdated_information"
  | "too_slow"
  | "hard_to_use"
  | "other";

export interface GuestFeedbackRecord {
  id: string;
  requestId: string;
  sessionId: string;
  propertyId: string;
  rating: "helpful" | "not_helpful";
  reason?: FeedbackReason;
  comment?: string;
  knowledgeVersion: number;
  promptVersion: string;
  route: string;
  timestamp: number;
}

export class FeedbackService {
  private records: GuestFeedbackRecord[] = [];

  submitFeedback(input: {
    requestId: string;
    sessionId: string;
    propertyId?: string;
    rating: "helpful" | "not_helpful";
    reason?: FeedbackReason;
    comment?: string;
    knowledgeVersion?: number;
    promptVersion?: string;
    route?: string;
  }): GuestFeedbackRecord {
    const propertyId = input.propertyId || "aster-house-main";
    const sanitizedComment = input.comment ? redactPii(input.comment.slice(0, 500)) : undefined;

    // Check if feedback for this requestId already exists (dedupe & update)
    const existingIndex = this.records.findIndex(
      (r) => r.requestId === input.requestId && r.sessionId === input.sessionId
    );

    if (existingIndex >= 0) {
      this.records[existingIndex] = {
        ...this.records[existingIndex],
        rating: input.rating,
        reason: input.reason,
        comment: sanitizedComment,
        timestamp: Date.now(),
      };
      return this.records[existingIndex];
    }

    const record: GuestFeedbackRecord = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestId: input.requestId,
      sessionId: input.sessionId,
      propertyId,
      rating: input.rating,
      reason: input.reason,
      comment: sanitizedComment,
      knowledgeVersion: input.knowledgeVersion || 1,
      promptVersion: input.promptVersion || "v1.0",
      route: input.route || "chat",
      timestamp: Date.now(),
    };

    this.records.unshift(record);
    if (this.records.length > 1000) {
      this.records.pop();
    }
    return record;
  }

  getFeedback(propertyId: string = "aster-house-main"): GuestFeedbackRecord[] {
    return this.records.filter((r) => r.propertyId === propertyId);
  }

  getSummary(propertyId: string = "aster-house-main") {
    const propertyRecords = this.getFeedback(propertyId);
    const total = propertyRecords.length;
    const helpful = propertyRecords.filter((r) => r.rating === "helpful").length;
    const notHelpful = propertyRecords.filter((r) => r.rating === "not_helpful").length;

    const reasons: Record<string, number> = {};
    for (const r of propertyRecords) {
      if (r.reason) {
        reasons[r.reason] = (reasons[r.reason] || 0) + 1;
      }
    }

    return {
      total,
      helpful,
      notHelpful,
      satisfactionRate: total > 0 ? Math.round((helpful / total) * 100) : 100,
      reasons,
    };
  }
}

export const defaultFeedbackService = new FeedbackService();
