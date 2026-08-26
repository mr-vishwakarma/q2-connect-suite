import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  BedDouble,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  Phone,
  Shield,
  Home,
  Sparkles,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { ResidentAvatar, StudentStatus } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const MOCK_RESIDENTS: ResidentAvatar[] = [
  { id: '1', name: 'Ananya Sharma', room: 'A-204', floor: '2nd Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Priya Nair', 'Sneha Rao'], course: 'B.Tech CSE', phone: '+91 98450 11223' },
  { id: '2', name: 'Priya Nair', room: 'A-204', floor: '2nd Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Ananya Sharma', 'Sneha Rao'], course: 'MBA Fin', phone: '+91 98450 11224' },
  { id: '3', name: 'Sneha Rao', room: 'A-204', floor: '2nd Floor', feeAmount: 8500, status: 'pending', deposit: 10000, roommates: ['Ananya Sharma', 'Priya Nair'], course: 'B.Des', phone: '+91 98450 11225' },
  { id: '4', name: 'Kajal Verma', room: 'B-101', floor: '1st Floor', feeAmount: 9000, status: 'paid', deposit: 12000, roommates: ['Riya Kapoor'], course: 'MBBS', phone: '+91 98450 11226' },
  { id: '5', name: 'Riya Kapoor', room: 'B-101', floor: '1st Floor', feeAmount: 9000, status: 'overdue', deposit: 12000, roommates: ['Kajal Verma'], course: 'B.Arch', phone: '+91 98450 11227' },
  { id: '6', name: 'Aarushi Patel', room: 'A-102', floor: '1st Floor', feeAmount: 7500, status: 'paid', deposit: 10000, roommates: ['Tanvi Desai', 'Meera Joshi'], course: 'B.Com', phone: '+91 98450 11228' },
  { id: '7', name: 'Tanvi Desai', room: 'A-102', floor: '1st Floor', feeAmount: 7500, status: 'upcoming', deposit: 10000, roommates: ['Aarushi Patel', 'Meera Joshi'], course: 'BCA', phone: '+91 98450 11229' },
  { id: '8', name: 'Meera Joshi', room: 'A-102', floor: '1st Floor', feeAmount: 7500, status: 'paid', deposit: 10000, roommates: ['Aarushi Patel', 'Tanvi Desai'], course: 'BBA', phone: '+91 98450 11230' },
  { id: '9', name: 'Divya Reddy', room: 'C-305', floor: '3rd Floor', feeAmount: 11000, status: 'paid', deposit: 15000, roommates: ['Pooja Hegde'], course: 'M.Tech AI', phone: '+91 98450 11231' },
  { id: '10', name: 'Pooja Hegde', room: 'C-305', floor: '3rd Floor', feeAmount: 11000, status: 'pending', deposit: 15000, roommates: ['Divya Reddy'], course: 'MCA', phone: '+91 98450 11232' },
  { id: '11', name: 'Nandini Das', room: 'B-202', floor: '2nd Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Isha Singhania'], course: 'B.Tech ECE', phone: '+91 98450 11233' },
  { id: '12', name: 'Isha Singhania', room: 'B-202', floor: '2nd Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Nandini Das'], course: 'BA Psych', phone: '+91 98450 11234' },
  { id: '13', name: 'Kavya Menon', room: 'A-301', floor: '3rd Floor', feeAmount: 8000, status: 'overdue', deposit: 10000, roommates: ['Swati Sen'], course: 'B.Sc Data', phone: '+91 98450 11235' },
  { id: '14', name: 'Swati Sen', room: 'A-301', floor: '3rd Floor', feeAmount: 8000, status: 'paid', deposit: 10000, roommates: ['Kavya Menon'], course: 'B.Pharma', phone: '+91 98450 11236' },
  { id: '15', name: 'Zoya Khan', room: 'B-104', floor: '1st Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Shruti Gupta', 'Radhika Rao'], course: 'B.Tech IT', phone: '+91 98450 11237' },
  { id: '16', name: 'Shruti Gupta', room: 'B-104', floor: '1st Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Zoya Khan', 'Radhika Rao'], course: 'LLB', phone: '+91 98450 11238' },
  { id: '17', name: 'Radhika Rao', room: 'B-104', floor: '1st Floor', feeAmount: 8500, status: 'upcoming', deposit: 10000, roommates: ['Zoya Khan', 'Shruti Gupta'], course: 'B.Sc Bio', phone: '+91 98450 11239' },
  { id: '18', name: 'Lavanya M.', room: 'C-201', floor: '2nd Floor', feeAmount: 9500, status: 'paid', deposit: 12000, roommates: ['Bhavna Seth'], course: 'CA Final', phone: '+91 98450 11240' },
  { id: '19', name: 'Bhavna Seth', room: 'C-201', floor: '2nd Floor', feeAmount: 9500, status: 'pending', deposit: 12000, roommates: ['Lavanya M.'], course: 'CA Inter', phone: '+91 98450 11241' },
  { id: '20', name: 'Simran Kaur', room: 'A-105', floor: '1st Floor', feeAmount: 8000, status: 'paid', deposit: 10000, roommates: ['Nikita Jain'], course: 'B.Tech AI', phone: '+91 98450 11242' },
  { id: '21', name: 'Nikita Jain', room: 'A-105', floor: '1st Floor', feeAmount: 8000, status: 'paid', deposit: 10000, roommates: ['Simran Kaur'], course: 'B.Sc Math', phone: '+91 98450 11243' },
  { id: '22', name: 'Aditi Sundaram', room: 'B-303', floor: '3rd Floor', feeAmount: 8500, status: 'overdue', deposit: 10000, roommates: ['Deepika M.'], course: 'MA Eng', phone: '+91 98450 11244' },
  { id: '23', name: 'Deepika M.', room: 'B-303', floor: '3rd Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Aditi Sundaram'], course: 'B.Ed', phone: '+91 98450 11245' },
  { id: '24', name: 'Shreya Ghosh', room: 'C-102', floor: '1st Floor', feeAmount: 10000, status: 'paid', deposit: 15000, roommates: ['Kriti Sanon'], course: 'B.Tech Mech', phone: '+91 98450 11246' },
  { id: '25', name: 'Kriti Sanon', room: 'C-102', floor: '1st Floor', feeAmount: 10000, status: 'paid', deposit: 15000, roommates: ['Shreya Ghosh'], course: 'BBA Fin', phone: '+91 98450 11247' },
  { id: '26', name: 'Mansi Tiwari', room: 'A-206', floor: '2nd Floor', feeAmount: 7500, status: 'upcoming', deposit: 10000, roommates: ['Rashmi Sen'], course: 'B.Com', phone: '+91 98450 11248' },
  { id: '27', name: 'Rashmi Sen', room: 'A-206', floor: '2nd Floor', feeAmount: 7500, status: 'paid', deposit: 10000, roommates: ['Mansi Tiwari'], course: 'BCA', phone: '+91 98450 11249' },
  { id: '28', name: 'Neha Chawla', room: 'B-205', floor: '2nd Floor', feeAmount: 8500, status: 'paid', deposit: 10000, roommates: ['Garima S.'], course: 'B.Tech Civil', phone: '+91 98450 11250' },
  { id: '29', name: 'Garima S.', room: 'B-205', floor: '2nd Floor', feeAmount: 8500, status: 'pending', deposit: 10000, roommates: ['Neha Chawla'], course: 'B.Sc Phys', phone: '+91 98450 11251' },
  { id: '30', name: 'Harini Roy', room: 'C-301', floor: '3rd Floor', feeAmount: 9000, status: 'paid', deposit: 12000, roommates: ['Tara Alva'], course: 'MBBS 2nd', phone: '+91 98450 11252' },
  { id: '31', name: 'Tara Alva', room: 'C-301', floor: '3rd Floor', feeAmount: 9000, status: 'paid', deposit: 12000, roommates: ['Harini Roy'], course: 'B.Des Fashion', phone: '+91 98450 11253' },
  { id: '32', name: 'Ishita Bansal', room: 'A-108', floor: '1st Floor', feeAmount: 8000, status: 'paid', deposit: 10000, roommates: ['Kavita K.'], course: 'B.Tech IT', phone: '+91 98450 11254' },
];

