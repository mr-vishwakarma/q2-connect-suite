const crypto = require('crypto');
const pdfParse = require('pdf-parse');

/**
 * Validates PDF buffer signature (%PDF-).
 */
const validatePdfBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    return { valid: false, error: 'Invalid or empty file buffer' };
  }

  // Check magic bytes %PDF-
  const header = buffer.slice(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    return { valid: false, error: 'File signature invalid. Only valid PDF files are permitted.' };
  }

  return { valid: true };
};

/**
 * Computes deterministic SHA-256 hash of document text / structured content.
 */
const computeContentHash = (content) => {
  const normalized = typeof content === 'string' ? content.trim() : JSON.stringify(content);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
};

/**
 * Parses raw extracted PDF text into safe structured document representation:
 * - Document title
 * - Sections & headings
 * - Subheadings
 * - Paragraphs
 * - Numbered clauses
 * - Bullet lists
 */
const structureDocumentText = (rawText, defaultTitle = 'Hostel Document') => {
  if (!rawText || !rawText.trim()) {
    return {
      title: defaultTitle,
      summary: '',
      sections: [],
    };
  }

  // Normalize line endings
  const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  let docTitle = defaultTitle;
  const sections = [];
  let currentSection = {
    heading: 'General Overview',
    subheading: '',
    paragraphs: [],
    clauses: [],
    pageNumber: 1,
  };

  // Regular expression patterns for structure recognition
  const sectionHeadingRegex = /^(section\s+[0-9]+|article\s+[0-9ivxlcdm]+|chapter\s+[0-9]+|[0-9]+\.\s+[A-Z0-9\s]{3,})/i;
  const uppercaseHeadingRegex = /^[A-Z0-9\s,:\-–—]{4,60}$/;
  const clauseRegex = /^([0-9]+\.[0-9]+(\.[0-9]+)?|\([a-z0-9ivx]+\)|[a-z0-9]\))\s+(.+)/i;
  const bulletRegex = /^([•\-\*\u2022\u25E6]|o\s)\s*(.+)/;

  let isFirstSubstantialLine = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect document title from very first prominent heading
    if (isFirstSubstantialLine && (uppercaseHeadingRegex.test(line) || line.length < 80)) {
      docTitle = line;
      isFirstSubstantialLine = false;
      continue;
    }
    isFirstSubstantialLine = false;

    // Detect section headings
    const isExplicitSection = sectionHeadingRegex.test(line);
    const isAllCapsShort = uppercaseHeadingRegex.test(line) && !line.endsWith('.') && line.length > 3 && line.length < 60;

    if (isExplicitSection || isAllCapsShort) {
      // If current section has content, flush it
      if (currentSection.paragraphs.length > 0 || currentSection.clauses.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: line,
        subheading: '',
        paragraphs: [],
        clauses: [],
        pageNumber: 1,
      };
      continue;
    }

    // Detect numbered clauses
    if (clauseRegex.test(line)) {
      currentSection.clauses.push(line);
      continue;
    }

    // Detect bullet points
    if (bulletRegex.test(line)) {
      currentSection.clauses.push(line);
      continue;
    }

    // Regular paragraph line: concatenate or append
    if (currentSection.paragraphs.length > 0 && !line.match(/^[A-Z]/)) {
      // Append continuation to previous paragraph
      const lastIndex = currentSection.paragraphs.length - 1;
      currentSection.paragraphs[lastIndex] += ' ' + line;
    } else {
      currentSection.paragraphs.push(line);
    }
  }

  // Push final section
  if (currentSection.paragraphs.length > 0 || currentSection.clauses.length > 0) {
    sections.push(currentSection);
  }

  // Fallback if no sections detected
  if (sections.length === 0) {
    sections.push({
      heading: 'General Provisions',
      subheading: '',
      paragraphs: lines,
      clauses: [],
      pageNumber: 1,
    });
  }

  return {
    title: docTitle,
    summary: sections[0]?.paragraphs[0]?.slice(0, 200) || '',
    sections,
  };
};

