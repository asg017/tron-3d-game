import * as THREE from 'three'

interface Burst {
  points: THREE.Points
  velocities: Float32Array
  life: number
  maxLife: number
  mat: THREE.PointsMaterial
}

/** Crash explosions: a burst of glowing shards in the rider's color. */
export class ExplosionPool {
  private bursts: Burst[] = []

  constructor(private readonly scene: THREE.Scene) {}

  spawn(x: number, z: number, color: string): void {
    const count = 140
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x
      pos[i * 3 + 1] = 0.8
      pos[i * 3 + 2] = z
      const theta = Math.random() * Math.PI * 2
      const up = Math.random() * 0.9
      const s = 6 + Math.random() * 20
      vel[i * 3] = Math.cos(theta) * s
      vel[i * 3 + 1] = up * s * 0.8
      vel[i * 3 + 2] = Math.sin(theta) * s
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.5,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    this.scene.add(points)
    this.bursts.push({ points, velocities: vel, life: 0, maxLife: 1.2, mat })
  }

  update(dt: number): void {
    for (const b of this.bursts) {
      b.life += dt
      const attr = b.points.geometry.getAttribute('position') as THREE.BufferAttribute
      const p = attr.array as Float32Array
      for (let i = 0; i < p.length; i += 3) {
        p[i] += b.velocities[i] * dt
        p[i + 1] = Math.max(0.1, p[i + 1] + b.velocities[i + 1] * dt)
        p[i + 2] += b.velocities[i + 2] * dt
        b.velocities[i + 1] -= 22 * dt // gravity
        b.velocities[i] *= 1 - 0.8 * dt
        b.velocities[i + 2] *= 1 - 0.8 * dt
      }
      attr.needsUpdate = true
      b.mat.opacity = Math.max(0, 1 - b.life / b.maxLife)
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.life < b.maxLife) return true
      this.scene.remove(b.points)
      b.points.geometry.dispose()
      b.mat.dispose()
      return false
    })
  }

  clear(): void {
    for (const b of this.bursts) {
      this.scene.remove(b.points)
      b.points.geometry.dispose()
      b.mat.dispose()
    }
    this.bursts = []
  }
}
