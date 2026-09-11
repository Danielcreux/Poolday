import * as THREE from 'three';
import { FloatingObject } from './FloatingObject.js';

function createVinylBumpTexture() {
  const size=96,data=new Uint8Array(size*size*4);
  let seed=9137;
  for(let i=0;i<size*size;i++){
    seed=(seed*1664525+1013904223)>>>0;
    const grain=122+Math.floor((seed/4294967296)*18);
    data[i*4]=grain;data[i*4+1]=grain;data[i*4+2]=grain;data[i*4+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(7,7);
  texture.needsUpdate=true;
  return texture;
}

const vinylBump=createVinylBumpTexture();
const mat = (color, roughness=.3) => new THREE.MeshPhysicalMaterial({
  color, roughness, metalness:0, opacity:1, transparent:false, transmission:0,
  clearcoat:.7, clearcoatRoughness:.19, sheen:.03, sheenRoughness:.58,
  sheenColor:new THREE.Color(color), specularIntensity:.58, specularColor:new THREE.Color('#fffdf8'),
  iridescence:.012, iridescenceIOR:1.24, envMapIntensity:.2,
  bumpMap:vinylBump, bumpScale:.012
});

function duck() {
  const g = new THREE.Group(), yellow = mat('#dba800',.24), orange = mat('#e85a00',.27);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.76, 32, 20), yellow); body.scale.set(1.25,.62,1); body.position.y=.24;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 28, 18), yellow); head.position.set(.58,.68,0);
  const beak = new THREE.Mesh(new THREE.SphereGeometry(.22, 20, 12), orange); beak.scale.set(.75,.3,.65); beak.position.set(.94,.62,0);
  [-1,1].forEach(s => { const eye = new THREE.Mesh(new THREE.SphereGeometry(.045,12,8), mat('#15191a')); eye.position.set(.82,.79,s*.25); g.add(eye); });
  g.add(body,head,beak); g.scale.setScalar(.78); return g;
}

function stripedMaterial(colors, axis='xz') {
  const material=mat('#ffffff',.22);
  const values=colors.map(color=>new THREE.Color(color));
  const colorCode=values.map(color=>`vec3(${color.r.toFixed(5)},${color.g.toFixed(5)},${color.b.toFixed(5)})`);
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`varying vec3 vLocalPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvLocalPosition=position;');
    const angle=axis==='xy'?'atan(vLocalPosition.y,vLocalPosition.x)':'atan(vLocalPosition.z,vLocalPosition.x)';
    shader.fragmentShader=`varying vec3 vLocalPosition;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>\nfloat stripeAngle=${angle}+3.14159265;\nint stripeIndex=int(mod(floor(stripeAngle/1.5707963),4.0));\nvec3 stripeColor=stripeIndex==0?${colorCode[0]}:stripeIndex==1?${colorCode[1]}:stripeIndex==2?${colorCode[2]}:${colorCode[3]};\ndiffuseColor.rgb=stripeColor;`);
  };
  material.customProgramCacheKey=()=>`stripes-${axis}-${colors.join('-')}`;
  return material;
}

function beachBall() { const g=new THREE.Group(); const ball=new THREE.Mesh(new THREE.SphereGeometry(.65,40,28),stripedMaterial(['#f4ead0','#d92b28','#e5ad00','#007fa6'])); ball.position.y=.43; g.add(ball); return g; }

function ring() { const g=new THREE.Group(); const torus=new THREE.Mesh(new THREE.TorusGeometry(.72,.23,22,64),stripedMaterial(['#f5f3e8','#00789f','#f5f3e8','#00789f'],'xy')); torus.rotation.x=Math.PI/2; torus.position.y=.2; g.add(torus); return g; }

function flamingo() {
  const g=new THREE.Group(), pink=mat('#d92c72',.23), dark=mat('#142127',.3), white=mat('#f6eee8',.3);
  const base=new THREE.Mesh(new THREE.TorusGeometry(.67,.2,20,56),pink); base.rotation.x=Math.PI/2; base.position.y=.18;
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.24,.45),new THREE.Vector3(0,.8,.58),new THREE.Vector3(0,1.18,.5),new THREE.Vector3(0,1.04,.42)]);
  const neck=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.11,10,false),pink);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,20,14),pink); head.position.set(0,1.05,.57);
  const face=new THREE.Mesh(new THREE.SphereGeometry(.135,18,12),white);face.scale.set(.62,.72,.82);face.position.set(0,1.065,.695);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.105,.32,16),dark); beak.rotation.x=Math.PI/2; beak.position.set(0,1.035,.845);
  [-1,1].forEach(side=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.042,14,10),dark);eye.position.set(side*.11,1.13,.7);g.add(eye);});
  g.add(base,neck,head,face,beak); g.scale.setScalar(.85); return g;
}

function prism() {
  const g=new THREE.Group(); const crystal=new THREE.Mesh(new THREE.IcosahedronGeometry(.68,2),mat('#009b7d',.2)); crystal.position.y=.48; g.add(crystal); return g;
}

function contactShadow(scale = 1) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);float a=(1.-smoothstep(.12,1.,d))*.34;gl_FragColor=vec4(.06,.13,.15,a);}`
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(scale, scale * .72, 1);
  shadow.position.y = -.645;
  return shadow;
}

