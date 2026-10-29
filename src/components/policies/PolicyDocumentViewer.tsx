import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Calendar,
  ShieldCheck,
  Hash,
  Copy,
  Check,
  Download,
  AlertCircle,
} from 'lucide-react';
import { PolicyVersionItem } from '@/services/api/policy.service';

interface PolicyDocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  document: PolicyVersionItem | null;
  hostelName?: string;
}

export function PolicyDocumentViewer({
  isOpen,
  onClose,
  document,
  hostelName,
}: PolicyDocumentViewerProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!document) return null;

  const handleCopyHash = () => {
    if (document.contentHash) {
      navigator.clipboard.writeText(document.contentHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const sections = document.structuredContent?.sections || [];
  const effectiveDateStr = document.effectiveDate
    ? new Date(document.effectiveDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Immediate';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border text-foreground shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border/80 bg-card/60 backdrop-blur shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {document.title || 'Hostel Policy Document'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Official hostel publication applicable to{' '}
                  <span className="font-semibold text-foreground">
                    {hostelName || 'your assigned hostel branch'}
                  </span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-xs px-2.5 py-0.5">
                Version {document.versionLabel || `v${document.versionNumber}`}
              </Badge>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-xs px-2.5 py-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Published
              </Badge>
            </div>
          </div>

          {/* Meta Bar */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-muted-foreground pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Effective: <strong>{effectiveDateStr}</strong></span>
            </div>

            {document.contentHash && (
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-[11px] truncate max-w-[200px]" title={document.contentHash}>
                  SHA: {document.contentHash.slice(0, 12)}...{document.contentHash.slice(-6)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="hover:text-foreground transition-colors p-0.5 rounded"
                  title="Copy full cryptographic SHA-256 hash"
                >
                  {copiedHash ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}

            {document.file?.pageCount && (
              <div className="text-[11px]">
                {document.file.pageCount} page{document.file.pageCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Document Body */}
        <ScrollArea className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Summary Banner if present */}
            {document.structuredContent?.summary && (
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/70 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Document Overview
                </p>
                {document.structuredContent.summary}
              </div>
            )}

            {/* Structured Sections */}
            {sections.length > 0 ? (
              sections.map((section, idx) => (
                <section
                  key={idx}
                  className="space-y-3 pb-6 border-b border-border/40 last:border-b-0"
                >
                  {section.heading && (
                    <h3 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-amber-500 rounded-full shrink-0" />
                      {section.heading}
                    </h3>
                  )}

                  {section.subheading && (
                    <h4 className="text-xs font-semibold text-amber-400/90 pl-3.5">
                      {section.subheading}
                    </h4>
                  )}

                  {/* Paragraphs */}
                  {section.paragraphs && section.paragraphs.length > 0 && (
                    <div className="space-y-2.5 pl-3.5">
                      {section.paragraphs.map((p, pIdx) => (
                        <p
                          key={pIdx}
                          className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal whitespace-pre-line"
                        >
                          {p}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Numbered Clauses & Bullet Points */}
                  {section.clauses && section.clauses.length > 0 && (
                    <ul className="space-y-2 pl-6 pt-1 list-none">
                      {section.clauses.map((clause, cIdx) => (
                        <li
                          key={cIdx}
                          className="text-xs sm:text-sm text-foreground/90 leading-relaxed relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-amber-400 before:font-bold"
                        >
                          {clause}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))
            ) : document.rawText ? (
              /* Fallback to clean pre-wrap raw text if structure is minimal */
              <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap">
                {document.rawText}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No text content available for this document.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/80 bg-card/60 backdrop-blur shrink-0 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            Hosteliq Document Verification System • Cryptographically Verified
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-medium px-4 h-8"
          >
            Close Document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

