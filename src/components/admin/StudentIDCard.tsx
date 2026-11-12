import React, { forwardRef } from 'react';
import { Building2, User, Bed, Calendar, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { getAvatarUrl } from '@/utils/imageUtils';

export interface StudentIDCardProps {
  name: string;
  email: string;
  username: string;
  roomNo: string;
  hostel: string;
  fees: string | number;
  startDate?: Date | string | null;
  profilePhoto?: string | null;
  studentCode?: string;
  className?: string;
}

export const StudentIDCard = forwardRef<HTMLDivElement, StudentIDCardProps>(({
  name,
  email,
  username,
  roomNo,
  hostel = 'Q2',
  fees,
  startDate,
  profilePhoto,
  studentCode,
  className = '',
}, ref) => {
  // Format formatted joining date: e.g. "11 Sep 2026"
  let formattedDate = 'Not set';
  if (startDate) {
    try {
      const d = typeof startDate === 'string' ? new Date(startDate) : startDate;
      formattedDate = format(d, 'dd MMM yyyy');
    } catch {
      formattedDate = String(startDate);
    }
  }

  // Format fees with currency comma formatting: e.g. "₹5,000"
  const numericFees = typeof fees === 'string' ? parseFloat(fees) || 0 : fees || 0;
  const formattedFees = `₹${numericFees.toLocaleString('en-IN')}`;

  // Default barcode code
  const code = studentCode || `${(hostel || 'Q2').toUpperCase().replace(/[^A-Z0-9]/g, '')}S${new Date().getFullYear()}${String(username || '001').slice(-3).padStart(3, '0').toUpperCase()}`;

  // Barcode lines pattern (repeating realistic varying line widths)
  const barcodePattern = [2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2];

  return (
    <div
      ref={ref}
      id="student-id-card-element"
      className={`relative w-full max-w-[340px] sm:max-w-[360px] mx-auto rounded-3xl overflow-hidden p-4 sm:p-6 text-[#F0EFF8] border border-[rgba(167,139,250,0.3)] shadow-[0_14px_40px_rgba(167,139,250,0.2)] bg-gradient-to-b from-[#171928] via-[#121522] to-[#0B0D15] select-none ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 100% 0%, rgba(237, 145, 193, 0.22) 0%, transparent 50%),
          radial-gradient(circle at 0% 100%, rgba(167, 139, 250, 0.24) 0%, transparent 60%),
          linear-gradient(180deg, #171928 0%, #111320 45%, #090B12 100%)
        `
      }}
    >
      {/* Background Decorative Mesh Waves */}
      <div className="absolute inset-0 pointer-events-none opacity-25 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 360 520" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M-40 180 C80 140 160 260 380 190 L400 360 C260 420 120 310 -40 380 Z"
            fill="url(#hosteliq-glow-gradient)"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="hosteliq-glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#ED91C1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Card Header */}
      <div className="relative z-10 flex items-start justify-between gap-2 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#A78BFA]/15 border border-[#A78BFA]/30 flex items-center justify-center text-[#A78BFA] shrink-0 shadow-inner">
            <Building2 className="w-5 h-5 text-[#A78BFA]" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wider text-[#F0EFF8] uppercase leading-tight">
              {(hostel || 'Q2').toUpperCase()} HOSTEL
            </h4>
            <p className="text-[10px] text-[#9295AD] font-medium tracking-wide">
              A Better Stay, A Brighter Tomorrow
            </p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#A78BFA] to-[#818CF8] text-[10px] font-bold tracking-wider text-white uppercase shadow-md shadow-[#A78BFA]/25">
          STUDENT
        </span>
      </div>

      {/* Student Photo */}
      <div className="relative z-10 flex flex-col items-center justify-center my-3">
        <div className="relative w-28 h-28 rounded-full p-1 ring-2 ring-[#A78BFA]/70 shadow-[0_0_24px_rgba(167,139,250,0.35)] bg-gradient-to-tr from-[#A78BFA] via-[#ED91C1] to-[#74DCCB]">
          <div className="w-full h-full rounded-full overflow-hidden bg-[#151722] border-2 border-[#090B12] flex items-center justify-center">
            {profilePhoto ? (
              <img
                src={getAvatarUrl(profilePhoto, 224)}
                alt={name || 'Student Photo'}
                width={112}
                height={112}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-[#1E2133] to-[#111320] flex flex-col items-center justify-center text-[#9295AD]">
                <User className="w-14 h-14 text-[#9295AD] stroke-[1.5]" />
              </div>
            )}
          </div>
        </div>

        {/* Student Name & Email */}
        <div className="text-center mt-3">
          <h3 className="text-xl font-bold text-[#F0EFF8] tracking-tight leading-tight">
            {name || 'Karan Sharma'}
          </h3>
          <p className="text-xs text-[#9295AD] mt-0.5 truncate max-w-[280px]">
            {email || 'karan@example.com'}
          </p>
        </div>
      </div>

      {/* 4-Grid Key Details */}
      <div className="relative z-10 grid grid-cols-2 gap-2.5 my-4">
        {/* User ID */}
        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/15 border border-[#A78BFA]/30 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#A78BFA]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-[#9295AD] uppercase tracking-wider">
              User ID
            </span>
            <span className="block text-xs font-bold text-[#F0EFF8] truncate">
              {username || 'karan123'}
            </span>
          </div>
        </div>

        {/* Room No */}
        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#ED91C1]/15 border border-[#ED91C1]/30 flex items-center justify-center shrink-0">
            <Bed className="w-4 h-4 text-[#ED91C1]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-[#9295AD] uppercase tracking-wider">
              Room No.
            </span>
            <span className="block text-xs font-bold text-[#F0EFF8] truncate">
              {roomNo && roomNo !== 'Not assigned' ? (roomNo.startsWith('Room ') ? roomNo : `Room ${roomNo}`) : 'Not Assigned'}
            </span>
          </div>
        </div>

        {/* Joining Date */}
        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#74DCCB]/15 border border-[#74DCCB]/30 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-[#74DCCB]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-[#9295AD] uppercase tracking-wider">
              Joining Date
            </span>
            <span className="block text-xs font-bold text-[#F0EFF8] truncate">
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Monthly Fees */}
        <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/15 border border-[#A78BFA]/30 flex items-center justify-center shrink-0">
            <IndianRupee className="w-4 h-4 text-[#A78BFA]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-[#9295AD] uppercase tracking-wider">
              Monthly Fees
            </span>
            <span className="block text-xs font-bold text-[#F0EFF8] truncate">
              {formattedFees}
            </span>
          </div>
        </div>
      </div>

      {/* Barcode Section */}
      <div className="relative z-10 pt-2 pb-1 border-t border-white/[0.08] flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-[2px] h-8 w-full max-w-[240px] px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded">
          {barcodePattern.map((width, idx) => (
            <div
              key={idx}
              className="h-full bg-[#F0EFF8]"
              style={{
                width: `${width * 1.5}px`,
                opacity: idx % 7 === 0 ? 0.4 : (idx % 3 === 0 ? 0.8 : 1)
              }}
            />
          ))}
        </div>
        <p className="font-mono text-[11px] font-semibold tracking-[0.25em] text-[#9295AD] uppercase mt-1">
          {code}
        </p>
      </div>
    </div>
  );
});

StudentIDCard.displayName = 'StudentIDCard';
