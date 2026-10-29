import { ScrollEffects } from "@/components/animations/ScrollEffects";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteNav } from "@/components/layout/SiteNav";
import { FeatureCarousel } from "@/components/sections/FeatureCarousel";
import { Film } from "@/components/sections/Film";
import { Hero } from "@/components/sections/Hero";
import { Product } from "@/components/sections/Product";
import { Closing, CtaBand, Listing } from "@/components/sections/Results";
import { Collage, Manifesto, Pillars } from "@/components/sections/Story";

export default function Home() {
  return (
    <>
      <SiteNav />
      <ScrollEffects>
        <main>
          <Hero />
          <Manifesto />
          <Pillars />
          <Collage />
          <FeatureCarousel />
          <Film />
          <Listing />
          <Product />
          {/* <Proof /> brand marquee hidden for now (src/components/sections/Results.tsx) */}
          <Closing />
          <CtaBand />
        </main>
      </ScrollEffects>
      <SiteFooter />
    </>
  );
}
