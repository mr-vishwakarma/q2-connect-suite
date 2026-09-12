import React, { forwardRef } from 'react';
import { Building2, User, Bed, Calendar, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

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
      className={`relative w-full max-w-[360px] mx-auto rounded-3xl overflow-hidden p-6 text-white border border-red-500/30 shadow-[0_12px_40px_rgba(239,68,68,0.2)] bg-gradient-to-b from-[#180e14] via-[#10131c] to-[#0a0d14] select-none ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 100% 0%, rgba(225, 29, 72, 0.25) 0%, transparent 50%),
          radial-gradient(circle at 0% 100%, rgba(185, 28, 28, 0.2) 0%, transparent 60%),
          linear-gradient(180deg, #160e15 0%, #0e121a 45%, #080b11 100%)
        `
      }}
    >
      {/* Background Decorative Mesh Waves */}
      <div className="absolute inset-0 pointer-events-none opacity-25 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 360 520" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M-40 180 C80 140 160 260 380 190 L400 360 C260 420 120 310 -40 380 Z"
            fill="url(#red-glow-gradient)"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="red-glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Card Header */}
      <div className="relative z-10 flex items-start justify-between gap-2 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0 shadow-inner">
            <Building2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wider text-white uppercase leading-tight">
              {(hostel || 'Q2').toUpperCase()} HOSTEL
            </h4>
            <p className="text-[10px] text-zinc-400 font-medium tracking-wide">
              A Better Stay, A Brighter Tomorrow
            </p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-[10px] font-bold tracking-wider text-white uppercase shadow-md shadow-red-600/30">
          STUDENT
        </span>
      </div>

      {/* Student Photo */}
      <div className="relative z-10 flex flex-col items-center justify-center my-3">
        <div className="relative w-28 h-28 rounded-full p-1 ring-2 ring-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)] bg-gradient-to-tr from-red-600 via-pink-500 to-amber-500">
          <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 border-2 border-background flex items-center justify-center">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt={name || 'Student Photo'}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-zinc-950 flex flex-col items-center justify-center text-zinc-300">
                <User className="w-14 h-14 text-zinc-400 stroke-[1.5]" />
              </div>
            )}
          </div>
        </div>

        {/* Student Name & Email */}
        <div className="text-center mt-3">
          <h3 className="text-xl font-bold text-white tracking-tight leading-tight">
            {name || 'Karan Sharma'}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[280px]">
            {email || 'karan@example.com'}
          </p>
        </div>
      </div>

      {/* 4-Grid Key Details */}
      <div className="relative z-10 grid grid-cols-2 gap-2.5 my-4">
        {/* User ID */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-950/70 border border-red-500/30 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
              User ID
            </span>
            <span className="block text-xs font-bold text-white truncate">
              {username || 'karan123'}
            </span>
          </div>
        </div>

        {/* Room No */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-950/70 border border-red-500/30 flex items-center justify-center shrink-0">
            <Bed className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
              Room No.
            </span>
            <span className="block text-xs font-bold text-white truncate">
              {roomNo ? (roomNo.startsWith('Room ') ? roomNo : `${roomNo}`) : 'B-101'}
            </span>
          </div>
        </div>

        {/* Joining Date */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-950/70 border border-red-500/30 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
              Joining Date
            </span>
            <span className="block text-xs font-bold text-white truncate">
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Monthly Fees */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-950/70 border border-red-500/30 flex items-center justify-center shrink-0">
            <IndianRupee className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
              Monthly Fees
            </span>
            <span className="block text-xs font-bold text-white truncate">
              {formattedFees}
            </span>
          </div>
        </div>
      </div>

      {/* Barcode Section */}
      <div className="relative z-10 pt-2 pb-1 border-t border-white/5 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-[2px] h-8 w-full max-w-[240px] px-2 py-0.5 bg-black/30 rounded">
          {barcodePattern.map((width, idx) => (
            <div
              key={idx}
              className="h-full bg-zinc-200"
              style={{
                width: `${width * 1.5}px`,
                opacity: idx % 7 === 0 ? 0.4 : (idx % 3 === 0 ? 0.8 : 1)
              }}
            />
          ))}
        </div>
        <p className="font-mono text-[11px] font-semibold tracking-[0.25em] text-zinc-400 uppercase mt-1">
          {code}
        </p>
      </div>
    </div>
  );
});

StudentIDCard.displayName = 'StudentIDCard';
