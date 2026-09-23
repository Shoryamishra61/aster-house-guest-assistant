/**
 * Aster House Guest Assistant - Production PDF Extractor
 * Uses mature, battle-tested PDF parsing engine (pdf-parse / PDF.js)
 * with robust support for FlateDecode compressed streams, TJ arrays, font encodings,
 * escaped character sequences, and multi-page documents.
 * 
 * Preserves:
 * - Signature / Magic bytes (%PDF-) validation
 * - Encryption detection (/Encrypt)
 * - Scanned/image-only PDF detection (yielding typed TEXT_EXTRACTION_UNAVAILABLE)
 * - Page count & page-provenance mapping
 * - Malformed/corrupt PDF rejection
 */

export interface PdfPageContent {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  success: boolean;
  pageCount: number;
  pages: PdfPageContent[];
  totalText: string;
  isEncrypted?: boolean;
  isScannedOnly?: boolean;
  error?: string;
}

export async function extractTextFromPdfAsync(pdfBuffer: Buffer | string): Promise<PdfExtractionResult> {
  const buffer = typeof pdfBuffer === "string" ? Buffer.from(pdfBuffer, "binary") : pdfBuffer;
  const rawString = buffer.toString("binary");

  // 1. Signature / Magic Bytes validation
  if (!rawString.startsWith("%PDF-")) {
    return {
      success: false,
      pageCount: 0,
      pages: [],
      totalText: "",
      error: "MALFORMED_PDF: Missing %PDF- magic header signature",
    };
  }

  // 2. Encryption Detection
  if (rawString.includes("/Encrypt")) {
    return {
      success: false,
      pageCount: 0,
      pages: [],
      totalText: "",
      isEncrypted: true,
      error: "ENCRYPTED_PDF: Document is password protected or encrypted. Manual action required.",
    };
  }

  // 3. Scanned / Image-only detection check
  const hasImage =
    rawString.includes("/Image") ||
    rawString.includes("/XObject") ||
    rawString.includes("Subtype /Image");

  try {
    // Dynamic import to avoid webpack bundling errors in Next.js edge/serverless runtimes
    const req = typeof module !== "undefined" && module.require ? module.require.bind(module) : require;
    const pdfParse = req("pdf-parse");
    const data = await pdfParse(buffer);
    const totalText = (data.text || "").trim();
    const pageCount = Math.max(1, data.numpages || 1);

    if (!totalText || totalText.length < 5) {
      if (hasImage) {
        return {
          success: false,
          pageCount,
          pages: [],
          totalText: "",
          isScannedOnly: true,
          error: "TEXT_EXTRACTION_UNAVAILABLE: Scanned or image-only PDF detected. OCR required.",
        };
      }
      return {
        success: false,
        pageCount,
        pages: [],
        totalText: "",
        error: "NO_EXTRACTABLE_TEXT: Document contains no extractable text characters.",
      };
    }

    // Split pages by form-feed character (\n\n\x0c) standard in PDF text representations
    const rawPages = totalText.split(/\f|\n\n\n\n/);
    const pages: PdfPageContent[] = [];

    if (rawPages.length > 1) {
      rawPages.forEach((pgText: string, idx: number) => {
        const trimmed = pgText.trim();
        if (trimmed.length > 0) {
          pages.push({
            pageNumber: idx + 1,
            text: trimmed,
          });
        }
      });
    }

    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        text: totalText,
      });
    }

    return {
      success: true,
      pageCount,
      pages,
      totalText,
    };
  } catch (err) {
    const errMsg = (err as Error).message || String(err);
    if (errMsg.includes("password") || errMsg.includes("encrypted")) {
      return {
        success: false,
        pageCount: 0,
        pages: [],
        totalText: "",
        isEncrypted: true,
        error: "ENCRYPTED_PDF: Document is password protected or encrypted. Manual action required.",
      };
    }

    // If PDF engine fails on stream structure or corrupt table, check for scanned image fallback
    if (hasImage) {
      return {
        success: false,
        pageCount: 1,
        pages: [],
        totalText: "",
        isScannedOnly: true,
        error: "TEXT_EXTRACTION_UNAVAILABLE: Scanned or image-only PDF detected. OCR required.",
      };
    }

    return {
      success: false,
      pageCount: 0,
      pages: [],
      totalText: "",
      error: `MALFORMED_PDF: Corrupt PDF structure - ${errMsg}`,
    };
  }
}

/**
 * Synchronous compatibility wrapper using regex fallback if needed, or structured inspection.
 */
export function extractTextFromPdf(pdfBuffer: Buffer | string): PdfExtractionResult {
  const rawString = typeof pdfBuffer === "string" ? pdfBuffer : pdfBuffer.toString("binary");

  // 1. Signature / Magic Bytes validation
  if (!rawString.startsWith("%PDF-")) {
    return {
      success: false,
      pageCount: 0,
      pages: [],
      totalText: "",
      error: "MALFORMED_PDF: Missing %PDF- magic header signature",
    };
  }

  // 2. Encryption Detection
  if (rawString.includes("/Encrypt")) {
    return {
      success: false,
      pageCount: 0,
      pages: [],
      totalText: "",
      isEncrypted: true,
      error: "ENCRYPTED_PDF: Document is password protected or encrypted. Manual action required.",
    };
  }

  // Extract page objects count
  const pageMatches = rawString.split(/\/Type\s*\/Page\b/);
  const detectedPages = Math.max(1, pageMatches.length - 1);

  // Extract both Tj, ', " and TJ array operators
  const extractedSnippets: string[] = [];

  // Match /BT ... /ET blocks
  const btEtRegex = /BT[\s\S]*?ET/gi;
  const btMatches = rawString.match(btEtRegex) || [];

  for (const block of btMatches) {
    // 1. Single string (text) Tj or '
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/gi;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      extractedSnippets.push(tjMatch[1]);
    }

    // 2. TJ array [(text) 20 (more text)] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/gi;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const stringMatches = inner.match(/\(([^)]+)\)/g);
      if (stringMatches) {
        const joined = stringMatches.map((s) => s.slice(1, -1)).join("");
        if (joined.trim()) {
          extractedSnippets.push(joined);
        }
      }
    }
  }

  if (extractedSnippets.length === 0) {
    const fallbackTj = /\(([^)]+)\)\s*(?:Tj|'|")/gi;
    let fbMatch: RegExpExecArray | null;
    while ((fbMatch = fallbackTj.exec(rawString)) !== null) {
      extractedSnippets.push(fbMatch[1]);
    }
  }

  const cleanTotal = extractedSnippets.join("\n").trim();
  const hasImage =
    rawString.includes("/Image") ||
    rawString.includes("/XObject") ||
    rawString.includes("Subtype /Image");

  if (!cleanTotal || cleanTotal.length < 5) {
    if (hasImage) {
      return {
        success: false,
        pageCount: detectedPages,
        pages: [],
        totalText: "",
        isScannedOnly: true,
        error: "TEXT_EXTRACTION_UNAVAILABLE: Scanned or image-only PDF detected. OCR required.",
      };
    }
    return {
      success: false,
      pageCount: detectedPages,
      pages: [],
      totalText: "",
      error: "NO_EXTRACTABLE_TEXT: Document contains no extractable text characters.",
    };
  }

  return {
    success: true,
    pageCount: detectedPages,
    pages: [{ pageNumber: 1, text: cleanTotal }],
    totalText: cleanTotal,
  };
}
