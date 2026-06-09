import * as THREE from 'three'

export interface CameraTarget {
  x: number
  z: number
  dirX: number
  dirZ: number
  speed: number
  alive: boolean
}

export interface ChaseCameraProfile {
  dist: number
  height: number
  lookAhead: number
  /** follow damping — higher settles faster after a turn */
  damp: number
  fovBase: number
  /** how much FOV widens with speed */
  fovSpeedK: number
}

export const DESKTOP_CAMERA: ChaseCameraProfile = {
  dist: 11,
  height: 5.5,
  lookAhead: 7,
  damp: 4.5,
  fovBase: 64,
  fovSpeedK: 0.28,
}

/**
 * Mobile profile tuned against motion sickness: higher and further back
 * (more top-down, so 90° turns sweep less of the screen), faster damping so
 * the swing settles quickly, and almost no speed-based FOV pumping.
 */
export const MOBILE_CAMERA: ChaseCameraProfile = {
  dist: 13,
  height: 7.6,
  lookAhead: 6,
  damp: 6,
  fovBase: 62,
  fovSpeedK: 0.08,
}

export class ChaseCamera {
  private readonly pos = new THREE.Vector3(0, 40, 60)
  private readonly look = new THREE.Vector3()
  private fov: number

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly profile: ChaseCameraProfile = DESKTOP_CAMERA,
  ) {
    this.fov = profile.fovBase
  }

  snapBehind(t: CameraTarget): void {
    const p = this.profile
    this.pos.set(t.x - t.dirX * p.dist, p.height, t.z - t.dirZ * p.dist)
    this.look.set(t.x + t.dirX * p.lookAhead, 1.2, t.z + t.dirZ * p.lookAhead)
    this.apply()
  }

  update(dt: number, t: CameraTarget): void {
    const p = this.profile
    let desired: THREE.Vector3
    let lookAt: THREE.Vector3
    if (t.alive) {
      desired = new THREE.Vector3(t.x - t.dirX * p.dist, p.height, t.z - t.dirZ * p.dist)
      lookAt = new THREE.Vector3(t.x + t.dirX * p.lookAhead, 1.2, t.z + t.dirZ * p.lookAhead)
    } else {
      desired = new THREE.Vector3(t.x * 0.3, 110, t.z * 0.3 + 70)
      lookAt = new THREE.Vector3(0, 0, 0)
    }
    const k = 1 - Math.exp(-dt * p.damp)
    this.pos.lerp(desired, k)
    this.look.lerp(lookAt, k)

    const targetFov = t.alive ? p.fovBase + t.speed * p.fovSpeedK : p.fovBase - 4
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-dt * 3))
    this.apply()
  }

  private apply(): void {
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
