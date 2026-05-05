import { Renderer, Plane, Program, Mesh } from 'ogl'

const vertexShader = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShader = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform float u_speed;
  uniform float u_scale;
  uniform int u_type;
  uniform float u_noise;
  uniform vec2 u_resolution;

  varying vec2 vUv;

  #define PI 3.14159265359

  float noise(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 silkGradient(vec2 uv, float time) {
    vec2 fragCoord = uv * u_resolution;
    vec2 invResolution = 1.0 / u_resolution.xy;
    vec2 centeredUv = (fragCoord * 2.0 - u_resolution.xy) * invResolution;

    centeredUv *= u_scale;

    float dampening = 1.0 / (1.0 + u_scale * 0.1);

    float d = -time * u_speed * 0.5;
    float a = 0.0;

    for (float i = 0.0; i < 8.0; ++i) {
      a += cos(i - d - a * centeredUv.x) * dampening;
      d += sin(centeredUv.y * i + a) * dampening;
    }

    d += time * u_speed * 0.5;

    vec3 patterns = vec3(
      cos(centeredUv.x * d + a) * 0.5 + 0.5,
      cos(centeredUv.y * a + d) * 0.5 + 0.5,
      cos((centeredUv.x + centeredUv.y) * (d + a) * 0.5) * 0.5 + 0.5
    );

    vec3 color1Mix = mix(u_color1, u_color2, patterns.x);
    vec3 color2Mix = mix(u_color2, u_color3, patterns.y);
    vec3 color3Mix = mix(u_color3, u_color1, patterns.z);

    vec3 finalColor = mix(color1Mix, color2Mix, patterns.z);
    finalColor = mix(finalColor, color3Mix, patterns.x * 0.5);

    vec3 originalPattern = vec3(
      cos(centeredUv * vec2(d, a)) * 0.6 + 0.4,
      cos(a + d) * 0.5 + 0.5
    );
    originalPattern = cos(originalPattern * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);

    return mix(finalColor, originalPattern * finalColor, 0.3);
  }

  void main() {
    vec2 uv = vUv;
    float time = u_time * u_speed;
    vec3 color = silkGradient(uv, time);
    gl_FragColor = vec4(color, 1.0);
  }
`

const CONFIG = {
  color1: [0,     0,     0    ],  // black
  color2: [0.294, 0.851, 0.702],  // #4bd9b3
  color3: [1.0,   1.0,   1.0  ],  // white
  speed:  0.5,
  scale:  0.9,
}

export function initHeroShader(container, overrides = {}) {
  const cfg = { ...CONFIG, ...overrides }
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  const renderer = new Renderer({
    canvas,
    dpr: Math.min(window.devicePixelRatio, 2),
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
  })
  const gl = renderer.gl

  const geometry = new Plane(gl, { width: 2, height: 2 })

  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      u_time:       { value: 0 },
      u_color1:     { value: cfg.color1 },
      u_color2:     { value: cfg.color2 },
      u_color3:     { value: cfg.color3 },
      u_speed:      { value: cfg.speed },
      u_scale:      { value: cfg.scale },
      u_type:       { value: 4 },
      u_noise:      { value: 0 },
      u_resolution: { value: [0, 0] },
    },
  })

  const mesh = new Mesh(gl, { geometry, program })

  function resize() {
    const { clientWidth: w, clientHeight: h } = container
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width  = w * dpr
    canvas.height = h * dpr
    canvas.style.width  = w + 'px'
    canvas.style.height = h + 'px'
    renderer.setSize(w, h)
    program.uniforms.u_resolution.value = [w, h]
  }
  resize()
  window.addEventListener('resize', resize, { passive: true })

  const heroEl = container.closest('.hero')

  let rafId
  let visible = true
  const visObserver = new IntersectionObserver(
    ([e]) => {
      visible = !!(e?.isIntersecting)
      container.classList.toggle('is-offscreen', !visible)
    },
    { root: null, rootMargin: '0px', threshold: 0 }
  )
  visObserver.observe(container)

  function animate() {
    rafId = requestAnimationFrame(animate)
    const heroHidden = heroEl?.classList.contains('hero--offscreen')
    if (visible && !heroHidden) {
      program.uniforms.u_time.value += 0.016
      renderer.render({ scene: mesh })
    }
  }
  animate()

  return function destroy() {
    cancelAnimationFrame(rafId)
    visObserver.disconnect()
    window.removeEventListener('resize', resize)
    container.removeChild(canvas)
  }
}