/**
 * Extracts and processes PDF buffer.
 * Performs validation, text extraction, scanned PDF detection, and safe structure generation.
 */
const extractAndProcessPdf = async (buffer, options = {}) => {
  const validation = validatePdfBuffer(buffer);
  if (!validation.valid) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  let pdfData;
  try {
    pdfData = await pdfParse(buffer, {
      max: options.maxPages || 50,
    });
  } catch (parseErr) {
    const error = new Error(`Corrupted or unreadable PDF: ${parseErr.message}`);
    error.statusCode = 422;
    throw error;
  }

  const pageCount = pdfData.numpages || 1;
  const rawText = (pdfData.text || '').trim();
  const charCount = rawText.length;
  const charsPerPage = pageCount > 0 ? charCount / pageCount : 0;

  // Scanned PDF detection
  let isScanned = false;
  let extractionStatus = 'SUCCESS';
  let extractionNotes = 'Text successfully extracted and structured.';

  if (charCount === 0) {
    isScanned = true;
    extractionStatus = 'EMPTY';
    extractionNotes =
      'Zero selectable text characters found. The uploaded document appears to be a scanned image or empty PDF. Please provide a digital text-based PDF.';
  } else if (charCount < 40 || charsPerPage < 25) {
    isScanned = true;
    extractionStatus = 'SCANNED_WARNING';
    extractionNotes =
      'Very low text density detected. Some or all pages appear to be scanned images without a complete OCR text layer. Please review carefully.';
  }

  const structuredContent = structureDocumentText(rawText, options.defaultTitle || 'Hostel Document');
  const contentHash = computeContentHash({ rawText, structuredContent });

  return {
    pageCount,
    rawText,
    charCount,
    isScanned,
    extractionStatus,
    extractionNotes,
    structuredContent,
    contentHash,
  };
};

/**
 * Helper to split a combined text/PDF into 3 document categories:
 * - TERMS_AND_CONDITIONS
 * - RULES_AND_REGULATIONS
 * - HOSTEL_POLICIES
 * Looks for category section headers or allows explicit split boundaries.
 */
const splitCombinedTextIntoCategories = (rawText) => {
  const result = {
    TERMS_AND_CONDITIONS: '',
    RULES_AND_REGULATIONS: '',
    HOSTEL_POLICIES: '',
  };

  const termsRegex = /(?:terms\s*(?:&|and)\s*conditions|terms\s*of\s*(?:service|residence|stay))/i;
  const rulesRegex = /(?:rules\s*(?:&|and)\s*regulations|hostel\s*rules|code\s*of\s*conduct)/i;
  const policiesRegex = /(?:hostel\s*policies|general\s*policies|administrative\s*policies|operational\s*policies)/i;

  const lines = rawText.split('\n');
  let currentCategory = 'TERMS_AND_CONDITIONS'; // default initial bucket
  const buckets = {
    TERMS_AND_CONDITIONS: [],
    RULES_AND_REGULATIONS: [],
    HOSTEL_POLICIES: [],
  };

  for (const line of lines) {
    if (rulesRegex.test(line)) {
      currentCategory = 'RULES_AND_REGULATIONS';
    } else if (policiesRegex.test(line)) {
      currentCategory = 'HOSTEL_POLICIES';
    } else if (termsRegex.test(line)) {
      currentCategory = 'TERMS_AND_CONDITIONS';
    }
    buckets[currentCategory].push(line);
  }

  result.TERMS_AND_CONDITIONS = buckets.TERMS_AND_CONDITIONS.join('\n').trim();
  result.RULES_AND_REGULATIONS = buckets.RULES_AND_REGULATIONS.join('\n').trim();
  result.HOSTEL_POLICIES = buckets.HOSTEL_POLICIES.join('\n').trim();

  return result;
};

module.exports = {
  validatePdfBuffer,
  computeContentHash,
  structureDocumentText,
  extractAndProcessPdf,
  splitCombinedTextIntoCategories,
};

