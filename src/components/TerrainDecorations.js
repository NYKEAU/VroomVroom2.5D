// TerrainDecorations.js — On-demand decoration creation for streaming terrain
import * as THREE from 'three';

// Per-terrain-type density multipliers for visual variety
const TERRAIN_MULTIPLIERS = {
  hills:     1.5,  // lush
  plateau:   1.2,
  ramp:      0.7,  // sparse on slopes
  washboard: 1.3,  // rocky
  valley:    1.3,  // lush valley
  gap:       0.3,  // almost empty near gaps
};

export default class TerrainDecorations {
  constructor(scene, seededRandom, terrainConfig) {
    this.scene = scene;
    this.seededRandom = seededRandom;
    this.terrainConfig = terrainConfig;
    this._geo = {};
    this._mat = {};
    this._initCaches();
  }

  // ── Geometry & material cache (shared across all decoration instances) ────────

  _initCaches() {
    const g = this._geo;
    const m = this._mat;

    // Tree geometries
    g.treeTrunk0 = new THREE.CylinderGeometry(0.2, 0.3, 2.8, 8);
    g.treeCone   = new THREE.ConeGeometry(1.2, 4.0, 8);
    g.treeTrunk1 = new THREE.CylinderGeometry(0.15, 0.3, 2.2, 8);
    g.treeSphere = new THREE.SphereGeometry(1.8, 8, 6);
    g.treeTrunk2 = new THREE.CylinderGeometry(0.25, 0.4, 1.5, 6);
    g.treeFlat   = new THREE.CylinderGeometry(0, 2.2, 1.5, 8);

    // Rock geometries
    g.rockDodeca  = new THREE.DodecahedronGeometry(0.8, 0);
    g.rockSphere  = new THREE.SphereGeometry(0.6, 7, 5);
    g.rockBox     = new THREE.BoxGeometry(1.2, 0.4, 0.8);
    g.rockBoxBase = new THREE.BoxGeometry(1.2, 0.6, 0.9);
    g.rockTetra   = new THREE.TetrahedronGeometry(0.4);

    // Sign geometries
    g.signPost0    = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6);
    g.signArrow    = new THREE.BoxGeometry(1.2, 0.4, 0.06);
    g.signPost1    = new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6);
    g.signPanel    = new THREE.BoxGeometry(1.0, 0.8, 0.04);
    g.signFrame    = new THREE.BoxGeometry(1.1, 0.9, 0.02);
    g.signPost2    = new THREE.BoxGeometry(0.1, 2.6, 0.1);
    g.signExclBar  = new THREE.BoxGeometry(0.08, 0.4, 0.06);
    g.signExclDot  = new THREE.BoxGeometry(0.08, 0.08, 0.06);

    // Sign ExtrudeGeometries (built from Shape — cached once)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0); arrowShape.lineTo(0.3, 0.2);
    arrowShape.lineTo(0, 0.4); arrowShape.lineTo(0, 0);
    g.signArrowTriangle = new THREE.ExtrudeGeometry(arrowShape, { steps: 1, depth: 0.06, bevelEnabled: false });

    const warnShape = new THREE.Shape();
    warnShape.moveTo(0, 0.8); warnShape.lineTo(-0.7, -0.4);
    warnShape.lineTo(0.7, -0.4); warnShape.lineTo(0, 0.8);
    g.signWarnTriangle = new THREE.ExtrudeGeometry(warnShape, { steps: 1, depth: 0.05, bevelEnabled: false });

    // Tree materials
    m.treeTrunk0 = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9, metalness: 0.0 });
    m.treePine   = new THREE.MeshStandardMaterial({ color: 0x2d572c, roughness: 0.8, metalness: 0.1 });
    m.treeTrunk1 = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.9, metalness: 0.0 });
    m.treeRound  = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8, metalness: 0.0 });
    m.treeTrunk2 = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.9, metalness: 0.0 });
    m.treeFlat   = new THREE.MeshStandardMaterial({ color: 0x33691e, roughness: 0.7, metalness: 0.1 });

    // Rock materials
    m.rock0     = new THREE.MeshStandardMaterial({ color: 0x7f7f7f, roughness: 0.9,  metalness: 0.2  });
    m.rock1     = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.85, metalness: 0.15 });
    m.rock2     = new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.8,  metalness: 0.1  });
    m.rock3base = new THREE.MeshStandardMaterial({ color: 0x616161, roughness: 0.9,  metalness: 0.1  });
    m.rock3top  = new THREE.MeshStandardMaterial({ color: 0x727272, roughness: 0.85, metalness: 0.15 });

    // Sign materials
    m.signWood   = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9, metalness: 0.0 });
    m.signArrow  = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.1 });
    m.signBlue   = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.5, metalness: 0.2 });
    m.signYellow = new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.5, metalness: 0.3 });
    m.black      = new THREE.MeshStandardMaterial({ color: 0x000000 });
  }

  // ── Decoration placement (called once per segment, no pools) ─────────────────

  addTerrainDecorations(startX, points, chunkType, decorations) {
    if (!decorations) return;
    try {
      const hw = this.terrainConfig.central.width / 2; // 3 — half road width
      const bw = this.terrainConfig.borders.width;      // 50 — side zone width
      const multiplier = TERRAIN_MULTIPLIERS[chunkType] ?? 1.0;

      const available = points.filter(
        (p, i) => i > 2 && i < points.length - 3 && p.height !== null
      );
      if (available.length === 0) return;

      const used = [];

      const isFree = (x, z, r) => {
        for (const p of used) {
          if (Math.sqrt((p.x - x) ** 2 + (p.z - z) ** 2) < r + p.r) return false;
        }
        return true;
      };

      const rp  = () => available[Math.floor(this.seededRandom() * available.length)];
      const rnd = () => this.seededRandom();

      // Place `baseCount * multiplier` items of given type in z band [zMin, zMax]
      const place = (type, baseCount, zMin, zMax, radius) => {
        const frac = baseCount * multiplier;
        const count = Math.floor(frac) + (rnd() < (frac % 1) ? 1 : 0);
        for (let i = 0; i < count; i++) {
          let placed = false;
          for (let attempt = 0; attempt < 10 && !placed; attempt++) {
            const pt = rp();
            if (!pt) break;
            const px = pt.x + (rnd() - 0.5) * 5;
            const pz = zMin + rnd() * (zMax - zMin);
            if (!isFree(px, pz, radius)) continue;

            let model = null;
            if (type === 'tree') {
              model = this.createTreeModel(Math.floor(rnd() * 100));
              if (model) {
                const dist = Math.abs(pz);
                const scale = 0.7 + (dist / (hw + bw)) * 0.8 + rnd() * 0.3;
                model.scale.set(scale, scale, scale);
                model.rotation.y = rnd() * Math.PI * 2;
                model.rotation.z = (rnd() - 0.5) * 0.15;
              }
            } else if (type === 'rock') {
              model = this.createRockModel(Math.floor(rnd() * 100));
              if (model) {
                const scale = 0.5 + rnd() * 0.8;
                model.scale.set(scale, scale, scale);
                model.rotation.x = rnd() * Math.PI;
                model.rotation.y = rnd() * Math.PI * 2;
                model.rotation.z = rnd() * Math.PI;
              }
            } else if (type === 'sign') {
              model = this.createSignModel(Math.floor(rnd() * 100));
              if (model) {
                model.rotation.y = pz > 0 ? Math.PI / 2 : -Math.PI / 2;
                const scale = 0.8 + rnd() * 0.3;
                model.scale.set(scale, scale, scale);
              }
            }
            if (!model) continue;

            model.position.set(px, pt.y + (type === 'sign' ? 0.1 : 0.2), pz);
            model.visible = true;
            this.scene.add(model);
            decorations.push({ mesh: model, type });
            used.push({ x: px, z: pz, r: radius });
            placed = true;
          }
        }
      };

      // ── Zone placement ──────────────────────────────────────────────────────
      // Near shoulders (both sides: ±3 to ±13)
      place('rock', 5,  hw,       hw + 10, 2.0);
      place('tree', 6,  hw,       hw + 10, 3.5);
      place('sign', 1,  hw,       hw + 10, 5.0);
      place('rock', 5, -hw - 10, -hw,      2.0);
      place('tree', 6, -hw - 10, -hw,      3.5);
      place('sign', 1, -hw - 10, -hw,      5.0);

      // Far zones (both sides: ±13 to ±53)
      place('rock',  8,  hw + 10,  hw + bw,  2.5);
      place('tree', 12,  hw + 10,  hw + bw,  3.5);
      place('sign',  1,  hw + 10,  hw + bw,  5.0);
      place('rock',  8, -hw - bw, -hw - 10,  2.5);
      place('tree', 12, -hw - bw, -hw - 10,  3.5);
      place('sign',  1, -hw - bw, -hw - 10,  5.0);

    } catch (error) {
      console.error("Erreur lors de l'ajout des décorations:", error);
    }
  }

  // ── Model builders (all using shared geometry/material cache) ────────────────

  createTreeModel(index) {
    try {
      const treeType = index % 3;
      const g = this._geo;
      const m = this._mat;
      const group = new THREE.Group();

      switch (treeType) {
        case 0: { // Pine tree
          const trunk = new THREE.Mesh(g.treeTrunk0, m.treeTrunk0);
          trunk.position.y = 1.4;
          group.add(trunk);
          const cone1 = new THREE.Mesh(g.treeCone, m.treePine);
          cone1.position.y = 4.0;
          group.add(cone1);
          const cone2 = new THREE.Mesh(g.treeCone, m.treePine);
          cone2.position.y = 3.2; cone2.scale.set(1.2, 0.8, 1.2);
          group.add(cone2);
          const cone3 = new THREE.Mesh(g.treeCone, m.treePine);
          cone3.position.y = 2.4; cone3.scale.set(1.4, 0.6, 1.4);
          group.add(cone3);
          break;
        }
        case 1: { // Round tree
          const trunk = new THREE.Mesh(g.treeTrunk1, m.treeTrunk1);
          trunk.position.y = 1.1;
          group.add(trunk);
          const leaves = new THREE.Mesh(g.treeSphere, m.treeRound);
          leaves.position.y = 3.2;
          group.add(leaves);
          break;
        }
        case 2: { // Flat canopy tree
          const trunk = new THREE.Mesh(g.treeTrunk2, m.treeTrunk2);
          trunk.position.y = 0.75;
          group.add(trunk);
          const flat = new THREE.Mesh(g.treeFlat, m.treeFlat);
          flat.position.y = 2.0;
          group.add(flat);
          break;
        }
      }

      group.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      return group;
    } catch (error) {
      console.error("Erreur création arbre:", error);
      return this.createBackupTreeModel();
    }
  }

  createRockModel(index) {
    try {
      const rockType = index % 4;
      const g = this._geo;
      const m = this._mat;

      switch (rockType) {
        case 0: {
          const rock = new THREE.Mesh(g.rockDodeca, m.rock0);
          rock.castShadow = true; rock.receiveShadow = true;
          return rock;
        }
        case 1: {
          const rock = new THREE.Mesh(g.rockSphere, m.rock1);
          rock.castShadow = true; rock.receiveShadow = true;
          return rock;
        }
        case 2: {
          const rock = new THREE.Mesh(g.rockBox, m.rock2);
          rock.castShadow = true; rock.receiveShadow = true;
          return rock;
        }
        case 3: {
          const group = new THREE.Group();
          const base = new THREE.Mesh(g.rockBoxBase, m.rock3base);
          group.add(base);
          const top1 = new THREE.Mesh(g.rockTetra, m.rock3top);
          top1.position.set(0.2, 0.5, 0.1); top1.rotation.set(0.5, 0.8, 0.2);
          group.add(top1);
          const top2 = new THREE.Mesh(g.rockTetra, m.rock3top);
          top2.position.set(-0.3, 0.4, -0.2); top2.rotation.set(0.3, -0.4, 0.1);
          top2.scale.set(0.7, 0.7, 0.7);
          group.add(top2);
          group.traverse((child) => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
          });
          return group;
        }
      }
    } catch (error) {
      console.error("Erreur création rocher:", error);
      return this.createBackupRockModel();
    }
  }

  createSignModel(index) {
    try {
      const signType = index % 3;
      const g = this._geo;
      const m = this._mat;
      const group = new THREE.Group();

      switch (signType) {
        case 0: { // Arrow sign
          const post = new THREE.Mesh(g.signPost0, m.signWood);
          post.position.y = 1.2;
          group.add(post);
          const arrow = new THREE.Mesh(g.signArrow, m.signArrow);
          arrow.position.set(0.4, 2.0, 0); arrow.rotation.z = Math.PI * 0.05;
          group.add(arrow);
          const tri = new THREE.Mesh(g.signArrowTriangle, m.signArrow);
          tri.position.set(1.0, 1.8, -0.03);
          group.add(tri);
          break;
        }
        case 1: { // Info sign
          const post = new THREE.Mesh(g.signPost1, m.signWood);
          post.position.y = 1.1;
          group.add(post);
          const panel = new THREE.Mesh(g.signPanel, m.signBlue);
          panel.position.y = 1.9;
          group.add(panel);
          const frame = new THREE.Mesh(g.signFrame, m.signWood);
          frame.position.set(0, 1.9, -0.03);
          group.add(frame);
          break;
        }
        case 2: { // Warning sign
          const post1 = new THREE.Mesh(g.signPost2, m.signWood);
          post1.position.set(-0.4, 1.3, 0);
          group.add(post1);
          const post2 = new THREE.Mesh(g.signPost2, m.signWood);
          post2.position.set(0.4, 1.3, 0);
          group.add(post2);
          const warn = new THREE.Mesh(g.signWarnTriangle, m.signYellow);
          warn.position.set(0, 2.0, 0);
          group.add(warn);
          const bar = new THREE.Mesh(g.signExclBar, m.black);
          bar.position.set(0, 1.9, 0.03);
          group.add(bar);
          const dot = new THREE.Mesh(g.signExclDot, m.black);
          dot.position.set(0, 1.65, 0.03);
          group.add(dot);
          break;
        }
      }

      group.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      return group;
    } catch (error) {
      console.error("Erreur création panneau:", error);
      return this.createBackupSignModel();
    }
  }

  // ── Backup models (simple fallbacks) ────────────────────────────────────────

  createBackupTreeModel() {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.4, 2, 5),
      new THREE.MeshLambertMaterial({ color: 0x006400 })
    );
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1, 2, 6),
      new THREE.MeshLambertMaterial({ color: 0x228b22 })
    );
    top.position.y = 2;
    const tree = new THREE.Group();
    tree.add(trunk); tree.add(top);
    return tree;
  }

  createBackupRockModel() {
    return new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.6, 0),
      new THREE.MeshLambertMaterial({ color: 0x808080 })
    );
  }

  createBackupSignModel() {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x8b4513 })
    );
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.05),
      new THREE.MeshLambertMaterial({ color: 0xffd700 })
    );
    sign.position.y = 0.5;
    const group = new THREE.Group();
    group.add(post); group.add(sign);
    return group;
  }
}
