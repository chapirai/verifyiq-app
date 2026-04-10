import { FAQ } from '@/components/sections/FAQ';
import { Features } from '@/components/sections/Features';
import { Footer } from '@/components/sections/Footer';
import { Hero } from '@/components/sections/Hero';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { Navbar } from '@/components/sections/Navbar';
import { Pricing } from '@/components/sections/Pricing';
import { SocialProof } from '@/components/sections/SocialProof';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
