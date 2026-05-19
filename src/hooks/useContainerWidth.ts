import { useState, useRef, useEffect } from 'react';

export function useContainerWidth() {
  const [width, setWidth] = useState(1200);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let resizeObserver: ResizeObserver | null = null;
    
    if (containerRef.current) {
      setWidth(containerRef.current.getBoundingClientRect().width);
      
      resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  return { width, containerRef, mounted };
}
