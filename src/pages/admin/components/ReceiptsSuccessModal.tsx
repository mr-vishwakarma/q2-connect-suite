/**
 * ReceiptsSuccessModal
 * 
 * Displays separate Fee Receipt (first) and Security Deposit Receipt (second).
 * Provides distinct download and print actions for each document, plus a 
 * "Download Both Receipts" quick action.
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Download,
  Printer,
  Receipt,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ArrowDownToLine,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { HostelFeeReceiptModal } from '@/components/receipts/HostelFeeReceiptModal';
import {
  FeeReceiptData,
  SecurityDepositReceiptData,
  downloadFeeReceipt,
  downloadSecurityDepositReceipt,
  downloadBothReceipts,
  printFeeReceipt,
  printSecurityDepositReceipt,
} from '@/lib/receiptPdf';
import { toast } from 'react-toastify';

export interface ReceiptsSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  feeReceipt?: FeeReceiptData | null;
  depositReceipt?: SecurityDepositReceiptData | null;
  onDone?: () => void;
}

export function ReceiptsSuccessModal({
  open,
  onOpenChange,
  title = 'Payment Recorded & Receipts Generated',
  subtitle,
  feeReceipt,
  depositReceipt,
  onDone,
}: ReceiptsSuccessModalProps) {
  const [downloadingBoth, setDownloadingBoth] = useState(false);
  const [downloadingFee, setDownloadingFee] = useState(false);
  const [downloadingDeposit, setDownloadingDeposit] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const hasFeeReceipt = Boolean(feeReceipt && feeReceipt.amount_paid >= 0 && feeReceipt.receipt_no);
  const hasDepositReceipt = Boolean(
    depositReceipt && depositReceipt.deposit_amount > 0 && depositReceipt.receipt_no
  );
  const hasBoth = hasFeeReceipt && hasDepositReceipt;

  const handleDownloadFee = async () => {
    if (!feeReceipt) return;
    setDownloadingFee(true);
    try {
      await downloadFeeReceipt(feeReceipt);
      toast.success('Fee receipt downloaded');
    } catch (err: any) {
      toast.error('Failed to download fee receipt');
    } finally {
      setDownloadingFee(false);
    }
  };

  const handleDownloadDeposit = async () => {
    if (!depositReceipt) return;
    setDownloadingDeposit(true);
    try {
      await downloadSecurityDepositReceipt(depositReceipt);
      toast.success('Security deposit receipt downloaded');
    } catch (err: any) {
      toast.error('Failed to download security deposit receipt');
    } finally {
      setDownloadingDeposit(false);
    }
  };

  const handleDownloadBoth = async () => {
    if (!feeReceipt || !depositReceipt) return;
    setDownloadingBoth(true);
    try {
      await downloadBothReceipts(feeReceipt, depositReceipt);
      toast.success('Both receipts downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to download both receipts');
    } finally {
      setDownloadingBoth(false);
    }
  };

  const handlePrintFee = async () => {
    if (!feeReceipt) return;
    try {
      await printFeeReceipt(feeReceipt);
    } catch {
      toast.error('Failed to open fee receipt print view');
    }
  };

  const handlePrintDeposit = async () => {
    if (!depositReceipt) return;
    try {
      await printSecurityDepositReceipt(depositReceipt);
    } catch {
      toast.error('Failed to open deposit receipt print view');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (onDone) onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg sm:text-xl font-bold flex items-center gap-2">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {subtitle ||
                  (hasBoth
                    ? 'Two separate receipts generated: Monthly Fee Receipt and Security Deposit Receipt.'
                    : hasFeeReceipt
                    ? 'Hostel monthly fee receipt generated successfully.'
                    : 'Security deposit receipt generated successfully.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {hasBoth && (
          <div className="p-3 bg-secondary/60 border border-border/80 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>Hostel Accounting Rule:</strong> Monthly hostel fees and security deposits are
              separate financial liabilities. Two independent receipts have been recorded in the ledger.
            </span>
          </div>
        )}

        <div className="space-y-4 my-2">
          {/* RECEIPT 1: FEE RECEIPT (Always displayed first) */}
          {hasFeeReceipt && feeReceipt && (
            <div className="p-4 bg-secondary/40 border border-primary/30 rounded-2xl space-y-3 relative overflow-hidden shadow-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/40 text-xs font-semibold">
                      Receipt 1 — Hostel Fee Receipt
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{feeReceipt.receipt_no}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {feeReceipt.student_name}{' '}
                    <span className="text-xs font-mono font-normal text-muted-foreground">
                      (@{feeReceipt.username})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hostel: <span className="font-medium text-foreground">{feeReceipt.hostel}</span> • Room:{' '}
                    <span className="font-medium text-foreground">{feeReceipt.room_no || 'N/A'}</span> • Month:{' '}
                    <span className="font-medium text-primary">{feeReceipt.month}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Fee Amount Paid</span>
                  <span className="text-lg font-mono font-extrabold text-foreground">
                    ₹{feeReceipt.amount_paid.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-muted-foreground block uppercase font-mono">
                    Mode: {feeReceipt.payment_mode}
                  </span>
                </div>
              </div>

              {/* Informational Security Deposit Cross-Reference on Fee Receipt */}
              {(feeReceipt.deposit_collected_separately || feeReceipt.deposit_receipt_no) && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      <strong>Security Deposit Collected Separately:</strong> ₹
                      {(feeReceipt.deposit_collected_separately || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {feeReceipt.deposit_receipt_no && (
                    <span className="font-mono text-[11px] text-blue-200">
                      Ref: #{feeReceipt.deposit_receipt_no}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  View Receipt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-border"
                  onClick={handlePrintFee}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={handleDownloadFee}
                  disabled={downloadingFee}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {downloadingFee ? 'Generating...' : 'Download Fee Receipt PDF'}
                </Button>
              </div>
            </div>
          )}

          {/* RECEIPT 2: SECURITY DEPOSIT RECEIPT (Always displayed second) */}
          {hasDepositReceipt && depositReceipt && (
            <div className="p-4 bg-secondary/40 border border-blue-500/30 rounded-2xl space-y-3 relative overflow-hidden shadow-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-xs font-semibold">
                      Receipt 2 — Security Deposit Receipt
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{depositReceipt.receipt_no}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {depositReceipt.student_name}{' '}
                    <span className="text-xs font-mono font-normal text-muted-foreground">
                      (@{depositReceipt.username})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hostel: <span className="font-medium text-foreground">{depositReceipt.hostel}</span> • Room:{' '}
                    <span className="font-medium text-foreground">{depositReceipt.room_no || 'N/A'}</span> • Type:{' '}
                    <span className="font-medium text-blue-400">One-Time Security Deposit</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Deposit Collected</span>
                  <span className="text-lg font-mono font-extrabold text-blue-400">
                    ₹{depositReceipt.deposit_amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-muted-foreground block uppercase font-mono">
                    Mode: {depositReceipt.payment_mode}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
                <p>
                  <strong>One-Time Liability Notice:</strong> This receipt is for a refundable security
                  deposit, not recurring monthly hostel rent. It will not be charged again in monthly cycles.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-border"
                  onClick={handlePrintDeposit}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  onClick={handleDownloadDeposit}
                  disabled={downloadingDeposit}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {downloadingDeposit ? 'Generating...' : 'Download Deposit Receipt PDF'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
          <div>
            {hasBoth && (
              <Button
                variant="outline"
                className="h-9 text-xs border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                onClick={handleDownloadBoth}
                disabled={downloadingBoth}
              >
                <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                {downloadingBoth ? 'Downloading Both...' : 'Download Both Receipts'}
              </Button>
            )}
          </div>
          <Button
            className="h-9 px-5 text-xs font-semibold"
            variant="default"
            onClick={handleClose}
          >
            Done
          </Button>
        </div>
      </DialogContent>

      <HostelFeeReceiptModal
        open={showPreview}
        onOpenChange={setShowPreview}
        receiptNo={feeReceipt?.receipt_no}
      />
    </Dialog>
  );
}
