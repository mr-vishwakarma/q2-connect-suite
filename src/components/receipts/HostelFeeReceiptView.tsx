import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  User,
  Calendar,
  FileText,
  CreditCard,
  Check,
  Phone,
  Mail,
  Info,
  Building,
} from 'lucide-react';
import { FeeReceiptSnapshot } from '@/types/receipt';

export interface HostelFeeReceiptViewProps {
  receipt: FeeReceiptSnapshot;
}

export const HostelFeeReceiptView: React.FC<HostelFeeReceiptViewProps> = ({ receipt }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    if (receipt?.verificationUrl) {
      QRCode.toDataURL(receipt.verificationUrl, {
        margin: 1,
        width: 140,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => {
          if (isMounted) setQrCodeUrl(url);
        })
        .catch((err) => {
          console.error('Failed to generate receipt QR code:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [receipt?.verificationUrl]);

  if (!receipt) return null;

  const {
    branding,
    student,
    billing,
    lineItems = [],
    financials,
    paymentDetails,
  } = receipt;

  const isPaid = receipt.status === 'PAID';

  return (
    <div className="receipt-wrapper font-sans text-slate-800 antialiased print:m-0 print:p-0">
      {/* Printable Page Wrapper */}
      <div className="receipt-container relative mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-9 shadow-sm print:max-w-none print:border-none print:p-0 print:shadow-none">
        
        {/* Subtle Centered Logo Watermark (~4-5% opacity) */}
        <div
          className="watermark-overlay pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
          aria-hidden="true"
        >
          {branding?.logo ? (
            <img
              src={branding.logo}
              alt=""
              className="h-72 w-72 object-contain opacity-[0.045] grayscale filter"
            />
          ) : (
            <svg
              className="h-80 w-80 text-purple-900 opacity-[0.04]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3zm0 3.8l5 4.5v6.7h-2v-5H9v5H7v-6.7l5-4.5z" />
            </svg>
          )}
        </div>

        {/* Receipt Content Body (above watermark) */}
        <div className="relative z-10 space-y-6">
          
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 border-b border-slate-100 pb-5">
            {/* Left: Branding & Issuer Contact */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {branding?.logo ? (
                  <img
                    src={branding.logo}
                    alt={branding.branchName}
                    className="h-12 w-12 rounded-xl object-contain border border-slate-100 p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-sm">
                    <Building className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                    {branding?.organizationName || 'Hosteliq'}
                  </h1>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                    {branding?.tagline || 'STUDENT LIVING, BRIGHTER FUTURES'}
                  </p>
                </div>
              </div>

              {/* Branch & Contact Info */}
              <div className="space-y-0.5 text-xs text-slate-600">
                <div className="font-bold text-slate-800 text-sm">
                  {branding?.branchName}
                </div>
                <div className="max-w-[320px] leading-relaxed text-slate-500">
                  {branding?.address}
                </div>
                <div className="flex items-center gap-2 pt-1 text-slate-600">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-purple-600" />
                    <span>{branding?.phone}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-purple-600" />
                  <span>{branding?.email}</span>
                </div>
              </div>
            </div>

            {/* Right: Fee Receipt Pill & Payment Status Confirmation */}
            <div className="flex flex-col sm:items-end space-y-3 min-w-[210px]">
              {/* Lavender Receipt Pill */}
              <div className="w-full sm:w-auto rounded-2xl border border-purple-200/80 bg-[#f5edff] px-5 py-2.5 text-center sm:text-right">
                <div className="text-xs font-black uppercase tracking-wider text-purple-700">
                  FEE RECEIPT
                </div>
                <div className="mt-0.5 font-mono text-xs font-bold text-slate-700">
                  # {receipt.receiptNo}
                </div>
              </div>

              {/* Green Payment Confirmation Card */}
              <div className="w-full rounded-xl border border-emerald-200 bg-[#ecfdf5] px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <Check className="h-4 w-4 stroke-[3]" />
                  </div>
                  <div>
                    <div className="text-sm font-black tracking-wide text-emerald-800">
                      {isPaid ? 'PAID' : 'PARTIALLY PAID'}
                    </div>
                    <div className="text-[10.5px] font-medium text-emerald-700 leading-tight">
                      {receipt.confirmationMessage}
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta key-values table */}
              <div className="w-full text-right text-xs space-y-1 pt-1">
                <div className="grid grid-cols-[85px_1fr] text-[11.5px] gap-2 justify-end">
                  <span className="text-slate-400 font-medium text-left">Receipt Date</span>
                  <span className="font-semibold text-slate-700 text-right">: {receipt.receiptDate}</span>
                </div>
                <div className="grid grid-cols-[85px_1fr] text-[11.5px] gap-2 justify-end">
                  <span className="text-slate-400 font-medium text-left">Payment Date</span>
                  <span className="font-semibold text-slate-700 text-right">: {receipt.paymentDate}</span>
                </div>
                <div className="grid grid-cols-[85px_1fr] text-[11.5px] gap-2 justify-end">
                  <span className="text-slate-400 font-medium text-left">Invoice No.</span>
                  <span className="font-mono font-semibold text-slate-700 text-right">: {receipt.invoiceNo}</span>
                </div>
                <div className="grid grid-cols-[85px_1fr] text-[11.5px] gap-2 justify-end">
                  <span className="text-slate-400 font-medium text-left">Receipt No.</span>
                  <span className="font-mono font-semibold text-slate-700 text-right">: {receipt.receiptNo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Cards: Student Details & Billing Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Left Card: Student Details */}
            <div className="rounded-xl border border-purple-100 bg-[#fcfaff] p-4 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-800 pb-1 border-b border-purple-100/60">
                <User className="h-4 w-4 text-purple-600" />
                <span className="text-xs uppercase tracking-wide">Student Details</span>
              </div>
              <div className="space-y-1.5 pt-0.5">
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Name</span>
                  <span className="font-bold text-slate-800">: {student?.name}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Student ID</span>
                  <span className="font-mono font-semibold text-slate-700">: {student?.studentId}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Course</span>
                  <span className="font-semibold text-slate-700">: {student?.course || 'General Residency'}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Year / Semester</span>
                  <span className="font-semibold text-slate-700">: {student?.yearSemester || 'Academic Resident'}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Room No.</span>
                  <span className="font-bold text-slate-900">: {student?.roomNo}</span>
                </div>
              </div>
            </div>

            {/* Right Card: Billing Period */}
            <div className="rounded-xl border border-purple-100 bg-[#fcfaff] p-4 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-800 pb-1 border-b border-purple-100/60">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="text-xs uppercase tracking-wide">Billing Period</span>
              </div>
              <div className="space-y-1.5 pt-0.5">
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Month</span>
                  <span className="font-bold text-slate-800">: {billing?.month}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Due Date</span>
                  <span className="font-semibold text-slate-700">: {billing?.dueDate}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">Payment Date</span>
                  <span className="font-semibold text-slate-700">: {billing?.paymentDate}</span>
                </div>
                <div className="grid grid-cols-[105px_1fr]">
                  <span className="text-slate-500 font-medium">No. of Days</span>
                  <span className="font-semibold text-slate-700">: {billing?.numberOfDays || 'Full Month'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Fee Breakdown Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800">
              <FileText className="h-4 w-4 text-purple-600" />
              <span className="uppercase tracking-wide">Fee Breakdown</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-purple-100/90 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-200/80 bg-[#f6effe] text-[11px] font-bold text-slate-700">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Particulars</th>
                    <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100/60 bg-white">
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/20 transition-colors">
                      <td className="py-2.5 px-4 text-center font-medium text-slate-400">
                        {item.index || idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {item.particulars}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800">
                        {item.isDeduction ? '-' : ''}
                        {Number(item.amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-purple-200 bg-[#f5edff]">
                    <td colSpan={2} className="py-3 px-4 text-left font-black text-xs text-purple-900 uppercase tracking-wide">
                      Total Amount Paid
                    </td>
                    <td className="py-3 px-4 text-right font-black text-sm sm:text-base font-mono text-purple-900">
                      ₹ {Number(financials?.amountPaid || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* If there is an outstanding remaining balance */}
            {financials && financials.remainingBalance > 0 && (
              <div className="flex justify-between items-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
                <span>Remaining Unpaid Balance:</span>
                <span className="font-mono font-bold">
                  ₹ {Number(financials.remainingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Payment Details & Verification QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4 items-stretch">
            
            {/* Left: Payment Details Card */}
            <div className="rounded-xl border border-emerald-200/90 bg-[#f4fcf6] p-4 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 pb-1 border-b border-emerald-100">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <span className="text-xs uppercase tracking-wide">Payment Details</span>
              </div>

              <div className="space-y-1.5 pt-0.5">
                <div className="grid grid-cols-[135px_1fr]">
                  <span className="text-slate-500 font-medium">Payment Method</span>
                  <span className="font-bold text-slate-800">: {paymentDetails?.method}</span>
                </div>
                <div className="grid grid-cols-[135px_1fr]">
                  <span className="text-slate-500 font-medium">Transaction ID / UTR</span>
                  <span className="font-mono font-semibold text-slate-800">: {paymentDetails?.transactionId}</span>
                </div>
                <div className="grid grid-cols-[135px_1fr]">
                  <span className="text-slate-500 font-medium">Paid Amount</span>
                  <span className="font-mono font-bold text-slate-900">
                    : ₹ {Number(paymentDetails?.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="grid grid-cols-[135px_1fr]">
                  <span className="text-slate-500 font-medium">Payment Status</span>
                  <span className="font-bold text-emerald-600">: {paymentDetails?.paymentStatus}</span>
                </div>
                <div className="grid grid-cols-[135px_1fr]">
                  <span className="text-slate-500 font-medium">Bank / UPI App</span>
                  <span className="font-semibold text-slate-700">: {paymentDetails?.bankOrApp}</span>
                </div>
              </div>
            </div>

            {/* Right: Verification QR Code */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Scan to verify"
                  className="h-24 w-24 object-contain rounded"
                />
              ) : (
                <div className="h-24 w-24 bg-slate-100 rounded animate-pulse" />
              )}
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500 leading-tight">
                Scan to verify this receipt
              </div>
            </div>

          </div>

          {/* Notes Section */}
          <div className="rounded-xl border border-purple-100/90 bg-[#fbfaff] p-3 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-900">
              <Info className="h-3.5 w-3.5 text-purple-600" />
              <span>Notes</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 pl-1">
              {receipt.notes?.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>

          {/* Footer Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-2 text-xs">
            {/* Left: Thank you message */}
            <div className="text-center sm:text-left">
              <div className="font-serif italic font-bold text-purple-700 text-sm">
                Thank you!
              </div>
              <div className="text-[11px] text-slate-500">
                For being a part of our hostel community.
              </div>
            </div>

            {/* Right: Issuing Branch & Hosteliq Attribution */}
            <div className="text-center sm:text-right space-y-0.5">
              <div className="font-bold text-slate-800 text-xs">
                {branding?.branchName}
              </div>
              <div className="text-[10px] text-slate-500">
                Managed with <span className="text-purple-600">💜</span> by Hosteliq
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
