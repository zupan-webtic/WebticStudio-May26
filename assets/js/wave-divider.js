/**
 * Interactive SVG wave (ported from WavePath React demo — vanilla DOM).
 * Expects markup from index.html: [data-wave-divider], path.section-wave-divider__path
 */
export function initSectionWaveDivider() {
  const root = document.querySelector('[data-wave-divider]')
  const path = root?.querySelector('.section-wave-divider__path')
  if (!root || !path || !(path instanceof SVGPathElement)) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    path.setAttribute('d', 'M0 100 Q500 100 1000 100')
    return
  }

  let progress = 0
  let x = 0.5
  let time = Math.PI / 2
  let reqId = 0

  const W = 1000
  const baseY = 100

  function setPath(p) {
    const qx = W * x
    const qy = baseY + p * 0.55
    path.setAttribute('d', `M0 ${baseY} Q${qx} ${qy} ${W} ${baseY}`)
  }

  function lerp(a, b, t) {
    return a * (1 - t) + b * t
  }

  function resetAnimation() {
    time = Math.PI / 2
    progress = 0
    setPath(0)
  }

  function animateOut() {
    time += 0.18
    const wobble = progress * Math.sin(time)
    progress = lerp(progress, 0, 0.065)
    setPath(wobble)
    if (Math.abs(progress) > 0.08 || Math.abs(wobble) > 0.12) {
      reqId = requestAnimationFrame(animateOut)
    } else {
      reqId = 0
      resetAnimation()
    }
  }

  function onEnter() {
    if (reqId) {
      cancelAnimationFrame(reqId)
      reqId = 0
    }
    resetAnimation()
  }

  function onMove(e) {
    if (!(e instanceof PointerEvent)) return
    const rect = path.getBoundingClientRect()
    if (rect.width <= 0) return
    x = (e.clientX - rect.left) / rect.width
    x = Math.max(0.02, Math.min(0.98, x))
    progress += e.movementY
    progress = Math.max(-120, Math.min(120, progress))
    setPath(progress)
  }

  function onLeave() {
    animateOut()
  }

  setPath(0)

  root.addEventListener('pointerenter', onEnter)
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerleave', onLeave)

  window.addEventListener(
    'resize',
    () => {
      setPath(progress)
    },
    { passive: true }
  )
}