export function HeroProductScene() {
  const [selectedStudent, setSelectedStudent] = useState<ResidentAvatar | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | StudentStatus>('all');
  const [hoveredStudent, setHoveredStudent] = useState<ResidentAvatar | null>(null);

  const filteredResidents = activeFilter === 'all'
    ? MOCK_RESIDENTS
    : MOCK_RESIDENTS.filter((r) => r.status === activeFilter);

  const getStatusColor = (status: StudentStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500 text-white border-emerald-300 ring-emerald-100';
      case 'pending':
        return 'bg-rose-500 text-white border-rose-300 ring-rose-100';
      case 'overdue':
        return 'bg-amber-500 text-white border-amber-300 ring-amber-100';
      case 'upcoming':
        return 'bg-blue-500 text-white border-blue-300 ring-blue-100';
    }
  };

  const getStatusBadge = (status: StudentStatus) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">✓ Paid</Badge>;
      case 'pending':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-semibold">× Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold">! Overdue</Badge>;
      case 'upcoming':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">→ Upcoming</Badge>;
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.08)] p-4 sm:p-6 lg:p-8 overflow-hidden text-left">
      {/* Top ambient soft glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-purple-100/60 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-32 bg-teal-100/50 blur-3xl pointer-events-none" />

      {/* Dashboard Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Q2 Connect Control Console</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500">Gachibowli Campus • Branch 01 (Women's Wing)</p>
          </div>
        </div>

        {/* Quick KPI meters */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-4">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Students</span>
            <span className="text-sm font-extrabold text-slate-900">248 <span className="text-[10px] text-slate-400 font-normal">Active</span></span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Occupancy</span>
            <span className="text-sm font-extrabold text-emerald-600">92.4%</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Collection Rate</span>
            <span className="text-sm font-extrabold text-purple-600">87.6%</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] text-slate-500 font-semibold uppercase block">Pending Fees</span>
            <span className="text-sm font-extrabold text-rose-600">₹1.24L</span>
          </div>
        </div>
      </div>

      {/* Signature Feature: Live Student Fee Matrix Map */}
      <div className="pt-6 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Live Student Fee Matrix</h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual resident roster map. Hover for quick glance or click to inspect full student ledger.
            </p>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All ({MOCK_RESIDENTS.length})
            </button>
            <button
              onClick={() => setActiveFilter('paid')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                activeFilter === 'paid'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Paid (22)
            </button>
            <button
              onClick={() => setActiveFilter('pending')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                activeFilter === 'pending'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              Pending (4)
            </button>
            <button
              onClick={() => setActiveFilter('overdue')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                activeFilter === 'overdue'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Overdue (3)
            </button>
            <button
              onClick={() => setActiveFilter('upcoming')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                activeFilter === 'upcoming'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              Upcoming (3)
            </button>
          </div>
        </div>

        {/* Matrix Circle Grid Container */}
        <div className="relative p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-11 gap-2 sm:gap-2.5">
            {filteredResidents.map((res) => {
              const isSelected = selectedStudent?.id === res.id;
              const initials = res.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2);

              return (
                <div key={res.id} className="relative group flex items-center justify-center">
                  <button
                    onClick={() => setSelectedStudent(res)}
                    onMouseEnter={() => setHoveredStudent(res)}
                    onMouseLeave={() => setHoveredStudent(null)}
                    className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-150 shadow-sm ring-2 ${getStatusColor(
                      res.status
                    )} ${
                      isSelected
                        ? 'scale-110 ring-4 ring-purple-600 ring-offset-2 z-20'
                        : 'hover:scale-105 hover:shadow-md'
                    }`}
                    aria-label={`Student ${res.name}, Room ${res.room}, Status ${res.status}`}
                  >
                    <span>{initials}</span>

                    {/* Status small dot indicator */}
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          res.status === 'paid'
                            ? 'bg-emerald-500'
                            : res.status === 'pending'
                            ? 'bg-rose-500'
                            : res.status === 'overdue'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                    </span>
                  </button>

                  {/* Micro Tooltip on Hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 whitespace-nowrap">
                    <div className="bg-slate-900 text-white rounded-xl px-3 py-1.5 shadow-xl border border-slate-700 text-left text-xs">
                      <p className="font-bold">{res.name}</p>
                      <p className="text-[10px] text-slate-300">
                        Room {res.room} • ₹{res.feeAmount.toLocaleString('en-IN')} ({res.status.toUpperCase()})
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matrix Legend Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-200/60 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Paid (✓)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Pending (×)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Overdue (!)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Upcoming (→)</span>
              </span>
            </div>
            <span className="text-[11px] text-purple-600 font-semibold">Click any avatar to inspect profile</span>
          </div>
        </div>
      </div>

      {/* Interactive Student Ledger Inspector Modal / Panel */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-purple-50/50 via-white to-slate-50 border border-purple-200/80 shadow-md relative"
          >
            <button
              onClick={() => setSelectedStudent(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm ${getStatusColor(selectedStudent.status)}`}>
                  {selectedStudent.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-slate-900">{selectedStudent.name}</h4>
                    {getStatusBadge(selectedStudent.status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedStudent.course} • Room {selectedStudent.room} ({selectedStudent.floor})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Monthly Rent</span>
                  <span className="text-base font-black text-slate-900">₹{selectedStudent.feeAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right pl-3 border-l border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Security Deposit</span>
                  <span className="text-base font-black text-purple-700">₹{selectedStudent.deposit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Roommates</span>
                <p className="font-semibold text-slate-800">{selectedStudent.roommates.join(', ')}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">Contact Phone</span>
                <p className="font-semibold text-slate-800 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {selectedStudent.phone}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Gate Pass Status</span>
                  <span className="font-semibold text-emerald-600">Checked In (Campus)</span>
                </div>
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Verified</Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