export class ObjectManager {
  constructor(scene) {
    this.collisionCooldown = 0;
    this.items = [
      new FloatingObject(duck(), {name:'Buoyant Duck',description:'A familiar polymer shell used to observe displacement and gentle rotational drift.',position:[-4,.14,-1.7],phase:.4,physics:{mass:1.1,footprint:.72,collisionRadius:.98,buoyancy:17,angularDrag:4.8}}),
      new FloatingObject(flamingo(), {name:'Pink Flamingo',description:'A high-profile inflatable sample with an intentionally unstable center of mass.',position:[2.5,.1,-2.2],phase:1.7,physics:{mass:.82,footprint:.78,collisionRadius:.88,buoyancy:14,angularSpring:9,angularDrag:3.4}}),
      new FloatingObject(beachBall(), {name:'Chromatic Sphere',description:'Low-mass volume responding quickly to surface tension and passing wave fronts.',position:[4.05,.16,.35],phase:2.8,physics:{mass:.38,footprint:.46,collisionRadius:.68,buoyancy:12,linearDrag:.38,angularSpring:8,angularDrag:2.8,yawDrift:.06}}),
      new FloatingObject(ring(), {name:'Rescue Ring',description:'A balanced toroidal body designed to reveal tilt and local water gradients.',position:[-1.4,.12,2.4],phase:4.1,physics:{mass:.7,footprint:.74,collisionRadius:.96,buoyancy:19,angularSpring:17,angularDrag:5.2}}),
      new FloatingObject(prism(), {name:'Sample X–05',description:'An experimental translucent solid with a dense, faceted optical response.',position:[.7,.12,.2],phase:5.2,physics:{mass:1.65,footprint:.48,collisionRadius:.7,buoyancy:21,linearDrag:.72,angularSpring:15,angularDrag:4.5}})
    ];
    const shadowScales = [1.15, 1.25, .72, 1.05, .68];
    this.shadows = this.items.map((item, index) => {
      const shadow = contactShadow(shadowScales[index]);
      shadow.position.x = item.group.position.x;
      shadow.position.z = item.group.position.z;
      scene.add(shadow);
      return shadow;
    });
    this.items.forEach(i => scene.add(i.group));
  }
  update(time,dt,water,physics){
    const viscosity=water.uniforms.uViscosity.value;
    const steps=Math.max(1,Math.ceil(dt/(1/90)));
    const step=dt/steps;
    for(let frame=0;frame<steps;frame++){
      const subTime=time-dt+step*(frame+1);
      this.items.forEach(item=>item.update(subTime,step,water.heightAt.bind(water),physics,viscosity));
      if(physics){this.resolveCollisions(viscosity,water);this.resolveCollisions(viscosity,water);}
    }
    this.collisionCooldown=Math.max(0,this.collisionCooldown-dt);
    this.items.forEach((item,index)=>{
      if(physics)this.updateWake(item,dt,water,viscosity);
      this.shadows[index].position.x=item.group.position.x+.16;
      this.shadows[index].position.z=item.group.position.z+.22;
    });
  }

  resolveCollisions(viscosity,water){
    for(let i=0;i<this.items.length;i++)for(let j=i+1;j<this.items.length;j++){
      const a=this.items[i],b=this.items[j];
      const dx=b.group.position.x-a.group.position.x;
      const dz=b.group.position.z-a.group.position.z;
      const minDistance=a.body.collisionRadius*a.body.responsiveScale+b.body.collisionRadius*b.body.responsiveScale;
      const distance=Math.max(Math.hypot(dx,dz),.0001);
      if(distance>=minDistance)continue;
      const nx=dx/distance,nz=dz/distance;
      const invA=a.dragging?0:1/a.body.mass;
      const invB=b.dragging?0:1/b.body.mass;
      const invTotal=invA+invB;
      if(invTotal===0)continue;
      const correction=(minDistance-distance)*.88/invTotal;
      a.group.position.x-=nx*correction*invA;a.group.position.z-=nz*correction*invA;
      b.group.position.x+=nx*correction*invB;b.group.position.z+=nz*correction*invB;
      const relative=(b.velocity.x-a.velocity.x)*nx+(b.velocity.z-a.velocity.z)*nz;
      if(relative<0){
        const restitution=THREE.MathUtils.lerp(.16,.025,viscosity);
        const impulse=-(1+restitution)*relative/invTotal;
        a.velocity.x-=nx*impulse*invA;a.velocity.z-=nz*impulse*invA;
        b.velocity.x+=nx*impulse*invB;b.velocity.z+=nz*impulse*invB;
        a.angularVelocity.y-=impulse*.018;b.angularVelocity.y+=impulse*.018;
        a.addJellyImpulse(impulse*.055);b.addJellyImpulse(impulse*.055);
        if(-relative>.28&&this.collisionCooldown<=0){water.disturb((a.group.position.x+b.group.position.x)*.5,(a.group.position.z+b.group.position.z)*.5,Math.min(.72,-relative*.3));this.collisionCooldown=.18;}
      }
    }
  }

  updateWake(item,dt,water,viscosity){
    item.wakeCooldown=(item.wakeCooldown??0)-dt;
    const speed=Math.hypot(item.velocity.x,item.velocity.z);
    if(speed<.3||item.wakeCooldown>0)return;
    const nx=item.velocity.x/speed,nz=item.velocity.z/speed;
    const strength=THREE.MathUtils.clamp(speed*.14,.08,.42)*(1-viscosity*.45);
    water.disturb(item.group.position.x-nx*item.body.footprint,item.group.position.z-nz*item.body.footprint,strength);
    item.wakeCooldown=THREE.MathUtils.lerp(.16,.34,viscosity);
  }
  reset(){ this.items.forEach(i=>i.reset()); }
}
