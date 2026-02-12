'use client'

import { useState, useEffect } from 'react'

/**
 * Custom hook that listens to a CSS media query and returns whether it matches.
 * Uses window.matchMedia for efficient, event-driven updates.
 *
 * @param query - A valid CSS media query string, e.g. "(min-width: 768px)"
 * @returns boolean indicating whether the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }

    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** True when viewport is >= 768px (md breakpoint) */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

/** True when viewport is >= 1024px (lg breakpoint) */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
