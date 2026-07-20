"use client";

import { useEffect, useRef } from "react";

/**
 * The hero background video. It's a client component so we can work around iOS
 * Safari's autoplay rules, which the plain SSR attributes don't reliably satisfy:
 *  - set the `muted` PROPERTY (not just the attribute) — iOS checks the property
 *    before allowing muted autoplay, and React doesn't always reflect it.
 *  - call play() on mount and again when the tab becomes visible (iOS pauses
 *    background tabs), swallowing the promise rejection when autoplay is blocked
 *    (e.g. Low Power Mode) so the poster frame simply stays.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => {
      v.play().catch(() => {
        /* autoplay blocked (e.g. iOS Low Power Mode) — poster stays */
      });
    };
    tryPlay();
    document.addEventListener("visibilitychange", tryPlay);
    return () => document.removeEventListener("visibilitychange", tryPlay);
  }, []);

  return (
    <video
      ref={ref}
      className="hero-video__media absolute inset-0 -z-10 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/media/hero-clinic-poster.jpg"
      aria-hidden="true"
    >
      <source src="/media/hero-clinic.mp4" type="video/mp4" />
    </video>
  );
}
