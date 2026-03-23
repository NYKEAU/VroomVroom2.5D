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
    // Création d'un groupe pour le chassis de la voiture télécommandée
    const chassisGroup = new THREE.Group();
    this.scene.add(chassisGroup);

    // Base du chassis (plateforme principale)
    const baseGeometry = new THREE.BoxGeometry(3, 0.2, 2.8);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333, // Gris foncé pour le châssis
      roughness: 0.5,
      metalness: 0.3,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.set(0.3, -0.2, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    chassisGroup.add(baseMesh);

    // Carrosserie principale (corps de la RC car)
    const bodyGeometry = new THREE.BoxGeometry(2.6, 0.4, 2.4);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3300, // Rouge vif typique des RC cars
      roughness: 0.3,
      metalness: 0.5,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.set(0.3, 0.1, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // Cockpit/capot avant incliné
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 0.3, 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3300, // Même couleur que le corps
      roughness: 0.3,
      metalness: 0.5,
    });
    const cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpitMesh.position.set(1.2, 0.2, 0);
    cockpitMesh.rotation.z = -Math.PI * 0.1; // Légère inclinaison pour l'aérodynamisme
    cockpitMesh.castShadow = true;
    cockpitMesh.receiveShadow = true;
    chassisGroup.add(cockpitMesh);

    // Pare-chocs avant
    const frontBumperGeometry = new THREE.BoxGeometry(0.3, 0.3, 2.6);
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222, // Noir pour les pare-chocs
      roughness: 0.7,
      metalness: 0.2,
    });
    const frontBumperMesh = new THREE.Mesh(frontBumperGeometry, bumperMaterial);
    frontBumperMesh.position.set(1.8, -0.1, 0);
    frontBumperMesh.castShadow = true;
    frontBumperMesh.receiveShadow = true;
    chassisGroup.add(frontBumperMesh);

    // Pare-chocs arrière
    const rearBumperGeometry = new THREE.BoxGeometry(0.3, 0.3, 2.6);
    const rearBumperMesh = new THREE.Mesh(rearBumperGeometry, bumperMaterial);
    rearBumperMesh.position.set(-1.2, -0.1, 0);
    rearBumperMesh.castShadow = true;
    rearBumperMesh.receiveShadow = true;
    chassisGroup.add(rearBumperMesh);

    // Aileron arrière (élément caractéristique des RC cars)
    const spoilerGeometry = new THREE.BoxGeometry(0.5, 0.1, 2.2);
    const spoilerMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000, // Noir pour l'aileron
      roughness: 0.5,
      metalness: 0.3,
    });
    const spoilerMesh = new THREE.Mesh(spoilerGeometry, spoilerMaterial);
    spoilerMesh.position.set(-1.1, 0.4, 0);
    spoilerMesh.castShadow = true;
    spoilerMesh.receiveShadow = true;
    chassisGroup.add(spoilerMesh);

    // Supports d'aileron (2 montants)
    const supportGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const supportMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.5,
      metalness: 0.3,
    });

    const supportLeft = new THREE.Mesh(supportGeometry, supportMaterial);
    supportLeft.position.set(-1.1, 0.2, 0.8);
    chassisGroup.add(supportLeft);

    const supportRight = new THREE.Mesh(supportGeometry, supportMaterial);
    supportRight.position.set(-1.1, 0.2, -0.8);
    chassisGroup.add(supportRight);

    // Antenne (élément typique des RC cars)
    const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4);
    const antennaMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.5,
      metalness: 0.7,
    });
    const antennaMesh = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antennaMesh.position.set(0, 0.8, 0);
    antennaMesh.rotation.x = Math.PI * 0.1; // Légèrement inclinée vers l'arrière
    chassisGroup.add(antennaMesh);

    // Assigner le groupe comme chassis pour le véhicule
    this.meshes.chassis = chassisGroup;

    // Roues avec un aspect plus détaillé - INCHANGÉ comme demandé
    for (let i = 0; i < 4; i++) {
      // Groupe pour contenir la roue et ses détails
      const wheelGroup = new THREE.Group();

      // Pneu principal
      const sphereGeometry = new THREE.SphereGeometry(0.8);
      const sphereMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.9,
        metalness: 0.1,
      });
      const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphereMesh.castShadow = true;
      sphereMesh.receiveShadow = true;
      wheelGroup.add(sphereMesh);

      // Jante (un peu plus petite)
      const hubGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
      const hubMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.2,
        metalness: 0.8,
      });
      const hubMesh = new THREE.Mesh(hubGeometry, hubMaterial);
      hubMesh.rotation.x = Math.PI / 2; // Orienter correctement
      hubMesh.castShadow = true;
      wheelGroup.add(hubMesh);

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
        if (force > 0 && wheelAngularSpeed >= this.maxWheelAngularVelocity) {
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
