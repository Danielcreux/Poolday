import * as THREE from 'three';

export class FloatingObject {
  constructor(group, { name, description, position, phase = 0, physics = {} }) {
    this.group = group;
    this.name = name;
    this.description = description;
    this.phase = phase;
    this.home = new THREE.Vector3(...position);
    this.target = this.home.clone();
    this.baseScale = group.scale.clone();
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.pointerVelocity = new THREE.Vector3();
    this.lastDragPoint = this.target.clone();
    this.lastDragTime = 0;
    this.jelly = 0;
    this.jellyVelocity = 0;
    this.displayScale = 1;
    this.jellyUniforms = [];
    this.dragging = false;
    this.hovered = false;
    this.selected = false;

    this.body = {
      mass: physics.mass ?? 1,
      footprint: physics.footprint ?? .65,
      collisionRadius: physics.collisionRadius ?? physics.footprint ?? .65,
      responsiveScale: 1,
      buoyancy: physics.buoyancy ?? 18,
      verticalDrag: physics.verticalDrag ?? 4.5,
      linearDrag: physics.linearDrag ?? .55,
      angularSpring: physics.angularSpring ?? 13,
      angularDrag: physics.angularDrag ?? 4,
      drift: physics.drift ?? .018,
      yawDrift: physics.yawDrift ?? .025,
      wavePush: physics.wavePush ?? 1.35,
      softness: physics.softness ?? .75,
      minX: physics.minX ?? -5.45,
      maxX: physics.maxX ?? 5.45,
      minZ: physics.minZ ?? -4.15,
      maxZ: physics.maxZ ?? 4.15
    };

    const r = this.body.footprint;
    this.samples = [
      new THREE.Vector2(-r, 0), new THREE.Vector2(r, 0),
      new THREE.Vector2(0, -r), new THREE.Vector2(0, r),
      new THREE.Vector2(-r * .62, -r * .62), new THREE.Vector2(r * .62, -r * .62),
      new THREE.Vector2(-r * .62, r * .62), new THREE.Vector2(r * .62, r * .62)
    ];

    group.position.copy(this.home);
    this.visualRadius = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere()).radius;
    this.viewportRaycaster = new THREE.Raycaster();
    this.viewportPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    group.userData.floatingObject = this;
    const jellyMaterials = new Set();
    group.traverse(child => {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.floatingObject = this;
      const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
      materials.forEach(material => {
        if (jellyMaterials.has(material)) return;
        jellyMaterials.add(material);
        this.jellyUniforms.push(attachJellyShader(material, this.phase));
      });
    });
  }

  beginDrag(point, time) {
    this.dragging = true;
    this.target.set(point.x, this.group.position.y, point.z);
    this.lastDragPoint.copy(this.target);
    this.lastDragTime = time;
    this.pointerVelocity.set(0, 0, 0);
  }

  setViewportBounds(bounds) {
    this.viewportBounds = bounds;
  }

  setCamera(camera) { this.camera = camera; }

  setResponsiveScale(scale) {
    this.body.responsiveScale = scale;
    this.baseScale.multiplyScalar(scale);
    this.group.scale.copy(this.baseScale);
  }

  planarLimits(z = this.group.position.z) {
    const radius = this.body.footprint * .9;
    if (!this.viewportBounds) return { minX:this.body.minX+radius,maxX:this.body.maxX-radius,minZ:this.body.minZ+radius,maxZ:this.body.maxZ-radius };
    const { bottomLeft, bottomRight, topLeft, topRight } = this.viewportBounds;
    const bottomZ=(bottomLeft.z+bottomRight.z)*.5,topZ=(topLeft.z+topRight.z)*.5;
    const t=THREE.MathUtils.clamp((z-bottomZ)/(topZ-bottomZ),0,1);
    return {
      minX:THREE.MathUtils.lerp(bottomLeft.x,topLeft.x,t)+radius,
      maxX:THREE.MathUtils.lerp(bottomRight.x,topRight.x,t)-radius,
      minZ:Math.min(bottomZ,topZ)+radius,
      maxZ:Math.max(bottomZ,topZ)-radius
    };
  }

  constrainPoint(point) {
    const zLimits=this.planarLimits(point.z);
    point.z=THREE.MathUtils.clamp(point.z,zLimits.minZ,zLimits.maxZ);
    const limits=this.planarLimits(point.z);
    point.x=THREE.MathUtils.clamp(point.x,limits.minX,limits.maxX);
    return point;
  }

  constrainToViewport() {
    if (!this.camera) return;
    const center = this.group.position.clone().project(this.camera);
    const edgeX = this.group.position.clone().add(new THREE.Vector3(this.visualRadius,0,0)).project(this.camera);
    const edgeZ = this.group.position.clone().add(new THREE.Vector3(0,0,this.visualRadius)).project(this.camera);
    const radiusX = Math.abs(edgeX.x-center.x);
    const radiusY = Math.abs(edgeZ.y-center.y);
    const limitX = Math.max(.2,1-radiusX-.035),limitY = Math.max(.2,1-radiusY-.035);
    const targetX = THREE.MathUtils.clamp(center.x,-limitX,limitX);
    const targetY = THREE.MathUtils.clamp(center.y,-limitY,limitY);
    if (targetX===center.x && targetY===center.y) return;
    this.viewportPlane.constant=-this.group.position.y;
    this.viewportRaycaster.setFromCamera(new THREE.Vector2(targetX,targetY),this.camera);
    const corrected=new THREE.Vector3();
    if(this.viewportRaycaster.ray.intersectPlane(this.viewportPlane,corrected)){
      if(targetX!==center.x)this.velocity.x*= -.18;
      if(targetY!==center.y)this.velocity.z*= -.18;
      this.group.position.x=corrected.x;this.group.position.z=corrected.z;
      this.addJellyImpulse(.025);
    }
  }

  addJellyImpulse(amount) {
    this.jellyVelocity += THREE.MathUtils.clamp(amount, -.28, .28) * this.body.softness;
  }

  dragTo(point, time) {
    this.target.x = point.x;
    this.target.z = point.z;
    const dt = Math.max((time - this.lastDragTime) / 1000, 1 / 120);
    const instantX = (point.x - this.lastDragPoint.x) / dt;
    const instantZ = (point.z - this.lastDragPoint.z) / dt;
    this.pointerVelocity.x = THREE.MathUtils.lerp(this.pointerVelocity.x, instantX, .32);
    this.pointerVelocity.z = THREE.MathUtils.lerp(this.pointerVelocity.z, instantZ, .32);
    this.pointerVelocity.clampLength(0, 5.5);
    this.addJellyImpulse(this.pointerVelocity.length() * .0018);
    this.lastDragPoint.set(point.x, this.group.position.y, point.z);
    this.lastDragTime = time;
  }

  endDrag(throwObject = true) {
    this.dragging = false;
    if (throwObject) {
      this.velocity.x = this.pointerVelocity.x * .42;
      this.velocity.z = this.pointerVelocity.z * .42;
      this.angularVelocity.z += -this.pointerVelocity.x * .018;
      this.angularVelocity.x += this.pointerVelocity.z * .018;
      this.angularVelocity.y += (this.pointerVelocity.x + this.pointerVelocity.z) * .022;
      this.addJellyImpulse(this.pointerVelocity.length() * .018);
    }
  }

  sampleSurface(waterHeight, time) {
    const cos = Math.cos(this.group.rotation.y);
    const sin = Math.sin(this.group.rotation.y);
    const heights = this.samples.map(sample => {
      const x = this.group.position.x + sample.x * cos - sample.y * sin;
      const z = this.group.position.z + sample.x * sin + sample.y * cos;
      return waterHeight(x, z, time);
    });
    return {
      average: heights.reduce((sum, height) => sum + height, 0) / heights.length,
      left: (heights[0] + heights[4] + heights[6]) / 3,
      right: (heights[1] + heights[5] + heights[7]) / 3,
      back: (heights[2] + heights[4] + heights[5]) / 3,
      front: (heights[3] + heights[6] + heights[7]) / 3,
      slopeX: (heights[1] - heights[0]) / (rSafe(this.body.footprint) * 2),
      slopeZ: (heights[3] - heights[2]) / (rSafe(this.body.footprint) * 2)
    };
  }

  update(time, dt, waterHeight, physicsEnabled = true, viscosity = .18) {
    const body = this.body;
    if (physicsEnabled) {
      const surface = this.sampleSurface(waterHeight, time);
      const targetY = this.home.y + surface.average;
      this.velocity.y += (targetY - this.group.position.y) * body.buoyancy / body.mass * dt;
      this.velocity.y *= Math.exp(-(body.verticalDrag + viscosity * 5.5) * dt);

      if (this.dragging) {
        const dragSpring = 52 / (1 + viscosity * 2.2);
        this.velocity.x += (this.target.x - this.group.position.x) * dragSpring * dt;
        this.velocity.z += (this.target.z - this.group.position.z) * dragSpring * dt;
        this.velocity.x *= Math.exp(-(8 + viscosity * 9) * dt);
        this.velocity.z *= Math.exp(-(8 + viscosity * 9) * dt);
      } else {
        this.velocity.x -= surface.slopeX * body.wavePush / body.mass * dt;
        this.velocity.z -= surface.slopeZ * body.wavePush / body.mass * dt;
        this.velocity.x += Math.sin(time * .19 + this.phase) * body.drift * dt;
        this.velocity.z += Math.cos(time * .16 + this.phase) * body.drift * .8 * dt;
        const damping = body.linearDrag + viscosity * 4.8;
        this.velocity.x *= Math.exp(-damping * dt);
        this.velocity.z *= Math.exp(-damping * dt);
      }

      this.group.position.addScaledVector(this.velocity, dt);
      const limits=this.planarLimits();
      const { minX,maxX,minZ,maxZ }=limits;
      if (this.group.position.x < minX || this.group.position.x > maxX) {
        this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, minX, maxX);
        this.velocity.x *= -.24;
        this.angularVelocity.z += this.velocity.x * .025;
        this.addJellyImpulse(Math.abs(this.velocity.x) * .09);
      }
      if (this.group.position.z < minZ || this.group.position.z > maxZ) {
        this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, minZ, maxZ);
        this.velocity.z *= -.24;
        this.angularVelocity.x -= this.velocity.z * .025;
        this.addJellyImpulse(Math.abs(this.velocity.z) * .09);
      }

      const targetRotationX = Math.atan2(surface.back - surface.front, body.footprint * 2);
      const targetRotationZ = Math.atan2(surface.left - surface.right, body.footprint * 2);
      this.angularVelocity.x += (targetRotationX - this.group.rotation.x) * body.angularSpring / body.mass * dt;
      this.angularVelocity.z += (targetRotationZ - this.group.rotation.z) * body.angularSpring / body.mass * dt;
      const angularDamping = body.angularDrag + viscosity * 4.2;
      this.angularVelocity.x *= Math.exp(-angularDamping * dt);
      this.angularVelocity.z *= Math.exp(-angularDamping * dt);
      this.angularVelocity.y *= Math.exp(-(1.2 + viscosity * 3.2) * dt);
      this.group.rotation.x += this.angularVelocity.x * dt;
      this.group.rotation.z += this.angularVelocity.z * dt;
      this.group.rotation.y += (body.yawDrift / (1 + viscosity * 2) + this.angularVelocity.y) * dt;
    } else {
      const follow = 1 - Math.exp(-dt * 8);
      this.velocity.multiplyScalar(Math.exp(-8 * dt));
      this.angularVelocity.multiplyScalar(Math.exp(-8 * dt));
      this.group.position.x = THREE.MathUtils.lerp(this.group.position.x, this.target.x, follow);
      this.group.position.z = THREE.MathUtils.lerp(this.group.position.z, this.target.z, follow);
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.home.y, follow);
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, follow);
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, 0, follow);
    }

    const motion = Math.abs(this.velocity.y) * .16 + Math.hypot(this.angularVelocity.x, this.angularVelocity.z) * .09;
    const jellyTarget = THREE.MathUtils.clamp(motion, 0, .09);
    this.jellyVelocity += (jellyTarget - this.jelly) * 34 * dt;
    this.jellyVelocity *= Math.exp(-(4.8 + viscosity * 2.5) * dt);
    this.jelly += this.jellyVelocity * dt;
    this.jelly = THREE.MathUtils.clamp(this.jelly, -.14, .14);
    const wobble = this.jelly * Math.sin(time * (6.2 - viscosity * 2.2) + this.phase);
    const targetDisplayScale = this.hovered || this.selected ? 1.07 : 1;
    this.displayScale = THREE.MathUtils.lerp(this.displayScale, targetDisplayScale, 1 - Math.exp(-dt * 8));
    const stretchY = 1 - wobble;
    const conserveVolume = 1 / Math.sqrt(Math.max(stretchY, .72));
    this.group.scale.set(
      this.baseScale.x * this.displayScale * conserveVolume,
      this.baseScale.y * this.displayScale * stretchY,
      this.baseScale.z * this.displayScale * conserveVolume
    );
    this.constrainToViewport();
    const shaderJelly = THREE.MathUtils.clamp(Math.abs(wobble) * 1.4 + Math.abs(this.jelly) * .7, 0, .16);
    this.jellyUniforms.forEach(uniforms => {
      uniforms.time.value = time;
      uniforms.amount.value = shaderJelly;
    });
  }

  reset() {
    this.target.copy(this.home);
    this.group.position.copy(this.home);
    this.group.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.pointerVelocity.set(0, 0, 0);
    this.jelly = 0;
    this.jellyVelocity = 0;
    this.selected = false;
    this.dragging = false;
  }
}

function rSafe(radius) {
  return Math.max(radius, .001);
}

function attachJellyShader(material, phase) {
  const uniforms = { time: { value: 0 }, amount: { value: 0 }, phase: { value: phase } };
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    shader.uniforms.uJellyTime = uniforms.time;
    shader.uniforms.uJellyAmount = uniforms.amount;
    shader.uniforms.uJellyPhase = uniforms.phase;
    shader.vertexShader = `uniform float uJellyTime;uniform float uJellyAmount;uniform float uJellyPhase;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float jellyPrimary=sin(position.y*6.0+uJellyTime*5.2+uJellyPhase);
        float jellySecondary=sin(position.x*8.0-uJellyTime*4.1+uJellyPhase*1.7)*.45;
        transformed+=normal*(jellyPrimary+jellySecondary)*uJellyAmount*.12;
        transformed.x+=sin(position.z*5.0+uJellyTime*3.7)*uJellyAmount*.035;`);
  };
  material.customProgramCacheKey = () => `${previousKey()}-jelly-v2`;
  material.needsUpdate = true;
  return uniforms;
}
