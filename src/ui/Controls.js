const sliderDefs = [
  ['viscosity','Viscosity',0,1,.18,.01],['tension','Surface tension',0,1,.52,.01],
  ['waves','Wave strength',.02,.32,.16,.01],['refraction','Refraction',0,1,.62,.01],['light','Light intensity',.7,5,3.3,.1]
];

export class Controls {
  constructor({water,environment,lighting,onReset,onForce}){
    this.water=water;this.environment=environment;this.lighting=lighting;
    const sliders=document.querySelector('#sliders');
    sliderDefs.forEach(([id,label,min,max,value,step])=>{
      const row=document.createElement('label');row.innerHTML=`<span>${label}<output>${value}</output></span><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" step="${step}">`;sliders.append(row);
      row.querySelector('input').addEventListener('input',e=>{row.querySelector('output').textContent=Number(e.target.value).toFixed(id==='light'?1:2);this.apply(id,+e.target.value);});
    });
    const toggleDefs=[['Refraction',true,v=>water.uniforms.uRefractionEnabled.value=v],['Caustics',true,v=>environment.causticsUniforms.uEnabled.value=v],['Shadows',true,v=>lighting.sun.castShadow=v],['Physics',true,v=>this.physics=v]];
    this.physics=true; const toggles=document.querySelector('#toggles');
    toggleDefs.forEach(([label,checked,fn])=>{const l=document.createElement('label');l.innerHTML=`<span>${label}</span><input type="checkbox" ${checked?'checked':''}><i></i>`;l.querySelector('input').addEventListener('change',e=>fn(e.target.checked));toggles.append(l);});
    document.querySelector('#water-types').addEventListener('click',e=>{if(!e.target.dataset.type)return;[...e.currentTarget.children].forEach(b=>b.classList.toggle('active',b===e.target));this.preset(e.target.dataset.type);});
    document.querySelector('#reset-button').addEventListener('click',onReset);document.querySelector('#force-button').addEventListener('click',onForce);
  }
  apply(id,v){if(id==='viscosity')this.water.uniforms.uViscosity.value=v;if(id==='tension')this.water.uniforms.uSurfaceTension.value=v;if(id==='waves')this.water.uniforms.uWaveStrength.value=v;if(id==='refraction')this.water.uniforms.uRefraction.value=v;if(id==='light')this.lighting.sun.intensity=v;this.updateReadouts();}
  preset(type){const values=type==='salt'?{viscosity:.28,tension:.7,waves:.12,refraction:.78}:type==='viscous'?{viscosity:.88,tension:.35,waves:.07,refraction:.48}:{viscosity:.18,tension:.52,waves:.16,refraction:.62};Object.entries(values).forEach(([id,v])=>{const input=document.querySelector(`#${id}`);input.value=v;input.dispatchEvent(new Event('input'));});document.querySelector('#density-value').textContent=type==='salt'?'1025 kg/m³':type==='viscous'?'1180 kg/m³':'997 kg/m³';}
  updateReadouts(){document.querySelector('#tension-value').textContent=`${(45+this.water.uniforms.uSurfaceTension.value*53.5).toFixed(1)} mN/m`;document.querySelector('#viscosity-value').textContent=`${(.72+this.water.uniforms.uViscosity.value*1.57).toFixed(3)} mPa·s`;}
}
