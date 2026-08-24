import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, BedDouble, Users, CheckCircle2, AlertCircle } from 'lucide-react';

const FLOORS_DATA = [
  {
    floorName: 'Ground Floor',
    rooms: [
      { number: 'G-01', type: 'Triple Sharing', capacity: 3, occupied: 3, status: 'FULL', feeStatus: 'PAID' },
      { number: 'G-02', type: 'Double Sharing', capacity: 2, occupied: 2, status: 'FULL', feeStatus: 'PAID' },
      { number: 'G-03', type: 'Triple Sharing', capacity: 3, occupied: 2, status: 'AVAILABLE', feeStatus: 'PENDING' },
      { number: 'G-04', type: 'Single Room', capacity: 1, occupied: 1, status: 'FULL', feeStatus: 'PAID' },
    ],
  },
  {
    floorName: 'First Floor',
    rooms: [
      { number: 'F-101', type: 'Triple Sharing', capacity: 3, occupied: 3, status: 'FULL', feeStatus: 'PAID' },
      { number: 'F-102', type: 'Double Sharing', capacity: 2, occupied: 1, status: 'AVAILABLE', feeStatus: 'PAID' },
      { number: 'F-103', type: 'Double Sharing', capacity: 2, occupied: 2, status: 'FULL', feeStatus: 'OVERDUE' },
      { number: 'F-104', type: 'Triple Sharing', capacity: 3, occupied: 3, status: 'FULL', feeStatus: 'PAID' },
    ],
  },
  {
    floorName: 'Second Floor',
    rooms: [
      { number: 'S-201', type: 'Double Sharing', capacity: 2, occupied: 2, status: 'FULL', feeStatus: 'PAID' },
      { number: 'S-202', type: 'Triple Sharing', capacity: 3, occupied: 2, status: 'AVAILABLE', feeStatus: 'PAID' },
      { number: 'S-203', type: 'Single Room', capacity: 1, occupied: 1, status: 'FULL', feeStatus: 'PAID' },
      { number: 'S-204', type: 'Double Sharing', capacity: 2, occupied: 2, status: 'FULL', feeStatus: 'UPCOMING' },
    ],
  },
];

export function HostelOperationsShowcase() {
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const currentFloor = FLOORS_DATA[activeFloorIndex];

  return (
    <section id="operations" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-primary/30 text-primary">
            Physical & Financial Synchronization
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            Floor-by-Floor Hostel Operations
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Q2 unifies physical bed occupancy with financial ledgers. Know exactly who lives where and who has paid.
          </p>

          {/* Floor Navigation Buttons */}
          <div className="flex justify-center gap-2 pt-4">
            {FLOORS_DATA.map((floor, idx) => (
              <Button
                key={floor.floorName}
                variant={activeFloorIndex === idx ? 'default' : 'outline'}
                onClick={() => setActiveFloorIndex(idx)}
                className="rounded-full text-xs font-bold"
              >
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                {floor.floorName}
              </Button>
            ))}
          </div>
        </div>

        {/* Interactive Room Grid */}
        <div className="max-w-5xl mx-auto bg-card/60 backdrop-blur-xl border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">{currentFloor.floorName} Map</h3>
              <p className="text-xs text-muted-foreground">Showing 4 rooms with active resident allocations</p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Branch: Q2 Girls Hostel
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {currentFloor.rooms.map((room) => (
              <motion.div
                key={room.number}
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-secondary/40 border border-border/60 rounded-xl p-4 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-extrabold text-foreground font-mono">{room.number}</span>
                  <Badge
                    variant={room.status === 'FULL' ? 'secondary' : 'default'}
                    className="text-[10px]"
                  >
                    {room.status}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">{room.type}</div>

                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <BedDouble className="w-3 h-3" /> Beds
                    </span>
                    <span className="font-bold text-foreground font-mono">{room.occupied} / {room.capacity}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Fee Status</span>
                    <span
                      className={`font-bold text-[10px] ${
                        room.feeStatus === 'PAID'
                          ? 'text-emerald-400'
                          : room.feeStatus === 'OVERDUE'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {room.feeStatus}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-background/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${(room.occupied / room.capacity) * 100}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
