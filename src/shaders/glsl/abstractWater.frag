uniform float time;
uniform vec3 color;
uniform float distortionScale;

varying vec2 vUv;

void main() {
    vec2 uv = vUv * 5.0; // Scale UV for more waves
    vec2 wavyUV = uv;

    // Create simple waves based on sine and cosine functions
    wavyUV.x += sin(uv.y * 2.0 + time * 0.5) * 0.1 * distortionScale;
    wavyUV.y += cos(uv.x * 2.0 + time * 0.5) * 0.1 * distortionScale;

    // Add another layer of waves
    wavyUV.x += sin(uv.y * 3.0 + time * 0.8) * 0.05 * distortionScale;
    wavyUV.y += cos(uv.x * 3.0 + time * 0.8) * 0.05 * distortionScale;

    // Use a mix of the original color and a slightly lighter/darker version based on wave height
    float waveEffect = (sin(wavyUV.x * 10.0) + cos(wavyUV.y * 10.0)) * 0.1;
    vec3 finalColor = color + waveEffect * 0.2; // Add subtle color variation

    gl_FragColor = vec4(finalColor, 1.0);
}
