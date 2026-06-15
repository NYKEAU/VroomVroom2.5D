import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export default class Vehicle {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.vehicle = null;
    this.carBody = null;
    this.wheelBodies = [];
    this.meshes = {
      chassis: null,
      wheels: [],
    };

    // Limites de vitesse et état du véhicule
    this.maxWheelAngularVelocity = 35;
    this.inAir = false; // Calculé depuis Game.js via hauteur terrain

    // Matériau pour les roues
    this.wheelMaterial = new CANNON.Material('wheel');
    this.setupContactMaterial();
    this.setupVehicle();
    this.setupVisuals();
  }

  setupContactMaterial() {
    // Configuration du matériau de contact entre roues et sol
    const groundMaterial = new CANNON.Material('ground');
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(
      this.wheelMaterial,
      groundMaterial,
      {
        friction: 0.8,
        restitution: 0.01,
        contactEquationStiffness: 1e6,
        contactEquationRelaxation: 10,
      }
    );
    this.physicsWorld.addContactMaterial(wheelGroundContactMaterial);
    this.groundMaterial = groundMaterial;

    // Exposer le groundMaterial pour que d'autres composants (comme Terrain) puissent l'utiliser
    return groundMaterial;
  }

  setupVehicle() {
    // Création du châssis - Modifications pour le rendre extrêmement léger et réactif
    this.carBody = new CANNON.Body({
      mass: 1.5, // Masse drastiquement réduite (était 3) pour un comportement ultra-léger
      position: new CANNON.Vec3(5, 7, 0), // Position initiale
      shape: new CANNON.Box(new CANNON.Vec3(1.5, 0.4, 1.5)), // Châssis compact
      angularDamping: 0.4, // Amortissement modéré — évite les rotations parasites au sol
      linearDamping: 0.02, // Presque pas d'amortissement linéaire pour glisser partout
      allowSleep: true,
    });

    // Ajuster le centre de masse vers l'avant et vers le haut pour favoriser les wheelies et front flips
    this.carBody.shapeOffsets[0] = new CANNON.Vec3(0.4, 0.2, 0);

    // Contraindre le mouvement pour rester en 2.5D
    this.carBody.linearFactor = new CANNON.Vec3(1, 1, 0);
    this.carBody.angularFactor = new CANNON.Vec3(0, 0, 1);

    // Paramètres de sommeil pour optimiser les performances
    this.carBody.sleepSpeedLimit = 0.5;
    this.carBody.sleepTimeLimit = 1.0;

    // Création du véhicule rigide
    this.vehicle = new CANNON.RigidVehicle({
      chassisBody: this.carBody,
    });

    // Ajout des roues
    this.addWheels();

    // Ajouter le véhicule au monde physique
    this.vehicle.addToWorld(this.physicsWorld);
  }

  addWheels() {
    const mass = 0.1; // Masse des roues très réduite pour un effet ultra-léger
    const axisWidth = 3;
    const wheelShape = new CANNON.Sphere(0.8);
    const down = new CANNON.Vec3(0, -1, 0);

    // Configuration des positions des roues
    const wheelPositions = [
      { pos: new CANNON.Vec3(-0.8, -0.6, axisWidth / 2), isFront: true },
      { pos: new CANNON.Vec3(-0.8, -0.6, -axisWidth / 2), isFront: true },
      { pos: new CANNON.Vec3(1.2, -0.6, axisWidth / 2), isFront: false },
      { pos: new CANNON.Vec3(1.2, -0.6, -axisWidth / 2), isFront: false },
    ];

    // Création des roues
    wheelPositions.forEach((wheel, index) => {
      const wheelBody = new CANNON.Body({
        mass,
        material: this.wheelMaterial,
      });

      wheelBody.addShape(wheelShape);
      wheelBody.angularDamping = 0.05; // Réduit drastiquement pour favoriser la rotation des roues
      wheelBody.linearFactor = new CANNON.Vec3(1, 1, 0); // Contrainte en Z

      this.vehicle.addWheel({
        body: wheelBody,
        position: wheel.pos,
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down,
      });

      this.wheelBodies.push(wheelBody);
    });
  }

  setupVisuals() {
    // ─── CHASSIS ──────────────────────────────────────────────────────────────
    const chassisGroup = new THREE.Group();
    this.scene.add(chassisGroup);

    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2d20, roughness: 0.3, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.5 });

    // 1. Skid plate (plaque de base noire)
    const skidMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.15, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 })
    );
    skidMesh.position.set(0, 0, 0);
    skidMesh.castShadow = true;
    skidMesh.receiveShadow = true;
    chassisGroup.add(skidMesh);

    // 2. Corps principal
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), redMat);
    bodyMesh.position.set(0.1, 0.45, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // 3. Capot avant incliné
    const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 1.8), redMat);
    hoodMesh.position.set(1.1, 0.55, 0);
    hoodMesh.rotation.z = -0.15;
    hoodMesh.castShadow = true;
    hoodMesh.receiveShadow = true;
    chassisGroup.add(hoodMesh);

    // 4. Roll cage — deux montants verticaux + barre de toit
    const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
    const pillarL = new THREE.Mesh(pillarGeo, darkMat);
    pillarL.position.set(-0.3, 0.75, 0.7);
    pillarL.castShadow = true;
    chassisGroup.add(pillarL);

    const pillarR = new THREE.Mesh(pillarGeo, darkMat);
    pillarR.position.set(-0.3, 0.75, -0.7);
    pillarR.castShadow = true;
    chassisGroup.add(pillarR);

    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1.2), darkMat);
    roofBar.position.set(-0.3, 1.15, 0);
    roofBar.castShadow = true;
    chassisGroup.add(roofBar);

    // 5. Pare-chocs avant (bull bar) + renforts diagonaux
    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 2.2), darkMat);
    bullBar.position.set(1.65, 0.3, 0);
    bullBar.castShadow = true;
    bullBar.receiveShadow = true;
    chassisGroup.add(bullBar);

    for (const side of [0.7, -0.7]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), darkMat);
      brace.position.set(1.65, 0.3, side);
      brace.rotation.z = 0.4;
      brace.castShadow = true;
      chassisGroup.add(brace);
    }

    // 6. Aileron arrière — plaque + deux supports cylindriques
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 2.0), redMat);
    wing.position.set(-1.4, 1.1, 0);
    wing.castShadow = true;
    chassisGroup.add(wing);

    const wingSupportGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
    for (const side of [0.7, -0.7]) {
      const ws = new THREE.Mesh(wingSupportGeo, darkMat);
      ws.position.set(-1.4, 0.85, side);
      ws.castShadow = true;
      chassisGroup.add(ws);
    }

    // 7. Antenne
    const antennaMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.7 })
    );
    antennaMesh.position.set(-0.8, 1.4, 0.6);
    antennaMesh.rotation.x = 0.15;
    antennaMesh.castShadow = true;
    chassisGroup.add(antennaMesh);

    chassisGroup.traverse((obj) => {
      if (obj.isMesh) obj.material.userData.outlineParameters = { visible: false };
    });
    this.meshes.chassis = chassisGroup;

    // ─── ROUES ────────────────────────────────────────────────────────────────
    const cramponGeo = new THREE.BoxGeometry(0.05, 0.18, 0.65);
    const cramponMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });

    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group();

      // 1. Pneu principal
      const tireMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 0.65, 12),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.05 })
      );
      tireMesh.rotation.x = Math.PI / 2;
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;
      wheelGroup.add(tireMesh);

      // Crampons — 4 répartis à 90° d'intervalle en couronne
      for (let c = 0; c < 4; c++) {
        const angle = c * (Math.PI / 2);
        const crampon = new THREE.Mesh(cramponGeo, cramponMat);
        crampon.position.set(0.9 * Math.cos(angle), 0.9 * Math.sin(angle), 0);
        crampon.rotation.z = angle;
        crampon.castShadow = true;
        wheelGroup.add(crampon);
      }

      // 2. Jante centrale
      const rimMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.68, 8),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 })
      );
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.castShadow = true;
      wheelGroup.add(rimMesh);

      // 3. Centre de jante (moyeu rouge)
      const hubMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.7, 6),
        new THREE.MeshStandardMaterial({ color: 0xff2d20, roughness: 0.4, metalness: 0.5 })
      );
      hubMesh.rotation.x = Math.PI / 2;
      hubMesh.castShadow = true;
      wheelGroup.add(hubMesh);

      wheelGroup.traverse((obj) => {
        if (obj.isMesh) obj.material.userData.outlineParameters = { visible: false };
      });
      this.scene.add(wheelGroup);
      this.meshes.wheels.push(wheelGroup);
    }
  }

  // Méthodes de contrôle
  setWheelForce(force, wheelIndex) {
    this.vehicle.setWheelForce(force, wheelIndex);
  }

  // Appliquer des forces à toutes les roues
  applyForceToAllWheels(force) {
    for (let i = 0; i < 4; i++) {
      if (this.wheelBodies[i]) {
        const wheelAngularSpeed = Math.abs(
          this.wheelBodies[i].angularVelocity.z
        );
        if (wheelAngularSpeed >= this.maxWheelAngularVelocity) {
          this.vehicle.setWheelForce(0, i);
        } else {
          this.vehicle.setWheelForce(force, i);
        }
      }
    }
  }

  // Appliquer une rotation en l'air
  applyAirControl(direction) {
    if (this.inAir) {
      const airTorque = 20 * direction;
      this.carBody.applyTorque(new CANNON.Vec3(0, 0, airTorque));
      return true;
    }
    return false;
  }

  // Méthode pour réinitialiser le véhicule
  reset(terrainHeightFunction) {
    if (!this.carBody || !this.vehicle) {
      console.warn("Tentative de réinitialiser un véhicule qui n'existe plus.");
      return;
    }

    const resetX = this.carBody.position.x;
    const resetY = terrainHeightFunction
      ? terrainHeightFunction(resetX) + 7
      : 12;

    this.carBody.position.set(resetX, resetY, 0);
    this.carBody.quaternion.set(0, 0, 0, 1);
    this.carBody.velocity.set(0, 0, 0);
    this.carBody.angularVelocity.set(0, 0, 0);

    if (this.vehicle.wheels && Array.isArray(this.vehicle.wheels)) {
      this.vehicle.wheels.forEach((wheel) => {
        if (wheel && wheel.body) {
          wheel.body.velocity.set(0, 0, 0);
          wheel.body.angularVelocity.set(0, 0, 0);
        }
      });
    }
  }

  // Méthode pour stabiliser le véhicule (éviter les retournements)
  stabilize() {
    const upVector = new CANNON.Vec3(0, 1, 0);
    const carUpVector = new CANNON.Vec3();
    this.carBody.vectorToWorldFrame(upVector, carUpVector);

    if (carUpVector.y < -0.9) {
      if (
        this.vehicle &&
        this.vehicle.wheels &&
        Array.isArray(this.vehicle.wheels)
      ) {
        this.vehicle.wheels.forEach((wheel) => {
          if (wheel && wheel.sideFriction !== undefined) {
            wheel.sideFriction = 2.0;
          }
        });
      }
    } else if (carUpVector.y >= 0.1) {
      if (
        this.vehicle &&
        this.vehicle.wheels &&
        Array.isArray(this.vehicle.wheels)
      ) {
        this.vehicle.wheels.forEach((wheel) => {
          if (wheel && wheel.sideFriction !== undefined) {
            wheel.sideFriction = 1;
          }
        });
      }
    }

    // Plafond de vitesse angulaire — évite les rotations incontrôlables
    const MAX_ANG_VEL = 14;
    if (Math.abs(this.carBody.angularVelocity.z) > MAX_ANG_VEL) {
      this.carBody.angularVelocity.z =
        Math.sign(this.carBody.angularVelocity.z) * MAX_ANG_VEL;
    }

    // Centrer le véhicule sur l'axe Z
    if (Math.abs(this.carBody.position.z) > 0.1) {
      const centeringForce = new CANNON.Vec3(
        0,
        0,
        -this.carBody.position.z * 10
      );
      this.carBody.applyForce(centeringForce, this.carBody.position);
    }
  }

  // Méthode pour mettre à jour les visuels en fonction de la physique
  update() {
    try {
      if (this.meshes && this.meshes.chassis && this.carBody) {
        this.meshes.chassis.position.copy(this.carBody.position);
        this.meshes.chassis.quaternion.copy(this.carBody.quaternion);
      }

      if (
        this.wheelBodies &&
        this.meshes &&
        this.meshes.wheels &&
        Array.isArray(this.wheelBodies) &&
        Array.isArray(this.meshes.wheels)
      ) {
        const count = Math.min(
          this.wheelBodies.length,
          this.meshes.wheels.length
        );

        for (let index = 0; index < this.wheelBodies.length; index++) {
          const wheelBody = this.wheelBodies[index];
          if (wheelBody) {
            if (
              Math.abs(wheelBody.angularVelocity.z) >
              this.maxWheelAngularVelocity
            ) {
              const direction = wheelBody.angularVelocity.z > 0 ? 1 : -1;
              wheelBody.angularVelocity.z =
                this.maxWheelAngularVelocity * direction;
            }
          }
        }

        for (let index = 0; index < count; index++) {
          const wheelBody = this.wheelBodies[index];
          const wheelMesh = this.meshes.wheels[index];

          if (wheelMesh && wheelBody) {
            wheelMesh.position.copy(wheelBody.position);
            wheelMesh.quaternion.copy(wheelBody.quaternion);
          }
        }
      }
    } catch (error) {
      console.warn(
        'Erreur lors de la mise à jour visuelle du véhicule:',
        error
      );
    }
  }

  getChassisBody() {
    return this.carBody;
  }

  isInAir() {
    return this.inAir;
  }

  getSpeedKmh() {
    if (!this.carBody) return 0;
    const speed = this.carBody.velocity.length() * 3.6;
    return Math.round(speed);
  }

  get mesh() {
    return this.meshes.chassis;
  }
}
