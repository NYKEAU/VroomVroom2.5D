// TerrainGenerator.js — LCG, noise, height generation, interpolation, height queries
export default class TerrainGenerator {
  constructor(initialSeed, terrainMeshes, segmentWidth) {
    this.initialSeed = initialSeed;
    this.lcgState = initialSeed;
    this.noiseOffsetX = initialSeed % 10000;
    this.noiseOffsetY = (initialSeed % 1000) * 10;
    this.terrainMeshes = terrainMeshes; // shared reference to Terrain.terrainMeshes
    this.segmentWidth = segmentWidth;
    this.chunkHistory = [];
  }

  // LCG pseudo-random number generator (mutes lcgState)
  seededRandom() {
    this.lcgState = (this.lcgState * 9301 + 49297) % 233280;
    return this.lcgState / 233280;
  }

  // Deterministic noise function (uses initialSeed, never mutates it)
  noise(x) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const fadeX = x * x * (3 - 2 * x);
    const offset = this.initialSeed % 256;
    const h1 = (X + offset) & 255;
    const h2 = (X + 1 + offset) & 255;
    const n1 = Math.sin(h1 * 37.1 + this.initialSeed * 0.1) * 43758.5453;
    const n2 = Math.sin(h2 * 37.1 + this.initialSeed * 0.1) * 43758.5453;
    const res1 = (n1 - Math.floor(n1)) * 2 - 1;
    const res2 = (n2 - Math.floor(n2)) * 2 - 1;
    return res1 + fadeX * (res2 - res1);
  }

  improvedNoise(x, frequency, octaves, persistence, lacunarity) {
    let total = 0;
    let amplitude = 1;
    let maxValue = 0;
    const seedX = x + this.noiseOffsetX;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(seedX * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  // --- Interpolation helpers ---

  cubicInterpolation(t) {
    return t * t * (3 - 2 * t);
  }

  quinticInterpolation(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  bezierInterpolation(t, p0, p1, p2, p3) {
    const oneMinusT = 1 - t;
    return (
      oneMinusT * oneMinusT * oneMinusT * p0 +
      3 * oneMinusT * oneMinusT * t * p1 +
      3 * oneMinusT * t * t * p2 +
      t * t * t * p3
    );
  }

  smoothTransition(t, startHeight, endHeight, smoothness = 'cubic') {
    let interpolationFunction;
    switch (smoothness) {
      case 'linear':
        interpolationFunction = (t) => t;
        break;
      case 'cubic':
        interpolationFunction = this.cubicInterpolation;
        break;
      case 'quintic':
        interpolationFunction = this.quinticInterpolation;
        break;
      default:
        interpolationFunction = this.cubicInterpolation;
    }
    const factor = interpolationFunction(t);
    return startHeight * (1 - factor) + endHeight * factor;
  }

  bezierTransition(x, segment1End, segment2Start, segment1Height, segment2Height) {
    const t = (x - segment1End) / (segment2Start - segment1End);
    const heightDiff = Math.abs(segment2Height - segment1Height);
    const controlPointDistance = Math.min(0.3 + heightDiff * 0.05, 0.5);
    const p0 = segment1Height;
    const p1 = segment1Height + (segment2Height - segment1Height) * controlPointDistance;
    const p2 = segment2Height - (segment2Height - segment1Height) * controlPointDistance;
    const p3 = segment2Height;
    return this.bezierInterpolation(t, p0, p1, p2, p3);
  }

  // --- Chunk type selection ---

  selectChunkType(difficulty) {
    const rand = this.seededRandom();
    if (difficulty < 0.1) {
      // Tout début : seulement collines et plateau pour apprivoiser les commandes
      if (rand < 0.6) return 'hills';
      else return 'plateau';
    } else if (difficulty < 0.2) {
      // Début : rampe et washboard introduits dès 0.1
      if (rand < 0.35) return 'hills';
      else if (rand < 0.55) return 'plateau';
      else if (rand < 0.80) return 'ramp';
      else return 'washboard';
    } else if (difficulty < 0.4) {
      if (rand < 0.25) return 'hills';
      else if (rand < 0.40) return 'plateau';
      else if (rand < 0.60) return 'ramp';
      else if (rand < 0.85) return 'washboard';
      else return 'valley';
    } else if (difficulty < 0.65) {
      if (rand < 0.15) return 'hills';
      else if (rand < 0.35) return 'ramp';
      else if (rand < 0.55) return 'washboard';
      else if (rand < 0.80) return 'valley';
      else return 'gap';
    } else {
      if (rand < 0.10) return 'hills';
      else if (rand < 0.28) return 'ramp';
      else if (rand < 0.50) return 'washboard';
      else if (rand < 0.72) return 'valley';
      else return 'gap';
    }
  }

  // --- Height generators ---

  generateHills(x, startX, endX, difficulty) {
    // Pas de plafond : les collines grossissent sans limite avec la difficulté
    const amplitude = 4.0 + difficulty * 30;
    const baseFreq = difficulty < 0.2 ? 0.05 * 1.3 : 0.05;
    const baseNoise = this.improvedNoise(x, baseFreq, 3, 0.5, 2.0);
    const detailNoise = this.improvedNoise(x, 0.2, 2, 0.3, 2.5);
    const rawHeight = baseNoise * amplitude + detailNoise * (amplitude * 0.3);
    // Pas de lissage par delta — le smoothSegmentPoints s'en charge
    if (x - startX < 1.0) {
      const borderFactor = x - startX;
      const prevSegmentHeight = this.getTerrainHeightAt(startX - 0.1);
      if (prevSegmentHeight !== undefined && prevSegmentHeight !== null) {
        const t = this.quinticInterpolation(borderFactor);
        return prevSegmentHeight * (1 - t) + rawHeight * t;
      }
    } else if (endX - x < 1.0) {
      const borderFactor = endX - x;
      const nextSegmentHeight = this.getTerrainHeightAt(endX + 0.1);
      if (nextSegmentHeight !== undefined && nextSegmentHeight !== null) {
        const t = this.quinticInterpolation(borderFactor);
        return rawHeight * (1 - t) + nextSegmentHeight * t;
      }
    }
    return rawHeight;
  }

  generatePlateau(x, startX, endX, difficulty) {
    const width = endX - startX;
    const baseHeight = Math.sin(startX * 0.03) * 4;
    const distanceFromStart = x - startX;
    const distanceFromEnd = endX - x;
    const transitionWidth = width * 0.2;
    if (distanceFromStart < transitionWidth) {
      const prevHeight =
        this.getTerrainHeightNear(startX - 0.1) ||
        this.generateHills(startX - 0.1, startX - this.segmentWidth, startX, difficulty);
      const t = distanceFromStart / transitionWidth;
      return this.smoothTransition(t, prevHeight, baseHeight, 'quintic');
    } else if (distanceFromEnd < transitionWidth) {
      const nextHeight =
        this.getTerrainHeightNear(endX + 0.1) ||
        this.generateHills(endX + 0.1, endX, endX + this.segmentWidth, difficulty);
      const t = distanceFromEnd / transitionWidth;
      return this.smoothTransition(t, nextHeight, baseHeight, 'quintic');
    } else {
      return baseHeight + Math.sin(x * 0.3) * 0.2 + Math.cos(x * 0.7) * 0.1;
    }
  }

  generateGap(x, startX, endX, difficulty) {
    const adjustedDifficulty = Math.min(difficulty * 0.7, 0.6);
    const width = endX - startX;
    // Trou x1.2 de l'original
    const gapWidth = Math.min(3.6 + adjustedDifficulty * 2.4, 6.0);
    const gapCenter = (startX + endX) / 2;
    const gapStart = gapCenter - gapWidth / 2;
    const gapEnd = gapCenter + gapWidth / 2;
    // Bords à ~45° (pas verticaux)
    const transitionLength = width * 0.15;
    if (x < gapStart - transitionLength) {
      return this.generateHills(x, startX, gapStart - transitionLength, adjustedDifficulty * 0.3) + 0.5;
    } else if (x < gapStart) {
      const baseHeight = this.generateHills(gapStart - transitionLength, startX, gapStart - transitionLength, adjustedDifficulty * 0.3) + 0.5;
      const t = (x - (gapStart - transitionLength)) / transitionLength;
      return this.smoothTransition(t, baseHeight, -24, 'quintic');
    } else if (x < gapEnd) {
      return null;
    } else if (x < gapEnd + transitionLength) {
      const afterGapHeight = this.generateHills(gapEnd + transitionLength, gapEnd + transitionLength, endX, adjustedDifficulty * 0.3) + 0.5;
      const t = (x - gapEnd) / transitionLength;
      return this.smoothTransition(t, -24, afterGapHeight, 'quintic');
    } else {
      return this.generateHills(x, gapEnd + transitionLength, endX, adjustedDifficulty * 0.3) + 0.5;
    }
  }

  generateRamp(x, startX, endX, difficulty) {
    const width = endX - startX;
    // Dénivelé 3–6 unités sur tout le chunk
    const rampHeight = 3 + difficulty * 3;
    // Direction (montée ou descente) déterministe selon la position
    const direction = Math.sin(startX * 0.13) >= 0 ? 1 : -1;
    // Partir de la hauteur réelle du chunk précédent pour une vraie inclinaison continue
    const startHeight = this.getTerrainHeightAt(startX - 0.5) ?? 0;
    const t = (x - startX) / width;
    // Pente linéaire pure : le véhicule monte ou descend progressivement
    return startHeight + direction * rampHeight * t;
  }

  generateWashboard(x, startX, endX, difficulty) {
    const width = endX - startX;
    const adjustedDifficulty = Math.min(difficulty * 0.7, 0.6);
    const washboardCenter = (startX + endX) / 2;
    // Zone active élargie
    const washboardWidth = width * 0.85;
    const washboardStart = washboardCenter - washboardWidth / 2;
    const washboardEnd = washboardCenter + washboardWidth / 2;
    if (x < washboardStart) {
      return this.generateHills(x, startX, washboardStart, adjustedDifficulty * 0.3);
    } else if (x < washboardEnd) {
      const baseHeight = this.generateHills(washboardStart, startX, washboardStart, adjustedDifficulty * 0.3);
      const normalizedX = (x - washboardStart) / (washboardEnd - washboardStart);
      // Fréquence x1.5 (12 cycles), amplitude x1.4
      const phase = normalizedX * Math.PI * 2 * 12;
      const maxAmplitude = Math.min(1.0 + adjustedDifficulty * 1.1, 2.1);
      let amplitudeFactor = 1.0;
      const fadeLength = washboardWidth * 0.15;
      const distFromStart = x - washboardStart;
      const distFromEnd = washboardEnd - x;
      if (distFromStart < fadeLength) {
        amplitudeFactor = this.cubicInterpolation(distFromStart / fadeLength);
      } else if (distFromEnd < fadeLength) {
        amplitudeFactor = this.cubicInterpolation(distFromEnd / fadeLength);
      }
      const mainWave = Math.sin(phase) * maxAmplitude;
      const secondaryWave = Math.sin(phase * 1.5) * (maxAmplitude * 0.25);
      return baseHeight + (mainWave + secondaryWave) * amplitudeFactor;
    } else {
      return this.generateHills(x, washboardEnd, endX, adjustedDifficulty * 0.3);
    }
  }

  generateValley(x, startX, endX, difficulty) {
    const width = endX - startX;
    const adjustedDifficulty = Math.min(difficulty * 0.7, 0.6);
    // Descente max 4 unités
    const valleyWidth = width * 0.85;
    const valleyDepth = Math.min(3 + adjustedDifficulty * 2, 4);
    const valleyCenter = (startX + endX) / 2;
    const valleyStart = valleyCenter - valleyWidth / 2;
    const valleyEnd = valleyCenter + valleyWidth / 2;
    if (x < valleyStart) {
      return this.generateHills(x, startX, valleyStart, adjustedDifficulty * 0.3);
    } else if (x < valleyEnd) {
      const baseHeight = this.generateHills(valleyStart, startX, valleyStart, adjustedDifficulty * 0.3);
      const t = (x - valleyStart) / valleyWidth;
      // sin(PI*t) : 0 aux bords, 1 au centre → fond de vallée au centre
      const valleyShape = Math.sin(Math.PI * t);
      return baseHeight - valleyDepth * valleyShape;
    } else {
      return this.generateHills(x, valleyEnd, endX, adjustedDifficulty * 0.3);
    }
  }

  // --- Height queries (use shared terrainMeshes reference) ---

  getTerrainHeightNear(x) {
    const segment = this.terrainMeshes.find(
      (s) => s.startX <= x && s.startX + this.segmentWidth > x
    );
    if (segment && segment.points) {
      const pointIndex = Math.floor(
        ((x - segment.startX) / this.segmentWidth) * segment.points.length
      );
      if (segment.points[pointIndex]) {
        return segment.points[pointIndex].y;
      }
    }
    return undefined;
  }

  getTerrainHeightAt(x) {
    for (const segment of this.terrainMeshes) {
      if (x >= segment.startX && x < segment.startX + this.segmentWidth) {
        const points = segment.points;
        if (!points || points.length === 0) return 0;
        const normalizedX = (x - segment.startX) / this.segmentWidth;
        const index = Math.floor(normalizedX * (points.length - 1));
        if (points[index] && points[index].height === null) return null;
        if (index < points.length - 1) {
          const x1 = segment.startX + (index / (points.length - 1)) * this.segmentWidth;
          const x2 = segment.startX + ((index + 1) / (points.length - 1)) * this.segmentWidth;
          const y1 = points[index].y;
          const y2 = points[index + 1].y;
          const t = (x - x1) / (x2 - x1);
          return y1 * (1 - this.cubicInterpolation(t)) + y2 * this.cubicInterpolation(t);
        } else {
          return points[index].y;
        }
      }
    }
    return this.generateHills(x, x - 10, x + 10, 0.1);
  }

  // --- Point smoothing ---

  smoothSegmentPoints(points) {
    if (points.length < 5) return;
    const validPoints = points.filter((p) => p.height !== null);
    if (validPoints.length < 5) return;
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    const originalHeights = validPoints.map((p) => p.y);
    for (let i = halfWindow; i < validPoints.length - halfWindow; i++) {
      let sum = 0;
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const weight = 1.0 - Math.abs(j) / (halfWindow + 1);
        sum += originalHeights[i + j] * weight;
      }
      validPoints[i].y = sum / windowSize;
    }
    for (const validPoint of validPoints) {
      const originalPoint = points.find((p) => p.x === validPoint.x);
      if (originalPoint && originalPoint.height !== null) {
        originalPoint.y = validPoint.y;
        originalPoint.height = validPoint.y;
      }
    }
  }

  // --- Rigidity ---

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
}
