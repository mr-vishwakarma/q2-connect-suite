import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  Loader2,
  FileText,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { PaymentLifecycleState, PaymentFlowContext } from '@/hooks/useRazorpayPayment';
import { VerifyPaymentResponse } from '@/services/api/payment.service';

interface PaymentModalProps {
  state: PaymentLifecycleState;
  context: PaymentFlowContext | null;
  verificationResult: VerifyPaymentResponse | null;
  errorMessage: string | null;
  onProceed: () => void;
  onClose: () => void;
  onRetry: () => void;
  onDownloadReceipt?: (invoiceNumber: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  state,
  context,
  verificationResult,
  errorMessage,
  onProceed,
  onClose,
  onRetry,
  onDownloadReceipt,
}) => {
  const isOpen = state !== 'IDLE';

  if (!isOpen || !context) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border rounded-2xl p-6 shadow-2xl animate-fade-in">
        {/* State 1: Confirmation Summary */}
        {state === 'CONFIRMING' && (
          <>
            <DialogHeader className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
                <CreditCard className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Payment Summary
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Review your fee breakdown before continuing to Razorpay checkout.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-secondary/40 border border-border/80 rounded-xl p-4 my-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Billing Period</span>
                <span className="font-semibold text-foreground">{context.month}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Fee</span>
                <span className="text-foreground">₹{context.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              {context.paidAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="text-emerald-500 font-medium">
                    -₹{context.paidAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="font-bold text-foreground">Outstanding Due</span>
                <span className="text-xl font-extrabold text-primary font-mono flex items-center">
                  <IndianRupee className="w-4 h-4 mr-0.5 inline" />
                  {context.outstandingAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Secured by 256-bit encryption. Handled by Razorpay.</span>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={onClose} className="rounded-xl border-border">
                Cancel
              </Button>
              <Button
                onClick={onProceed}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Pay ₹{context.outstandingAmount.toLocaleString('en-IN')}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* State 2: Order Creation / Signature Verification in Progress */}
        {(state === 'CREATING_ORDER' || state === 'VERIFYING' || state === 'CHECKOUT_OPEN') && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {state === 'CREATING_ORDER' && 'Initializing Secure Order...'}
                {state === 'CHECKOUT_OPEN' && 'Payment Window Open'}
                {state === 'VERIFYING' && 'Verifying Payment Cryptography...'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                {state === 'CREATING_ORDER' && 'Validating tenant fee balance on the server.'}
                {state === 'CHECKOUT_OPEN' && 'Complete the payment in the Razorpay checkout window.'}
                {state === 'VERIFYING' && 'Authenticating HMAC signature and generating invoice.'}
              </p>
            </div>
          </div>
        )}

        {/* State 3: Payment Success */}
        {state === 'SUCCESS' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Payment Successful!
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Your payment has been verified and applied to your fee account.
              </DialogDescription>
            </div>

            <div className="bg-secondary/40 border border-border/80 rounded-xl p-4 space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-bold text-foreground font-mono">
                  ₹{context.outstandingAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Billing Month</span>
                <span className="font-medium text-foreground">{context.month}</span>
              </div>
              {verificationResult?.invoiceNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Invoice / Receipt</span>
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                    {verificationResult.invoiceNumber}
                  </Badge>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              {onDownloadReceipt && verificationResult?.invoiceNumber && (
                <Button
                  variant="outline"
                  onClick={() => onDownloadReceipt(verificationResult.invoiceNumber)}
                  className="rounded-xl border-border flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Invoice
                </Button>
              )}
              <Button onClick={onClose} className="rounded-xl bg-primary hover:bg-primary/90">
                Back to Fees
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* State 4: Payment Processing (Asynchronous confirmation) */}
        {state === 'PROCESSING' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Payment Processing
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Payment received from gateway. We are confirming the transaction with the bank.
              </DialogDescription>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-500 leading-relaxed">
              Please do not make another payment while verification is underway. Your fee status will update automatically.
            </div>

            <DialogFooter>
              <Button onClick={onClose} className="w-full rounded-xl bg-primary hover:bg-primary/90">
                Acknowledge & Close
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* State 5: Payment Failed */}
        {state === 'FAILED' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Payment Failed
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {errorMessage || 'The payment could not be completed. Please check your bank or card details.'}
              </DialogDescription>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={onClose} className="rounded-xl border-border">
                Close
              </Button>
              <Button onClick={onRetry} className="rounded-xl bg-primary hover:bg-primary/90">
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* State 6: Payment Cancelled by User */}
        {state === 'CANCELLED' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Payment Cancelled
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                The checkout window was closed before completing the payment.
              </DialogDescription>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={onClose} className="rounded-xl border-border">
                Close
              </Button>
              <Button onClick={onRetry} className="rounded-xl bg-primary hover:bg-primary/90">
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
