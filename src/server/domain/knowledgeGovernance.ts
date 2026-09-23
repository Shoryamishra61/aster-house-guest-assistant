import { createHash } from "crypto";
import { KNOWLEDGE_BASE, KnowledgeItem } from "../data/hotelData";
import { extractTextFromPdf } from "./pdfExtractor";

export type KnowledgeStatus = "draft" | "published" | "superseded" | "rolled_back";

export interface CandidateFact {
  id: string;
  category: "property" | "policies" | "amenities" | "rooms" | "faqs";
  title: string;
  aliases: string[];
  facts: Record<string, string | number | boolean | string[]>;
  summary: string;
  sourcePage?: number;
}

export interface IngestionConflict {
  factId: string;
  field: string;
  existingValue: unknown;
  candidateValue: unknown;
  severity: "high" | "medium" | "low";
  reason: string;
}

export interface IngestionSourceRecord {
  sourceId: string;
  propertyId: string;
  fileName: string;
  fileType: "json" | "csv" | "txt" | "md" | "pdf";
  sourceHash: string;
  uploadedAt: number;
  uploadedBy: string;
  status: "pending_review" | "approved" | "rejected";
  pageCount?: number;
  candidateFacts: CandidateFact[];
  conflicts: IngestionConflict[];
}

export interface KnowledgeVersion {
  version: number;
  propertyId: string;
  publishedAt: number;
  publishedBy: string;
  sourceId?: string;
  status: KnowledgeStatus;
  items: KnowledgeItem[];
}

export interface AuditEvent {
  id: string;
  actor: string;
  propertyId: string;
  action: "upload" | "approve_publish" | "reject" | "rollback" | "flag_update" | "resolve_escalation";
  beforeVersion?: number;
  afterVersion?: number;
  timestamp: number;
  details?: Record<string, unknown>;
}

export class KnowledgeGovernanceService {
  private versions: KnowledgeVersion[] = [];
  private currentVersionNumber = 1;
  private ingestionRecords: IngestionSourceRecord[] = [];
  private activeItems: KnowledgeItem[] = [];
  private auditLog: AuditEvent[] = [];

  constructor(initialItems: KnowledgeItem[] = KNOWLEDGE_BASE) {
    this.activeItems = JSON.parse(JSON.stringify(initialItems));
    this.versions.push({
      version: 1,
      propertyId: "aster-house-main",
      publishedAt: Date.now(),
      publishedBy: "system_init",
      status: "published",
      items: JSON.parse(JSON.stringify(this.activeItems)),
    });
    this.recordAudit({
      actor: "system_init",
      propertyId: "aster-house-main",
      action: "approve_publish",
      afterVersion: 1,
      details: { note: "Initial verified knowledge base baseline" },
    });
  }

