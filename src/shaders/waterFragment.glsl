uniform float uTime;
uniform float uRefraction;
uniform bool uRefractionEnabled;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uCornerLightPositions[4];
uniform float uNightMix;
varying vec3 vWorldPosition;
varying float vHeight;
varying vec3 vWaveNormal;

float caustic(vec2 p) {
  vec2 q = p * 1.35;
  float t = uTime * .22;
  float a = abs(sin(q.x * 2.1 + sin(q.y * 1.7 + t)));
  float b = abs(sin(q.y * 2.35 + cos(q.x * 1.45 - t * 1.2)));
  return pow(1.0 - abs(a - b), 8.0);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 normal = normalize(vWaveNormal);
  float facing = max(dot(normal, viewDir), 0.0);
  float fresnel = .02 + .98 * pow(1.0 - facing, 5.0);
  vec3 halfVector = normalize(normalize(uSunDirection) + viewDir);
  float sunSpecular = pow(max(dot(normal, halfVector), 0.0), 150.0) * 1.35;
  float broadSpecular = pow(max(dot(normal, halfVector), 0.0), 28.0) * .12;
  float microGlint = pow(max(sin(vWorldPosition.x * 31.0 + uTime * 1.7)
    * cos(vWorldPosition.z * 27.0 - uTime * 1.3), 0.0), 18.0);
  float c = caustic(vWorldPosition.xz + normal.xz * .7 + vHeight * 2.0);
  vec3 color = mix(uShallowColor, uDeepColor, fresnel * .72 + max(-vHeight, 0.0) * .8);
  color += c * .035;
  color += uSunColor * (sunSpecular + broadSpecular + microGlint * .07);
  float refractMix = uRefractionEnabled ? uRefraction : 0.0;
  color += vec3(.8, .96, 1.0) * fresnel * (.12 + refractMix * .18);
  float cornerLight = 0.0;
  for (int i = 0; i < 4; i++) {
    float distanceToLight = distance(vWorldPosition.xz, uCornerLightPositions[i].xz);
    cornerLight += 1.0 / (1.0 + distanceToLight * distanceToLight * .42);
  }
  float illuminatedRipple = .62 + .38 * pow(1.0 - clamp(normal.y, 0.0, 1.0), .55);
  color += vec3(.12, .42, .78) * cornerLight * illuminatedRipple * uNightMix * .52;
  float alpha = .2 + fresnel * .3 + refractMix * .055;
  gl_FragColor = vec4(color, alpha);
}
