import { ShieldCheck, Lock, Database, FileCheck, KeyRound, Server } from 'lucide-react';

export function SecurityArchitecture() {
  const securityPillars = [
    {
      icon: Lock,
      title: 'Multi-Tenant Isolation',
      desc: 'Strict organization-level query filters and membership gating ensure zero cross-tenant data leakage between hostel brands.',
    },
    {
      icon: KeyRound,
      title: 'Granular Role-Based RBAC',
      desc: 'Independent permission matrices for Super Admins, Property Wardens, Accountants, and Student Residents.',
    },
    {
      icon: FileCheck,
      title: 'Immutable Audit Trail',
      desc: 'Every fee receipt generation, manual discount waiver, bed swap, and gate pass is recorded in a tamper-proof audit log.',
    },
    {
      icon: Database,
      title: 'AES-256 Cloud Encryption',
      desc: 'All student IDs, KYC documents, and financial records are encrypted both in transit (TLS 1.3) and at rest on MongoDB Atlas.',
    },
    {
      icon: Server,
      title: 'Daily Automated Backups',
      desc: 'Continuous cloud snapshots with point-in-time recovery and 99.98% high-availability uptime SLA across multi-region clusters.',
    },
    {
      icon: ShieldCheck,
      title: 'GDPR & DPDP Compliant',
      desc: 'Built in adherence with India’s Digital Personal Data Protection (DPDP) Act with verified data residency and consent controls.',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-white border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Enterprise Trust & Compliance</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Built with security at the core.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Hostel operations deal with sensitive student records, parent emergency contacts, and daily cash transactions. Q2 treats safety as a primary feature.
          </p>
        </div>

        {/* Security Pillars 6-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityPillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 sm:p-7 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 hover:border-blue-200 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
