import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-toastify';
import {
  ShieldCheck,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  LogOut,
  Building2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useHostel } from '@/contexts/HostelContext';
import { policyService, PolicyVersionItem, PolicyReadiness } from '@/services/api/policy.service';
import { PolicyDocumentViewer } from '@/components/policies/PolicyDocumentViewer';

export default function PolicyAcceptanceGate() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { selectedHostel, currentBranch } = useHostel();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [applicableVersions, setApplicableVersions] = useState<PolicyVersionItem[]>([]);
  const [readiness, setReadiness] = useState<PolicyReadiness | null>(null);

  // Checkbox state map: versionId -> boolean
  const [acceptedCheckboxMap, setAcceptedCheckboxMap] = useState<Record<string, boolean>>({});

  // Active document in modal viewer
  const [viewingDoc, setViewingDoc] = useState<PolicyVersionItem | null>(null);

  const hostelDisplayName =
    currentBranch?.name || profile?.hostel || selectedHostel || 'Your Hostel';

  const fetchApplicablePolicies = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await policyService.getApplicablePolicies();

      if (res) {
        setApplicableVersions(res.applicableVersions || []);
        setReadiness(res.readiness || null);

        // If all policies are already accepted or hostel setup is pending, navigate to dashboard!
        if (res.allAccepted || res.notReadyBypass) {
          navigate('/student/dashboard', { replace: true });
          return;
        }

        // Initialize checkboxes to false (strict requirement: never pre-checked)
        const initialMap: Record<string, boolean> = {};
        (res.applicableVersions || []).forEach((v) => {
          // If already accepted in database, mark true; otherwise MUST be false
          initialMap[v.versionId] = Boolean(v.isAccepted);
        });
        setAcceptedCheckboxMap(initialMap);
      }
    } catch (err: any) {
      console.error('Failed to load applicable policies:', err);
      setErrorMsg(
        err.response?.data?.message ||
          'Failed to retrieve mandatory hostel policies. Please check your connection and retry.'
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchApplicablePolicies();
  }, [fetchApplicablePolicies]);

  const handleToggleCheckbox = (versionId: string, checked: boolean) => {
    setAcceptedCheckboxMap((prev) => ({
      ...prev,
      [versionId]: checked,
    }));
  };

  // Determine if all applicable policies are checked
  const allRequiredChecked =
    applicableVersions.length > 0 &&
    applicableVersions.every((v) => acceptedCheckboxMap[v.versionId] === true);

  const handleAcceptSubmit = async () => {
    if (!allRequiredChecked) {
      toast.error('Please acknowledge and accept all mandatory documents before continuing.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      // Collect payload
      const payload = applicableVersions.map((v) => ({
        versionId: v.versionId,
        contentHash: v.contentHash,
      }));

      const res = await policyService.acceptPolicies(payload);

      if (res?.success) {
        toast.success('All hostel policies accepted successfully! Access granted.');
        await refreshProfile();
        // Redirect to protected student dashboard
        navigate('/student/dashboard', { replace: true });
      } else {
        toast.error('Failed to record policy acceptances. Please retry.');
      }
    } catch (err: any) {
      console.error('Accept policies error:', err);
      const message =
        err.response?.data?.message ||
        'An error occurred while saving your acceptance records. Please retry.';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login?role=student', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 animate-pulse">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">Verifying Hostel Policies...</p>
          <p className="text-xs text-muted-foreground">Checking compliance and regulatory requirements</p>
        </div>
        <Loader2 className="w-5 h-5 text-amber-500 animate-spin mt-2" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        {/* Top Branding & Header */}
        <div className="space-y-3 text-center sm:text-left sm:flex sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                  Hosteliq
                </span>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px] px-2 py-0">
                  Resident Access Gate
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Mandatory Policy Acceptance
              </h1>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2">
            <Badge variant="outline" className="border-border text-foreground bg-secondary/40 text-xs px-3 py-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              {hostelDisplayName}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Explanation Banner */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs sm:text-sm text-foreground/90 leading-relaxed">
          <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Resident Agreement Required Before Dashboard Access
            </p>
            <p className="text-xs text-muted-foreground leading-normal">
              To ensure safety, compliance, and transparent living operations at <strong>{hostelDisplayName}</strong>, all residents are required to review and accept the official hostel documents below. Once accepted, your agreement is cryptographically logged and you will be immediately redirected to your student portal.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchApplicablePolicies}
              className="text-xs h-7 px-2 border-destructive/40 hover:bg-destructive/10"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Document Cards */}
        <div className="space-y-4">
          {applicableVersions.map((doc) => {
            const isChecked = Boolean(acceptedCheckboxMap[doc.versionId]);
            const isAlreadyAccepted = Boolean(doc.isAccepted);
            const effectiveDateStr = doc.effectiveDate
              ? new Date(doc.effectiveDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Current';

            return (
              <Card
                key={doc.versionId}
                className={`border transition-all duration-200 ${
                  isChecked
                    ? 'border-amber-500/60 bg-amber-500/[0.03] shadow-md'
                    : 'border-border/80 bg-card/60'
                }`}
              >
                <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-secondary/80 border border-border flex items-center justify-center text-amber-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                          {doc.categoryLabel || doc.category.replace(/_/g, ' ')}
                        </div>
                        <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                          {doc.title}
                        </CardTitle>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-border text-xs text-muted-foreground bg-secondary/40 font-mono">
                        {doc.versionLabel || `v${doc.versionNumber}`}
                      </Badge>
                      <Badge variant="outline" className="border-border text-xs text-muted-foreground bg-secondary/40 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        Effective {effectiveDateStr}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-5 sm:px-6 pb-5 space-y-4 pt-1">
                  {/* Action row: Review Document button */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-3">
                    <span className="text-[11px]">
                      {doc.structuredContent?.sections?.length || 1} sections • Complete text available
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingDoc(doc)}
                      className="text-xs font-medium gap-1.5 h-8 border-border hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Read Document
                    </Button>
                  </div>

                  {/* Explicit Acceptance Checkbox */}
                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/60 flex items-start gap-3">
                    <Checkbox
                      id={`check-${doc.versionId}`}
                      checked={isChecked}
                      disabled={isAlreadyAccepted}
                      onCheckedChange={(checked) => handleToggleCheckbox(doc.versionId, Boolean(checked))}
                      className="mt-0.5 border-border data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    />
                    <label
                      htmlFor={`check-${doc.versionId}`}
                      className="text-xs text-foreground/90 font-medium leading-relaxed cursor-pointer select-none"
                    >
                      I have opened, reviewed, and agree to abide by the provisions set forth in{' '}
                      <strong className="text-foreground">{doc.title}</strong> ({doc.versionLabel || `v${doc.versionNumber}`}).
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Submission Action */}
        <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                {allRequiredChecked ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    All {applicableVersions.length} documents acknowledged
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Acknowledgement pending ({Object.values(acceptedCheckboxMap).filter(Boolean).length} of {applicableVersions.length} checked)
                  </>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground leading-normal">
                By clicking below, you submit an authoritative digital acceptance record linked to your student account.
              </p>
            </div>

            <Button
              type="button"
              disabled={!allRequiredChecked || submitting}
              onClick={handleAcceptSubmit}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs sm:text-sm h-11 px-8 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording Acceptance...
                </>
              ) : (
                'Accept All Policies & Continue'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer support notice */}
      <footer className="mt-12 text-center text-xs text-muted-foreground py-4 border-t border-border/30">
        Hosteliq Secure Resident Access • Need assistance? Contact hostel administration.
      </footer>

      {/* Readable Modal Viewer */}
      <PolicyDocumentViewer
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
        hostelName={hostelDisplayName}
      />
    </div>
  );
}

