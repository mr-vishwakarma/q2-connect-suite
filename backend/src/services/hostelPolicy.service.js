const mongoose = require('mongoose');
const HostelPolicyDocument = require('../models/HostelPolicyDocument');
const HostelPolicyVersion = require('../models/HostelPolicyVersion');
const HostelPolicyAcceptance = require('../models/HostelPolicyAcceptance');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const {
  extractAndProcessPdf,
  computeContentHash,
  splitCombinedTextIntoCategories,
} = require('./policyExtraction.service');
const { logAuditAction } = require('../middleware/audit.middleware');

const MANDATORY_CATEGORIES = [
  'TERMS_AND_CONDITIONS',
  'RULES_AND_REGULATIONS',
  'HOSTEL_POLICIES',
];

const CATEGORY_METADATA = {
  TERMS_AND_CONDITIONS: {
    title: 'Terms & Conditions',
    description: 'General legal terms of residence, liability, and occupancy rules.',
  },
  RULES_AND_REGULATIONS: {
    title: 'Hostel Rules & Regulations',
    description: 'Code of conduct, curfew hours, visitor policies, and discipline.',
  },
  HOSTEL_POLICIES: {
    title: 'Hostel Policies',
    description: 'Fee schedules, refunds, laundry, mess rebates, and operational guidelines.',
  },
};

/**
 * Resolves the applicable published versions for a given organization and optional branch.
 * Hierarchical resolution:
 * 1. Branch-specific override if published (hostelId = specific branch)
 * 2. Organization-wide default if published (hostelId = null)
 */
const resolveApplicablePolicies = async (organizationId, hostelId = null) => {
  const result = {};

  for (const category of MANDATORY_CATEGORIES) {
    let publishedVersion = null;

    // 1. Check branch-specific override if hostelId provided
    if (hostelId) {
      publishedVersion = await HostelPolicyVersion.findOne({
        organizationId,
        hostelId,
        category,
        status: 'PUBLISHED',
      })
        .populate('publishedBy', 'name email')
        .lean();
    }

    // 2. Fall back to organization-wide default
    if (!publishedVersion) {
      publishedVersion = await HostelPolicyVersion.findOne({
        organizationId,
        hostelId: null,
        category,
        status: 'PUBLISHED',
      })
        .populate('publishedBy', 'name email')
        .lean();
    }

    result[category] = publishedVersion || null;
  }

  return result;
};

/**
 * Evaluates the policy readiness for a hostel branch / organization.
 * Ready = All 3 mandatory categories have an active published version.
 */
const getHostelPolicyReadiness = async (organizationId, hostelId = null) => {
  const resolved = await resolveApplicablePolicies(organizationId, hostelId);
  const missingCategories = [];
  let publishedCount = 0;

  for (const category of MANDATORY_CATEGORIES) {
    if (resolved[category]) {
      publishedCount++;
    } else {
      missingCategories.push(category);
    }
  }

  const isReady = missingCategories.length === 0;

  return {
    isReady,
    totalRequired: MANDATORY_CATEGORIES.length,
    publishedCount,
    missingCategories,
    categories: MANDATORY_CATEGORIES.map((cat) => ({
      category: cat,
      title: CATEGORY_METADATA[cat]?.title || cat,
      isConfigured: Boolean(resolved[cat]),
      version: resolved[cat]
        ? {
            id: resolved[cat]._id,
            versionNumber: resolved[cat].versionNumber,
            versionLabel: resolved[cat].versionLabel,
            title: resolved[cat].title,
            effectiveDate: resolved[cat].effectiveDate,
            publishedAt: resolved[cat].publishedAt,
            isBranchOverride: Boolean(resolved[cat].hostelId),
          }
        : null,
    })),
  };
};

/**
 * Lists all documents and status for an organization and branch.
 */
const listDocuments = async (organizationId, hostelId = null) => {
  const readiness = await getHostelPolicyReadiness(organizationId, hostelId);

  // Retrieve existing document records
  const query = { organizationId };
  if (hostelId) {
    query.$or = [{ hostelId }, { hostelId: null }];
  } else {
    query.hostelId = null;
  }

  const docs = await HostelPolicyDocument.find(query)
    .populate('currentPublishedVersionId')
    .populate('draftVersionId')
    .lean();

  const documentsByCategory = {};
  MANDATORY_CATEGORIES.forEach((cat) => {
    // Find branch-specific first, then org-level
    const branchDoc = docs.find((d) => d.category === cat && String(d.hostelId) === String(hostelId));
    const orgDoc = docs.find((d) => d.category === cat && !d.hostelId);
    const chosenDoc = branchDoc || orgDoc || null;

    documentsByCategory[cat] = {
      category: cat,
      defaultTitle: CATEGORY_METADATA[cat]?.title,
      description: CATEGORY_METADATA[cat]?.description,
      document: chosenDoc,
      isBranchOverride: Boolean(branchDoc),
    };
  });

  return {
    readiness,
    categories: documentsByCategory,
  };
};

