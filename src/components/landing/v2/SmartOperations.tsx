import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BedDouble,
  Wrench,
  UserCheck,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function SmartOperations() {
  // Interactive state for Maintenance
  const [maintenanceTickets, setMaintenanceTickets] = useState([
    { id: '#M-101', title: 'AC Filter Cleaning (Room 204)', priority: 'High', status: 'In Progress', technician: 'Suresh' },
    { id: '#M-102', title: 'Geyser Thermostat (Room 302)', priority: 'High', status: 'Pending', technician: 'Unassigned' },
    { id: '#M-103', title: 'Wardrobe Latch (Room 105)', priority: 'Normal', status: 'Resolved', technician: 'Raju' },
  ]);

  // Interactive state for Staff Tasks
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Evening roll call (Wing A & B)', done: true },
    { id: 2, title: 'Mess dinner head count verification', done: true },
    { id: 3, title: 'Water tank chlorine & TDS check', done: false },
    { id: 4, title: 'Night curfew gate security audit', done: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <section id="operations" className="py-20 sm:py-28 bg-white border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Daily Operations</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Smart Operations. Zero Friction.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Four specialized modules that keep your property running smoothly without constant staff follow-ups.
          </p>
        </div>

        {/* 4 Interactive Operations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Room & Bed Management */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#F8F9FC] border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <BedDouble className="w-5 h-5" />
              </div>
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                Live Inventory
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900">Room & Bed Management</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Instant bed allocation, vacancy forecast, and automated checkout clearance.
            </p>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Triple AC (Room 204)</span>
                  <span className="text-slate-400 block text-[11px]">3 of 3 Beds Occupied</span>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">100% Full</Badge>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Double Premium (Room 102)</span>
                  <span className="text-slate-400 block text-[11px]">1 of 2 Beds Occupied</span>
                </div>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">1 Bed Vacant</Badge>
              </div>
            </div>
          </div>

          {/* Card 2: Maintenance & SLA Helpdesk */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#F8F9FC] border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">
                7 Issues (2 High)
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900">Maintenance & Ticket SLA</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Photo-verified work orders assigned to technicians with SLA countdowns.
            </p>

            <div className="space-y-2.5">
              {maintenanceTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{ticket.title}</span>
                    <span className="text-slate-400 block text-[11px]">Assigned: {ticket.technician}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ticket.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ticket.priority === 'High'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {ticket.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Visitor & Gate Passes */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#F8F9FC] border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs">
                12 Visitors Today
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900">Visitor & Gate Passes</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Parent check-in OTP validation, digital guest pass logs, and night curfews.
            </p>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Mr. R. K. Sharma (Parent)</span>
                  <span className="text-slate-400 block text-[11px]">Visiting: Ananya Sharma (Room 204)</span>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Active in Lounge</Badge>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Weekend Overnight Pass</span>
                  <span className="text-slate-400 block text-[11px]">Student: Priya Nair • Guardian Approved</span>
                </div>
                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">OTP Verified</Badge>
              </div>
            </div>
          </div>

          {/* Card 4: Staff Tasks & Shift Handovers */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#F8F9FC] border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                {tasks.filter((t) => t.done).length} / {tasks.length} Done
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900">Staff Shift Handovers</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Warden checklists and compliance audits. Click tasks to toggle live status:
            </p>

            <div className="space-y-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all text-xs ${
                    task.done
                      ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-purple-300 font-semibold'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                      task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {task.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span>{task.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
