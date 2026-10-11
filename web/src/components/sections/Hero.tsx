import { site } from "@/config/site";
import { SignalField } from "./SignalField";

export function Hero() {
  return (
    <header className="hero" data-io>
      <SignalField />
      <span className="plus c-tl" /><span className="plus c-tr" />
      <div className="edge inner w-full">
        <div className="kick">
          <span className="chip"><span className="dot" />CREATOR INTELLIGENCE</span>
          <span className="mono">EST / 25 · INDIA</span>
        </div>
        <h1 className="disp huge" data-scrub>
          <span className="ln">FIND THE RIGHT</span>
          <span className="ln">CREATORS, NOT MORE</span>
        </h1>
        <div className="btnrow mt-[clamp(28px,3.5vw,48px)]">
          <a className="pbtn" href={site.demoHref}>Launch the demo →</a>
          <a className="pbtn ghost" href="#manifesto">See how it works</a>
        </div>
      </div>
      <div className="scrollcue mono" aria-hidden="true">↓ SCROLL</div>
    </header>
  );
}
