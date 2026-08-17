import React from 'react';
import { motion } from 'framer-motion';
import { Building2, User, CheckCircle2, Clock, AlertTriangle, Calendar, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type FeeStatusType = 'paid' | 'pending' | 'overdue' | 'upcoming';

export interface MatrixStudentRecord {
  student: {
    id: string;
    user_id: string;
    name: string;
    username: string;
    room_no: string | null;
    floor?: string | null;
    profile_photo?: string | null;
    fees: number | null;
    start_date: string | null;
    valid_date: string | null;
    parent_phone?: string | null;
  };
  currentFee?: any;
  isExpired: boolean;
  pending: number;
  status: FeeStatusType;
  dueDate?: string | null;
}

interface StudentFeeMatrixProps {
  records: MatrixStudentRecord[];
  onSelectStudent: (student: MatrixStudentRecord['student']) => void;
  selectedMonth: string;
}

// Smart floor extractor
export function extractFloor(roomNo: string | null | undefined, explicitFloor?: string | null): string {
  if (explicitFloor && explicitFloor.trim()) {
    return explicitFloor.trim();
  }
  if (!roomNo) return 'Unassigned';

  const clean = roomNo.trim().toUpperCase();
  if (clean.startsWith('G') || clean.startsWith('0') || clean.includes('GROUND')) {
    return 'Ground Floor';
  }
  if (clean.startsWith('F') || clean.startsWith('1') || clean.includes('1ST') || clean.includes('FIRST')) {
    return 'First Floor';
  }
  if (clean.startsWith('S') || clean.startsWith('2') || clean.includes('2ND') || clean.includes('SECOND')) {
    return 'Second Floor';
  }
  if (clean.startsWith('T') || clean.startsWith('3') || clean.includes('3RD') || clean.includes('THIRD')) {
    return 'Third Floor';
  }
  if (clean.startsWith('4') || clean.includes('4TH') || clean.includes('FOURTH')) {
    return 'Fourth Floor';
  }
  if (clean.startsWith('5') || clean.includes('5TH') || clean.includes('FIFTH')) {
    return 'Fifth Floor';
  }
  if (clean.startsWith('6') || clean.includes('6TH') || clean.includes('SIXTH')) {
    return 'Sixth Floor';
  }

  // Extract first digit if room is like "104", "204", "305"
  const digitMatch = clean.match(/\d/);
  if (digitMatch) {
    const digit = digitMatch[0];
    if (digit === '0') return 'Ground Floor';
    if (digit === '1') return 'First Floor';
    if (digit === '2') return 'Second Floor';
    if (digit === '3') return 'Third Floor';
    if (digit === '4') return 'Fourth Floor';
    if (digit === '5') return 'Fifth Floor';
  }

  return 'General Floor';
}

const FLOOR_ORDER = [
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Fifth Floor',
  'Sixth Floor',
  'General Floor',
  'Unassigned',
];

export function StudentFeeMatrix({ records, onSelectStudent, selectedMonth }: StudentFeeMatrixProps) {
  // Group records by floor
  const floorGroups = React.useMemo(() => {
    const map: Record<string, MatrixStudentRecord[]> = {};

    records.forEach((record) => {
      const floor = extractFloor(record.student.room_no, record.student.floor);
      if (!map[floor]) map[floor] = [];
      map[floor].push(record);
    });

    // Sort students inside each floor by room number or name
    Object.keys(map).forEach((floor) => {
      map[floor].sort((a, b) => {
        const roomA = a.student.room_no || '';
        const roomB = b.student.room_no || '';
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' }) ||
          a.student.name.localeCompare(b.student.name);
      });
    });

    // Return ordered array of floor groups
    return Object.entries(map).sort(([floorA], [floorB]) => {
      const idxA = FLOOR_ORDER.indexOf(floorA);
      const idxB = FLOOR_ORDER.indexOf(floorB);
      const posA = idxA === -1 ? 999 : idxA;
      const posB = idxB === -1 ? 999 : idxB;
      return posA - posB;
    });
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="py-16 text-center bg-card/40 border border-border/60 rounded-2xl">
        <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-60" />
        <h3 className="text-base font-semibold text-foreground mb-1">No Students Found</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No students matched your search or status filter. Try clearing filters to view the full hostel matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {floorGroups.map(([floorName, floorStudents], floorIdx) => {
        // Count distinct rooms
        const distinctRooms = new Set(floorStudents.map((s) => s.student.room_no).filter(Boolean)).size;

        return (
          <motion.div
            key={floorName}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: floorIdx * 0.05, duration: 0.3 }}
            className="bg-card/70 border border-border/70 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 backdrop-blur-sm"
          >
            {/* Floor Header Bar */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                    {floorName}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-secondary/60 text-xs text-muted-foreground font-normal border-border">
                  {distinctRooms > 0 ? `${distinctRooms} Rooms` : `${floorStudents.length} Students`}
                </Badge>
              </div>
            </div>

            {/* Students Grid for this floor */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {floorStudents.map((record) => {
                const s = record.student;
                const firstName = s.name.split(' ')[0];

                // Determine colors & styling based on status
                let ringColor = 'ring-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]';
                let dotBg = 'bg-emerald-500';
                let statusLabel = 'Paid';
                let badgeVariant = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

                if (record.status === 'pending') {
                  ringColor = 'ring-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]';
                  dotBg = 'bg-rose-500';
                  statusLabel = 'Pending';
                  badgeVariant = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                } else if (record.status === 'overdue') {
                  ringColor = 'ring-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]';
                  dotBg = 'bg-amber-500';
                  statusLabel = 'Overdue';
                  badgeVariant = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                } else if (record.status === 'upcoming') {
                  ringColor = 'ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.35)]';
                  dotBg = 'bg-blue-500';
                  statusLabel = 'Upcoming';
                  badgeVariant = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                }

                // Generate consistent colorful avatar background if no photo
                const avatarPalette = [
                  'from-pink-500 to-rose-500',
                  'from-purple-500 to-indigo-500',
                  'from-cyan-500 to-blue-500',
                  'from-emerald-500 to-teal-500',
                  'from-amber-500 to-orange-500',
                ];
                const charCodeSum = s.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const bgGradient = avatarPalette[charCodeSum % avatarPalette.length];

                return (
                  <TooltipProvider key={s.id} delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.button
                          whileHover={{ scale: 1.04, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onSelectStudent(s)}
                          className={cn(
                            'group flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl border transition-all duration-200 text-left w-full cursor-pointer',
                            'bg-card/80 hover:bg-secondary/70 border-border/80 hover:border-primary/40 shadow-sm'
                          )}
                        >
                          {/* Circular Indicator (Avatar + Status Ring + Indicator Dot) */}
                          <div className="relative shrink-0">
                            <div
                              className={cn(
                                'w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 ring-2 transition-all duration-200 overflow-hidden flex items-center justify-center',
                                ringColor
                              )}
                            >
                              {s.profile_photo ? (
                                <img
                                  src={s.profile_photo}
                                  alt={s.name}
                                  className="w-full h-full object-cover rounded-full"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className={cn('w-full h-full rounded-full bg-gradient-to-tr flex items-center justify-center text-white font-bold text-xs', bgGradient)}>
                                  {firstName.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            {/* Glowing Status Dot on avatar bottom right */}
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-card shrink-0 animate-pulse',
                                dotBg
                              )}
                            />
                          </div>

                          {/* Student Name & Room Tag */}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate">
                              {firstName}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono font-medium truncate">
                              {s.room_no || 'No Room'}
                            </p>
                          </div>
                        </motion.button>
                      </TooltipTrigger>

                      <TooltipContent
                        side="top"
                        className="bg-popover border border-border p-3 rounded-xl shadow-xl max-w-xs text-xs space-y-1.5 z-50"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                          <p className="font-bold text-foreground text-sm">{s.name}</p>
                          <Badge className={badgeVariant}>{statusLabel}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div>
                            <span>Room: </span>
                            <span className="text-foreground font-mono font-medium">{s.room_no || 'N/A'}</span>
                          </div>
                          <div>
                            <span>Monthly Fee: </span>
                            <span className="text-foreground font-medium">₹{(s.fees || 0).toLocaleString('en-IN')}</span>
                          </div>
                          {record.pending > 0 && (
                            <div className="col-span-2 text-rose-400 font-medium">
                              Pending Balance: ₹{record.pending.toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-primary/80 italic pt-1">Click to open fee profile & collect payment →</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
