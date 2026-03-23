// TerrainPhysics.js — Cannon-ES body creation for terrain segments
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const COLLISION_GROUPS = { TERRAIN: 1, VEHICLE: 2, WHEELS: 4, DECORATIONS: 8 };
const DEBUG = { SHOW_PHYSICS: false };
const TERRAIN_PHYSICS_CONFIG = { SEGMENT_STEP: 1, SKIP_MINOR_SEGMENTS: false };

export default class TerrainPhysics {
  constructor(physicsWorld, terrainConfig, terrainPhysicsMaterial, groundMaterial, segmentDepth, scene, seededRandom) {
    this.physicsWorld = physicsWorld;
    this.terrainConfig = terrainConfig;
    this.terrainMaterial = terrainPhysicsMaterial;
    this.groundMaterial = groundMaterial;
    this.segmentDepth = segmentDepth;
    this.scene = scene;
    this.seededRandom = seededRandom; // bound function from TerrainGenerator
  }

  getSegmentRigidity(chunkType) {
    switch (chunkType) {
      case 'gap': return 0.1;
      case 'ramp': return 1.5;
      case 'washboard': return 1.2;
      case 'valley': return 0.8;
      case 'plateau': return 1.0;
      default: return 1.0;
    }
  }

  createPhysicsForSegment(points, bodiesArray, chunkType) {
    const skipMinorSegments = TERRAIN_PHYSICS_CONFIG.SKIP_MINOR_SEGMENTS;
    const segmentStep = TERRAIN_PHYSICS_CONFIG.SEGMENT_STEP || 1;
    const rigidityMultiplier = this.getSegmentRigidity(chunkType);
    this.createSideBarriers(points, bodiesArray, rigidityMultiplier);
    this.createPhysicsSegment(points, bodiesArray, segmentStep, skipMinorSegments);
    this.createBackgroundPhysics(points, bodiesArray, rigidityMultiplier);
  }

