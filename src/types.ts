import * as THREE from 'three';

export const MODES = {
  TREE: 'TREE',
  SCATTER: 'SCATTER',
  FOCUS: 'FOCUS'
} as const;

export type Mode = keyof typeof MODES;

export const STATE = {
  currentMode: MODES.TREE as Mode,
  handPos: { x: 0, y: 0 },
  isHandActive: false,
  focusTarget: null as Particle | null
};

export class Particle {
  mesh: THREE.Object3D;
  type: 'DECO' | 'DUST' | 'PHOTO';
  targetPos: THREE.Vector3;
  targetRot: THREE.Quaternion;
  targetScale: THREE.Vector3;
  velocity: THREE.Vector3;
  rotVel: THREE.Euler;

  constructor(mesh: THREE.Object3D, type: 'DECO' | 'DUST' | 'PHOTO' = 'DECO') {
    this.mesh = mesh;
    this.type = type;
    this.targetPos = new THREE.Vector3();
    this.targetRot = new THREE.Quaternion();
    this.targetScale = new THREE.Vector3(1, 1, 1);
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02
    );
    this.rotVel = new THREE.Euler(Math.random() * 0.02, Math.random() * 0.02, Math.random() * 0.02);
  }

  update(currentMode: Mode) {
    this.mesh.position.lerp(this.targetPos, 0.05);
    this.mesh.quaternion.slerp(this.targetRot, 0.05);
    this.mesh.scale.lerp(this.targetScale, 0.05);

    if (currentMode === MODES.SCATTER) {
      this.mesh.rotation.x += this.rotVel.x;
      this.mesh.rotation.y += this.rotVel.y;
    }
  }
}
