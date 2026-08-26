import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, BedDouble, Users, IndianRupee, Sparkles, CheckCircle2, Layers } from 'lucide-react';
import { RoomBedInfo } from './types';
import { Badge } from '@/components/ui/badge';

const FLOOR_ROOMS: Record<string, RoomBedInfo[]> = {
  'Ground Floor': [
    { roomNo: 'A-101', floor: 'Ground Floor', totalBeds: 3, occupiedBeds: 3, occupants: ['Kajal Sharma', 'Sneha Patel', 'Meera Joshi'], type: 'Triple Sharing', rentPerBed: 7500, monthlyRevenue: 22500, amenities: ['Attached Washroom', 'AC', 'Balcony'] },
    { roomNo: 'A-102', floor: 'Ground Floor', totalBeds: 3, occupiedBeds: 2, occupants: ['Aarushi Patel', 'Tanvi Desai'], type: 'Triple Sharing', rentPerBed: 7500, monthlyRevenue: 15000, amenities: ['Attached Washroom', 'AC'] },
    { roomNo: 'A-103', floor: 'Ground Floor', totalBeds: 2, occupiedBeds: 2, occupants: ['Pooja Hegde', 'Divya Reddy'], type: 'Double Sharing', rentPerBed: 9500, monthlyRevenue: 19000, amenities: ['Attached Washroom', 'AC', 'Study Desk'] },
    { roomNo: 'A-104', floor: 'Ground Floor', totalBeds: 1, occupiedBeds: 1, occupants: ['Rhea Chakraborty'], type: 'Single Premium', rentPerBed: 14000, monthlyRevenue: 14000, amenities: ['Attached Washroom', 'AC', 'Balcony', 'Smart TV'] },
  ],
  '1st Floor': [
    { roomNo: 'B-201', floor: '1st Floor', totalBeds: 3, occupiedBeds: 3, occupants: ['Ananya Sharma', 'Priya Nair', 'Sneha Rao'], type: 'Triple Sharing', rentPerBed: 8500, monthlyRevenue: 25500, amenities: ['Attached Washroom', 'AC', 'Balcony'] },
    { roomNo: 'B-202', floor: '1st Floor', totalBeds: 2, occupiedBeds: 2, occupants: ['Nandini Das', 'Isha Singhania'], type: 'Double Sharing', rentPerBed: 9500, monthlyRevenue: 19000, amenities: ['Attached Washroom', 'AC', 'Study Desk'] },
    { roomNo: 'B-203', floor: '1st Floor', totalBeds: 3, occupiedBeds: 1, occupants: ['Zoya Khan'], type: 'Triple Sharing', rentPerBed: 8500, monthlyRevenue: 8500, amenities: ['Attached Washroom', 'Non-AC'] },
    { roomNo: 'B-204', floor: '1st Floor', totalBeds: 2, occupiedBeds: 2, occupants: ['Shruti Gupta', 'Radhika Rao'], type: 'Double Sharing', rentPerBed: 9000, monthlyRevenue: 18000, amenities: ['Attached Washroom', 'AC'] },
  ],
  '2nd Floor': [
    { roomNo: 'C-301', floor: '2nd Floor', totalBeds: 3, occupiedBeds: 2, occupants: ['Harini Roy', 'Tara Alva'], type: 'Triple Sharing', rentPerBed: 9000, monthlyRevenue: 18000, amenities: ['Attached Washroom', 'AC', 'Balcony'] },
    { roomNo: 'C-302', floor: '2nd Floor', totalBeds: 2, occupiedBeds: 2, occupants: ['Lavanya M.', 'Bhavna Seth'], type: 'Double Sharing', rentPerBed: 9500, monthlyRevenue: 19000, amenities: ['Attached Washroom', 'AC'] },
    { roomNo: 'C-303', floor: '2nd Floor', totalBeds: 3, occupiedBeds: 3, occupants: ['Aditi Sundaram', 'Deepika M.', 'Simran Kaur'], type: 'Triple Sharing', rentPerBed: 8500, monthlyRevenue: 25500, amenities: ['Attached Washroom', 'AC'] },
    { roomNo: 'C-304', floor: '2nd Floor', totalBeds: 1, occupiedBeds: 0, occupants: [], type: 'Single Premium', rentPerBed: 15000, monthlyRevenue: 0, amenities: ['Attached Washroom', 'AC', 'Private Terrace'] },
  ],
};

