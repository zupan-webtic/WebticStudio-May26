import * as THREE from 'three'

const vertexShader = `
  attribute vec3 position;
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;
  uniform float xScale;
  uniform float yScale;
  uniform float distortion;

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

    float d = length(p) * distortion;

    float rx = p.x * (1.0 + d);
    float gx = p.x;
    float bx = p.x * (1.0 - d);

    float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
    float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
    float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);

    // Tint to hero palette: #4bd9b3 = (0.294, 0.851, 0.702)
    gl_FragColor = vec4(r * 0.294, g * 0.851, b * 0.702, 1.0);
  }
`

export function initBeamShader(container) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:100%;height:100%;'
  container.appendChild(canvas)

  let scene, camera, renderer, mesh, uniforms, animationId
  let destroyed = false

  function init() {
    scene = new THREE.Scene()
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

    uniforms = {
      resolution:  { value: new THREE.Vector2(1, 1) },
      time:        { value: 0.0 },
      xScale:      { value: 1.0 },
      yScale:      { value: 0.5 },
      distortion:  { value: 0.05 },
    }

    const positions = new Float32Array([
      -1, -1, 0,
       1, -1, 0,
      -1,  1, 0,
       1, -1, 0,
      -1,  1, 0,
       1,  1, 0,
    ])
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    })

    mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    resize()
  }

  function resize() {
    if (!renderer || !uniforms) return
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    uniforms.resolution.value.set(w, h)
  }

  let visible = true
  const visObserver = new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting },
    { rootMargin: '0px', threshold: 0 }
  )
  visObserver.observe(container)

  function animate() {
    if (destroyed) return
    animationId = requestAnimationFrame(animate)
    if (!visible) return
    uniforms.time.value += 0.01
    renderer.render(scene, camera)
  }

  init()
  animate()
  window.addEventListener('resize', resize, { passive: true })

  return function destroy() {
    destroyed = true
    if (animationId) cancelAnimationFrame(animationId)
    visObserver.disconnect()
    window.removeEventListener('resize', resize)
    if (mesh) {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    renderer?.dispose()
  }
}
