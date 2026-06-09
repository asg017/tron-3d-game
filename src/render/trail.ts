import * as THREE from 'three'
import type { TrailPoint } from '../sim/types'

const TRAIL_VERT = /* glsl */ `
  varying float vY;
  void main() {
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const TRAIL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHeight;
  varying float vY;
  void main() {
    float t = vY / uHeight;
    // bright core near the top edge, soft glow below
    float edge = smoothstep(0.75, 1.0, t) * 1.6;
    float body = 0.35 + 0.3 * t;
    gl_FragColor = vec4(uColor * (body + edge), uOpacity * (0.5 + 0.5 * t));
  }
`

const HEIGHT = 1.7
const MAX_QUADS = 1024

/**
 * One bike's light ribbon: a vertical glowing quad per trail segment. The
 * buffer is preallocated and rewritten each frame (segment counts are tiny),
 * with the live segment tracking the interpolated bike position.
 */
export class TrailMesh {
  private readonly mesh: THREE.Mesh
  private readonly mat: THREE.ShaderMaterial
  private readonly positions: Float32Array

  constructor(private readonly scene: THREE.Scene, color: string) {
    this.positions = new Float32Array(MAX_QUADS * 6 * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setDrawRange(0, 0)
    this.mat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 1 },
        uHeight: { value: HEIGHT },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  /** Rebuild quads from trail corner points plus the (interpolated) head. */
  update(trail: TrailPoint[], headX: number, headZ: number, derez: number): void {
    const pts: TrailPoint[] = trail.length > 0 ? [...trail, { x: headX, z: headZ }] : []
    const p = this.positions
    let v = 0
    const quads = Math.min(pts.length - 1, MAX_QUADS)
    for (let i = 0; i < quads; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      // two triangles: (a0, b0, b1) and (a0, b1, a1) — 0 = ground, 1 = top
      const verts = [
        [a.x, 0, a.z], [b.x, 0, b.z], [b.x, HEIGHT, b.z],
        [a.x, 0, a.z], [b.x, HEIGHT, b.z], [a.x, HEIGHT, a.z],
      ]
      for (const [x, y, z] of verts) {
        p[v++] = x
        p[v++] = y
        p[v++] = z
      }
    }
    const geo = this.mesh.geometry
    geo.setDrawRange(0, quads * 6)
    ;(geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    this.mat.uniforms.uOpacity.value = Math.max(0, 1 - derez)
    this.mesh.visible = derez < 1
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mat.dispose()
  }
}