export function HostelDigitalTwin() {
  const [selectedFloor, setSelectedFloor] = useState<string>('1st Floor');
  const [hoveredRoom, setHoveredRoom] = useState<RoomBedInfo>(FLOOR_ROOMS['1st Floor'][0]);

  const currentRooms = FLOOR_ROOMS[selectedFloor];

  return (
    <section id="digital-twin" className="py-20 sm:py-28 bg-white text-slate-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Floor & Bed Map</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            See your hostel. At a glance.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            A real-time digital twin of every building wing, floor, room, and bed. Hover on any room to inspect occupant rosters and revenue yield.
          </p>
        </div>

        {/* Digital Twin Interactive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Floor Selector & Room Grid */}
          <div className="lg:col-span-7 space-y-5 text-left">
            {/* Floor switcher tabs */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 w-fit">
              {Object.keys(FLOOR_ROOMS).map((floor) => (
                <button
                  key={floor}
                  onClick={() => {
                    setSelectedFloor(floor);
                    setHoveredRoom(FLOOR_ROOMS[floor][0]);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedFloor === floor
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {floor}
                </button>
              ))}
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentRooms.map((room) => {
                const isSelected = hoveredRoom.roomNo === room.roomNo;
                const isFull = room.occupiedBeds === room.totalBeds;
                const isEmpty = room.occupiedBeds === 0;

                return (
                  <div
                    key={room.roomNo}
                    onMouseEnter={() => setHoveredRoom(room)}
                    onClick={() => setHoveredRoom(room)}
                    className={`p-5 rounded-2xl border transition-all duration-150 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-gradient-to-br from-purple-50 via-white to-slate-50 border-purple-400 shadow-md ring-2 ring-purple-400/20 -translate-y-0.5'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900">{room.roomNo}</span>
                        <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded-md bg-slate-100">
                          {room.type}
                        </span>
                      </div>
                      <Badge
                        className={`text-[10px] font-semibold ${
                          isFull
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isEmpty
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isFull ? 'Fully Occupied' : isEmpty ? '100% Vacant' : `${room.totalBeds - room.occupiedBeds} Bed Available`}
                      </Badge>
                    </div>

                    {/* Visual Bed Slot Meter */}
                    <div className="flex items-center gap-2 mb-3">
                      {Array.from({ length: room.totalBeds }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2.5 flex-1 rounded-full transition-colors ${
                            idx < room.occupiedBeds ? 'bg-purple-600' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <span>
                        <strong className="text-slate-900">{room.occupiedBeds}</strong> / {room.totalBeds} Beds Filled
                      </span>
                      <span className="font-semibold text-slate-700">
                        ₹{room.monthlyRevenue.toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Detailed Room Digital Twin Inspector */}
          <div className="lg:col-span-5 text-left">
            <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs text-purple-400 font-bold uppercase tracking-wider block">
                    {hoveredRoom.floor}
                  </span>
                  <h3 className="text-2xl font-black text-white mt-0.5">Room {hoveredRoom.roomNo}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Monthly Revenue</span>
                  <span className="text-lg font-extrabold text-emerald-400">
                    ₹{hoveredRoom.monthlyRevenue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Bed breakdown list */}
              <div className="space-y-3 my-5">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                  Resident Occupancy Breakdown
                </span>
                {hoveredRoom.occupants.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-center text-xs text-slate-400">
                    No residents currently assigned. Ready for immediate check-in.
                  </div>
                ) : (
                  hoveredRoom.occupants.map((name, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px] border border-purple-500/30">
                          {i + 1}
                        </div>
                        <span className="font-semibold text-slate-200">{name}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">Rent Paid</span>
                    </div>
                  ))
                )}
              </div>

              {/* Room specs */}
              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Room Amenities
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {hoveredRoom.amenities.map((am) => (
                    <span
                      key={am}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px]"
                    >
                      {am}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
