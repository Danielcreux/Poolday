import * as THREE from 'three';

export class InteractionController {
  constructor({ camera, canvas, water, objects, onHover, onSelect }) {
    this.camera=camera; this.canvas=canvas; this.water=water; this.objects=objects; this.onHover=onHover; this.onSelect=onSelect;
    this.raycaster=new THREE.Raycaster(); this.pointer=new THREE.Vector2(); this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.hovered=null; this.dragged=null; this.down=null; this.lastMove=0; this.enabled=true;
    this.lastWaterPoint=null; this.lastPointerTime=performance.now();
    canvas.addEventListener('pointermove',e=>this.move(e)); canvas.addEventListener('pointerdown',e=>this.start(e));
    window.addEventListener('pointerup',e=>this.end(e)); canvas.addEventListener('pointerleave',()=>{this.setHover(null);this.lastWaterPoint=null;});
  }
  setPointer(e){ const r=this.canvas.getBoundingClientRect(); this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); this.raycaster.setFromCamera(this.pointer,this.camera); }
  hitObject(){ const hits=this.raycaster.intersectObjects(this.objects.items.map(i=>i.group),true); return hits[0]?.object.userData.floatingObject || null; }
  waterPoint(){ const p=new THREE.Vector3(); return this.raycaster.ray.intersectPlane(this.plane,p) ? p : null; }
  setHover(item,e){ if(this.hovered===item)return; if(this.hovered)this.hovered.hovered=false; this.hovered=item; if(item)item.hovered=true; this.onHover(item,e); }
  move(e){
    this.setPointer(e); const now=performance.now(); const waterPoint=this.waterPoint();
    if(this.dragged){ if(waterPoint){this.dragged.constrainPoint(waterPoint);this.dragged.dragTo(waterPoint,now);this.water.stir(this.lastWaterPoint||waterPoint,waterPoint,now-this.lastPointerTime,true);this.lastWaterPoint=waterPoint.clone();this.lastPointerTime=now;} return; }
    this.setHover(this.hitObject(),e);
    if(waterPoint){if(this.lastWaterPoint)this.water.stir(this.lastWaterPoint,waterPoint,now-this.lastPointerTime,false);this.lastWaterPoint=waterPoint.clone();this.lastPointerTime=now;}
  }
  start(e){ this.setPointer(e); const item=this.hitObject(); this.down={x:e.clientX,y:e.clientY,item}; if(item){const p=this.waterPoint();this.dragged=item;item.beginDrag(p||item.group.position,performance.now());this.canvas.setPointerCapture?.(e.pointerId);} }
  end(e){
    if(!this.down)return; const moved=Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y);
    if(this.dragged){this.dragged.endDrag(moved>=6);if(moved<6)this.select(this.dragged);else this.water.disturb(this.dragged.group.position.x,this.dragged.group.position.z,.9);this.dragged=null;}
    else {this.setPointer(e);const p=this.waterPoint();if(p)this.water.disturb(p.x,p.z,1);if(moved<6)this.select(null);}
    this.down=null;
  }
  select(item){this.objects.items.forEach(i=>i.selected=i===item);this.onSelect(item);}
}
