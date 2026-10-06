"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Runs the CSS animations inside it only while it is on screen. The looping
 * "How it works" illustrations would otherwise keep repainting for as long as
 * the homepage is open. Paused is also the server-rendered state, so the
 * illustrations show their resting frame until the browser says they're seen.
 */
export function PlayWhenVisible({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} data-playing={playing ? "true" : "false"}>
      {children}
    </div>
  );
}
