import * as THREE from 'three';

export class HeightField {
  constructor(width = 128, height = 96, worldWidth = 24, worldDepth = 18) {
    this.width = width;
    this.height = height;
    this.worldWidth = worldWidth;
    this.worldDepth = worldDepth;
    this.current = new Float32Array(width * height);
    this.previous = new Float32Array(width * height);
    this.next = new Float32Array(width * height);
    this.accumulator = 0;
    this.fixedStep = 1 / 60;
    this.texture = new THREE.DataTexture(this.current, width, height, THREE.RedFormat, THREE.FloatType);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  worldToGrid(x, z) {
    return {
      x: (x / this.worldWidth + .5) * (this.width - 1),
      y: (z / this.worldDepth + .5) * (this.height - 1)
    };
  }

  disturb(x, z, strength = 1, radius = .42) {
    const center = this.worldToGrid(x, z);
    const radiusX = Math.max(2, radius / this.worldWidth * this.width);
    const radiusY = Math.max(2, radius / this.worldDepth * this.height);
    const minX = Math.max(1, Math.floor(center.x - radiusX * 2.5));
    const maxX = Math.min(this.width - 2, Math.ceil(center.x + radiusX * 2.5));
    const minY = Math.max(1, Math.floor(center.y - radiusY * 2.5));
    const maxY = Math.min(this.height - 2, Math.ceil(center.y + radiusY * 2.5));

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = (gx - center.x) / radiusX;
        const dy = (gy - center.y) / radiusY;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > 6.25) continue;
        const impulse = Math.exp(-distanceSq * 1.7) * strength * .095;
        const index = gy * this.width + gx;
        this.current[index] += impulse;
        this.previous[index] += impulse * .72;
      }
    }
    this.texture.needsUpdate = true;
  }

  disturbLine(from, to, strength, radius = .3) {
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = THREE.MathUtils.clamp(Math.ceil(distance / Math.max(radius * .7, .08)), 1, 7);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = THREE.MathUtils.lerp(from.x, to.x, t);
      const z = THREE.MathUtils.lerp(from.z, to.z, t);
      const pulse = strength * THREE.MathUtils.lerp(.45, 1, t);
      this.disturb(x, z, pulse, radius);
    }
  }

  update(deltaTime, viscosity, surfaceTension) {
    this.accumulator = Math.min(this.accumulator + deltaTime, this.fixedStep * 3);
    while (this.accumulator >= this.fixedStep) {
      this.step(viscosity, surfaceTension);
      this.accumulator -= this.fixedStep;
    }
  }

  step(viscosity, surfaceTension) {
    const width = this.width;
    const height = this.height;
    const propagation = THREE.MathUtils.lerp(.115, .205, surfaceTension);
    const damping = THREE.MathUtils.lerp(.997, .965, viscosity);

    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const i = row + x;
        const laplacian = this.current[i - 1] + this.current[i + 1]
          + this.current[i - width] + this.current[i + width] - this.current[i] * 4;
        this.next[i] = ((2 * this.current[i] - this.previous[i]) + laplacian * propagation) * damping;
      }
    }

    // A slightly lossy boundary reflects waves without creating hard numerical spikes.
    for (let x = 0; x < width; x++) {
      this.next[x] = this.next[width + x] * .82;
      this.next[(height - 1) * width + x] = this.next[(height - 2) * width + x] * .82;
    }
    for (let y = 0; y < height; y++) {
      this.next[y * width] = this.next[y * width + 1] * .82;
      this.next[y * width + width - 1] = this.next[y * width + width - 2] * .82;
    }

    const oldPrevious = this.previous;
    this.previous = this.current;
    this.current = this.next;
    this.next = oldPrevious;
    this.texture.image.data = this.current;
    this.texture.needsUpdate = true;
  }

  sample(x, z) {
    const grid = this.worldToGrid(x, z);
    const gx = THREE.MathUtils.clamp(grid.x, 0, this.width - 1.001);
    const gy = THREE.MathUtils.clamp(grid.y, 0, this.height - 1.001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const y1 = Math.min(y0 + 1, this.height - 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const top = THREE.MathUtils.lerp(this.current[y0 * this.width + x0], this.current[y0 * this.width + x1], tx);
    const bottom = THREE.MathUtils.lerp(this.current[y1 * this.width + x0], this.current[y1 * this.width + x1], tx);
    return THREE.MathUtils.lerp(top, bottom, ty);
  }

  reset() {
    this.current.fill(0);
    this.previous.fill(0);
    this.next.fill(0);
    this.accumulator = 0;
    this.texture.image.data = this.current;
    this.texture.needsUpdate = true;
  }
}
