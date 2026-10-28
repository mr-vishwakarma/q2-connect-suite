import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, AlertCircle } from 'lucide-react';
import { HostelFeeReceiptView } from './HostelFeeReceiptView';
import { FeeReceiptSnapshot } from '@/types/receipt';
import { api } from '@/lib/api';
import { downloadFeeReceipt, printFeeReceipt } from '@/lib/receiptPdf';
import { toast } from 'react-toastify';

export interface HostelFeeReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptNo?: string | null;
  initialData?: FeeReceiptSnapshot | null;
}

export const HostelFeeReceiptModal: React.FC<HostelFeeReceiptModalProps> = ({
  open,
  onOpenChange,
  receiptNo,
  initialData,
}) => {
  const [receipt, setReceipt] = useState<FeeReceiptSnapshot | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    if (initialData) {
      setReceipt(initialData);
      setError(null);
      return;
    }

    if (open && receiptNo) {
      setLoading(true);
      setError(null);
      api
        .get(`/receipts/${receiptNo}`)
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setReceipt(res.data.data);
          } else {
            setError(res.data?.message || 'Failed to load receipt details');
          }
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Error fetching receipt');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, receiptNo, initialData]);

  const handleDownload = async () => {
    if (!receipt) return;
    setDownloading(true);
    try {
      await downloadFeeReceipt(receipt);
      toast.success('Fee receipt downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to download fee receipt');
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!receipt) return;
    try {
      await printFeeReceipt(receipt);
    } catch {
      window.print();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 sm:rounded-2xl border-border bg-slate-50 dark:bg-slate-950">
        <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b border-border bg-background sticky top-0 z-20 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Official Hostel Fee Receipt
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-mono">
              #{receipt?.receiptNo || receiptNo || ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs font-medium"
              onClick={handlePrint}
              disabled={!receipt || loading}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs font-medium bg-purple-700 hover:bg-purple-800 text-white"
              onClick={handleDownload}
              disabled={!receipt || loading || downloading}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Download PDF</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 flex justify-center">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm font-medium">Generating official receipt...</p>
            </div>
          )}

          {error && !loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-rose-500 text-center max-w-md mx-auto">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="text-sm font-semibold">{error}</p>
              <p className="text-xs text-muted-foreground">
                Please verify authorization or check with the hostel administration.
              </p>
            </div>
          )}

          {!loading && !error && receipt && (
            <HostelFeeReceiptView receipt={receipt} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
