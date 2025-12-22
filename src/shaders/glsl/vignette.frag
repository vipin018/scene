uniform sampler2D tDiffuse;
uniform float offset;
uniform float darkness;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(tDiffuse, vUv);
  vec2 uv = (vUv - 0.5) * 2.0;
  float v = smoothstep(offset, offset + darkness, length(uv));
  gl_FragColor = vec4(texel.rgb * (1.0 - v), texel.a);
}