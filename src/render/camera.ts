import * as THREE from 'three'

export interface CameraTarget {
  x: number
  z: number
  dirX: number
  dirZ: number
  speed: number
  alive: boolean
}

/**
 * Third-person chase camera: damped follow behind the bike, look-ahead down
 * the track, FOV widens with speed. When the player derezzes it floats up to
 * a spectator overview of the arena.
 */
export class ChaseCamera {
  private readonly pos = new THREE.Vector3(0, 40, 60)
  private readonly look = new THREE.Vector3()
  private fov = 68

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  snapBehind(t: CameraTarget): void {
    this.pos.set(t.x - t.dirX * 11, 5.5, t.z - t.dirZ * 11)
    this.look.set(t.x + t.dirX * 7, 1.2, t.z + t.dirZ * 7)
    this.apply()
  }

  update(dt: number, t: CameraTarget): void {
    let desired: THREE.Vector3
    let lookAt: THREE.Vector3
    if (t.alive) {
      desired = new THREE.Vector3(t.x - t.dirX * 11, 5.5, t.z - t.dirZ * 11)
      lookAt = new THREE.Vector3(t.x + t.dirX * 7, 1.2, t.z + t.dirZ * 7)
    } else {
      desired = new THREE.Vector3(t.x * 0.3, 110, t.z * 0.3 + 70)
      lookAt = new THREE.Vector3(0, 0, 0)
    }
    const k = 1 - Math.exp(-dt * 4.5)
    this.pos.lerp(desired, k)
    this.look.lerp(lookAt, k)

    const targetFov = t.alive ? 64 + t.speed * 0.28 : 60
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
