import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export interface RendererOptions {
  /** cap on devicePixelRatio — lower on mobile GPUs, bloom is fill-rate heavy */
  maxDpr?: number
  bloomStrength?: number
}

export class GameRenderer {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly onResizeBound = () => this.onResize()

  constructor(container: HTMLElement, opts: RendererOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxDpr ?? 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color('#04060e')
    this.scene.fog = new THREE.FogExp2('#070a18', 0.0048)

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200)
    this.camera.position.set(0, 60, 120)

    this.scene.add(new THREE.AmbientLight('#26344f', 1.2))
    const key = new THREE.DirectionalLight('#7fa8ff', 0.9)
    key.position.set(60, 120, 40)
    this.scene.add(key)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      opts.bloomStrength ?? 1.05,
      0.55, // radius
      0.2, // threshold
    )
    this.composer.addPass(bloom)
    this.composer.addPass(new OutputPass())

    window.addEventListener('resize', this.onResizeBound)
  }

  render(): void {
    this.composer.render()
  }

  private onResize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResizeBound)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
