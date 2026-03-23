// Terrain.js — Orchestrator: chunk streaming, LOD, cleanup
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import TerrainGenerator from './TerrainGenerator.js';
import TerrainDecorations from './TerrainDecorations.js';
import TerrainPhysics from './TerrainPhysics.js';

const TERRAIN_CONFIG = {
  VISIBLE_CHUNKS_AHEAD: 5,
  VISIBLE_CHUNKS_BEHIND: 5,
  DECORATION_DENSITY: { TREE: 0.1, ROCK: 0.1, SIGN: 0.2 },
  LOD_DISTANCES: { HIGH: 100, MEDIUM: 200, LOW: 400 },
  PHYSICS_SIMPLIFICATION: { SEGMENT_STEP: 3, SKIP_MINOR_SEGMENTS: true },
};

const DEBUG = { SHOW_PHYSICS: false, WIREFRAME: false };

export default class Terrain {
  constructor(scene, physicsWorld, seed = Math.floor(Math.random() * 1000000)) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.terrainMeshes = [];
    this.segmentWidth = 40;
    this.segmentDepth = 8;
    this.visibleSegments = 15;

    this.terrainConfig = {
      central: { width: 6, hasCollision: true },
      borders: { width: 50, hasCollision: false },
    };
    this.totalWidth = this.terrainConfig.central.width + this.terrainConfig.borders.width * 2;

