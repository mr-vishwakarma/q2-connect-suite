import { api } from '@/lib/api';

export interface PolicyStructuredSection {
  heading: string;
  subheading?: string;
  paragraphs: string[];
  clauses?: string[];
  pageNumber?: number;
}

export interface PolicyStructuredContent {
  title: string;
  summary?: string;
  sections: PolicyStructuredSection[];
}

export interface PolicyVersionItem {
  id: string;
  _id?: string;
  documentId: string;
  category: 'TERMS_AND_CONDITIONS' | 'RULES_AND_REGULATIONS' | 'HOSTEL_POLICIES';
  categoryLabel?: string;
  title: string;
  versionNumber: number;
  versionLabel: string;
  effectiveDate: string;
  status: 'DRAFT' | 'REVIEW_REQUIRED' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';
  contentHash: string;
  structuredContent: PolicyStructuredContent;
  rawText?: string;
  file?: {
    originalFileName?: string;
    fileSize?: number;
    mimeType?: string;
    pageCount?: number;
    isScanned?: boolean;
    extractionStatus?: string;
    extractionNotes?: string;
  };
  isAccepted?: boolean;
  acceptedAt?: string | null;
  publishedAt?: string;
  isImmutable?: boolean;
}

export interface PolicyReadiness {
  isReady: boolean;
  totalRequired: number;
  publishedCount: number;
  missingCategories: string[];
  categories: {
    category: string;
    title: string;
    isConfigured: boolean;
    version: {
      id: string;
      versionNumber: number;
      versionLabel: string;
      title: string;
      effectiveDate: string;
      publishedAt?: string;
      isBranchOverride?: boolean;
    } | null;
  }[];
}

export interface PolicySettingsResponse {
  readiness: PolicyReadiness;
  categories: Record<
    string,
    {
      category: string;
      defaultTitle: string;
      description: string;
      document: any;
      isBranchOverride: boolean;
    }
  >;
}

export interface StudentPolicyStatusResponse {
  hasStudentProfile: boolean;
  allAccepted: boolean;
  notReadyBypass?: boolean;
  readiness: PolicyReadiness;
  pendingCategories: string[];
  applicableVersions: PolicyVersionItem[];
}

export interface StudentAcceptanceHistoryItem {
  acceptanceId: string;
  category: string;
  categoryTitle: string;
  versionNumber: number;
  versionLabel: string;
  acceptedAt: string;
  contentHash: string;
  documentTitle: string;
  effectiveDate?: string;
}

export const policyService = {
  // Admin Endpoints
  getSettings: async (hostelId?: string): Promise<PolicySettingsResponse> => {
    const params = hostelId ? { hostelId } : {};
    const res = await api.get('/policies/settings', { params });
    return res.data.data;
  },

  uploadDraft: async (formData: FormData): Promise<{ document: any; version: PolicyVersionItem; extraction: any }> => {
    const res = await api.post('/policies/upload-draft', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  updateDraft: async (versionId: string, data: Partial<PolicyVersionItem>): Promise<PolicyVersionItem> => {
    const res = await api.put(`/policies/draft/${versionId}`, data);
    return res.data.data;
  },

  publishVersion: async (versionId: string): Promise<PolicyVersionItem> => {
    const res = await api.post(`/policies/publish/${versionId}`);
    return res.data.data;
  },

  getDocumentHistory: async (documentId: string): Promise<PolicyVersionItem[]> => {
    const res = await api.get(`/policies/history/${documentId}`);
    return res.data.data;
  },

  splitCombinedText: async (rawText: string): Promise<Record<string, string>> => {
    const res = await api.post('/policies/split-combined', { rawText });
    return res.data.data;
  },

  // Student Endpoints
  getApplicablePolicies: async (): Promise<StudentPolicyStatusResponse> => {
    const res = await api.get('/policies/applicable');
    return res.data.data;
  },

  getStudentStatus: async (): Promise<{
    allAccepted: boolean;
    pendingCategories: string[];
    readiness: PolicyReadiness;
  }> => {
    const res = await api.get('/policies/student-status');
    return res.data;
  },

  acceptPolicies: async (
    documentVersions: { versionId: string; contentHash?: string }[]
  ): Promise<{ success: boolean; acceptedCount: number; status: StudentPolicyStatusResponse }> => {
    const res = await api.post('/policies/accept', { documentVersions });
    return res.data;
  },

  getStudentHistory: async (): Promise<StudentAcceptanceHistoryItem[]> => {
    const res = await api.get('/policies/history');
    return res.data.data;
  },

  viewVersion: async (versionId: string): Promise<PolicyVersionItem> => {
    const res = await api.get(`/policies/view/${versionId}`);
    return res.data.data;
  },
};

