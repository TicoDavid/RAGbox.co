'use client'

import { useRef, useEffect, useState } from 'react'

/**
 * VaultOrb — Three.js 3D sphere with particle ring + light ribbon.
 * Loads Three.js dynamically to avoid SSR issues.
 * Falls back to a CSS gradient orb if WebGL is unavailable.
 */
export function VaultOrb() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [webglSupported, setWebglSupported] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // WebGL support check
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      setWebglSupported(false)
      return
    }

    let disposed = false

    // Dynamic import to avoid SSR
    import('three').then((THREE) => {
      if (disposed) return

      const width = container.clientWidth
      const height = container.clientHeight

      // --- Renderer ---
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      container.appendChild(renderer.domElement)

      // --- Scene + Camera ---
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
      camera.position.z = 8

      // --- Environment (cube render target for reflections) ---
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      })
      const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget)

      // Environment lighting dots
      const envScene = new THREE.Scene()
      const envLightGeo = new THREE.SphereGeometry(0.2, 8, 8)
      const envColors = [0x2463EB, 0x7C3AED, 0x06B6D4, 0x3B82F6]
      envColors.forEach((c, i) => {
        const mat = new THREE.MeshBasicMaterial({ color: c })
        const mesh = new THREE.Mesh(envLightGeo, mat)
        const angle = (i / envColors.length) * Math.PI * 2
        mesh.position.set(Math.cos(angle) * 15, Math.sin(angle) * 8, -10)
        mesh.scale.setScalar(4)
        envScene.add(mesh)
      })
      cubeCamera.update(renderer, envScene)

      // --- Orb ---
      const orbGeo = new THREE.IcosahedronGeometry(2.5, 4)
      const orbMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a2e,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMap: cubeRenderTarget.texture,
        envMapIntensity: 2.0,
      })
      const orb = new THREE.Mesh(orbGeo, orbMat)
      scene.add(orb)

      // --- Lighting ---
      const ambientLight = new THREE.AmbientLight(0x222244, 0.5)
      scene.add(ambientLight)

      const pointLight1 = new THREE.PointLight(0x2463EB, 2, 20)
      pointLight1.position.set(5, 3, 5)
      scene.add(pointLight1)

      const pointLight2 = new THREE.PointLight(0x7C3AED, 1.5, 20)
      pointLight2.position.set(-5, -2, 3)
      scene.add(pointLight2)

      const pointLight3 = new THREE.PointLight(0x06B6D4, 1, 15)
      pointLight3.position.set(0, 5, -3)
      scene.add(pointLight3)

      // --- Particle Ring ---
      const particleCount = 50
      const particlePositions = new Float32Array(particleCount * 3)
      const particleAngles: number[] = []
      const particleRadii: number[] = []
      const particleYOffsets: number[] = []

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2
        const radius = 3.2 + (Math.random() - 0.5) * 0.6
        const yOffset = (Math.random() - 0.5) * 1.2
        particleAngles.push(angle)
        particleRadii.push(radius)
        particleYOffsets.push(yOffset)
        particlePositions[i * 3] = Math.cos(angle) * radius
        particlePositions[i * 3 + 1] = yOffset
        particlePositions[i * 3 + 2] = Math.sin(angle) * radius
      }

      const particleGeo = new THREE.BufferGeometry()
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
      const particleMat = new THREE.PointsMaterial({
        size: 0.04,
        color: 0x3B82F6,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      })
      const particles = new THREE.Points(particleGeo, particleMat)
      scene.add(particles)

      // --- Light Ribbon ---
      const ribbonGeo = new THREE.PlaneGeometry(8, 0.15, 64, 1)
      const ribbonCanvas = document.createElement('canvas')
      ribbonCanvas.width = 512
      ribbonCanvas.height = 4
      const rctx = ribbonCanvas.getContext('2d')!
      const gradient = rctx.createLinearGradient(0, 0, 512, 0)
      gradient.addColorStop(0, 'rgba(217,70,239,0)')
      gradient.addColorStop(0.2, 'rgba(217,70,239,0.8)')
      gradient.addColorStop(0.5, 'rgba(6,182,212,0.9)')
      gradient.addColorStop(0.8, 'rgba(36,99,235,0.8)')
      gradient.addColorStop(1, 'rgba(36,99,235,0)')
      rctx.fillStyle = gradient
      rctx.fillRect(0, 0, 512, 4)

      const ribbonTexture = new THREE.CanvasTexture(ribbonCanvas)
      const ribbonMat = new THREE.MeshBasicMaterial({
        map: ribbonTexture,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat)
      ribbon.position.z = 0
      scene.add(ribbon)

      // --- Mouse handler ---
      const onMouseMove = (e: MouseEvent) => {
        mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
        mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1
      }
      window.addEventListener('mousemove', onMouseMove)

      // --- Resize handler ---
      const onResize = () => {
        if (!container || disposed) return
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      // --- Animate ---
      let frame = 0
      const targetRotation = { x: 0, y: 0 }

      const animate = () => {
        if (disposed) return
        requestAnimationFrame(animate)
        frame++

        // Mouse parallax (max 10 degrees)
        const maxTilt = (10 * Math.PI) / 180
        targetRotation.x = mouseRef.current.y * maxTilt
        targetRotation.y = mouseRef.current.x * maxTilt
        orb.rotation.x += (targetRotation.x - orb.rotation.x) * 0.05
        orb.rotation.y += (targetRotation.y - orb.rotation.y) * 0.05

        // Slow auto-rotation
        orb.rotation.y += 0.001

        // Update particles — orbit
        const positions = particleGeo.attributes.position.array as Float32Array
        for (let i = 0; i < particleCount; i++) {
          const angle = particleAngles[i] + frame * 0.001
          const r = particleRadii[i]
          positions[i * 3] = Math.cos(angle) * r
          positions[i * 3 + 1] = particleYOffsets[i] + Math.sin(frame * 0.005 + i) * 0.1
          positions[i * 3 + 2] = Math.sin(angle) * r
        }
        particleGeo.attributes.position.needsUpdate = true

        // Ribbon wave
        const ribbonPositions = ribbonGeo.attributes.position.array as Float32Array
        for (let i = 0; i < ribbonPositions.length; i += 3) {
          const x = ribbonPositions[i]
          ribbonPositions[i + 1] = Math.sin(x * 1.5 + frame * 0.02) * 0.08
        }
        ribbonGeo.attributes.position.needsUpdate = true

        renderer.render(scene, camera)
      }
      animate()

      // Cleanup
      return () => {
        disposed = true
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('resize', onResize)
        renderer.dispose()
        orbGeo.dispose()
        orbMat.dispose()
        particleGeo.dispose()
        particleMat.dispose()
        ribbonGeo.dispose()
        ribbonMat.dispose()
        ribbonTexture.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    })

    return () => {
      disposed = true
    }
  }, [])

  // Fallback: CSS gradient orb
  if (!webglSupported) {
    return (
      <div className="relative w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#1a1a2e] via-[#2463EB]/30 to-[#7C3AED]/20 border border-white/5" />
        <div className="absolute inset-[-60px] rounded-full bg-[radial-gradient(circle,rgba(36,99,235,0.15)_0%,rgba(124,58,237,0.08)_50%,transparent_70%)] animate-pulse" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] mx-auto"
      aria-hidden="true"
    />
  )
}
