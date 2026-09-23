/**
 * Aster House Guest Assistant - Human Escalation Service
 * Manages operational escalations with full state lifecycle:
 * OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> CLOSED
 */

export type EscalationReason =
  | "unsupported_information"
  | "booking_problem"
  | "special_request"
  | "accessibility_request"
  | "complaint"
  | "payment_question"
  | "model_failure"
  | "guest_requests_human";

export type EscalationStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "closed";

export interface EscalationRecord {
  id: string;
  propertyId: string;
  sessionId: string;
  reason: EscalationReason;
  guestMessage: string;
  summary: string;
  priority: "low" | "medium" | "high" | "urgent";
  verifiedFactsKnown: string[];
  status: EscalationStatus;
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export class EscalationService {
  private records: EscalationRecord[] = [];

  createEscalation(input: {
    propertyId?: string;
    sessionId: string;
    reason: EscalationReason;
    guestMessage: string;
    priority?: "low" | "medium" | "high" | "urgent";
    summary?: string;
    verifiedFactsKnown?: string[];
  }): EscalationRecord {
    const now = Date.now();
    const record: EscalationRecord = {
      id: `esc_${now}_${Math.random().toString(36).slice(2, 6)}`,
      propertyId: input.propertyId || "aster-house-main",
      sessionId: input.sessionId,
      reason: input.reason,
      guestMessage: input.guestMessage,
      priority: input.priority || (input.reason === "complaint" ? "high" : "medium"),
      summary: input.summary || `Guest requested assistance regarding: ${input.guestMessage.slice(0, 100)}`,
      verifiedFactsKnown: input.verifiedFactsKnown || [],
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    this.records.unshift(record);
    if (this.records.length > 500) {
      this.records.pop();
    }
    return record;
  }

  getEscalations(propertyId: string = "aster-house-main"): EscalationRecord[] {
    return this.records.filter((r) => r.propertyId === propertyId);
  }

  transitionStatus(id: string, newStatus: EscalationStatus, actor: string): EscalationRecord {
    const record = this.records.find((r) => r.id === id);
    if (!record) {
      throw new Error(`Escalation record ${id} not found`);
    }

    // Enforce valid transitions
    const validTransitions: Record<EscalationStatus, EscalationStatus[]> = {
      open: ["acknowledged", "in_progress", "resolved"],
      acknowledged: ["in_progress", "resolved"],
      in_progress: ["resolved"],
      resolved: ["closed", "open"],
      closed: [],
    };

    if (!validTransitions[record.status].includes(newStatus)) {
      throw new Error(`INVALID_TRANSITION: Cannot transition escalation from ${record.status} to ${newStatus}`);
    }

    record.status = newStatus;
    record.updatedAt = Date.now();

    if (newStatus === "resolved") {
      record.resolvedAt = Date.now();
      record.resolvedBy = actor;
    }

    return record;
  }

  assign(id: string, assignee: string): EscalationRecord {
    const record = this.records.find((r) => r.id === id);
    if (!record) {
      throw new Error(`Escalation record ${id} not found`);
    }
    record.assignedTo = assignee;
    record.updatedAt = Date.now();
    return record;
  }

  resolveEscalation(id: string, resolvedBy: string): EscalationRecord {
    return this.transitionStatus(id, "resolved", resolvedBy);
  }
}

export const defaultEscalationService = new EscalationService();
