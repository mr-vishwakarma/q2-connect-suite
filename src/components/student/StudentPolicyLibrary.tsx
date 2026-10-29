import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  History,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import {
  policyService,
  PolicyVersionItem,
  StudentAcceptanceHistoryItem,
} from '@/services/api/policy.service';
import { PolicyDocumentViewer } from '@/components/policies/PolicyDocumentViewer';
import { useNavigate } from 'react-router-dom';

interface StudentPolicyLibraryProps {
  hostelName?: string;
}

export function StudentPolicyLibrary({ hostelName }: StudentPolicyLibraryProps) {
  const [loading, setLoading] = useState(true);
  const [applicablePolicies, setApplicablePolicies] = useState<PolicyVersionItem[]>([]);
  const [acceptanceHistory, setAcceptanceHistory] = useState<StudentAcceptanceHistoryItem[]>([]);
  const [viewingDoc, setViewingDoc] = useState<PolicyVersionItem | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPolicyData = async () => {
      try {
        setLoading(true);
        const [statusRes, historyRes] = await Promise.all([
          policyService.getApplicablePolicies().catch(() => null),
          policyService.getStudentHistory().catch(() => []),
        ]);

        if (statusRes?.applicableVersions) {
          setApplicablePolicies(statusRes.applicableVersions);
        }
        if (historyRes) {
          setAcceptanceHistory(historyRes);
        }
      } catch (err) {
        console.error('Failed to load student policy library:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPolicyData();
  }, []);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (loading) {
    return (
      <Card className="border border-border/80 shadow-sm">
        <CardContent className="p-6 text-center text-xs text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500 mb-2" />
          Loading hostel policies and acceptance history...
        </CardContent>
      </Card>
    );
  }

  if (applicablePolicies.length === 0) {
    return null;
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                Hostel Policies &amp; Documents
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Published regulatory agreements and personal acceptance history for {hostelName || 'your branch'}.
              </CardDescription>
            </div>
          </div>

          {acceptanceHistory.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs h-8 gap-1.5 border-border hover:border-amber-500/50"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              {showHistory ? 'Show Current Policies' : 'View Acceptance Audit Log'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {showHistory ? (
          /* Historical Acceptances View */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
              <span className="font-semibold text-foreground">Personal Acceptance Log</span>
              <span>{acceptanceHistory.length} recorded acceptance(s)</span>
            </div>

            <div className="space-y-2">
              {acceptanceHistory.map((item) => (
                <div
                  key={item.acceptanceId}
                  className="p-3.5 rounded-lg border border-border/60 bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{item.documentTitle}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {item.versionLabel || `v${item.versionNumber}`}
                      </Badge>
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]">
                        Explicit Acceptance
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-[11px]">
                      <span>
                        Accepted on:{' '}
                        <strong>
                          {new Date(item.acceptedAt).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </strong>
                      </span>
                      {item.contentHash && (
                        <span className="font-mono truncate max-w-[160px]" title={item.contentHash}>
                          Hash: {item.contentHash.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Currently Applicable Published Policies */
          <div className="space-y-3">
            {applicablePolicies.map((doc) => {
              const effectiveDateStr = doc.effectiveDate
                ? new Date(doc.effectiveDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Current';

              const acceptedDateStr = doc.acceptedAt
                ? new Date(doc.acceptedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : null;

              return (
                <div
                  key={doc.versionId}
                  className="p-4 rounded-xl border border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-sm text-foreground">{doc.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px] border-border text-muted-foreground">
                        {doc.versionLabel || `v${doc.versionNumber}`}
                      </Badge>

                      {doc.isAccepted ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted {acceptedDateStr ? `on ${acceptedDateStr}` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Action Required
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-[11px] pl-6">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        Effective {effectiveDateStr}
                      </span>
                      {doc.contentHash && (
                        <span className="flex items-center gap-1 font-mono">
                          SHA: {doc.contentHash.slice(0, 8)}...
                          <button
                            type="button"
                            onClick={() => handleCopyHash(doc.contentHash)}
                            className="hover:text-foreground p-0.5"
                            title="Copy full cryptographic SHA-256 hash"
                          >
                            {copiedHash === doc.contentHash ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!doc.isAccepted && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => navigate('/student/accept-policies')}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-8 px-3"
                      >
                        Accept Policy
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingDoc(doc)}
                      className="text-xs h-8 gap-1.5 px-3 border-border hover:border-amber-500/50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Read Document
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Readable Modal Viewer */}
      <PolicyDocumentViewer
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
        hostelName={hostelName}
      />
    </Card>
  );
}

