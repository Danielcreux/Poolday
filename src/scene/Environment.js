import * as THREE from 'three';
import causticsFragment from '../shaders/caustics.glsl?raw';

const passVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

export class Environment {
  constructor(scene) {
    scene.background = new THREE.Color('#d9e7e7');
    scene.fog = new THREE.FogExp2('#d9e7e7', .017);
    this.causticsUniforms = { uTime: { value: 0 }, uIntensity: { value: .65 }, uEnabled: { value: true },
      uHeightField: { value: null }, uSpectralField: { value: null }, uSpectralScale: { value: 1 },
      uBaseColor: { value: new THREE.Color('#b3cacc') }, uCausticColor: { value: new THREE.Color('#d4e2e2') },
      uCornerLightPositions: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      uNightMix: { value: 0 } };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.ShaderMaterial({
      vertexShader: passVertex, fragmentShader: causticsFragment, uniforms: this.causticsUniforms
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.68;
    floor.receiveShadow = true;
    scene.add(floor);

  }
  connectWater(water) {
    this.water = water;
    this.causticsUniforms.uHeightField.value = water.heightField.texture;
    this.causticsUniforms.uSpectralField.value = water.spectralField.texture;
    this.causticsUniforms.uCornerLightPositions.value = water.uniforms.uCornerLightPositions.value;
  }
  update(time) { this.causticsUniforms.uTime.value = time;if(this.water)this.causticsUniforms.uSpectralScale.value=this.water.uniforms.uWaveStrength.value/.16; }
}
