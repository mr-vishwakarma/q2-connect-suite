import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'react-toastify';
import {
  FileText,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  Eye,
  Edit3,
  Calendar,
  Layers,
  FileSpreadsheet,
  Clock,
  Loader2,
  Copy,
  Check,
  Split,
  Building2,
  HelpCircle,
} from 'lucide-react';
import {
  policyService,
  PolicyVersionItem,
  PolicySettingsResponse,
  PolicyReadiness,
} from '@/services/api/policy.service';
import { PolicyDocumentViewer } from '@/components/policies/PolicyDocumentViewer';

interface AdminPolicyManagementProps {
  selectedHostel: string;
  branchName?: string;
}

export function AdminPolicyManagement({
  selectedHostel,
  branchName,
}: AdminPolicyManagementProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PolicySettingsResponse | null>(null);

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>('TERMS_AND_CONDITIONS');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadVersionLabel, setUploadVersionLabel] = useState('v1.0');
  const [uploadEffectiveDate, setUploadEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review & Edit Draft Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewVersion, setReviewVersion] = useState<PolicyVersionItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVersionLabel, setEditVersionLabel] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');
  const [editRawText, setEditRawText] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Version History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<PolicyVersionItem[]>([]);
  const [historyDocTitle, setHistoryDocTitle] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Document Viewer Modal State
  const [viewingDoc, setViewingDoc] = useState<PolicyVersionItem | null>(null);

  // Combined PDF Modal State
  const [combinedModalOpen, setCombinedModalOpen] = useState(false);
  const [combinedFile, setCombinedFile] = useState<File | null>(null);
  const [processingCombined, setProcessingCombined] = useState(false);
  const [splitResult, setSplitResult] = useState<Record<string, string> | null>(null);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await policyService.getSettings(selectedHostel);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load policy settings:', err);
      toast.error('Failed to load hostel policy configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedHostel]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const openUploadModal = (category: string) => {
    setUploadCategory(category);
    const categoryInfo = data?.categories[category];
    setUploadTitle(categoryInfo?.defaultTitle || 'Hostel Document');
    setUploadVersionLabel('v1.0');
    setUploadEffectiveDate(new Date().toISOString().split('T')[0]);
    setSelectedFile(null);
    setUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10 MB limit.');
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle || uploadTitle === 'Hostel Document') {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadTitle(cleanName);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a PDF file to upload.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', uploadCategory);
      formData.append('title', uploadTitle.trim());
      formData.append('versionLabel', uploadVersionLabel.trim());
      formData.append('effectiveDate', uploadEffectiveDate);
      if (selectedHostel) {
        formData.append('hostelId', selectedHostel);
      }

      const res = await policyService.uploadDraft(formData);

      toast.success('Document uploaded and parsed successfully! Opening review dialog.');
      setUploadModalOpen(false);
      setSelectedFile(null);

      // Refresh list and open review dialog
      await fetchSettings();
      if (res?.version) {
        openReviewModal(res.version);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload and parse PDF document.');
    } finally {
      setUploading(false);
    }
  };

  const openReviewModal = (version: PolicyVersionItem) => {
    setReviewVersion(version);
    setEditTitle(version.title || '');
    setEditVersionLabel(version.versionLabel || 'v1.0');
    setEditEffectiveDate(
      version.effectiveDate
        ? new Date(version.effectiveDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setEditRawText(version.rawText || '');
    setReviewModalOpen(true);
  };

  const handleSaveDraft = async () => {
    if (!reviewVersion) return;
    try {
      setSavingDraft(true);
      const updated = await policyService.updateDraft(reviewVersion.id || reviewVersion._id || '', {
        title: editTitle.trim(),
        versionLabel: editVersionLabel.trim(),
        effectiveDate: editEffectiveDate,
        rawText: editRawText,
      });

      setReviewVersion(updated);
      toast.success('Draft changes saved successfully.');
      await fetchSettings();
    } catch (err: any) {
      console.error('Save draft error:', err);
      toast.error(err.response?.data?.message || 'Failed to update draft content.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (!reviewVersion) return;
    try {
      setPublishing(true);
      const targetVersionId = reviewVersion.id || reviewVersion._id || '';

      // First persist any current edits
      await policyService.updateDraft(targetVersionId, {
        title: editTitle.trim(),
        versionLabel: editVersionLabel.trim(),
        effectiveDate: editEffectiveDate,
        rawText: editRawText,
      });

      // Now publish
      await policyService.publishVersion(targetVersionId);

      toast.success('Policy document published and activated successfully!');
      setReviewModalOpen(false);
      await fetchSettings();
    } catch (err: any) {
      console.error('Publish error:', err);
      toast.error(err.response?.data?.message || 'Failed to publish policy document.');
    } finally {
      setPublishing(false);
    }
  };

  const openHistoryModal = async (documentId: string, title: string) => {
    try {
      setHistoryDocTitle(title);
      setLoadingHistory(true);
      setHistoryModalOpen(true);
      const versions = await policyService.getDocumentHistory(documentId);
      setHistoryVersions(versions);
    } catch (err: any) {
      console.error('History error:', err);
      toast.error('Failed to load version history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleProcessCombined = async () => {
    if (!combinedFile) {
      toast.error('Please select a combined PDF file.');
      return;
    }

    try {
      setProcessingCombined(true);
      // We upload a temporary extraction to get raw text
      const formData = new FormData();
      formData.append('file', combinedFile);
      formData.append('category', 'TERMS_AND_CONDITIONS');
      formData.append('title', 'Combined Hostel Document');

      const res = await policyService.uploadDraft(formData);
      if (res?.version?.rawText) {
        const split = await policyService.splitCombinedText(res.version.rawText);
        setSplitResult(split);
        toast.success('Combined document extracted into 3 categories! Review below.');
      }
    } catch (err: any) {
      console.error('Combined error:', err);
      toast.error(err.response?.data?.message || 'Failed to process combined document.');
    } finally {
      setProcessingCombined(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse space-y-3">
        <Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-500" />
        <p className="text-xs">Loading hostel policies &amp; regulatory documents...</p>
      </div>
    );
  }

  const readiness: PolicyReadiness | undefined = data?.readiness;
  const isFullyReady = readiness?.isReady;
  const publishedCount = readiness?.publishedCount ?? 0;
  const totalRequired = readiness?.totalRequired ?? 3;

  return (
    <div className="space-y-6">
      {/* Policy Readiness Status Card */}
      <Card className={`border shadow-sm transition-all ${
        isFullyReady
          ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
          : 'border-amber-500/40 bg-amber-500/[0.02]'
      }`}>
        <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isFullyReady
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
              }`}>
                {isFullyReady ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Policy Configuration Readiness
                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 ${
                    isFullyReady
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                  }`}>
                    {publishedCount} of {totalRequired} Mandatory Documents Published
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5 text-muted-foreground">
                  {isFullyReady ? (
                    <span className="text-emerald-400 font-medium">
                      Active &amp; Fully Enforced: Mandatory acceptance gate is actively protecting resident access.
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium">
                      Incomplete Setup: Publish all 3 mandatory document categories to activate the resident acceptance gate.
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCombinedModalOpen(true)}
              className="text-xs font-medium gap-1.5 h-8 border-border hover:border-amber-500/50"
            >
              <Split className="w-3.5 h-3.5 text-amber-400" />
              Import Combined PDF
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Mandatory Category Cards */}
      <div className="grid grid-cols-1 gap-5">
        {data &&
          Object.entries(data.categories).map(([categoryKey, cat]) => {
            const document = cat.document;
            const publishedVersion: PolicyVersionItem | null =
              document?.currentPublishedVersionId || null;
            const draftVersion: PolicyVersionItem | null = document?.draftVersionId || null;

            const hasPublished = Boolean(publishedVersion);
            const hasDraft = Boolean(draftVersion);

            const effectiveDateStr = publishedVersion?.effectiveDate
              ? new Date(publishedVersion.effectiveDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return (
              <Card
                key={categoryKey}
                className="border border-border/80 shadow-sm bg-card/60 transition-all hover:border-border"
              >
                <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/80 border border-border flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-foreground">
                            {cat.defaultTitle}
                          </CardTitle>
                          {hasPublished ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] px-2 py-0">
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 text-[10px] px-2 py-0">
                              Missing
                            </Badge>
                          )}
                          {hasDraft && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px] px-2 py-0">
                              Draft Review Required
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                          {cat.description}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openUploadModal(categoryKey)}
                        className="text-xs font-medium gap-1.5 h-8 border-border hover:border-amber-500/50 hover:text-amber-400"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {hasPublished ? 'Upload New Version' : 'Upload PDF'}
                      </Button>

                      {document && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openHistoryModal(document._id, cat.defaultTitle)}
                          className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 gap-1"
                          title="Version History"
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-5 sm:px-6 pb-5 pt-1 space-y-3">
                  {/* Active Published Version Status */}
                  {hasPublished && publishedVersion ? (
                    <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {publishedVersion.title}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            ({publishedVersion.versionLabel || `v${publishedVersion.versionNumber}`})
                          </span>
                          {publishedVersion.isBranchOverride && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                              Branch Override
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-[11px]">
                          <span>Effective: <strong>{effectiveDateStr}</strong></span>
                          {publishedVersion.contentHash && (
                            <span className="flex items-center gap-1 font-mono">
                              SHA: {publishedVersion.contentHash.slice(0, 8)}...
                              <button
                                type="button"
                                onClick={() => handleCopyHash(publishedVersion.contentHash)}
                                className="hover:text-foreground p-0.5"
                                title="Copy content hash"
                              >
                                {copiedHash === publishedVersion.contentHash ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setViewingDoc(publishedVersion)}
                        className="text-xs h-7 gap-1 px-3"
                      >
                        <Eye className="w-3 h-3" />
                        View Document
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      <span>
                        No active document published for this mandatory category. Residents will not have access to this document until uploaded and published.
                      </span>
                    </div>
                  )}

                  {/* Draft Notice if present */}
                  {hasDraft && draftVersion && (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">
                            Draft Under Review: {draftVersion.title} ({draftVersion.versionLabel || `v${draftVersion.versionNumber}`})
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Extracted text has not yet been published. Review and activate this version to replace the active publication.
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openReviewModal(draftVersion)}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-7 px-3 shrink-0"
                      >
                        Review &amp; Publish
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Upload PDF Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Upload Document PDF</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a digital, text-selectable PDF for automatic clause and section extraction.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="docTitle" className="text-xs font-semibold">Document Title</Label>
              <Input
                id="docTitle"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="versionLabel" className="text-xs font-semibold">Version Label</Label>
                <Input
                  id="versionLabel"
                  value={uploadVersionLabel}
                  onChange={(e) => setUploadVersionLabel(e.target.value)}
                  placeholder="e.g. v1.0, 2026-Fall"
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="effectiveDate" className="text-xs font-semibold">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={uploadEffectiveDate}
                  onChange={(e) => setUploadEffectiveDate(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* File Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select PDF File</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-amber-500/50 rounded-xl p-5 text-center cursor-pointer transition-colors bg-secondary/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                />
                <Upload className="w-6 h-6 mx-auto text-amber-400 mb-2" />
                {selectedFile ? (
                  <div className="text-xs">
                    <p className="font-semibold text-foreground truncate max-w-[280px] mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for processing
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Click or drag PDF here</p>
                    <p className="text-[11px]">Maximum size: 10 MB</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUploadModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading || !selectedFile}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Extracting &amp; Processing...
                  </>
                ) : (
                  'Upload & Extract Text'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review & Publish Draft Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border text-foreground">
          <DialogHeader className="p-6 border-b border-border/80 bg-card/60 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold">Review Extracted Policy Text</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Verify extracted clauses and formatting before publishing. All published versions are immutable.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-xs">
                Draft State
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Scanned Warning notice if detected */}
            {reviewVersion?.file?.isScanned && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-foreground flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Scanned Document Warning</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {reviewVersion.file.extractionNotes ||
                      'Low selectable text detected. The document may be a scanned image. Please verify all clauses below before publishing.'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="reviewTitle" className="text-xs font-semibold">Document Title</Label>
                <Input
                  id="reviewTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="reviewLabel" className="text-xs font-semibold">Version Label</Label>
                <Input
                  id="reviewLabel"
                  value={editVersionLabel}
                  onChange={(e) => setEditVersionLabel(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="reviewText" className="text-xs font-semibold">Extracted Text Content</Label>
                <span className="text-[11px] text-muted-foreground">
                  {editRawText.length} characters • Section headings will be formatted automatically
                </span>
              </div>
              <Textarea
                id="reviewText"
                rows={12}
                value={editRawText}
                onChange={(e) => setEditRawText(e.target.value)}
                className="text-xs font-mono leading-relaxed bg-secondary/20 resize-y"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/80 bg-card/60 shrink-0 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReviewModalOpen(false)}
              className="text-xs"
            >
              Close
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveDraft}
                disabled={savingDraft || publishing}
                className="text-xs"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handlePublish}
                disabled={publishing || savingDraft || !editRawText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish & Activate'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Version History — {historyDocTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Audit log of all published and superseded iterations for this document.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 py-2">
            {loadingHistory ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500 mb-2" />
                Loading history...
              </div>
            ) : historyVersions.length > 0 ? (
              historyVersions.map((v) => (
                <div
                  key={v.id || v._id}
                  className="p-3.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{v.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {v.versionLabel || `v${v.versionNumber}`}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          v.status === 'PUBLISHED'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                            : v.status === 'SUPERSEDED'
                            ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {v.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-[11px]">
                      <span>
                        Effective:{' '}
                        {v.effectiveDate
                          ? new Date(v.effectiveDate).toLocaleDateString()
                          : 'N/A'}
                      </span>
                      {v.contentHash && (
                        <span className="font-mono truncate max-w-[150px]" title={v.contentHash}>
                          SHA: {v.contentHash.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingDoc(v)}
                    className="text-xs h-7 px-2.5"
                  >
                    View
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No past versions recorded.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Combined PDF Split Modal */}
      <Dialog open={combinedModalOpen} onOpenChange={setCombinedModalOpen}>
        <DialogContent className="max-w-2xl bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Import Combined Document PDF</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              If your hostel maintains a single handbook containing Terms &amp; Conditions, Rules &amp; Regulations, and Operational Policies together, upload it here to split its content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Combined PDF</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setCombinedFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
            </div>

            <Button
              type="button"
              disabled={processingCombined || !combinedFile}
              onClick={handleProcessCombined}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
            >
              {processingCombined ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Analyzing and Splitting Sections...
                </>
              ) : (
                'Extract and Split into 3 Categories'
              )}
            </Button>

            {splitResult && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-foreground">Extracted Section Summaries:</p>
                {Object.entries(splitResult).map(([cat, text]) => (
                  <div key={cat} className="p-3 rounded-lg bg-secondary/30 border border-border/70 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400">{cat.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-muted-foreground">{text.length} chars</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {text || 'No text detected under this category header.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Document Viewer */}
      <PolicyDocumentViewer
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
        hostelName={branchName || selectedHostel}
      />
    </div>
  );
}