/**
 * Uploads a PDF, extracts its text, structures it, and creates or updates a DRAFT version.
 */
const uploadAndCreateDraft = async ({
  organizationId,
  hostelId = null,
  category,
  title,
  versionLabel,
  effectiveDate,
  fileBuffer,
  fileName,
  fileSize,
  mimeType,
  userId,
}) => {
  if (!MANDATORY_CATEGORIES.includes(category)) {
    const error = new Error(`Invalid category '${category}'. Must be one of: ${MANDATORY_CATEGORIES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  // Extract and process text
  const extractionResult = await extractAndProcessPdf(fileBuffer, {
    defaultTitle: title || CATEGORY_METADATA[category]?.title,
  });

  // Find or create parent HostelPolicyDocument
  let document = await HostelPolicyDocument.findOne({
    organizationId,
    hostelId: hostelId || null,
    category,
  });

  if (!document) {
    document = await HostelPolicyDocument.create({
      organizationId,
      hostelId: hostelId || null,
      category,
      title: title || CATEGORY_METADATA[category]?.title,
      description: CATEGORY_METADATA[category]?.description,
      status: 'REVIEW_REQUIRED',
      createdBy: userId,
      updatedBy: userId,
    });
  }

  // Determine next version number
  const latestVersion = await HostelPolicyVersion.findOne({
    documentId: document._id,
  })
    .sort({ versionNumber: -1 })
    .lean();

  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  // Create new draft version
  const draftVersion = await HostelPolicyVersion.create({
    documentId: document._id,
    organizationId,
    hostelId: hostelId || null,
    category,
    versionNumber: nextVersionNumber,
    versionLabel: versionLabel || `v${nextVersionNumber}.0`,
    title: title || extractionResult.structuredContent.title || CATEGORY_METADATA[category]?.title,
    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    status: 'REVIEW_REQUIRED',
    rawText: extractionResult.rawText,
    structuredContent: extractionResult.structuredContent,
    contentHash: extractionResult.contentHash,
    file: {
      originalFileName: fileName,
      fileSize: fileSize || fileBuffer.length,
      mimeType: mimeType || 'application/pdf',
      pageCount: extractionResult.pageCount,
      isScanned: extractionResult.isScanned,
      extractionStatus: extractionResult.extractionStatus,
      extractionNotes: extractionResult.extractionNotes,
    },
    requiresAcceptance: true,
    requiresReacceptance: true,
    isImmutable: false,
    createdBy: userId,
    updatedBy: userId,
  });

  // Link draft to document
  document.draftVersionId = draftVersion._id;
  document.status = 'REVIEW_REQUIRED';
  document.updatedBy = userId;
  await document.save();

  return {
    document,
    version: draftVersion,
    extraction: {
      charCount: extractionResult.charCount,
      pageCount: extractionResult.pageCount,
      isScanned: extractionResult.isScanned,
      extractionStatus: extractionResult.extractionStatus,
      extractionNotes: extractionResult.extractionNotes,
    },
  };
};

/**
 * Updates draft content and metadata during admin review.
 */
const updateDraftContent = async ({
  versionId,
  organizationId,
  title,
  versionLabel,
  effectiveDate,
  rawText,
  structuredContent,
  userId,
}) => {
  const version = await HostelPolicyVersion.findOne({
    _id: versionId,
    organizationId,
  });

  if (!version) {
    const error = new Error('Document version not found or access denied');
    error.statusCode = 404;
    throw error;
  }

  if (version.isImmutable || version.status === 'PUBLISHED' || version.status === 'SUPERSEDED') {
    const error = new Error('Cannot edit an immutable published or superseded version. Create a new version instead.');
    error.statusCode = 400;
    throw error;
  }

  if (title) version.title = title.trim();
  if (versionLabel) version.versionLabel = versionLabel.trim();
  if (effectiveDate) version.effectiveDate = new Date(effectiveDate);
  if (rawText !== undefined) version.rawText = rawText;
  if (structuredContent !== undefined) version.structuredContent = structuredContent;

  // Recompute content hash
  version.contentHash = computeContentHash({
    rawText: version.rawText,
    structuredContent: version.structuredContent,
  });
  version.updatedBy = userId;

  await version.save();

  return version;
};

/**
 * Publishes a reviewed draft version.
 * Marks any previous published version as SUPERSEDED.
 * Marks the new version as PUBLISHED and isImmutable = true.
 */
const publishVersion = async ({ versionId, organizationId, userId, req = null }) => {
  const version = await HostelPolicyVersion.findOne({
    _id: versionId,
    organizationId,
  });

  if (!version) {
    const error = new Error('Document version not found');
    error.statusCode = 404;
    throw error;
  }

  if (version.status === 'PUBLISHED') {
    return version; // Already published
  }

  // Verify non-empty content
  if (!version.rawText || !version.rawText.trim()) {
    const error = new Error('Cannot publish an empty document version. Please review the extracted content.');
    error.statusCode = 400;
    throw error;
  }

  // Ensure content hash is populated
  if (!version.contentHash) {
    version.contentHash = computeContentHash({
      rawText: version.rawText,
      structuredContent: version.structuredContent,
    });
  }

  const document = await HostelPolicyDocument.findById(version.documentId);
  if (!document) {
    const error = new Error('Parent document record not found');
    error.statusCode = 404;
    throw error;
  }

  // Supersede currently published version if exists
  if (document.currentPublishedVersionId) {
    await HostelPolicyVersion.findByIdAndUpdate(document.currentPublishedVersionId, {
      $set: {
        status: 'SUPERSEDED',
        supersededAt: new Date(),
        supersededBy: userId,
      },
    });
  }

  // Publish this version
  version.status = 'PUBLISHED';
  version.isImmutable = true;
  version.publishedAt = new Date();
  version.publishedBy = userId;
  version.updatedBy = userId;
  await version.save();

  // Update parent document
  document.currentPublishedVersionId = version._id;
  document.draftVersionId = null;
  document.status = 'PUBLISHED';
  document.updatedBy = userId;
  await document.save();

  // Audit log
  if (req) {
    try {
      await logAuditAction({
        req,
        action: 'POLICY_DOCUMENT_PUBLISHED',
        entityType: 'HostelPolicyVersion',
        entityId: version._id,
        actor: req.user,
        newValue: {
          category: version.category,
          versionNumber: version.versionNumber,
          versionLabel: version.versionLabel,
          title: version.title,
          contentHash: version.contentHash,
        },
      });
    } catch (e) {
      // non-fatal
    }
  }

  return version;
};

/**
 * Retrieves version history for a document.
 */
const getVersionHistory = async (documentId, organizationId) => {
  const versions = await HostelPolicyVersion.find({
    documentId,
    organizationId,
  })
    .sort({ versionNumber: -1 })
    .populate('publishedBy', 'name email')
    .populate('createdBy', 'name email')
    .lean();

  return versions;
};

/**
 * Retrieves applicable policies for a student and verifies their acceptance status.
 */
const getStudentPolicyStatus = async (user, studentDoc = null) => {
  let student = studentDoc;
  if (!student) {
    student = await Student.findOne({ userId: user._id }).lean();
  }

  if (!student) {
    return {
      hasStudentProfile: false,
      allAccepted: true, // No student profile linked yet
      pendingCategories: [],
      applicableVersions: [],
      readiness: { isReady: false },
    };
  }

  const organizationId = student.organizationId || user.activeOrganizationId;
  const hostelId = student.hostelId || user.activeHostelId;

  // Resolve readiness and applicable versions
  const readiness = await getHostelPolicyReadiness(organizationId, hostelId);
  const resolvedVersions = await resolveApplicablePolicies(organizationId, hostelId);

  // If hostel is not ready, policy acceptance gate cannot be satisfied yet
  if (!readiness.isReady) {
    return {
      hasStudentProfile: true,
      allAccepted: true, // Do not block if hostel hasn't finished setup
      notReadyBypass: true,
      readiness,
      pendingCategories: [],
      applicableVersions: [],
    };
  }

  // Retrieve student's acceptances
  const acceptances = await HostelPolicyAcceptance.find({
    studentId: student._id,
  }).lean();

  const acceptanceMap = new Map();
  acceptances.forEach((a) => {
    acceptanceMap.set(String(a.versionId), a);
  });

  const applicableVersions = [];
  const pendingCategories = [];

  for (const category of MANDATORY_CATEGORIES) {
    const version = resolvedVersions[category];
    if (!version) continue;

    const existingAcceptance = acceptanceMap.get(String(version._id));
    const isAccepted = Boolean(
      existingAcceptance && existingAcceptance.acceptedContentHash === version.contentHash
    );

    if (!isAccepted) {
      pendingCategories.push(category);
    }

    applicableVersions.push({
      documentId: version.documentId,
      versionId: version._id,
      category: version.category,
      categoryLabel: CATEGORY_METADATA[version.category]?.title || version.category,
      title: version.title,
      versionNumber: version.versionNumber,
      versionLabel: version.versionLabel,
      effectiveDate: version.effectiveDate,
      contentHash: version.contentHash,
      structuredContent: version.structuredContent,
      rawText: version.rawText,
      file: version.file,
      isAccepted,
      acceptedAt: existingAcceptance?.acceptedAt || null,
    });
  }

  const allAccepted = pendingCategories.length === 0;

  return {
    hasStudentProfile: true,
    allAccepted,
    notReadyBypass: false,
    readiness,
    pendingCategories,
    applicableVersions,
  };
};

/**
 * Records student acceptance for one or more policy versions.
 * Enforces atomic and idempotent persistence.
 */
const recordStudentAcceptance = async ({
  user,
  studentDoc,
  documentVersions, // [{ documentId, versionId, contentHash }]
  userAgent = '',
}) => {
  if (!Array.isArray(documentVersions) || documentVersions.length === 0) {
    const error = new Error('No document versions provided for acceptance');
    error.statusCode = 400;
    throw error;
  }

  let student = studentDoc;
  if (!student) {
    student = await Student.findOne({ userId: user._id });
  }

  if (!student) {
    const error = new Error('Student resident profile not found');
    error.statusCode = 404;
    throw error;
  }

  const organizationId = student.organizationId || user.activeOrganizationId;
  const hostelId = student.hostelId || user.activeHostelId;

  // Retrieve applicable versions to verify authenticity
  const resolved = await resolveApplicablePolicies(organizationId, hostelId);
  const applicableMap = new Map();
  Object.values(resolved).forEach((v) => {
    if (v) applicableMap.set(String(v._id), v);
  });

  const recordsToInsert = [];

  for (const item of documentVersions) {
    const { versionId, contentHash } = item;
    if (!versionId) continue;

    const applicableVersion = applicableMap.get(String(versionId));
    if (!applicableVersion) {
      const error = new Error(`Version '${versionId}' is not an active published version for your hostel.`);
      error.statusCode = 400;
      throw error;
    }

    // Verify content hash match
    if (contentHash && applicableVersion.contentHash && contentHash !== applicableVersion.contentHash) {
      const error = new Error(
        `Content integrity verification failed for '${applicableVersion.title}'. The document has been updated. Please review the current version.`
      );
      error.statusCode = 409;
      throw error;
    }

    recordsToInsert.push({
      studentId: student._id,
      userId: user._id,
      organizationId,
      hostelId: applicableVersion.hostelId || null,
      documentId: applicableVersion.documentId,
      versionId: applicableVersion._id,
      category: applicableVersion.category,
      versionNumber: applicableVersion.versionNumber,
      versionLabel: applicableVersion.versionLabel,
      acceptedContentHash: applicableVersion.contentHash,
      acceptedAt: new Date(),
      actionType: 'EXPLICIT_ACCEPTANCE',
      userAgent,
    });
  }

  // Idempotent upsert to avoid duplicate key errors on retry
  const results = [];
  for (const record of recordsToInsert) {
    const res = await HostelPolicyAcceptance.findOneAndUpdate(
      { studentId: record.studentId, versionId: record.versionId },
      { $setOnInsert: record },
      { upsert: true, new: true }
    );
    results.push(res);
  }

  // Re-verify acceptance state
  const updatedStatus = await getStudentPolicyStatus(user, student);

  return {
    success: true,
    acceptedCount: results.length,
    status: updatedStatus,
  };
};

/**
 * Retrieves student acceptance history.
 */
const getStudentAcceptanceHistory = async (studentId) => {
  const history = await HostelPolicyAcceptance.find({ studentId })
    .sort({ acceptedAt: -1 })
    .populate('versionId', 'title versionLabel effectiveDate structuredContent')
    .lean();

  return history.map((h) => ({
    acceptanceId: h._id,
    category: h.category,
    categoryTitle: CATEGORY_METADATA[h.category]?.title || h.category,
    versionNumber: h.versionNumber,
    versionLabel: h.versionLabel,
    acceptedAt: h.acceptedAt,
    contentHash: h.acceptedContentHash,
    documentTitle: h.versionId?.title || CATEGORY_METADATA[h.category]?.title,
    effectiveDate: h.versionId?.effectiveDate,
  }));
};

module.exports = {
  MANDATORY_CATEGORIES,
  CATEGORY_METADATA,
  resolveApplicablePolicies,
  getHostelPolicyReadiness,
  listDocuments,
  uploadAndCreateDraft,
  updateDraftContent,
  publishVersion,
  getVersionHistory,
  getStudentPolicyStatus,
  recordStudentAcceptance,
  getStudentAcceptanceHistory,
};