    // Visual materials
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d572c, roughness: 0.8, metalness: 0.2, wireframe: false, flatShading: false, side: THREE.DoubleSide,
    });
    this.borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e3e1e, roughness: 0.9, metalness: 0.1, wireframe: false, flatShading: false, side: THREE.DoubleSide,
    });

    // Physics materials
    this.terrainPhysicsMaterial = new CANNON.Material('terrain');
    this.groundMaterial = new CANNON.Material('ground');
    const wheelGroundContact = new CANNON.ContactMaterial(
      new CANNON.Material('wheel'),
      this.groundMaterial,
      { friction: 0.8, restitution: 0.1, contactEquationStiffness: 1e6 }
    );
    if (this.physicsWorld) this.physicsWorld.addContactMaterial(wheelGroundContact);

    // Sub-modules
    this.generator = new TerrainGenerator(seed, this.terrainMeshes, this.segmentWidth);
    this.decorModule = new TerrainDecorations(
      scene,
      this.generator.seededRandom.bind(this.generator),
      this.terrainConfig
    );
    this.physicsModule = new TerrainPhysics(
      physicsWorld,
      this.terrainConfig,
      this.terrainPhysicsMaterial,
      this.groundMaterial,
      this.segmentDepth,
      scene,
      this.generator.seededRandom.bind(this.generator)
    );

    this.initialTerrainWidth = 400;
    this.initialize();
  }

  // ── Delegation helpers ───────────────────────────────────────────────────────

  getTerrainHeightAt(x) { return this.generator.getTerrainHeightAt(x); }
  getTerrainHeightNear(x) { return this.generator.getTerrainHeightNear(x); }

  // ── Initialization ───────────────────────────────────────────────────────────

  initialize() {
    console.log('Initialisation complète du terrain avec tous les segments');
    const initialSegments = 20;
    const startOffset = -5;
    for (let i = startOffset; i < initialSegments + startOffset; i++) {
      this.createTerrainSegment(i * this.segmentWidth, false);
    }
    this.terrainMeshes.forEach((segment) => {
      if (segment.meshes) {
        segment.meshes.forEach((mesh) => { if (!mesh.parent) this.scene.add(mesh); });
      }
    });
    this.generator.chunkHistory = this.terrainMeshes.map((segment) => segment.chunkType);
    console.log(`Terrain initialisé avec ${this.terrainMeshes.length} segments complets`);
  }

  generateAdditionalSegments() {
    console.log('Génération des segments additionnels...');
    this.terrainMeshes.forEach((segment) => {
      if (segment.decorations && segment.decorations.length === 0) {
        this.decorModule.addTerrainDecorations(segment.startX, segment.points, segment.chunkType, segment.decorations);
      }
    });
    const totalSegments = 30;
    const existingSegments = this.terrainMeshes.length;
    const remainingSegments = Math.max(0, totalSegments - existingSegments);
    if (remainingSegments <= 0) {
      console.log('Aucun segment supplémentaire à générer');
      return;
    }
    this.scheduleRemainingSegments(existingSegments);
  }

  scheduleRemainingSegments(startIndex) {
    let currentIndex = 8;
    const generateNextBatch = () => {
      const batchSize = 5;
      let segmentsCreated = 0;
      for (let i = 0; i < batchSize; i++) {
        const segmentX = (currentIndex + i) * this.segmentWidth;
        const exists = this.terrainMeshes.some((segment) => Math.abs(segment.startX - segmentX) < 0.1);
        if (!exists) { this.createTerrainSegment(segmentX); segmentsCreated++; }
      }
      currentIndex += batchSize;
      if (currentIndex < 30 && segmentsCreated > 0) {
        setTimeout(generateNextBatch, 300);
      } else {
        console.log('Génération des segments additionnels terminée');
      }
    };
    setTimeout(generateNextBatch, 300);
  }

  // ── Segment creation ─────────────────────────────────────────────────────────

  createTerrainSegment(startX, priorityCreate = false) {
    const difficulty = Math.min(0.99, Math.max(0, Math.abs(startX) / 5000));
    const chunkType = this.generator.selectChunkType(difficulty);
    const nbPoints = 30;
    const previousEndHeight =
      this.terrainMeshes.length > 0
        ? this.terrainMeshes[this.terrainMeshes.length - 1].points[
            this.terrainMeshes[this.terrainMeshes.length - 1].points.length - 1
          ].height
        : null;

    const points = [];
    for (let i = 0; i < nbPoints; i++) {
      const x = startX + (i / (nbPoints - 1)) * this.segmentWidth;
      const isGap = chunkType === 'gap' && (i / (nbPoints - 1)) > 0.3 && (i / (nbPoints - 1)) < 0.7;
      let y = 0;
      switch (chunkType) {
        case 'hills':    y = this.generator.generateHills(x, startX, startX + this.segmentWidth, difficulty); break;
        case 'plateau':  y = this.generator.generatePlateau(x, startX, startX + this.segmentWidth, difficulty); break;
        case 'ramp':     y = this.generator.generateRamp(x, startX, startX + this.segmentWidth, difficulty); break;
        case 'gap':      y = this.generator.generateGap(x, startX, startX + this.segmentWidth, difficulty); break;
        case 'washboard':y = this.generator.generateWashboard(x, startX, startX + this.segmentWidth, difficulty); break;
        case 'valley':   y = this.generator.generateValley(x, startX, startX + this.segmentWidth, difficulty); break;
        default:         y = this.generator.generateHills(x, startX, startX + this.segmentWidth, difficulty);
      }
      // Raccord exact au 1er point, lerp quintic sur les 10 premiers
      if (i === 0 && previousEndHeight !== null) {
        y = previousEndHeight;
      } else if (i > 0 && i < 10 && previousEndHeight !== null) {
        const blendFactor = 1 - this.generator.quinticInterpolation(i / 10);
        y = previousEndHeight * blendFactor + y * (1 - blendFactor);
      }
      points.push({ x, y: isGap ? -24 : y, height: isGap ? null : y });
    }
    // Contrainte de pente : delta max 2.0 unités entre points consécutifs
    for (let i = 1; i < points.length; i++) {
      if (points[i].height === null || points[i - 1].height === null) continue;
      const delta = points[i].y - points[i - 1].y;
      if (Math.abs(delta) > 2.0) {
        points[i].y = points[i - 1].y + Math.sign(delta) * 2.0;
        points[i].height = points[i].y;
      }
    }

    const terrainMeshes = [];
    const terrainBodies = [];

    const CHUNK_COLORS = {
      hills:     { central: 0x4a9e3f, border: 0x2d6e25 },
      plateau:   { central: 0x7ab648, border: 0x4a8a28 },
      ramp:      { central: 0xc8a96e, border: 0x8a6a3a },
      washboard: { central: 0x8b7355, border: 0x5a4a30 },
      valley:    { central: 0x5b8c3e, border: 0x2d5a1e },
      gap:       { central: 0x2d4a1e, border: 0x1a2e10 },
    };
    const colors = CHUNK_COLORS[chunkType] ?? CHUNK_COLORS.hills;
    const prevSegment = this.terrainMeshes.length > 0 ? this.terrainMeshes[this.terrainMeshes.length - 1] : null;
    const prevColors = prevSegment ? (CHUNK_COLORS[prevSegment.chunkType] ?? CHUNK_COLORS.hills) : null;

    const centralCurrent = new THREE.Color(colors.central);
    const centralPrev    = prevColors ? new THREE.Color(prevColors.central) : null;
    const borderCurrent  = new THREE.Color(colors.border);
    const borderPrev     = prevColors ? new THREE.Color(prevColors.border)  : null;

    const centralMesh = this.createTerrainMeshPart(points, -this.terrainConfig.central.width / 2, this.terrainConfig.central.width, this.terrainMaterial, 'central', centralCurrent, centralPrev);
    terrainMeshes.push(centralMesh);
    const leftBorderMesh = this.createTerrainMeshPart(points, -this.terrainConfig.central.width / 2 - this.terrainConfig.borders.width, this.terrainConfig.borders.width, this.borderMaterial, 'left', borderCurrent, borderPrev);
    terrainMeshes.push(leftBorderMesh);
    const rightBorderMesh = this.createTerrainMeshPart(points, this.terrainConfig.central.width / 2, this.terrainConfig.borders.width, this.borderMaterial, 'right', borderCurrent, borderPrev);
    terrainMeshes.push(rightBorderMesh);

    terrainMeshes.forEach((mesh) => { if (!mesh.parent) this.scene.add(mesh); });

    this.physicsModule.createPhysicsForSegment(points, terrainBodies, chunkType);

    const segment = { startX, meshes: terrainMeshes, bodies: terrainBodies, points, chunkType, decorations: [] };
    this.decorModule.addTerrainDecorations(startX, points, chunkType, segment.decorations);
    this.terrainMeshes.push(segment);
    return segment;
  }

  createTerrainMeshPart(points, zOffset, width, material, partType, currentColor, previousColor) {
    const terrainShape = new THREE.Shape();
    const initialHeight = points[0].y;
    terrainShape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      if (points[i].height !== null) {
        terrainShape.lineTo(points[i].x, points[i].y);
      } else {
        terrainShape.lineTo(points[i].x, -24);
      }
    }
    terrainShape.lineTo(points[points.length - 1].x, -50);
    terrainShape.lineTo(points[0].x, -50);
    terrainShape.lineTo(points[0].x, initialHeight);

    const terrainGeometry = new THREE.ExtrudeGeometry(terrainShape, { steps: 1, depth: width, bevelEnabled: false });

    // Build per-vertex color array with transition on the first 15% of the chunk
    const positions = terrainGeometry.attributes.position;
    const colorArray = new Float32Array(positions.count * 3);
    const chunkStartX   = points[0].x;
    const transitionEndX = chunkStartX + (points[points.length - 1].x - chunkStartX) * 0.15;
    const tmpColor = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      if (previousColor && vx < transitionEndX) {
        const t = Math.max(0, Math.min(1, (vx - chunkStartX) / (transitionEndX - chunkStartX)));
        tmpColor.copy(previousColor).lerp(currentColor, t);
      } else {
        tmpColor.copy(currentColor);
      }
      colorArray[i * 3]     = tmpColor.r;
      colorArray[i * 3 + 1] = tmpColor.g;
      colorArray[i * 3 + 2] = tmpColor.b;
    }
    terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const meshMaterial = (partType === 'central' ? this.terrainMaterial : this.borderMaterial).clone();
    meshMaterial.vertexColors = true;
    meshMaterial.color.set(0xffffff); // vertex colors are unmodified when base color is white
    meshMaterial.wireframe = false;
    meshMaterial.side = THREE.DoubleSide;
    meshMaterial.needsUpdate = true;
    meshMaterial.userData.outlineParameters = { visible: false };

    const terrainMesh = new THREE.Mesh(terrainGeometry, meshMaterial);
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    terrainMesh.position.z = zOffset;
    terrainMesh.userData = { type: 'terrain', part: partType, hasCollision: partType === 'central' };
    return terrainMesh;
  }

  // ── Update loop ──────────────────────────────────────────────────────────────

  update(vehiclePosition) {
    try {
      if (!vehiclePosition || typeof vehiclePosition.x !== 'number') {
        console.warn('Position du véhicule invalide pour la mise à jour du terrain');
        return;
      }
      const currentSegmentIndex = Math.floor(vehiclePosition.x / this.segmentWidth);
      if (isNaN(currentSegmentIndex) || currentSegmentIndex < 0) {
        console.warn('Index de segment invalide:', currentSegmentIndex);
        return;
      }

      const currentSegment = this.terrainMeshes.find(
        (segment) => segment.startX <= vehiclePosition.x && segment.startX + this.segmentWidth > vehiclePosition.x
      );
      const currentChunkType = currentSegment ? currentSegment.chunkType : 'hills';

      const existingSegmentsStartX = new Set(this.terrainMeshes.map((segment) => segment.startX));

      // Deduplicate
      const uniqueSegments = [];
      const processedStartX = new Set();
      for (const segment of this.terrainMeshes) {
        if (!processedStartX.has(segment.startX)) {
          uniqueSegments.push(segment);
          processedStartX.add(segment.startX);
        } else {
          this.removeSegment(segment);
        }
      }
      this.terrainMeshes = uniqueSegments;

      const segmentsAhead = TERRAIN_CONFIG.VISIBLE_CHUNKS_AHEAD || 5;
      const segmentsBehind = TERRAIN_CONFIG.VISIBLE_CHUNKS_BEHIND || 5;

      // Generate ahead
      try {
        while (true) {
          const lastSegmentIndex =
            this.terrainMeshes.length > 0
              ? Math.floor(this.terrainMeshes[this.terrainMeshes.length - 1].startX / this.segmentWidth)
              : -1;
          if (lastSegmentIndex >= currentSegmentIndex + segmentsAhead) break;
          let nextStartX = 0;
          if (this.terrainMeshes.length > 0) {
            nextStartX = this.terrainMeshes[this.terrainMeshes.length - 1].startX + this.segmentWidth;
          }
          if (!existingSegmentsStartX.has(nextStartX)) {
            this.createTerrainSegment(nextStartX);
            existingSegmentsStartX.add(nextStartX);
          } else {
            nextStartX += this.segmentWidth;
          }
        }
      } catch (error) {
        console.error('Erreur lors de la génération de nouveaux segments:', error);
      }

      // Remove old segments
      try {
        while (
          this.terrainMeshes.length > segmentsAhead + segmentsBehind &&
          currentSegmentIndex > segmentsBehind
        ) {
          const firstSegment = this.terrainMeshes[0];
          const firstSegmentIndex = Math.floor(firstSegment.startX / this.segmentWidth);
          if (firstSegmentIndex < currentSegmentIndex - segmentsBehind) {
            this.removeSegment(firstSegment);
            this.terrainMeshes.shift();
            existingSegmentsStartX.delete(firstSegment.startX);
          } else {
            break;
          }
        }
      } catch (error) {
        console.error("Erreur lors de la suppression d'anciens segments:", error);
      }

      // Regenerate missing segment
      const currentTerrainExists = this.terrainMeshes.some(
        (segment) => segment.startX <= vehiclePosition.x && segment.startX + this.segmentWidth > vehiclePosition.x
      );
      if (!currentTerrainExists) {
        const segmentStartX = Math.floor(vehiclePosition.x / this.segmentWidth) * this.segmentWidth;
        if (!existingSegmentsStartX.has(segmentStartX)) {
          this.createTerrainSegment(segmentStartX);
          existingSegmentsStartX.add(segmentStartX);
        }
      }

      this.applyLODToSegments(vehiclePosition);
      this.updateTerrainInfo(currentSegmentIndex, currentChunkType);
    } catch (error) {
      console.error('Erreur générale dans la mise à jour du terrain:', error);
    }
  }

  // ── LOD ──────────────────────────────────────────────────────────────────────

  applyLODToSegments(vehiclePosition) {
    if (!vehiclePosition) return;
    const lodDistances = TERRAIN_CONFIG.LOD_DISTANCES || { HIGH: 100, MEDIUM: 200, LOW: 400 };
    try {
      this.terrainMeshes.forEach((segment) => {
        if (!segment) return;
        const segmentCenterX = segment.startX + this.segmentWidth / 2;
        const distanceFromPlayer = Math.abs(segmentCenterX - vehiclePosition.x);
        this.applyLOD(segment, distanceFromPlayer, false, vehiclePosition);
      });
    } catch (error) {
      console.error("Erreur lors de l'application du LOD:", error);
    }
  }

  applyLOD(segment, distanceFromPlayer, isStartup = false, vehiclePosition = null) {
    if (!segment) return;
    const lodDistances = { HIGH: 100, MEDIUM: 200, LOW: 400 };
    if (segment.meshes && Array.isArray(segment.meshes)) {
      segment.meshes.forEach((mesh) => {
        if (!mesh || !mesh.material) return;
        const partType = mesh.userData?.part || 'central';
        mesh.material.wireframe = false;
        if (distanceFromPlayer > lodDistances.MEDIUM) {
          mesh.castShadow = partType === 'central';
          mesh.receiveShadow = partType === 'central';
        } else {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
    }
    if (segment.decorations && Array.isArray(segment.decorations)) {
      segment.decorations.forEach((decoration) => {
        if (!decoration || !decoration.mesh) return;
        if (distanceFromPlayer > lodDistances.LOW) {
          decoration.mesh.visible = false;
        } else if (distanceFromPlayer > lodDistances.MEDIUM) {
          decoration.mesh.visible = true;
          if (decoration.mesh.traverse) {
            decoration.mesh.traverse((child) => {
              if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; }
            });
          }
        } else {
          decoration.mesh.visible = true;
          if (decoration.mesh.traverse) {
            decoration.mesh.traverse((child) => {
              if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });
          }
        }
      });
    }
  }

  // ── Segment removal ──────────────────────────────────────────────────────────

  removeSegment(segment) {
    try {
      if (!segment) return;
      if (segment.bodies && Array.isArray(segment.bodies)) {
        segment.bodies.forEach((body) => {
          if (body && this.physicsWorld && this.physicsWorld.bodies && this.physicsWorld.bodies.includes(body)) {
            this.physicsWorld.removeBody(body);
          }
        });
      }
      if (segment.meshes && Array.isArray(segment.meshes)) {
        segment.meshes.forEach((mesh) => {
          if (this.scene) this.scene.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
            else mesh.material.dispose();
          }
        });
      }
      if (segment.decorations && Array.isArray(segment.decorations)) {
        segment.decorations.forEach((decoration) => {
          if (decoration && decoration.mesh) {
            if (this.scene) this.scene.remove(decoration.mesh);
            // Geometries/materials are shared in TerrainDecorations._geo/_mat caches
            // — do NOT dispose them here; they are reused for future segments
          }
        });
      }
    } catch (error) {
      console.error("Erreur lors de la suppression d'un segment:", error);
    }
  }

  // ── HUD info ─────────────────────────────────────────────────────────────────

  updateTerrainInfo(currentSegmentIndex, currentChunkType) {
    let terrainInfo = document.querySelector('.terrain-info');
    if (!terrainInfo) {
      terrainInfo = document.createElement('div');
      terrainInfo.className = 'terrain-info';
      document.body.appendChild(terrainInfo);
    }
    const difficulty = Math.min(0.1 + currentSegmentIndex * 0.01, 0.9);
    const difficultyPercent = Math.floor(difficulty * 100);
    let terrainName = 'Standard', terrainColor = '#FFFFFF';
    switch (currentChunkType) {
      case 'hills':     terrainName = 'Collines';    terrainColor = '#4CAF50'; break;
      case 'plateau':   terrainName = 'Plateau';     terrainColor = '#2196F3'; break;
      case 'valley':    terrainName = 'Vallée';      terrainColor = '#9C27B0'; break;
      case 'ramp':      terrainName = 'Rampe';       terrainColor = '#FF9800'; break;
      case 'gap':       terrainName = 'Trou';        terrainColor = '#F44336'; break;
      case 'washboard': terrainName = 'Ondulations'; terrainColor = '#FFEB3B'; break;
      default:          terrainName = 'Standard';    terrainColor = '#FFFFFF';
    }
    terrainInfo.innerHTML = `<span style="color:${terrainColor}">Terrain: ${terrainName}</span> - Difficulté: ${difficultyPercent}%`;
  }

  // ── Dispose ──────────────────────────────────────────────────────────────────

  dispose() {
    try {
      if (this.infoElement) this.infoElement.remove();
      const segments = [...this.terrainMeshes];
      segments.forEach((segment) => this.removeSegment(segment));
      this.terrainMeshes = [];
      this.generator.chunkHistory = [];
    } catch (error) {
      console.error('Erreur lors de la libération des ressources du terrain:', error);
    }
  }
}
