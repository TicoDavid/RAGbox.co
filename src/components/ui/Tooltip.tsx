'use client';
import { useState, useEffect, useRef, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  enabled?: boolean;
  delay?: number;
  maxWidth?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  enabled = true,
  delay = 500,
  maxWidth = 200
}: TooltipProps) {
  // All hooks must be called BEFORE any conditional returns
  const [show, setShow] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if tooltip would overflow viewport and adjust position
  useEffect(() => {
    if (show && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newPosition = position;

      // Check overflow and adjust
      if (position === 'top' && tooltip.top < 0) newPosition = 'bottom';
      if (position === 'bottom' && tooltip.bottom > viewportHeight) newPosition = 'top';
      if (position === 'left' && tooltip.left < 0) newPosition = 'right';
      if (position === 'right' && tooltip.right > viewportWidth) newPosition = 'left';

      if (newPosition !== actualPosition) {
        setActualPosition(newPosition);
      }
    }
  }, [show, position, actualPosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (!enabled) return; // Guard inside handler, not early return
    timeoutRef.current = setTimeout(() => {
      setShow(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShow(false);
  };

  // If disabled, just render children without tooltip wrapper
  if (!enabled) {
    return <>{children}</>;
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-b border-r',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-t border-l',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l',
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          className={`
            absolute z-[100] px-2.5 py-1.5
            text-[10px] font-medium tracking-wide leading-tight
            text-amber-300 bg-gray-900/95
            border border-amber-500/30 rounded
            shadow-lg shadow-amber-500/10
            backdrop-blur-sm
            animate-in fade-in duration-150
            pointer-events-none
            ${positionClasses[actualPosition]}
          `}
          style={{ maxWidth: `${maxWidth}px`, whiteSpace: content.length > 40 ? 'normal' : 'nowrap' }}
        >
          {content}
          {/* Arrow */}
          <div className={`
            absolute w-2 h-2 bg-gray-900/95 border-amber-500/30
            transform rotate-45
            ${arrowClasses[actualPosition]}
          `}/>
        </div>
      )}
    </div>
  );
}

export default Tooltip;
