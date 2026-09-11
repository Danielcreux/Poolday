import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Water } from './Water.js';
import { Environment } from './Environment.js';
import { createLighting } from './Lighting.js';
import { ObjectManager } from '../objects/ObjectManager.js';
import { InteractionController } from '../interaction/InteractionController.js';

export class SceneManager {
  constructor(canvas){
    this.canvas=canvas;this.scene=new THREE.Scene();this.quality=window.innerWidth<700?.55:1;
    this.camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,60);this.baseCamera=new THREE.Vector3(0,14.2,5.4);this.camera.position.copy(this.baseCamera);this.camera.lookAt(0,0,0);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:this.quality>.7,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.quality>.7?2:1.35));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;
    const pmrem=new THREE.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();
    this.environment=new Environment(this.scene);this.lighting=createLighting(this.scene,this.quality);this.water=new Water(this.scene,this.quality);this.environment.connectWater(this.water);this.objects=new ObjectManager(this.scene);
    this.objects.items.forEach(item=>item.setCamera(this.camera));
    if(innerWidth<700)this.objects.items.forEach(item=>{item.home.x*=.48;item.target.copy(item.home);item.setResponsiveScale(.8);item.group.position.copy(item.home);});
    this.updateObjectBounds();
    this.mouse=new THREE.Vector2();this.cameraTarget=new THREE.Vector3();this.selected=null;
    this.nightMix=0;this.nightTarget=0;
    this.theme={dayBackground:new THREE.Color('#d9e7e7'),nightBackground:new THREE.Color('#06172d'),dayDeep:new THREE.Color('#739ba1'),nightDeep:new THREE.Color('#062c58'),dayShallow:new THREE.Color('#e0eeee'),nightShallow:new THREE.Color('#0b5b7a'),daySun:new THREE.Color('#fff8df'),nightSun:new THREE.Color('#a9c9ff'),dayFloor:new THREE.Color('#b3cacc'),nightFloor:new THREE.Color('#061a35'),dayCaustic:new THREE.Color('#d4e2e2'),nightCaustic:new THREE.Color('#245a82')};
    this.interaction=new InteractionController({camera:this.camera,canvas,water:this.water,objects:this.objects,onHover:(item,e)=>this.hover(item,e),onSelect:item=>this.select(item)});
    const themeToggle=document.querySelector('#theme-toggle');themeToggle.addEventListener('click',()=>{this.nightTarget=this.nightTarget?0:1;const night=!!this.nightTarget;document.body.classList.toggle('night',night);themeToggle.setAttribute('aria-pressed',night);themeToggle.innerHTML=night?'<span>☀</span> Day':'<span>☾</span> Night';});
    if(new URLSearchParams(location.search).has('night'))themeToggle.click();
    window.addEventListener('resize',()=>this.resize());window.addEventListener('pointermove',e=>{this.mouse.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1);document.documentElement.style.setProperty('--mx',`${e.clientX}px`);document.documentElement.style.setProperty('--my',`${e.clientY}px`);});
    this.clock=new THREE.Clock();this.elapsed=0;this.animate();
  }
  hover(item,e){const label=document.querySelector('#object-label');label.classList.toggle('visible',!!item);label.textContent=item?.name||'';if(e){label.style.left=`${e.clientX}px`;label.style.top=`${e.clientY}px`;}document.body.classList.toggle('is-hovering',!!item);}
  select(item){this.selected=item;}
  force(){
    const origin=new THREE.Vector2((Math.random()-.5)*3,(Math.random()-.5)*2);
    this.water.disturb(origin.x,origin.y,1.25);
    this.objects.items.forEach(item=>{
      const dx=item.group.position.x-origin.x,dz=item.group.position.z-origin.y;
      const distance=Math.max(Math.hypot(dx,dz),.7);
      const impulse=Math.min(1.25,.9/distance)/item.body.mass;
      item.velocity.x+=dx/distance*impulse;
      item.velocity.z+=dz/distance*impulse;
      item.velocity.y+=impulse*.12;
      item.angularVelocity.x+=dz/distance*impulse*.07;
      item.angularVelocity.z-=dx/distance*impulse*.07;
    });
    for(let i=1;i<4;i++)setTimeout(()=>this.water.disturb(origin.x+(Math.random()-.5)*1.2,origin.y+(Math.random()-.5)*1.2,.65),i*120);
  }
  reset(){this.objects.reset();this.water.reset();this.interaction.select(null);this.mouse.set(0,0);}
  updateTheme(dt){
    this.nightMix=THREE.MathUtils.lerp(this.nightMix,this.nightTarget,1-Math.exp(-dt*2.2));
    const mix=this.nightMix,t=this.theme;
    this.scene.background.lerpColors(t.dayBackground,t.nightBackground,mix);this.scene.fog.color.copy(this.scene.background);
    this.water.uniforms.uDeepColor.value.lerpColors(t.dayDeep,t.nightDeep,mix);this.water.uniforms.uShallowColor.value.lerpColors(t.dayShallow,t.nightShallow,mix);this.water.uniforms.uSunColor.value.lerpColors(t.daySun,t.nightSun,mix);
    this.lighting.hemi.intensity=THREE.MathUtils.lerp(.78,.16,mix);this.lighting.sun.intensity=THREE.MathUtils.lerp(2.45,.62,mix);this.lighting.sun.color.lerpColors(t.daySun,t.nightSun,mix);
    this.environment.causticsUniforms.uBaseColor.value.lerpColors(t.dayFloor,t.nightFloor,mix);this.environment.causticsUniforms.uCausticColor.value.lerpColors(t.dayCaustic,t.nightCaustic,mix);
    this.water.uniforms.uNightMix.value=mix;this.environment.causticsUniforms.uNightMix.value=mix;
    this.lighting.nightLights.forEach(({light})=>{light.intensity=THREE.MathUtils.lerp(0,8.5,mix);});this.lighting.fixtureMaterial.emissiveIntensity=THREE.MathUtils.lerp(0,4.2,mix);this.lighting.fixtureMaterial.opacity=mix;
    this.environment.causticsUniforms.uIntensity.value=THREE.MathUtils.lerp(.72,.38,mix);this.renderer.toneMappingExposure=THREE.MathUtils.lerp(1.02,.82,mix);
  }
  updateObjectBounds(){
    this.camera.updateMatrixWorld();
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),raycaster=new THREE.Raycaster();
    const edge=innerWidth<700?.88:.95;
    const project=(x,y)=>{raycaster.setFromCamera(new THREE.Vector2(x,y),this.camera);const point=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,point)?point:null;};
    const bounds={bottomLeft:project(-edge,-edge),bottomRight:project(edge,-edge),topLeft:project(-edge,edge),topRight:project(edge,edge)};
    if(Object.values(bounds).some(point=>!point))return;
    this.objects.items.forEach(item=>item.setViewportBounds(bounds));
    const corners=[bounds.bottomLeft,bounds.bottomRight,bounds.topLeft,bounds.topRight];
    corners.forEach((corner,index)=>{
      const position=corner.clone().multiplyScalar(innerWidth<700?.82:.9);
      const fixture=this.lighting.nightLights[index].fixture,light=this.lighting.nightLights[index].light;
      fixture.position.set(position.x,.025,position.z);light.position.set(position.x,.24,position.z);
      this.water.uniforms.uCornerLightPositions.value[index].set(position.x,.24,position.z);
    });
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.35:2));this.renderer.setSize(innerWidth,innerHeight);this.updateObjectBounds();}
  animate(){requestAnimationFrame(()=>this.animate());const dt=Math.min(this.clock.getDelta(),.04);this.elapsed+=dt;this.updateTheme(dt);this.water.update(this.elapsed,dt);this.environment.update(this.elapsed);this.objects.update(this.elapsed,dt,this.water,true);
    const focus=this.selected?this.selected.group.position:this.cameraTarget.set(0,0,0);const desired=this.baseCamera.clone();desired.x+=this.mouse.x*.16;desired.z+=this.mouse.y*.14;if(this.selected){desired.x+=focus.x*.16;desired.z+=focus.z*.16;desired.y-=1.25;}this.camera.position.lerp(desired,1-Math.exp(-dt*2.5));this.camera.lookAt(focus.x*.08,0,focus.z*.08);this.renderer.render(this.scene,this.camera);}
}
