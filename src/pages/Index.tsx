import { useState, useEffect } from 'react';
import { LightNavbar } from '@/components/landing/v2/LightNavbar';
import { LightHero } from '@/components/landing/v2/LightHero';
import { ProductStory } from '@/components/landing/v2/ProductStory';
import { HostelDigitalTwin } from '@/components/landing/v2/HostelDigitalTwin';
import { FeeIntelligence } from '@/components/landing/v2/FeeIntelligence';
import { SmartOperations } from '@/components/landing/v2/SmartOperations';
import { RoleExperiences } from '@/components/landing/v2/RoleExperiences';
import { AIAssistantSection } from '@/components/landing/v2/AIAssistantSection';
import { SmartInsights } from '@/components/landing/v2/SmartInsights';
import { FeatureGrid } from '@/components/landing/v2/FeatureGrid';
import { HowItWorks } from '@/components/landing/v2/HowItWorks';
import { SecurityArchitecture } from '@/components/landing/v2/SecurityArchitecture';
import { TestimonialsSection } from '@/components/landing/v2/TestimonialsSection';
import { PricingSection } from '@/components/landing/v2/PricingSection';
import { FAQSection } from '@/components/landing/v2/FAQSection';
import { FinalCTA } from '@/components/landing/v2/FinalCTA';
import { LightFooter } from '@/components/landing/v2/LightFooter';
import { AuthRoleModal } from '@/components/landing/v2/AuthRoleModal';
import { LeadCaptureModal } from '@/components/landing/v2/LeadCaptureModal';

export default function Index() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Q2 Group of Hostels — Smart Hostel Management Platform';
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFBFD] text-slate-900 font-sans selection:bg-purple-600 selection:text-white relative overflow-x-hidden">
      {/* Sticky Navigation */}
      <LightNavbar
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenLead={() => setIsLeadModalOpen(true)}
      />

      {/* Main Page Story Flow */}
      <main>
        {/* Section 1: Editorial Hero with Signature Live Student Matrix */}
        <LightHero
          onOpenLead={() => setIsLeadModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Section 2: Product Story (Students → Rooms → Payments → Ops → Analytics) */}
        <ProductStory />

        {/* Section 3: Hostel Digital Twin (Interactive Building Floor & Bed Navigator) */}
        <HostelDigitalTwin />

        {/* Section 4: Fee Intelligence (Live Month Selector & Automated WhatsApp Reminders) */}
        <FeeIntelligence />

        {/* Section 5: Smart Operations (Rooms, Maintenance SLA, Visitors, Staff Checklists) */}
        <SmartOperations />

        {/* Section 6: Persona Experiences (Super Admin, Hostel Admin, Student Resident) */}
        <RoleExperiences onOpenAuth={() => setIsAuthModalOpen(true)} />

        {/* Section 7: AI Intelligence ("Ask your hostel anything" Natural Language Console) */}
        <AIAssistantSection />

        {/* Section 8: Forward-Looking Predictive Analytics */}
        <SmartInsights />

        {/* Section 9: 12-Card Feature Suite with Micro-Interactions */}
        <FeatureGrid />

        {/* Section 10: How Q2 Works (4 Implementation Milestones) */}
        <HowItWorks />

        {/* Section 11: Security at the Core (RBAC, Tenant Isolation, AES-256 Cloud Encryption) */}
        <SecurityArchitecture />

        {/* Section 12: Authentic Indian Operator & Resident Testimonials */}
        <TestimonialsSection />

        {/* Section 13: SaaS Subscription Plans (Starter, Professional, Enterprise) */}
        <PricingSection onOpenLead={() => setIsLeadModalOpen(true)} />

        {/* Section 14: Interactive Smooth FAQ Accordion */}
        <FAQSection />

        {/* Section 15: Emotional Closing Call-to-Action */}
        <FinalCTA onOpenLead={() => setIsLeadModalOpen(true)} />
      </main>

      {/* Section 16: Enterprise Light SaaS Footer */}
      <LightFooter
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenLead={() => setIsLeadModalOpen(true)}
      />

      {/* Global Role Gateway Authentication Modal */}
      <AuthRoleModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Global Lead Capture / Demo Booking Modal */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
      />
    </div>
  );
}
