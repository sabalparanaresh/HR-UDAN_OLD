import { useEffect, useRef } from 'react';

export const useRenderProfile = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    const duration = now - lastRenderTime.current;
    if (duration > 16) {
      console.warn(`[PERF - ${componentName}] Render ${renderCount.current} took ${duration.toFixed(2)}ms (Jank Potential)`);
    }
    lastRenderTime.current = performance.now();
  });
};
