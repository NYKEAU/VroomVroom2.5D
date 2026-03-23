import * as THREE from 'three';

export default class Camera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.lastVehiclePos = new THREE.Vector3();
    this.vehicleSpeed = 0;      // smoothed speed (EMA)
    this.rawSpeed = 0;
  }

  update(vehiclePosition, deltaTime) {
    // Use passed deltaTime (from game clock) — avoid Date.now() jitter
    const dt = Math.min(deltaTime ?? 1 / 60, 0.05);

    // Smooth vehicle speed with exponential moving average to avoid jitter
    if (this.lastVehiclePos.lengthSq() > 0) {
      const dist = new THREE.Vector3().subVectors(vehiclePosition, this.lastVehiclePos).length();
      this.rawSpeed = dist / dt;
    }
    this.lastVehiclePos.copy(vehiclePosition);
    // EMA: blend toward rawSpeed slowly so sudden jolts don't change camera behaviour
    this.vehicleSpeed += (this.rawSpeed - this.vehicleSpeed) * 0.1;

    const speedFactor = Math.min(this.vehicleSpeed / 50, 1);

    const idealOffset = new THREE.Vector3(
      -3 - speedFactor * 2,
      8 + speedFactor * 2,
      22
    );

    const lookAheadFactor = 5 + speedFactor * 8;
    const targetPosition = new THREE.Vector3(
      vehiclePosition.x + lookAheadFactor,
      vehiclePosition.y + 3,
      0
    );

    // Lower stiffness so the spring doesn't amplify micro-vibrations
    const cameraStiffness = 2.5 + speedFactor * 2.0;
    const cameraDamping   = 2.5 + speedFactor * 0.5;

    const springForce  = new THREE.Vector3().subVectors(targetPosition, this.target).multiplyScalar(cameraStiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-cameraDamping);
    const acceleration = new THREE.Vector3().addVectors(springForce, dampingForce);

    this.velocity.add(acceleration.multiplyScalar(dt));
    this.target.add(this.velocity.clone().multiplyScalar(dt));

    const idealPosition = this.target.clone().add(idealOffset);

    // Fixed, conservative lerp — no speed-dependent jumps
    this.position.lerp(idealPosition, 0.06);

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
  }
}
