import { ShieldCheck, Heart, ArrowUp } from 'lucide-react';

interface LightFooterProps {
  onOpenAuth: () => void;
  onOpenLead: () => void;
}

export function LightFooter({ onOpenAuth, onOpenLead }: LightFooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-900">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0">
                <img src="/q2-logo.png" alt="Q2 Group of Hostels" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-white tracking-tight leading-none">
                  Q2 Group of Hostels
                </span>
                <span className="text-[10px] text-purple-400 font-semibold tracking-wider uppercase mt-0.5">
                  Multi-Tenant Hostel SaaS Operating System
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Smart Hostel Management. Simplified. Powering student onboarding, room twin allocation, automated fee collection, and daily property operations across India.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational (99.98% SLA)
              </span>
            </div>
          </div>

          {/* Column 1: Platform */}
          <div className="space-y-3 text-xs">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
              Product Suite
            </span>
            <ul className="space-y-2">
              <li><a href="#platform" className="hover:text-white transition-colors">Unified Platform</a></li>
              <li><a href="#digital-twin" className="hover:text-white transition-colors">Hostel Digital Twin</a></li>
              <li><a href="#fee-intelligence" className="hover:text-white transition-colors">Fee Intelligence</a></li>
              <li><a href="#operations" className="hover:text-white transition-colors">Smart Operations</a></li>
              <li><a href="#ai-assistant" className="hover:text-white transition-colors">Q2 AI Assistant</a></li>
            </ul>
          </div>

          {/* Column 2: Portals & Roles */}
          <div className="space-y-3 text-xs">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
              Portals
            </span>
            <ul className="space-y-2">
              <li><button onClick={onOpenAuth} className="hover:text-white transition-colors text-left">Super Admin Console</button></li>
              <li><button onClick={onOpenAuth} className="hover:text-white transition-colors text-left">Hostel Admin Portal</button></li>
              <li><button onClick={onOpenAuth} className="hover:text-white transition-colors text-left">Resident Mobile App</button></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">SaaS Subscriptions</a></li>
              <li><button onClick={onOpenLead} className="hover:text-white transition-colors text-left">Book Assisted Demo</button></li>
            </ul>
          </div>

          {/* Column 3: Trust & Headquarters */}
          <div className="space-y-3 text-xs">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] block">
              Locations & Trust
            </span>
            <p className="text-slate-400 text-xs leading-relaxed">
              <strong className="text-slate-200 block">Q2 Tech Headquarters:</strong>
              Gachibowli, Financial District, Hyderabad, Telangana — 500032
            </p>
            <p className="text-slate-400 text-xs">
              Direct Support: <span className="text-purple-400 font-semibold">+91 98450 11220</span>
            </p>
            <p className="text-slate-400 text-xs">
              Email: <span className="text-purple-400 font-semibold">admin@q2hostels.com</span>
            </p>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Q2 Group of Hostels. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Security Compliance</span>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all ml-2"
              aria-label="Scroll to top"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
