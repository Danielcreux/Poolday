import * as THREE from 'three';

const GRAVITY = 9.81;

export class SpectralWaveField {
  constructor(size = 64, worldWidth = 24, worldDepth = 18) {
    this.size = size;
    this.worldWidth = worldWidth;
    this.worldDepth = worldDepth;
    this.real = new Float32Array(size * size);
    this.imag = new Float32Array(size * size);
    this.h0Real = new Float32Array(size * size);
    this.h0Imag = new Float32Array(size * size);
    this.omega = new Float32Array(size * size);
    this.output = new Float32Array(size * size);
    this.lineReal = new Float32Array(size);
    this.lineImag = new Float32Array(size);
    this.lastUpdate = -Infinity;
    this.texture = new THREE.DataTexture(this.output, size, size, THREE.RedFormat, THREE.FloatType);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.createSpectrum();
  }

  createSpectrum() {
    const n = this.size;
    const windSpeed = 2.25;
    const windX = .93;
    const windZ = .37;
    const largestWave = windSpeed * windSpeed / GRAVITY;
    const dampingLength = .035;
    const amplitude = .018;
    const depth = .72;
    let seed = 1847;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed + .5) / 4294967296;
    };
    const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-7))) * Math.cos(2 * Math.PI * random());

    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x <= n / 2 ? x : x - n;
      const fy = y <= n / 2 ? y : y - n;
      const kx = fx * Math.PI * 2 / this.worldWidth;
      const kz = fy * Math.PI * 2 / this.worldDepth;
      const k = Math.hypot(kx, kz);
      const index = y * n + x;
      if (k < 1e-4) continue;
      const directional = Math.max((kx * windX + kz * windZ) / k, 0);
      const phillips = amplitude * Math.exp(-1 / ((k * largestWave) ** 2))
        / (k ** 4) * directional ** 2 * Math.exp(-((k * dampingLength) ** 2));
      const scale = Math.sqrt(Math.max(phillips, 0) * .5);
      this.h0Real[index] = gaussian() * scale;
      this.h0Imag[index] = gaussian() * scale;
      this.omega[index] = Math.sqrt(GRAVITY * k * Math.tanh(k * depth));
    }
  }

  update(time) {
    if (time - this.lastUpdate < 1 / 30) return;
    this.lastUpdate = time;
    const n = this.size;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const index = y * n + x;
      const negative = ((n - y) % n) * n + ((n - x) % n);
      const phase = this.omega[index] * time;
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      const ar = this.h0Real[index] * cosine - this.h0Imag[index] * sine;
      const ai = this.h0Real[index] * sine + this.h0Imag[index] * cosine;
      const br = this.h0Real[negative] * cosine - this.h0Imag[negative] * sine;
      const bi = -this.h0Real[negative] * sine - this.h0Imag[negative] * cosine;
      this.real[index] = ar + br;
      this.imag[index] = ai + bi;
    }
    this.inverse2D();
    // Calibrates the normalized IFFT output to metres for this 24 × 18 m basin.
    for (let i = 0; i < this.output.length; i++) this.output[i] = this.real[i] * 320;
    this.texture.needsUpdate = true;
  }

  inverse2D() {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      const offset = y * n;
      for (let x = 0; x < n; x++) { this.lineReal[x] = this.real[offset + x]; this.lineImag[x] = this.imag[offset + x]; }
      this.inverseFFT(this.lineReal, this.lineImag);
      for (let x = 0; x < n; x++) { this.real[offset + x] = this.lineReal[x]; this.imag[offset + x] = this.lineImag[x]; }
    }
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) { this.lineReal[y] = this.real[y * n + x]; this.lineImag[y] = this.imag[y * n + x]; }
      this.inverseFFT(this.lineReal, this.lineImag);
      for (let y = 0; y < n; y++) { this.real[y * n + x] = this.lineReal[y]; this.imag[y * n + x] = this.lineImag[y]; }
    }
  }

  inverseFFT(real, imag) {
    const n = real.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    for (let length = 2; length <= n; length <<= 1) {
      const angle = Math.PI * 2 / length;
      const wLengthReal = Math.cos(angle);
      const wLengthImag = Math.sin(angle);
      for (let i = 0; i < n; i += length) {
        let wr = 1, wi = 0;
        for (let j = 0; j < length / 2; j++) {
          const even = i + j;
          const odd = even + length / 2;
          const tr = real[odd] * wr - imag[odd] * wi;
          const ti = real[odd] * wi + imag[odd] * wr;
          real[odd] = real[even] - tr;
          imag[odd] = imag[even] - ti;
          real[even] += tr;
          imag[even] += ti;
          const nextWr = wr * wLengthReal - wi * wLengthImag;
          wi = wr * wLengthImag + wi * wLengthReal;
          wr = nextWr;
        }
      }
    }
    for (let i = 0; i < n; i++) { real[i] /= n; imag[i] /= n; }
  }

  sample(x, z) {
    const n = this.size;
    const gx = THREE.MathUtils.euclideanModulo(x / this.worldWidth + .5, 1) * (n - 1);
    const gy = THREE.MathUtils.euclideanModulo(z / this.worldDepth + .5, 1) * (n - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = gx - x0, ty = gy - y0;
    const top = THREE.MathUtils.lerp(this.output[y0 * n + x0], this.output[y0 * n + x1], tx);
    const bottom = THREE.MathUtils.lerp(this.output[y1 * n + x0], this.output[y1 * n + x1], tx);
    return THREE.MathUtils.lerp(top, bottom, ty);
  }
}
