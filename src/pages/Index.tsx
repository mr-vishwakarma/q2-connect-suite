import { SaaSHeader } from '@/components/landing/SaaSHeader';
import { SaaSHero } from '@/components/landing/SaaSHero';
import { PlatformExperiences } from '@/components/landing/PlatformExperiences';
import { HostelOperationsShowcase } from '@/components/landing/HostelOperationsShowcase';
import { PlatformFeaturesGrid } from '@/components/landing/PlatformFeaturesGrid';
import { SecurityTrustSection } from '@/components/landing/SecurityTrustSection';
import { SaaSFooter } from '@/components/landing/SaaSFooter';
import { BuildingBackground } from '@/components/shared/BuildingBackground';

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-primary relative">
      <BuildingBackground showOnHome={true} />
      <SaaSHeader />
      <main>
        <SaaSHero />
        <PlatformExperiences />
        <HostelOperationsShowcase />
        <PlatformFeaturesGrid />
        <SecurityTrustSection />
      </main>
      <SaaSFooter />
    </div>
  );
}
