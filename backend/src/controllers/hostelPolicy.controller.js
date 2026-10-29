const {
  MANDATORY_CATEGORIES,
  listDocuments,
  getHostelPolicyReadiness,
  uploadAndCreateDraft,
  updateDraftContent,
  publishVersion,
  getVersionHistory,
  getStudentPolicyStatus,
  recordStudentAcceptance,
  getStudentAcceptanceHistory,
} = require('../services/hostelPolicy.service');
const { splitCombinedTextIntoCategories } = require('../services/policyExtraction.service');
const HostelPolicyVersion = require('../models/HostelPolicyVersion');
const Student = require('../models/Student');

/**
 * GET /api/policies/settings
 * Admin: List document statuses and readiness for active organization and branch.
 */
const getPolicySettings = async (req, res) => {
  try {
    const organizationId = req.organizationId || req.tenant?.organizationId;
    const hostelId = req.query.hostelId || req.headers['x-hostel-id'] || req.tenant?.hostelId || null;

    if (!organizationId) {
      return res.status(403).json({ success: false, message: 'Organization tenant context required' });
    }

    const data = await listDocuments(organizationId, hostelId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getPolicySettings error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/policies/upload-draft
 * Admin: Upload PDF, parse text, and create/update draft version.
 */
const uploadPolicyDraft = async (req, res) => {
  try {
    const organizationId = req.organizationId || req.tenant?.organizationId;
    let hostelId = null;
    if (req.body.hostelId && req.body.hostelId !== 'all' && req.body.hostelId !== 'null') {
      hostelId = req.body.hostelId;
    } else if (req.body.scope === 'BRANCH') {
      hostelId = req.headers['x-hostel-id'] || req.tenant?.hostelId || null;
    }

    if (!organizationId) {
      return res.status(403).json({ success: false, message: 'Organization tenant context required' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
    }

    const { category, title, versionLabel, effectiveDate } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Document category is required' });
    }

    const result = await uploadAndCreateDraft({
      organizationId,
      hostelId,
      category,
      title,
      versionLabel,
      effectiveDate,
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded and structured for review',
      data: result,
    });
  } catch (error) {
    console.error('uploadPolicyDraft error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/policies/draft/:versionId
 * Admin: Review and update draft content before publishing.
 */
const updateDraft = async (req, res) => {
  try {
    const organizationId = req.organizationId || req.tenant?.organizationId;
    const { versionId } = req.params;
    const { title, versionLabel, effectiveDate, rawText, structuredContent } = req.body;

    const updated = await updateDraftContent({
      versionId,
      organizationId,
      title,
      versionLabel,
      effectiveDate,
      rawText,
      structuredContent,
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Draft version updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('updateDraft error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/policies/publish/:versionId
 * Admin: Publish reviewed version and archive/supersede previous active version.
 */
const publishPolicyVersion = async (req, res) => {
  try {
    const organizationId = req.organizationId || req.tenant?.organizationId;
    const { versionId } = req.params;

    const published = await publishVersion({
      versionId,
      organizationId,
      userId: req.user._id,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Policy document published and activated successfully',
      data: published,
    });
  } catch (error) {
    console.error('publishPolicyVersion error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/policies/history/:documentId
 * Admin: Get all versions of a document.
 */
const getDocumentHistory = async (req, res) => {
  try {
    const organizationId = req.organizationId || req.tenant?.organizationId;
    const { documentId } = req.params;

    const versions = await getVersionHistory(documentId, organizationId);
    return res.status(200).json({ success: true, data: versions });
  } catch (error) {
    console.error('getDocumentHistory error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/policies/split-combined
 * Admin: Splits a combined document text into the 3 categories for review.
 */
const splitCombinedDocument = async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, message: 'rawText is required' });
    }

    const split = splitCombinedTextIntoCategories(rawText);
    return res.status(200).json({ success: true, data: split });
  } catch (error) {
    console.error('splitCombinedDocument error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/policies/applicable
 * Student: Get applicable published policies with acceptance status.
 */
const getApplicablePolicies = async (req, res) => {
  try {
    const status = await getStudentPolicyStatus(req.user);
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    console.error('getApplicablePolicies error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/policies/student-status
 * Student: Check if user has pending mandatory policy acceptances.
 */
const getStudentStatus = async (req, res) => {
  try {
    const status = await getStudentPolicyStatus(req.user);
    return res.status(200).json({
      success: true,
      allAccepted: status.allAccepted,
      pendingCategories: status.pendingCategories,
      readiness: status.readiness,
    });
  } catch (error) {
    console.error('getStudentStatus error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/policies/accept
 * Student: Submit explicit acceptance for required published policy versions.
 */
const acceptPolicies = async (req, res) => {
  try {
    const { documentVersions } = req.body;
    const userAgent = req.headers['user-agent'] || '';

    const result = await recordStudentAcceptance({
      user: req.user,
      documentVersions,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Policy documents accepted successfully',
      data: result,
    });
  } catch (error) {
    console.error('acceptPolicies error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/policies/student-history
 * Student: View personal acceptance history.
 */
const getStudentHistory = async (req, res) => {
  try {
    let student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(200).json({ success: true, data: [] });
    }

    const history = await getStudentAcceptanceHistory(student._id);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('getStudentHistory error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/policies/view/:versionId
 * Authenticated: View a specific policy version's readable content.
 */
const viewPolicyVersion = async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await HostelPolicyVersion.findById(versionId).lean();

    if (!version) {
      return res.status(404).json({ success: false, message: 'Policy document version not found' });
    }

    // Tenant check: ensure version belongs to user's organization (or Super Admin)
    const userOrgId = req.organizationId || req.tenant?.organizationId || req.user.activeOrganizationId;
    if (
      !req.user.isSuperAdmin &&
      req.user.role !== 'super_admin' &&
      userOrgId &&
      String(version.organizationId) !== String(userOrgId)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied to foreign policy document' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: version._id,
        category: version.category,
        title: version.title,
        versionLabel: version.versionLabel,
        effectiveDate: version.effectiveDate,
        publishedAt: version.publishedAt,
        structuredContent: version.structuredContent,
        rawText: version.rawText,
        contentHash: version.contentHash,
        file: {
          originalFileName: version.file?.originalFileName,
          pageCount: version.file?.pageCount,
        },
      },
    });
  } catch (error) {
    console.error('viewPolicyVersion error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPolicySettings,
  uploadPolicyDraft,
  updateDraft,
  publishPolicyVersion,
  getDocumentHistory,
  splitCombinedDocument,
  getApplicablePolicies,
  getStudentStatus,
  acceptPolicies,
  getStudentHistory,
  viewPolicyVersion,
};
