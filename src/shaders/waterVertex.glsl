uniform float uTime;
uniform float uWaveStrength;
uniform float uSurfaceTension;
uniform float uViscosity;
uniform sampler2D uHeightField;
uniform sampler2D uSpectralField;
varying vec3 vWorldPosition;
varying float vHeight;
varying vec3 vWaveNormal;

float combinedHeight(vec2 fieldUv) {
  float spectralScale = uWaveStrength / .16;
  return texture2D(uSpectralField, fieldUv).r * spectralScale
    + texture2D(uHeightField, fieldUv).r;
}

void main() {
  vec3 p = position;
  vec2 fieldUv = vec2(p.x, -p.y) / vec2(24.0, 18.0) + .5;
  vec2 texel = vec2(1.0 / 128.0, 1.0 / 96.0);
  float wave = combinedHeight(fieldUv);
  float heightLeft = combinedHeight(fieldUv - vec2(texel.x, 0.0));
  float heightRight = combinedHeight(fieldUv + vec2(texel.x, 0.0));
  float heightDown = combinedHeight(fieldUv - vec2(0.0, texel.y));
  float heightUp = combinedHeight(fieldUv + vec2(0.0, texel.y));
  float slopeX = (heightRight - heightLeft) / (24.0 * texel.x * 2.0);
  float slopeZ = (heightUp - heightDown) / (18.0 * texel.y * 2.0);
  vec3 localNormal = normalize(vec3(-slopeX, slopeZ, 1.0));
  p.z += wave;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPosition = world.xyz;
  vHeight = wave;
  vWaveNormal = normalize(mat3(modelMatrix) * localNormal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
