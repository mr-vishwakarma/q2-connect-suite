import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'react-toastify';
import { getErrorMessage } from '@/utils/errorHandling';

interface FormData {
  fullName: string;
  workEmail: string;
  contactNumber: string;
  hostelName: string;
  city: string;
  state: string;
  hostelType: string;
  approxBeds: string;
  message: string;
  hp_website: string; // Honeypot field for bot protection
}

const INITIAL_FORM: FormData = {
  fullName: '',
  workEmail: '',
  contactNumber: '',
  hostelName: '',
  city: '',
  state: '',
  hostelType: '',
  approxBeds: '',
  message: '',
  hp_website: '',
};

export default function ConnectWithUs() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEnquiryId, setSubmittedEnquiryId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    document.title = "Connect With Us — Hostel IQ";
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError(null);
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.workEmail.trim()) {
      newErrors.workEmail = 'Work email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.workEmail.trim())) {
      newErrors.workEmail = 'Please provide a valid work email address';
    }

    const cleanedPhone = formData.contactNumber.replace(/[\s().-]/g, '');
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (!/^\+?[0-9]{7,15}$/.test(cleanedPhone)) {
      newErrors.contactNumber = 'Enter a valid contact number (7-15 digits)';
    }

    if (!formData.hostelName.trim()) {
      newErrors.hostelName = 'Hostel or organization name is required';
    } else if (formData.hostelName.trim().length < 2) {
      newErrors.hostelName = 'Hostel name must be at least 2 characters';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.hostelType) {
      newErrors.hostelType = 'Please select your hostel type';
    }

    if (!formData.approxBeds) {
      newErrors.approxBeds = 'Please select your approximate bed capacity';
    }

    if (formData.message && formData.message.trim().length > 2000) {
      newErrors.message = 'Message cannot exceed 2000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const response = await api.post('/enquiries', {
        fullName: formData.fullName.trim(),
        workEmail: formData.workEmail.trim().toLowerCase(),
        contactNumber: formData.contactNumber.trim(),
        hostelName: formData.hostelName.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        hostelType: formData.hostelType,
        approxBeds: formData.approxBeds,
        message: formData.message.trim(),
        hp_website: formData.hp_website,
      });

      setIsSubmitting(false);

      if (response.data?.success) {
        setSubmittedEnquiryId(response.data?.data?.enquiryId || 'CONFIRMED');
        toast.success('Thank you! Your enquiry has been received.', { toastId: 'connect-success' });
      } else {
        const msg = response.data?.message || 'Failed to submit enquiry. Please try again.';
        setServerError(msg);
        toast.error(msg, { toastId: 'connect-error' });
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = getErrorMessage(
        err,
        'Unable to submit enquiry. Please verify your connection and try again.'
      );
      setServerError(msg);
      toast.error(msg, { toastId: 'connect-error' });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#08090d] text-white flex flex-col justify-between selection:bg-rose-500/30 relative overflow-x-hidden">
      {/* Background Ambient Lighting */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 w-[400px] sm:w-[650px] h-[400px] sm:h-[650px] bg-gradient-to-br from-rose-600/[0.14] via-red-600/[0.04] to-transparent blur-[100px] sm:blur-[130px] rounded-full"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-40 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-gradient-to-bl from-purple-600/[0.14] via-indigo-600/[0.04] to-transparent blur-[110px] sm:blur-[140px] rounded-full"
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none"
          aria-label="Hostel IQ Home"
        >
          <img
            src="/hosteliq-logo.png"
            alt="Hostel IQ"
            width={48}
            height={48}
            className="h-9 sm:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <span className="font-extrabold text-base sm:text-xl text-white tracking-tight">
            Hostel IQ
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white transition-all duration-200"
          >
            <span>Login</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-3 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-[760px] mx-auto">
          {submittedEnquiryId ? (
            /* =========================================================================
               SUCCESS STATE: Celebratory Confirmation Card
               ========================================================================= */
            <div className="relative rounded-[28px] xs:rounded-[32px] sm:rounded-[38px] bg-[#12131d]/90 backdrop-blur-2xl border border-white/[0.12] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] p-6 sm:p-12 text-center overflow-hidden">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 bg-gradient-to-br from-emerald-500/20 to-transparent blur-3xl rounded-full"
                aria-hidden="true"
              />

              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                Thank you for connecting with Hosteliq.
              </h1>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-lg mx-auto mb-6">
                Your enquiry has been received successfully. Our team will get in touch using the contact details you provided to help you explore Hosteliq.
              </p>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-400 mb-8">
                <span>Reference ID:</span>
                <strong className="text-zinc-200">{submittedEnquiryId}</strong>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto flex-1 h-12 rounded-full bg-gradient-to-r from-[#ff4d5a] to-[#ff2a5f] hover:from-[#ff5e6a] hover:to-[#ff3a6d] text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(255,75,90,0.4)] flex items-center justify-center gap-2"
                >
                  <span>Return to Home</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto flex-1 h-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white font-semibold text-sm transition-all flex items-center justify-center"
                >
                  Sign in to Portal
                </button>
              </div>
            </div>
          ) : (
            /* =========================================================================
               INITIAL / FORM STATE: Premium Glassmorphic Enquiry Form
               ========================================================================= */
            <div className="relative rounded-[28px] xs:rounded-[32px] sm:rounded-[38px] bg-[#12131d]/90 backdrop-blur-2xl border border-white/[0.12] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] p-5 xs:p-7 sm:p-10 md:p-12 overflow-hidden">
              {/* Specular top border reflection highlight */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                aria-hidden="true"
              />

              {/* Internal ambient corner highlights */}
              <div
                className="pointer-events-none absolute -top-16 -left-16 w-52 h-52 bg-gradient-to-br from-rose-500/20 to-transparent blur-3xl rounded-full"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-16 -right-16 w-52 h-52 bg-gradient-to-tl from-purple-600/15 to-transparent blur-3xl rounded-full"
                aria-hidden="true"
              />

              {/* Heading & Subheading */}
              <div className="text-center mb-6 sm:mb-8 relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] sm:text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span>Hostel Partnership & Platform Demo</span>
                </div>
                <h1 className="text-2xl xs:text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Let's Connect.
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-lg mx-auto leading-relaxed">
                  Tell us a little about your hostel. Our team will get in touch to help you explore Hosteliq.
                </p>
              </div>

              {/* Server-level error banner */}
              {serverError && (
                <div className="mb-6 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Enquiry Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-left relative z-10" noValidate>
                {/* Honeypot hidden trap field for bots */}
                <input
                  type="text"
                  name="hp_website"
                  value={formData.hp_website}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  style={{ display: 'none' }}
                />

                {/* Row 1: Full Name & Work Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-fullName" className="text-xs font-medium text-zinc-300 block">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="connect-fullName"
                        name="fullName"
                        type="text"
                        placeholder="e.g. Rajesh Kumar"
                        value={formData.fullName}
                        onChange={handleChange}
                        autoComplete="name"
                        required
                        className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                          errors.fullName
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                        }`}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  {/* Work Email Address */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-workEmail" className="text-xs font-medium text-zinc-300 block">
                      Work Email Address <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="connect-workEmail"
                        name="workEmail"
                        type="email"
                        placeholder="e.g. rajesh@greenwoodhostels.com"
                        value={formData.workEmail}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                        className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                          errors.workEmail
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                        }`}
                      />
                    </div>
                    {errors.workEmail && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.workEmail}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2: Contact Number & Hostel/Org Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact Number */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-contactNumber" className="text-xs font-medium text-zinc-300 block">
                      Contact Number <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="connect-contactNumber"
                        name="contactNumber"
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={formData.contactNumber}
                        onChange={handleChange}
                        autoComplete="tel"
                        required
                        className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                          errors.contactNumber
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                        }`}
                      />
                    </div>
                    {errors.contactNumber && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.contactNumber}</span>
                      </p>
                    )}
                  </div>

                  {/* Hostel / Organization Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-hostelName" className="text-xs font-medium text-zinc-300 block">
                      Hostel / Organization Name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="connect-hostelName"
                        name="hostelName"
                        type="text"
                        placeholder="e.g. Greenwood Living"
                        value={formData.hostelName}
                        onChange={handleChange}
                        required
                        className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                          errors.hostelName
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                        }`}
                      />
                    </div>
                    {errors.hostelName && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.hostelName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 3: City and State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* City */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-city" className="text-xs font-medium text-zinc-300 block">
                      City <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="connect-city"
                      name="city"
                      type="text"
                      placeholder="e.g. Pune"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                        errors.city
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                          : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                      }`}
                    />
                    {errors.city && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.city}</span>
                      </p>
                    )}
                  </div>

                  {/* State */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-state" className="text-xs font-medium text-zinc-300 block">
                      State <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="connect-state"
                      name="state"
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all ${
                        errors.state
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                          : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                      }`}
                    />
                    {errors.state && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.state}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 4: Hostel Type & Approximate Beds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hostel Type */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-hostelType" className="text-xs font-medium text-zinc-300 block">
                      Hostel Type <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="connect-hostelType"
                        name="hostelType"
                        value={formData.hostelType}
                        onChange={handleChange}
                        required
                        className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white outline-none transition-all appearance-none cursor-pointer ${
                          errors.hostelType
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                        }`}
                      >
                        <option value="" disabled className="bg-[#181926] text-zinc-500">
                          Select Hostel Type
                        </option>
                        <option value="Boys Hostel" className="bg-[#181926] text-white">
                          Boys Hostel
                        </option>
                        <option value="Girls Hostel" className="bg-[#181926] text-white">
                          Girls Hostel
                        </option>
                        <option value="Co-living" className="bg-[#181926] text-white">
                          Co-living
                        </option>
                        <option value="Other" className="bg-[#181926] text-white">
                          Other
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                        ▼
                      </div>
                    </div>
                    {errors.hostelType && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.hostelType}</span>
                      </p>
                    )}
                  </div>

                  {/* Approximate Number of Beds */}
                  <div className="space-y-1.5">
                    <label htmlFor="connect-approxBeds" className="text-xs font-medium text-zinc-300 block">
                      Approximate Bed Capacity <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="connect-approxBeds"
                        name="approxBeds"
                        value={formData.approxBeds}
                        onChange={handleChange}
                        required
                        className={`w-full h-12 px-4 rounded-2xl bg-[#181926]/90 border text-xs sm:text-sm text-white outline-none transition-all appearance-none cursor-pointer ${
                          errors.approxBeds
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15'
                        }`}
                      >
                        <option value="" disabled className="bg-[#181926] text-zinc-500">
                          Select Bed Range
                        </option>
                        <option value="Under 50" className="bg-[#181926] text-white">
                          Under 50
                        </option>
                        <option value="50–100" className="bg-[#181926] text-white">
                          50–100
                        </option>
                        <option value="101–250" className="bg-[#181926] text-white">
                          101–250
                        </option>
                        <option value="251–500" className="bg-[#181926] text-white">
                          251–500
                        </option>
                        <option value="Above 500" className="bg-[#181926] text-white">
                          Above 500
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                        ▼
                      </div>
                    </div>
                    {errors.approxBeds && (
                      <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.approxBeds}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 5: Additional Message / Requirements */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="connect-message" className="text-xs font-medium text-zinc-300 block">
                      Additional Message / Requirements (Optional)
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formData.message.length} / 2000
                    </span>
                  </div>
                  <textarea
                    id="connect-message"
                    name="message"
                    rows={3}
                    maxLength={2000}
                    placeholder="Tell us about your property goals, specific branch locations, or timeline..."
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full p-4 rounded-2xl bg-[#181926]/90 border border-white/[0.08] focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15 text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-all resize-y min-h-[80px]"
                  />
                  {errors.message && (
                    <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.message}</span>
                    </p>
                  )}
                </div>

                {/* Helper text & Privacy Notice */}
                <div className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  Our team will review your enquiry and contact you using the details provided. By submitting, you agree to our{' '}
                  <button
                    type="button"
                    onClick={() => setLegalModal('terms')}
                    className="text-rose-400 hover:underline focus:outline-none focus:underline cursor-pointer"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="text-rose-400 hover:underline focus:outline-none focus:underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </div>

                {/* CTA Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 sm:h-13 rounded-full font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-[#ff4d5a] to-[#ff2a5f] hover:from-[#ff5e6a] hover:to-[#ff3a6d] shadow-[0_0_22px_rgba(255,75,90,0.45)] hover:shadow-[0_0_28px_rgba(255,75,90,0.65)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending Enquiry...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>Send Enquiry</span>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Subtle Bottom Bar */}
      <footer className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-zinc-500">
        Hostel IQ &copy; {new Date().getFullYear()} &mdash; Enterprise Hostel Management Cloud Platform
      </footer>

      <Dialog
        open={legalModal !== null}
        onOpenChange={(open) => {
          if (!open) setLegalModal(null);
        }}
      >
        <DialogContent className="bg-[#12131d] border border-white/[0.12] text-zinc-100 max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              {legalModal === 'terms' ? 'Hostel IQ Terms of Service' : 'Hostel IQ Privacy Policy'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              {legalModal === 'terms'
                ? 'Enterprise onboarding and platform evaluation terms'
                : 'How we protect and handle your enquiry information'}
            </DialogDescription>
          </DialogHeader>
          {legalModal === 'terms' ? (
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                Submitting this form initiates a consultative onboarding and platform evaluation conversation with the Hosteliq team. No financial obligation or paid subscription is created until an authorized administrator completes tenant provisioning and plan activation.
              </p>
              <p>
                You confirm that the property and contact information provided is accurate and that you are authorized to enquire on behalf of your hostel or accommodation organization.
              </p>
              <p>
                Tenant workspaces, resident data isolation, and billing entitlements are governed by your selected Hosteliq service plan upon account activation.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                We collect your name, work email, contact number, and hostel details solely to respond to your onboarding enquiry, schedule demos, and assist with setting up your Hosteliq workspace.
              </p>
              <p>
                Enquiry submissions are stored securely within Hosteliq infrastructure and are never sold or shared with third-party data brokers.
              </p>
              <p>
                To update or request deletion of your enquiry details at any time, contact our support team at support@mrvishwakarma.in.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
