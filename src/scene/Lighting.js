import * as THREE from 'three';

export function createLighting(scene, quality = 1) {
  const hemi = new THREE.HemisphereLight('#f5ffff', '#507b80', .78);
  const sun = new THREE.DirectionalLight('#fff5dc', 2.45);
  sun.position.set(-5, 10, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality > .7 ? 2048 : 1024, quality > .7 ? 2048 : 1024);
  sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -.00035;
  const fixtureGeometry=new THREE.CylinderGeometry(.12,.12,.045,24);
  const fixtureMaterial=new THREE.MeshStandardMaterial({color:'#d9ecff',emissive:'#69bfff',emissiveIntensity:0,roughness:.25,metalness:.25,transparent:true,opacity:0,depthWrite:false});
  const nightLights=Array.from({length:4},()=>{
    const light=new THREE.PointLight('#72bdff',0,7.5,2);light.position.y=.18;
    const fixture=new THREE.Mesh(fixtureGeometry,fixtureMaterial);fixture.position.y=.035;
    scene.add(light,fixture);return {light,fixture};
  });
  scene.add(hemi, sun);
  return { hemi, sun, nightLights, fixtureMaterial };
}
