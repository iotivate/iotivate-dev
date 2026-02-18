import { useRef, useCallback, useEffect, useState } from "react";

const MAX_TILT = 4; // degrees

export default function usePerspectiveTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const rafId = useRef<number>(0);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchDevice || !ref.current) return;

      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * MAX_TILT;
        const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * MAX_TILT;

        el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
    },
    [isTouchDevice]
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    if (ref.current) {
      ref.current.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
    }
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return { ref, handleMouseMove, handleMouseLeave, isTouchDevice };
}
