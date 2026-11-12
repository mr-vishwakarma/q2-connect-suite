import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2, CheckCircle2, Building, Calendar, IndianRupee } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

interface VerificationData {
  valid: boolean;
  receiptNo: string;
  invoiceNo?: string;
  status: string;
  hostelBranch: string;
  organizationName: string;
  maskedStudentName: string;
  billingMonth: string;
  paidAmount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionId?: string;
  verifiedAt: string;
}

export default function VerifyReceiptPage() {
  const [searchParams] = useSearchParams();
  const receiptNo = searchParams.get('no') || searchParams.get('receiptNo');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptNo) {
      setError('No receipt number provided for verification.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .get(`/receipts/verify/${encodeURIComponent(receiptNo)}`)
      .then((res) => {
        if (res.data?.success && res.data?.data?.valid) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || 'Invalid or unverified receipt');
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Receipt verification failed. Please check the receipt number.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [receiptNo]);

  return (
    <div className="min-h-screen app-shell-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/15 border border-primary/30 text-primary mb-3 shadow-lg shadow-primary/15">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Hosteliq Document Verification
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Authoritative digital hostel fee receipt validation system
          </p>
        </div>

        {/* Status Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Verifying receipt authenticity...</p>
              </div>
            )}

            {error && !loading && (
              <div className="py-8 text-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-rose-400">Verification Failed</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    {error}
                  </p>
                </div>
                {receiptNo && (
                  <p className="text-xs font-mono bg-white/[0.04] border border-white/[0.08] py-1 px-2.5 rounded-lg inline-block text-muted-foreground">
                    Query: #{receiptNo}
                  </p>
                )}
              </div>
            )}

            {!loading && !error && data && (
              <div className="space-y-5">
                
                {/* Green Verified Banner */}
                <div className="rounded-xl bg-[#74DCCB]/10 border border-[#74DCCB]/30 p-4 text-center">
                  <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-[#74DCCB] text-[#090B12] mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-[#74DCCB]">
                    Official Receipt Verified
                  </h2>
                  <p className="text-xs text-[#74DCCB]/85">
                    This document was officially issued and registered in Hosteliq.
                  </p>
                </div>

                {/* Verified Metadata List */}
                <div className="space-y-3 text-xs divide-y divide-border/60">
                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Receipt Number</span>
                    <span className="font-mono font-bold text-foreground">#{data.receiptNo}</span>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="font-bold text-emerald-600 uppercase">{data.status}</span>
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-muted-foreground">Hostel Branch</span>
                    <span className="font-semibold text-foreground text-right">{data.hostelBranch}</span>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Resident</span>
                    <span className="font-semibold text-foreground">{data.maskedStudentName}</span>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Billing Month</span>
                    <span className="font-semibold text-foreground">{data.billingMonth}</span>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-bold font-mono text-foreground text-sm">
                      ₹ {Number(data.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Payment Mode</span>
                    <span className="font-mono uppercase text-foreground">{data.paymentMethod}</span>
                  </div>

                  {data.transactionId && (
                    <div className="pt-2 flex justify-between">
                      <span className="text-muted-foreground">Transaction ID / UTR</span>
                      <span className="font-mono text-muted-foreground">{data.transactionId}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-between">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="text-foreground">{data.paymentDate}</span>
                  </div>
                </div>

                {/* Footer Timestamp */}
                <div className="pt-2 border-t border-border text-[10.5px] text-center text-muted-foreground">
                  Verified timestamp: {new Date(data.verifiedAt).toLocaleString('en-IN')}
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          © {new Date().getFullYear()} Hosteliq. All rights reserved.
        </p>
      </div>
    </div>
  );
}
