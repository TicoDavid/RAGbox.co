'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * VaultOrb — Three.js 3D faceted sphere with orbiting particle ring,
 * light ribbon, mouse parallax, and CSS ambient glow.
 *
 * Spec: connexus-ops/orders/LANDING-V3-VAULT-ORB-SPEC.md
 * Brand: connexus-ops/docs/BRANDING_GUIDELINES.md
 *
 * - IcosahedronGeometry(2.5, 4), MeshPhysicalMaterial (chrome/glass)
 * - 50 orbiting particles (#3B82F6)
 * - Gradient light ribbon (magenta → cyan → blue, additive)
 * - Mouse parallax (10deg max, lerp 0.05); auto-rotate on mobile
 * - CSS radial glow behind canvas, pulsing 4s
 * - WebGL fallback: static CSS gradient orb
 */
export function VaultOrb() {
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const cleanupRef = useRef<(() => void) | null>(null)
  const [webglSupported, setWebglSupported] = useState(true)

  const isMobile = useCallback(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768
  }, [])

  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    // WebGL support check
    const testCanvas = document.createElement('canvas')
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')
    if (!gl) {
      setWebglSupported(false)
      return
    }

    let disposed = false

    // Dynamic import to avoid SSR bundle
    import('three').then((THREE) => {
      if (disposed) return

      const width = container.clientWidth
      const height = container.clientHeight

      // ── Renderer ──
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      container.appendChild(renderer.domElement)

      // ── Scene + Camera ──
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
      camera.position.z = 8

      // ── Environment map for reflections ──
      const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      })
      const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRT)
      const envScene = new THREE.Scene()
      const envGeo = new THREE.SphereGeometry(0.2, 8, 8)
      const envColors = [0x2463EB, 0x7C3AED, 0x06B6D4, 0x3B82F6]
      envColors.forEach((c, i) => {
        const mat = new THREE.MeshBasicMaterial({ color: c })
        const mesh = new THREE.Mesh(envGeo, mat)
        const a = (i / envColors.length) * Math.PI * 2
        mesh.position.set(Math.cos(a) * 15, Math.sin(a) * 8, -10)
        mesh.scale.setScalar(4)
        envScene.add(mesh)
      })
      cubeCamera.update(renderer, envScene)

      // ── Orb — faceted icosahedron with chrome/glass material ──
      const orbGeo = new THREE.IcosahedronGeometry(2.5, 4)
      const orbMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a2e,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMap: cubeRT.texture,
        envMapIntensity: 3.5,
      })
      const orb = new THREE.Mesh(orbGeo, orbMat)
      scene.add(orb)

      // ── Lighting ──
      scene.add(new THREE.AmbientLight(0x222244, 0.5))

      const pl1 = new THREE.PointLight(0x2463EB, 2, 20)
      pl1.position.set(5, 3, 5)
      scene.add(pl1)

      const pl2 = new THREE.PointLight(0x7C3AED, 1.5, 20)
      pl2.position.set(-5, -2, 3)
      scene.add(pl2)

      const pl3 = new THREE.PointLight(0x06B6D4, 1, 15)
      pl3.position.set(0, 5, -3)
      scene.add(pl3)

      const pl4 = new THREE.PointLight(0x3B82F6, 2, 20)
      pl4.position.set(5, 5, 5)
      scene.add(pl4)

      const pl5 = new THREE.PointLight(0x7C3AED, 1.5, 20)
      pl5.position.set(-5, -3, 5)
      scene.add(pl5)

      // ── Particle Ring — 50 orbiting "document" particles ──
      const PARTICLE_COUNT = 50
      const positions = new Float32Array(PARTICLE_COUNT * 3)
      const angles: number[] = []
      const radii: number[] = []
      const yOffsets: number[] = []

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2
        const radius = 3.2 + (Math.random() - 0.5) * 0.6
        const yOff = (Math.random() - 0.5) * 1.2
        angles.push(angle)
        radii.push(radius)
        yOffsets.push(yOff)
        positions[i * 3] = Math.cos(angle) * radius
        positions[i * 3 + 1] = yOff
        positions[i * 3 + 2] = Math.sin(angle) * radius
      }

      const particleGeo = new THREE.BufferGeometry()
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const particleMat = new THREE.PointsMaterial({
        size: 0.06,
        color: 0x3B82F6,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      })
      const particles = new THREE.Points(particleGeo, particleMat)
      scene.add(particles)

      // ── Light Ribbon — gradient plane through the orb ──
      const ribbonGeo = new THREE.PlaneGeometry(8, 0.15, 64, 1)

      // Bake gradient texture via offscreen canvas
      const rCanvas = document.createElement('canvas')
      rCanvas.width = 512
      rCanvas.height = 4
      const rCtx = rCanvas.getContext('2d')!
      const grad = rCtx.createLinearGradient(0, 0, 512, 0)
      grad.addColorStop(0, 'rgba(217,70,239,0)')       // magenta fade-in
      grad.addColorStop(0.2, 'rgba(217,70,239,0.8)')   // magenta
      grad.addColorStop(0.5, 'rgba(6,182,212,0.9)')    // cyan peak
      grad.addColorStop(0.8, 'rgba(36,99,235,0.8)')    // blue
      grad.addColorStop(1, 'rgba(36,99,235,0)')         // blue fade-out
      rCtx.fillStyle = grad
      rCtx.fillRect(0, 0, 512, 4)

      const ribbonTex = new THREE.CanvasTexture(rCanvas)
      const ribbonMat = new THREE.MeshBasicMaterial({
        map: ribbonTex,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat)
      scene.add(ribbon)

      // ── Mouse parallax handler ──
      const onMouseMove = (e: MouseEvent) => {
        mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
        mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1
      }
      window.addEventListener('mousemove', onMouseMove)

      // ── Device orientation for mobile parallax ──
      const onOrientation = (e: DeviceOrientationEvent) => {
        if (e.gamma != null && e.beta != null) {
          mouseRef.current.x = Math.max(-1, Math.min(1, e.gamma / 30))
          mouseRef.current.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30))
        }
      }
      if (isMobile() && typeof DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', onOrientation)
      }

      // ── Resize handler ──
      const onResize = () => {
        if (!container || disposed) return
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      // ── Animation loop ──
      let frame = 0
      const targetRot = { x: 0, y: 0 }
      const MAX_TILT = (10 * Math.PI) / 180
      const LERP = 0.05

      const animate = () => {
        if (disposed) return
        requestAnimationFrame(animate)
        frame++

        // Mouse parallax — lerp toward target, max 10 degrees
        targetRot.x = mouseRef.current.y * MAX_TILT
        targetRot.y = mouseRef.current.x * MAX_TILT
        orb.rotation.x += (targetRot.x - orb.rotation.x) * LERP
        orb.rotation.y += (targetRot.y - orb.rotation.y) * LERP

        // Slow auto-rotation (always on; primary input on mobile)
        orb.rotation.y += 0.001

        // Particle orbit
        const pos = particleGeo.attributes.position.array as Float32Array
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const a = angles[i] + frame * 0.001
          pos[i * 3] = Math.cos(a) * radii[i]
          pos[i * 3 + 1] = yOffsets[i] + Math.sin(frame * 0.005 + i) * 0.1
          pos[i * 3 + 2] = Math.sin(a) * radii[i]
        }
        particleGeo.attributes.position.needsUpdate = true

        // Ribbon sine wave
        const rPos = ribbonGeo.attributes.position.array as Float32Array
        for (let i = 0; i < rPos.length; i += 3) {
          rPos[i + 1] = Math.sin(rPos[i] * 1.5 + frame * 0.02) * 0.08
        }
        ribbonGeo.attributes.position.needsUpdate = true

        renderer.render(scene, camera)
      }
      animate()

      // ── Store cleanup so useEffect teardown can call it ──
      cleanupRef.current = () => {
        disposed = true
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('deviceorientation', onOrientation)
        renderer.dispose()
        orbGeo.dispose()
        orbMat.dispose()
        particleGeo.dispose()
        particleMat.dispose()
        ribbonGeo.dispose()
        ribbonMat.dispose()
        ribbonTex.dispose()
        cubeRT.dispose()
        envGeo.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    })

    return () => {
      disposed = true
      cleanupRef.current?.()
    }
  }, [isMobile])

  // ── Fallback: static CSS gradient orb when WebGL unavailable ──
  if (!webglSupported) {
    return (
      <div className="relative w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] mx-auto">
        {/* Pulsing glow */}
        <div
          className="absolute rounded-full animate-[orbPulse_4s_ease-in-out_infinite]"
          style={{
            width: 600,
            height: 600,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(36,99,235,0.25) 0%, rgba(124,58,237,0.15) 50%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Static orb shape */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#1a1a2e] via-[#2463EB]/30 to-[#7C3AED]/20 border border-white/5" />
      </div>
    )
  }

  return (
    <div
      className="relative w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] mx-auto"
      aria-hidden="true"
    >
      {/* Ambient glow — CSS radial gradient behind the WebGL canvas */}
      <div
        className="absolute rounded-full animate-[orbPulse_4s_ease-in-out_infinite] pointer-events-none"
        style={{
          width: 600,
          height: 600,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(36,99,235,0.25) 0%, rgba(124,58,237,0.15) 50%, transparent 70%)',
        }}
      />

      {/* Three.js canvas mount point — sits above the glow */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 z-10"
      />
    </div>
  )
}
