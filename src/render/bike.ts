import * as THREE from 'three'

/**
 * Stylized light cycle assembled from primitives (no model assets): dark
 * metallic body, two glowing wheel rings, emissive trim in the rider color.
 * Model forward is -Z; use rotationYForDir to orient from a sim heading.
 */
export function createBikeMesh(color: string): THREE.Group {
  const g = new THREE.Group()
  const c = new THREE.Color(color)

  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#0c0e16',
    metalness: 0.85,
    roughness: 0.35,
  })
  const glowMat = new THREE.MeshBasicMaterial({ color: c })
  const canopyMat = new THREE.MeshStandardMaterial({
    color: '#101522',
    metalness: 0.9,
    roughness: 0.15,
    emissive: c,
    emissiveIntensity: 0.15,
  })

  // main hull
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 2.6), bodyMat)
  body.position.y = 0.62
  g.add(body)

  // canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.1), canopyMat)
  canopy.position.set(0, 0.95, 0.1)
  g.add(canopy)

  // wheels: glowing rings front and back
  const wheelGeo = new THREE.TorusGeometry(0.5, 0.09, 10, 28)
  const hubGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 20)
  for (const zOff of [-1.05, 1.05]) {
    const ring = new THREE.Mesh(wheelGeo, glowMat)
    ring.position.set(0, 0.55, zOff)
    g.add(ring)
    const hub = new THREE.Mesh(hubGeo, bodyMat)
    hub.rotation.z = Math.PI / 2
    hub.position.set(0, 0.55, zOff)
    g.add(hub)
  }

  // side trim strips
  for (const xOff of [-0.34, 0.34]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 2.2), glowMat)
    strip.position.set(xOff, 0.7, 0)
    g.add(strip)
  }

  // tail light
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.08), glowMat)
  tail.position.set(0, 0.75, 1.32)
  g.add(tail)

  return g
}

/** Rotation about Y so the model (forward -Z) faces sim direction (dx, dz). */
export function rotationYForDir(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}
