import * as THREE from 'three';
import vertexShader from '../shaders/waterVertex.glsl?raw';
import fragmentShader from '../shaders/waterFragment.glsl?raw';
import { HeightField } from './HeightField.js';
import { SpectralWaveField } from './SpectralWaveField.js';

export class Water {
  constructor(scene, quality = 1) {
    const segments = quality > .7 ? 150 : 80;
    this.heightField = new HeightField(quality > .7 ? 128 : 72, quality > .7 ? 96 : 54);
    this.spectralField = new SpectralWaveField(quality > .7 ? 64 : 32);
    this.uniforms = {
      uTime: { value: 0 }, uWaveStrength: { value: .16 }, uSurfaceTension: { value: .52 },
      uViscosity: { value: .18 }, uRefraction: { value: .62 }, uRefractionEnabled: { value: true },
      uDeepColor: { value: new THREE.Color('#739ba1') }, uShallowColor: { value: new THREE.Color('#e0eeee') },
      uHeightField: { value: this.heightField.texture }, uSpectralField: { value: this.spectralField.texture },
      uSunDirection: { value: new THREE.Vector3(-5, 10, 3).normalize() },
      uSunColor: { value: new THREE.Color('#fff8df') },
      uCornerLightPositions: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      uNightMix: { value: 0 }
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 18, segments, segments), new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms: this.uniforms, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, derivatives: true
    }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0;
    this.mesh.receiveShadow = true;
    this.mesh.userData.isWater = true;
    scene.add(this.mesh);
  }

  heightAt(x, z, time) {
    const u = this.uniforms;
    const spectralScale = u.uWaveStrength.value / .16;
    return this.spectralField.sample(x, z) * spectralScale + this.heightField.sample(x, z);
  }

  disturb(x, z, strength = 1) {
    this.heightField.disturb(x, z, strength);
  }

  stir(from, to, elapsedMs, dragging = false) {
    if (!from || elapsedMs <= 0) return;
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    if (distance < .003) return;
    const speed = distance / Math.max(elapsedMs / 1000, 1 / 120);
    const viscosity = this.uniforms.uViscosity.value;
    const strength = THREE.MathUtils.clamp(speed * (dragging ? .022 : .011), .012, dragging ? .34 : .15);
    const radius = THREE.MathUtils.lerp(.22, .48, viscosity) * (dragging ? 1.2 : 1);
    this.heightField.disturbLine(from, to, strength, radius);
  }

  update(time, dt) {
    this.uniforms.uTime.value = time;
    this.spectralField.update(time * THREE.MathUtils.lerp(1, .45, this.uniforms.uViscosity.value));
    this.heightField.update(dt, this.uniforms.uViscosity.value, this.uniforms.uSurfaceTension.value);
  }

  reset() { this.heightField.reset(); }
}