  createSideBarriers(points, bodiesArray, rigidityMultiplier) {
    if (!points || points.length < 2) return;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const segmentLength = endX - startX;
    const barrierHeight = 15;
    const barrierThickness = 1;
    [-1, 1].forEach((side) => {
      const zOffset = side * (this.terrainConfig.central.width / 2 + this.terrainConfig.borders.width / 2);
      let avgHeight = 0;
      points.forEach((point) => { if (point.height !== null) avgHeight += point.height; });
      avgHeight /= points.filter((p) => p.height !== null).length;
      const barrierShape = new CANNON.Box(new CANNON.Vec3(segmentLength / 2, barrierHeight / 2, barrierThickness / 2));
      const barrierBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(startX + segmentLength / 2, avgHeight + barrierHeight / 2, zOffset),
        shape: barrierShape,
        material: this.terrainMaterial,
      });
      barrierBody.material = this.terrainMaterial;
      barrierBody.collisionFilterGroup = COLLISION_GROUPS.TERRAIN;
      barrierBody.collisionFilterMask = COLLISION_GROUPS.VEHICLE | COLLISION_GROUPS.WHEELS;
      barrierBody._terrainDebug = 'barrier';
      this.physicsWorld.addBody(barrierBody);
      bodiesArray.push(barrierBody);
      if (DEBUG.SHOW_PHYSICS) {
        const barrierMesh = new THREE.Mesh(
          new THREE.BoxGeometry(segmentLength, barrierHeight, barrierThickness),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.3 })
        );
        barrierMesh.position.set(startX + segmentLength / 2, avgHeight + barrierHeight / 2, zOffset);
        this.scene.add(barrierMesh);
      }
    });
  }

  createBackgroundPhysics(points, bodiesArray, rigidityMultiplier) {
    if (!points || points.length < 2) return;
    try {
      const bgDepth = this.terrainConfig.borders.width * 2;
      const startX = points[0].x;
      const endX = points[points.length - 1].x;
      const segmentLength = endX - startX;
      [-1, 1].forEach((side) => {
        const baseZ = side * (this.terrainConfig.central.width / 2 + this.terrainConfig.borders.width / 2);
        const depthLevels = [0.3, 0.7, 1.0];
        depthLevels.forEach((depthFactor) => {
          const zOffset = baseZ * depthFactor;
          const subsegments = 3;
          const subsegmentLength = segmentLength / subsegments;
          for (let i = 0; i < subsegments; i++) {
            const subsegmentX = startX + i * subsegmentLength;
            const startIdx = Math.floor((i * points.length) / subsegments);
            const endIdx = Math.floor(((i + 1) * points.length) / subsegments);
            let avgHeight = 0;
            let count = 0;
            for (let j = startIdx; j < endIdx; j++) {
              if (points[j] && points[j].height !== null) { avgHeight += points[j].height; count++; }
            }
            if (count > 0) {
              avgHeight /= count;
              const heightVariation = (1 - depthFactor) * 5 * (this.seededRandom() * 2 - 1);
              avgHeight += heightVariation;
              const bgBodyShape = new CANNON.Box(new CANNON.Vec3(subsegmentLength / 2, 5, bgDepth / depthLevels.length / 2));
              const bgBody = new CANNON.Body({
                mass: 0,
                position: new CANNON.Vec3(subsegmentX + subsegmentLength / 2, avgHeight + 2, zOffset),
                shape: bgBodyShape,
                material: this.terrainMaterial,
              });
              bgBody.collisionFilterGroup = COLLISION_GROUPS.TERRAIN;
              bgBody.collisionFilterMask = COLLISION_GROUPS.VEHICLE | COLLISION_GROUPS.WHEELS;
              bgBody._terrainDebug = 'background';
              this.physicsWorld.addBody(bgBody);
              bodiesArray.push(bgBody);
              if (DEBUG.SHOW_PHYSICS) {
                const bgMesh = new THREE.Mesh(
                  new THREE.BoxGeometry(subsegmentLength, 10, bgDepth / depthLevels.length),
                  new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.2 })
                );
                bgMesh.position.copy(bgBody.position);
                this.scene.add(bgMesh);
              }
            }
          }
        });
      });
    } catch (error) {
      console.error("Erreur lors de la création de la physique d'arrière-plan:", error);
    }
  }

  createBottomBarrier(startX, endX, bodiesArray) {
    const width = endX - startX;
    const barrierShape = new CANNON.Box(new CANNON.Vec3(width / 2, 2, this.segmentDepth / 2));
    const barrierBody = new CANNON.Body({ mass: 0, material: this.groundMaterial, collisionFilterGroup: 1, collisionFilterMask: 1 });
    barrierBody.addShape(barrierShape);
    barrierBody.position.set(startX + width / 2, -30, 0);
    this.physicsWorld.addBody(barrierBody);
    bodiesArray.push(barrierBody);
  }

  createPhysicsSegment(points, bodiesArray, segmentStep = 1, skipMinorSegments = false) {
    const groundMaterial = this.groundMaterial;
    // solidDepth=2: thin enough to not create phantom walls on steep slopes,
    // thick enough to avoid tunneling. SEGMENT_STEP=1 closes surface gaps.
    const solidDepth = 2;
    for (let i = 0; i < points.length - 1; i += segmentStep) {
      const p1 = points[i];
      const p2 = points[Math.min(i + segmentStep, points.length - 1)];
      const segmentLength = Math.abs(p2.x - p1.x);
      if (skipMinorSegments && segmentLength < 0.5) continue;
      const width = segmentLength;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const cx = (p2.x + p1.x) / 2;
      const cy = (p2.y + p1.y) / 2;
      const segmentShape = new CANNON.Box(new CANNON.Vec3(width / 2, solidDepth / 2, 100));
      const segmentBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(cx, cy - solidDepth / 2, 0), material: groundMaterial });
      segmentBody.addShape(segmentShape);
      segmentBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
      segmentBody._terrainDebug = 'segment';
      this.physicsWorld.addBody(segmentBody);
      bodiesArray.push(segmentBody);
    }
  }
}
