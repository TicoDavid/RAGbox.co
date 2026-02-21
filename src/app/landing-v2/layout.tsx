/**
 * Landing V2 layout — forces pure black body/html via SSR-injected style.
 *
 * The root layout sets body bg to --bg-primary (#0A192F cobalt) with
 * transition-colors, which causes a visible color bleed during hydration.
 * This route-level layout injects a <style> tag server-side so the
 * browser paints black from the very first frame.
 */
export default function LandingV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background-color: #000000 !important;
          background: #000000 !important;
          border: none !important;
          outline: none !important;
          transition: none !important;
        }
      `}</style>
      {children}
    </>
  )
}
