import * as THREE from 'three'

const FLOOR_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FLOOR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uHalf;
  varying vec3 vWorld;

  float gridLine(vec2 p, float scale, float thickness) {
    vec2 g = abs(fract(p / scale - 0.5) - 0.5) * scale;
    return smoothstep(thickness, 0.0, min(g.x, g.y));
  }

  void main() {
    vec2 p = vWorld.xz;
    float minor = gridLine(p, 5.0, 0.07) * 0.22;
    float major = gridLine(p, 25.0, 0.16) * 0.85;
    float pulse = 0.78 + 0.22 * sin(uTime * 1.4 - length(p) * 0.025);
    float edgeGlow = smoothstep(uHalf - 10.0, uHalf - 1.0, max(abs(p.x), abs(p.y)));
    vec3 base = vec3(0.012, 0.018, 0.04);
    vec3 col = base + uColor * (minor + major) * pulse + uColor * edgeGlow * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`

export class Arena {
  private readonly floorMat: THREE.ShaderMaterial

  constructor(scene: THREE.Scene, half: number) {
    const size = half * 2
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#00c8ff') },
        uHalf: { value: half },
      },
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.floorMat)
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    // boundary walls: translucent sheet + bright top edge for the bloom to catch
    const wallMat = new THREE.MeshBasicMaterial({
      color: '#0090c0',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#40e8ff' })
    const wallH = 6
    for (let i = 0; i < 4; i++) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(size, wallH), wallMat)
      const edge = new THREE.Mesh(new THREE.BoxGeometry(size, 0.25, 0.25), edgeMat)
      const angle = (i * Math.PI) / 2
      const nx = Math.sin(angle)
      const nz = Math.cos(angle)
      wall.position.set(nx * half, wallH / 2, nz * half)
      wall.rotation.y = angle
      edge.position.set(nx * half, wallH, nz * half)
      edge.rotation.y = angle
      scene.add(wall, edge)
    }

    // starfield, purely cosmetic
    const starCount = 700
    const pos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 400 + Math.random() * 400
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.45
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.6 + 30
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: '#9fc8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7 }),
    )
    scene.add(stars)
  }

  update(time: number): void {
    this.floorMat.uniforms.uTime.value = time
  }
}
