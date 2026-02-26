"use client";

import { useEffect, useRef, ReactNode } from "react";

interface HeroAnimationsProps {
  children: ReactNode;
}

export default function HeroAnimations({ children }: HeroAnimationsProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Find and animate child elements
            const title = entry.target.querySelector('.hero-title');
            const description = entry.target.querySelector('.hero-description');
            const buttons = entry.target.querySelector('.hero-buttons');

            if (title) title.classList.add('hero-animate-title');
            if (description) description.classList.add('hero-animate-description');
            if (buttons) buttons.classList.add('hero-animate-buttons');

            // Disconnect after animation triggers
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
      }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={heroRef}>
      {children}
    </div>
  );
}