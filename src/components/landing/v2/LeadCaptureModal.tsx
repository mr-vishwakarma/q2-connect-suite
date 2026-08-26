import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Building, Mail, Phone, User, Hash, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LeadCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeadCaptureModal({ isOpen, onClose }: LeadCaptureModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    hostelName: '',
    bedCount: '50-100 Beds',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.hostelName) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    // Simulate API lead booking submission
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const handleReset = () => {
    setIsSuccess(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      hostelName: '',
      bedCount: '50-100 Beds',
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-6 sm:p-8 z-10 overflow-hidden"
        >
          {/* Top highlight gradient */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 to-teal-500" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {!isSuccess ? (
            <div>
              <div className="text-left mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interactive Product Tour</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Experience Q2 in Action
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Schedule a personalized demo or start a 14-day free pilot for your hostel branch.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="name" className="text-xs font-semibold text-slate-700">Full Name *</Label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="name"
                      placeholder="e.g. Ramesh Reddy"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Business Email *</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="operator@hostel.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="phone"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="pl-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="hostelName" className="text-xs font-semibold text-slate-700">Hostel / PG Name *</Label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="hostelName"
                        placeholder="e.g. Q2 Luxury PG"
                        value={formData.hostelName}
                        onChange={(e) => setFormData({ ...formData, hostelName: e.target.value })}
                        className="pl-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="bedCount" className="text-xs font-semibold text-slate-700">Capacity</Label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        id="bedCount"
                        value={formData.bedCount}
                        onChange={(e) => setFormData({ ...formData, bedCount: e.target.value })}
                        className="w-full h-10 pl-9 pr-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="10-50 Beds">10 – 50 Beds</option>
                        <option value="50-100 Beds">50 – 100 Beds</option>
                        <option value="100-250 Beds">100 – 250 Beds</option>
                        <option value="250+ Beds">250+ Beds (Multi-Branch)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-600/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scheduling Demo...
                    </>
                  ) : (
                    'Schedule Guided Walkthrough'
                  )}
                </Button>
              </form>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Demo Scheduled!</h3>
              <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
                Thank you, <span className="font-semibold text-slate-900">{formData.name}</span>. Our hospitality tech specialist will connect with you at <span className="font-semibold text-slate-900">{formData.phone}</span> within 2 hours.
              </p>
              <Button
                onClick={handleReset}
                className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl px-8"
              >
                Back to Platform
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
