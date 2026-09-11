uniform float uTime;
uniform float uIntensity;
uniform bool uEnabled;
uniform sampler2D uHeightField;
uniform sampler2D uSpectralField;
uniform float uSpectralScale;
uniform vec3 uBaseColor;
uniform vec3 uCausticColor;
uniform vec3 uCornerLightPositions[4];
uniform float uNightMix;
varying vec2 vUv;

float waveHeight(vec2 uv) {
  return texture2D(uHeightField, uv).r + texture2D(uSpectralField, uv).r * uSpectralScale;
}

float filament(float value, float width) {
  return pow(1.0 - clamp(abs(value) * width, 0.0, 1.0), 4.0);
}

float cells(vec2 p, float t) {
  vec2 q = p * 44.0;
  q += vec2(sin(q.y * .72 + t) * .42, cos(q.x * .63 - t * .8) * .38);
  float a = sin(q.x * 1.37 + sin(q.y * .91 + t)) + sin(q.y * 1.12 - t * .7);
  float b = cos((q.x + q.y) * .82 - t * .55) + sin((q.x - q.y) * 1.08 + t * .45);
  float c = filament(a, 3.2);
  c = max(c, filament(b, 4.1) * .82);
  return c;
}

void main() {
  vec2 texel = vec2(1.0 / 128.0, 1.0 / 96.0);
  float center = waveHeight(vUv);
  float left = waveHeight(vUv - vec2(texel.x, 0.0));
  float right = waveHeight(vUv + vec2(texel.x, 0.0));
  float down = waveHeight(vUv - vec2(0.0, texel.y));
  float up = waveHeight(vUv + vec2(0.0, texel.y));
  vec2 gradient = vec2(right - left, up - down) * 2.4;
  float curvature = abs(left + right + down + up - center * 4.0);
  vec2 p = (vUv + gradient * .045) * vec2(1.42, 1.0);
  float edge = smoothstep(0.0, .12, vUv.x) * smoothstep(0.0, .12, vUv.y)
    * smoothstep(0.0, .12, 1.0-vUv.x) * smoothstep(0.0, .12, 1.0-vUv.y);
  float focusing = 1.0 + smoothstep(.003, .035, curvature) * .24;
  float c = cells(p, uTime * .32) * uIntensity * focusing * (uEnabled ? 1.0 : 0.0);
  vec3 color = uBaseColor + uCausticColor * c;
  vec2 worldPosition = (vUv - .5) * vec2(24.0, 18.0);
  float cornerLight = 0.0;
  for (int i = 0; i < 4; i++) {
    float distanceToLight = distance(worldPosition, uCornerLightPositions[i].xz);
    cornerLight += 1.0 / (1.0 + distanceToLight * distanceToLight * .32);
  }
  color += vec3(.055, .22, .48) * cornerLight * uNightMix * (1.0 + c * .9);
  gl_FragColor = vec4(color, edge);
}
