import { Star, Quote, Sparkles, Building2, CheckCircle2 } from 'lucide-react';
import { Testimonial } from './types';

export function TestimonialsSection() {
  const testimonials: Testimonial[] = [
    {
      quote:
        'Before Q2, fee tracking and room vacancies lived across three confusing Google Sheets and chaotic WhatsApp groups. Now our wardens and accountants reconcile all 240 beds in under 5 minutes every morning.',
      author: 'Vikramaditya Reddy',
      role: 'Managing Partner',
      hostelName: 'Q2 Luxury Living & Accommodations',
      location: 'Hyderabad (Financial District)',
      metrics: 'Collection rate jumped from 76% to 92.4% in 60 days',
    },
    {
      quote:
        'The automated weekend gate pass with parent OTP approval has transformed our safety protocol. Parents love the instant check-in notifications, and our staff saves 3 hours of manual phone calling every Friday.',
      author: 'Sunita Deshmukh',
      role: 'Chief Warden',
      hostelName: 'Shri Balaji Women’s Residency',
      location: 'Bangalore (Electronic City)',
      metrics: 'Zero gate log discrepancies across 180 residents',
    },
    {
      quote:
        'The Net Cashflow Analyzer showed us exactly where utility expenses were eating our margins. We identified high electricity wastage on Floor 3 and saved ₹45,000 in our first quarter on Q2.',
      author: 'Anand Kulkarni',
      role: 'Hostel Operations Director',
      hostelName: 'Greenwood Student Housing',
      location: 'Pune (Viman Nagar)',
      metrics: 'Reduced operating overheads by 14.8%',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-[#F8F9FC] border-b border-slate-200/80 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Proven Operator Results</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Loved by hostel operators and residents.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
            Discover how modern student accommodations across India run smoother, more profitable operations with Q2.
          </p>
        </div>

        {/* Testimonials 3-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="p-7 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all text-left"
            >
              <div>
                {/* 5 Stars rating */}
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>

                <Quote className="w-8 h-8 text-purple-200 mb-2" />

                <p className="text-sm text-slate-700 leading-relaxed font-normal mb-6">
                  “{t.quote}”
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-3 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100 w-fit">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.metrics}</span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{t.author}</h4>
                <p className="text-xs text-slate-500 font-medium">{t.role} • {t.hostelName}</p>
                <span className="text-[11px] text-slate-400 block mt-0.5">{t.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