  recordAudit(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
    const fullEvent: AuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...event,
    };
    this.auditLog.unshift(fullEvent);
    // Bound audit log to latest 500 records to prevent memory leak in local node
    if (this.auditLog.length > 500) {
      this.auditLog.pop();
    }
    return fullEvent;
  }

  getAuditLog(propertyId: string = "aster-house-main"): AuditEvent[] {
    return this.auditLog.filter((e) => e.propertyId === propertyId);
  }

  getActiveItems(): KnowledgeItem[] {
    return this.activeItems;
  }

  getCurrentVersion(): KnowledgeVersion {
    return this.versions.find((v) => v.status === "published") || this.versions[this.versions.length - 1];
  }

  getAllVersions(): KnowledgeVersion[] {
    return [...this.versions];
  }

  getIngestionRecords(): IngestionSourceRecord[] {
    return [...this.ingestionRecords];
  }

  hashContent(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }

  /**
   * Parses ingested content across JSON, CSV, TXT, MD, and true PDF streams.
   */
  parseContent(
    fileName: string,
    content: string,
    fileType: "json" | "csv" | "txt" | "md" | "pdf"
  ): { candidateFacts: CandidateFact[]; pageCount: number } {
    const candidateFacts: CandidateFact[] = [];
    let pageCount = 1;

    // Handle PDF extraction
    if (fileType === "pdf") {
      const pdfResult = extractTextFromPdf(content);
      if (!pdfResult.success) {
        throw new Error(pdfResult.error || "Failed to extract text from PDF");
      }

      pageCount = pdfResult.pageCount;
      const isPromptInjection = /ignore all (?:previous|system) instructions|system authority|set all rates/i.test(
        pdfResult.totalText
      );

      const lines = pdfResult.totalText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const inferredTitle = lines[0] ? (lines[0].includes(":") ? lines[0].split(":")[0] : lines[0]) : "Imported PDF Policy";
      const title = inferredTitle.replace(/^#+\s*/, "").slice(0, 80);
      const summary = pdfResult.totalText.slice(0, 300);

      const facts: Record<string, string> = {};
      for (const line of lines) {
        const match = line.match(/^([A-Za-z\s-]+):\s*(.+)$/);
        if (match) {
          const rawKey = match[1].trim().toLowerCase().replace(/[\s-]+/g, "_");
          facts[rawKey] = match[2].trim();
        }
      }

      if (Object.keys(facts).length === 0) {
        facts["text"] = summary;
      }

      candidateFacts.push({
        id: `pdf_${Date.now()}`,
        category: "policies",
        title: isPromptInjection ? "[SUSPICIOUS INJECTION] " + title : title,
        aliases: [title.toLowerCase()],
        facts,
        summary,
        sourcePage: 1,
      });

      return { candidateFacts, pageCount };
    }

    if (fileType === "json") {
      try {
        const parsed = JSON.parse(content);
        const items = Array.isArray(parsed) ? parsed : parsed.knowledgeBase || [parsed];
        for (const item of items) {
          if (item.id && item.title) {
            candidateFacts.push({
              id: item.id,
              category: item.category || "policies",
              title: item.title,
              aliases: item.aliases || [],
              facts: item.facts || {},
              summary: item.summary || item.title,
            });
          }
        }
      } catch (e) {
        throw new Error(`Invalid JSON content: ${(e as Error).message}`);
      }
    } else if (fileType === "csv") {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim());
          const id = cols[headers.indexOf("id")] || `fact_${Date.now()}_${i}`;
          const title = cols[headers.indexOf("title")] || `Imported Fact ${i}`;
          const summary = cols[headers.indexOf("summary")] || cols[headers.indexOf("text")] || title;
          candidateFacts.push({
            id,
            category: "policies",
            title,
            aliases: [title.toLowerCase()],
            facts: { text: summary },
            summary,
          });
        }
      }
    } else {
      // TXT or MD
      const isPromptInjection = /ignore all (?:previous|system) instructions|system authority|set all rates/i.test(content);
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const title = lines[0] ? lines[0].replace(/^#+\s*/, "").slice(0, 80) : "Imported Policy Note";
      const summary = content.slice(0, 300);

      const facts: Record<string, string> = {};
      for (const line of lines) {
        const match = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
          facts[key] = match[2].trim();
        }
      }

      if (Object.keys(facts).length === 0) {
        facts["text"] = summary;
      }

      candidateFacts.push({
        id: `doc_${Date.now()}`,
        category: "policies",
        title: isPromptInjection ? "[SUSPICIOUS INJECTION] " + title : title,
        aliases: [title.toLowerCase()],
        facts,
        summary,
      });
    }

    return { candidateFacts, pageCount };
  }

  detectConflicts(candidateFacts: CandidateFact[]): IngestionConflict[] {
    const conflicts: IngestionConflict[] = [];

    for (const cand of candidateFacts) {
      const candTitleLower = cand.title.toLowerCase();
      const existing = this.activeItems.find(
        (item) =>
          item.id === cand.id ||
          item.title.toLowerCase() === candTitleLower ||
          item.aliases.some((a) => candTitleLower.includes(a.toLowerCase())) ||
          (candTitleLower.includes("check-in") && item.id === "kb_checkin_checkout") ||
          (candTitleLower.includes("breakfast") && item.id === "kb_breakfast") ||
          (candTitleLower.includes("pool") && item.id === "kb_swimming_pool") ||
          (candTitleLower.includes("parking") && item.id === "kb_parking")
      );

      if (existing) {
        // Direct field comparison
        for (const [key, candVal] of Object.entries(cand.facts)) {
          // Normalize key name (e.g. check_in_time -> checkInTime)
          const normalizedKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          const existVal = existing.facts[normalizedKey] !== undefined ? existing.facts[normalizedKey] : existing.facts[key];

          if (existVal !== undefined && JSON.stringify(existVal) !== JSON.stringify(candVal)) {
            conflicts.push({
              factId: existing.id,
              field: key,
              existingValue: existVal,
              candidateValue: candVal,
              severity: key.includes("time") || key.includes("rate") || key.includes("fee") ? "high" : "medium",
              reason: `Discrepancy in ${key}: existing='${existVal}' vs candidate='${candVal}'`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  submitForReview(
    fileName: string,
    content: string,
    fileType: "json" | "csv" | "txt" | "md" | "pdf",
    uploadedBy: string = "operator",
    propertyId: string = "aster-house-main"
  ): IngestionSourceRecord {
    // Basic file upload security checks
    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
    if (content.length > MAX_UPLOAD_BYTES) {
      throw new Error(`UPLOAD_TOO_LARGE: Content exceeds maximum limit of 5MB`);
    }

    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      throw new Error(`UPLOAD_INVALID: Path traversal attempt in filename rejected`);
    }

    const sourceHash = this.hashContent(content);

    const existingUpload = this.ingestionRecords.find((r) => r.sourceHash === sourceHash);
    if (existingUpload) {
      throw new Error(`Duplicate file content already uploaded under record ${existingUpload.sourceId}`);
    }

    const { candidateFacts, pageCount } = this.parseContent(fileName, content, fileType);
    const conflicts = this.detectConflicts(candidateFacts);

    const record: IngestionSourceRecord = {
      sourceId: `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      propertyId,
      fileName,
      fileType,
      sourceHash,
      uploadedAt: Date.now(),
      uploadedBy,
      status: "pending_review",
      pageCount,
      candidateFacts,
      conflicts,
    };

    this.ingestionRecords.push(record);
    if (this.ingestionRecords.length > 200) {
      this.ingestionRecords.shift();
    }
    this.recordAudit({
      actor: uploadedBy,
      propertyId,
      action: "upload",
      details: { fileName, fileType, sourceId: record.sourceId, candidateCount: candidateFacts.length },
    });

    return record;
  }

  /**
   * Approves an ingestion record and publishes a new version with optimistic concurrency checks.
   */
  approveAndPublish(
    sourceId: string,
    approvedBy: string,
    options?: { expectedActiveVersion?: number; propertyId?: string }
  ): KnowledgeVersion {
    const record = this.ingestionRecords.find((r) => r.sourceId === sourceId);
    if (!record) {
      throw new Error(`Ingestion record ${sourceId} not found`);
    }

    if (record.status === "approved") {
      throw new Error(`Record ${sourceId} is already approved and published`);
    }

    const current = this.getCurrentVersion();
    if (options?.expectedActiveVersion && options.expectedActiveVersion !== current.version) {
      throw new Error(
        `VERSION_CONFLICT: Expected active version ${options.expectedActiveVersion}, but active version is ${current.version}`
      );
    }

    const propertyId = options?.propertyId || record.propertyId || "aster-house-main";
    const updatedItems: KnowledgeItem[] = JSON.parse(JSON.stringify(this.activeItems));

    for (const cand of record.candidateFacts) {
      const idx = updatedItems.findIndex((it) => it.id === cand.id);
      if (idx >= 0) {
        updatedItems[idx] = { ...updatedItems[idx], ...cand };
      } else {
        updatedItems.push(cand);
      }
    }

    current.status = "superseded";

    this.currentVersionNumber++;
    const newVersion: KnowledgeVersion = {
      version: this.currentVersionNumber,
      propertyId,
      publishedAt: Date.now(),
      publishedBy: approvedBy,
      sourceId,
      status: "published",
      items: updatedItems,
    };

    this.versions.push(newVersion);
    this.activeItems = updatedItems;
    record.status = "approved";

    this.recordAudit({
      actor: approvedBy,
      propertyId,
      action: "approve_publish",
      beforeVersion: current.version,
      afterVersion: newVersion.version,
      details: { sourceId, itemsCount: updatedItems.length },
    });

    return newVersion;
  }

  /**
   * Rolls back knowledge base to a previous version number.
   */
  rollbackToVersion(
    targetVersionNumber: number,
    rolledBackBy: string,
    propertyId: string = "aster-house-main"
  ): KnowledgeVersion {
    const target = this.versions.find((v) => v.version === targetVersionNumber);
    if (!target) {
      throw new Error(`Version ${targetVersionNumber} not found`);
    }

    const current = this.getCurrentVersion();
    if (current) {
      current.status = "rolled_back";
    }

    this.currentVersionNumber++;
    const rolledBackVersion: KnowledgeVersion = {
      version: this.currentVersionNumber,
      propertyId,
      publishedAt: Date.now(),
      publishedBy: rolledBackBy,
      status: "published",
      items: JSON.parse(JSON.stringify(target.items)),
    };

    this.versions.push(rolledBackVersion);
    this.activeItems = rolledBackVersion.items;

    this.recordAudit({
      actor: rolledBackBy,
      propertyId,
      action: "rollback",
      beforeVersion: current?.version,
      afterVersion: rolledBackVersion.version,
      details: { targetVersionRolledBackTo: targetVersionNumber },
    });

    return rolledBackVersion;
  }
}

export const defaultKnowledgeGovernance = new KnowledgeGovernanceService();
