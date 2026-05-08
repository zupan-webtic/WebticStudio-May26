/** Same-origin path as used for in-site transitions and loader eligibility */
function normalizePathname(p) {
  let x = p || '/'
  if (/\/index\.html?$/i.test(x)) x = x.replace(/\/index\.html?$/i, '')
  x = x.replace(/\/+$/, '') || '/'
  return x
}

function isLandingHomePath() {
  return normalizePathname(window.location.pathname) === '/'
}

/** Intro line (“In a world…”) — loader + landing enter transition; once per browser tab session (sessionStorage) */
const SESSION_INTRO_LINE_KEY = 'webticIntroLoaderShown'

function hasSessionIntroLineBeenShown() {
  return sessionStorage.getItem(SESSION_INTRO_LINE_KEY) === '1'
}

function markSessionIntroLineShown() {
  sessionStorage.setItem(SESSION_INTRO_LINE_KEY, '1')
}

// ── LOADER: homepage only, once per browser session; skipped after in-site transition ──
;(function () {
  document.documentElement.classList.add('js')

  const pendingNav = sessionStorage.getItem('webticNav') === 'pending'
  const loader = document.getElementById('loader')
  const textEl = document.getElementById('loader-text')

  if (pendingNav) {
    if (loader) loader.remove()
    document.body.classList.remove('loading')
    return
  }

  const isLandingHome = isLandingHomePath()
  const introAlreadyShown = hasSessionIntroLineBeenShown()

  if (!isLandingHome || introAlreadyShown) {
    if (loader) loader.remove()
    document.body.classList.remove('loading')
    return
  }

  if (!loader || !textEl) return

  document.body.classList.add('loading')

  const phrase = 'In a world that copies, we create.'
  const stagger = 42
  const charDuration = 550
  const holdAfter = 700

  phrase.split('').forEach((char, i) => {
    const span = document.createElement('span')
    span.className = 'loader-char'
    span.textContent = char === ' ' ? '\u00a0' : char
    span.style.animationDelay = `${i * stagger}ms`
    textEl.appendChild(span)
  })

  // Mark as soon as the line is committed so refresh / fast navigation cannot replay it this session
  markSessionIntroLineShown()

  const totalMs = phrase.length * stagger + charDuration + holdAfter

  setTimeout(() => {
    loader.classList.add('loader-exit')
    document.body.classList.remove('loading')
    setTimeout(() => loader.remove(), 900)
  }, totalMs)
})()

// Live location clocks (HH:MM per time zone; refresh each minute)
function tickClocks() {
  const now = new Date()
  document.querySelectorAll('.hero-loc__time[data-tz]').forEach(el => {
    el.textContent = new Intl.DateTimeFormat('en-GB', {
      hour:     '2-digit',
      minute:   '2-digit',
      timeZone: el.dataset.tz,
      hour12:   false,
    }).format(now)
  })
}

function msUntilNextMinute() {
  const n = new Date()
  return 60_000 - (n.getSeconds() * 1000 + n.getMilliseconds())
}

tickClocks()
setTimeout(() => {
  tickClocks()
  setInterval(tickClocks, 60_000)
}, msUntilNextMinute())

// Transparent nav — solidifies after hero (scroll position supplied by Lenis RAF path)
const header = document.querySelector('header')
const hero   = document.querySelector('.hero') || document.querySelector('.ab-hero') || document.querySelector('.work-hero') || document.querySelector('.contact-hero')
function updateNav(scrollY = window.scrollY) {
  if (!header) return
  if (
    document.body.classList.contains('program-page') ||
    document.body.classList.contains('legal-page')
  ) {
    header.classList.remove('scrolled')
    return
  }
  const threshold = hero ? hero.offsetHeight * 0.85 : window.innerHeight * 0.85
  header.classList.toggle('scrolled', scrollY > threshold)
}

// Landing palette inversion once Programs is reached (called after Lenis is created)
function initProgramsThemeInvert(lenisInstance) {
  if (!isLandingHomePath()) return
  if (
    document.body.classList.contains('program-page') ||
    document.body.classList.contains('legal-page') ||
    document.body.classList.contains('contact-page') ||
    document.body.classList.contains('work-page')
  ) return

  const programs = document.querySelector('.s-programs')
  if (!programs) return

  /** Past anchor: --invert-progress is only ever 0 or 1 (fractional values made bg/text the same mid-gray). */
  let lastInvert = null
  /** Document scroll Y where inversion flips — refreshed when layout changes. */
  let cachedInvertTriggerY = 0
  let cachedHeaderH = NaN

  function refreshInvertTriggerCache() {
    const headerOffset = header ? header.offsetHeight : 0
    cachedHeaderH = headerOffset
    /* Larger lead-in ⇒ lower trigger line ⇒ inversion starts sooner before Programs hits view. */
    const leadIn = Math.min(640, Math.max(300, window.innerHeight * 0.4))
    // Document Y must come from layout + scroll, not offsetTop (wrong if offsetParent ≠ document
    // flow, e.g. transformed main during transitions — same coordinate space as Lenis / scrollY).
    const scrollYDoc = lenisInstance ? lenisInstance.actualScroll : window.scrollY
    const programsDocY = programs.getBoundingClientRect().top + scrollYDoc
    cachedInvertTriggerY = programsDocY - headerOffset - leadIn
  }

  const setState = () => {
    const ho = header ? header.offsetHeight : 0
    if (ho !== cachedHeaderH) {
      lastInvert = null
      refreshInvertTriggerCache()
    }
    const scrollY = lenisInstance ? lenisInstance.actualScroll : window.scrollY
    const triggerLineY = cachedInvertTriggerY
    const hysteresisPx = 22
    let pastTrigger
    if (lastInvert === null) {
      pastTrigger = scrollY >= triggerLineY
    } else if (lastInvert) {
      pastTrigger = scrollY >= triggerLineY - hysteresisPx
    } else {
      pastTrigger = scrollY >= triggerLineY + hysteresisPx
    }
    if (pastTrigger === lastInvert) return
    lastInvert = pastTrigger
    const on = pastTrigger ? '1' : '0'
    document.documentElement.style.setProperty('--invert-progress', on)
    document.body.classList.toggle('programs-invert', pastTrigger)
  }

  window.addEventListener('resize', () => {
    lastInvert = null
    refreshInvertTriggerCache()
    setState()
  })
  if (typeof ResizeObserver !== 'undefined') {
    let roT = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(roT)
      roT = window.setTimeout(() => {
        const prevT = Math.round(cachedInvertTriggerY)
        const prevH = cachedHeaderH
        refreshInvertTriggerCache()
        const nextT = Math.round(cachedInvertTriggerY)
        const nextH = cachedHeaderH
        // Do not reset state if geometry did not change (RO can fire from unrelated subtree churn).
        if (nextT === prevT && nextH === prevH) return
        lastInvert = null
        setState()
      }, 80)
    })
    // Only .s-programs — never observe `header`: transitions/borders can spam RO and thrash inversion.
    ro.observe(programs)
  }
  if (lenisInstance) subscribeLenisScroll(setState)
  refreshInvertTriggerCache()
  setState()
}

import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import { initSectionWaveDivider } from './wave-divider.js'
const lenis = new Lenis({
  lerp: 0.12,
  smoothWheel: true,
  syncTouch: false,
  wheelMultiplier: 1,
})

/** Lenis recommends a single RAF; keep a single scroll fan-out too (one layout pass, stable order). */
const lenisScrollSubscribers = []
function subscribeLenisScroll(fn) {
  lenisScrollSubscribers.push(fn)
}
lenis.on('scroll', (l) => {
  for (let i = 0; i < lenisScrollSubscribers.length; i++) lenisScrollSubscribers[i](l)
})

function lenisRaf(time) {
  lenis.raf(time)
  requestAnimationFrame(lenisRaf)
}
requestAnimationFrame(lenisRaf)

initProgramsThemeInvert(lenis)
initSectionWaveDivider()

function updateNavFromLenis(l) {
  updateNav(l.scroll)
}
subscribeLenisScroll(updateNavFromLenis)
updateNav(lenis.scroll)
// Fallback for browsers that intercept scroll (e.g. Telegram in-app browser)
window.addEventListener('scroll', () => updateNav(window.scrollY), { passive: true })

// Chameleon nav — sync header palette to the section it overlaps
function updateNavDark() {
  if (!header) return
  if (isLandingHomePath()) return // landing uses programs-invert
  if (
    document.body.classList.contains('program-page') ||
    document.body.classList.contains('legal-page')
  ) return // static header on these pages
  const hRect = header.getBoundingClientRect()
  const el = document.elementFromPoint(window.innerWidth / 2, hRect.bottom + 2)
  const isDark = !!(el && (el.closest('[data-nav-dark]') || el.closest('.site-footer')))
  header.classList.toggle('header--dark', isDark)
}
subscribeLenisScroll(updateNavDark)
window.addEventListener('resize', updateNavDark, { passive: true })
updateNavDark()

/** Whole hero (incl. WebGL) must not paint once it has left the viewport — avoids teal/black band over later sections.
 *  Use document-Y compare (offsetTop + offsetHeight) instead of getBoundingClientRect so iOS URL-bar dvh shifts
 *  don't desync the toggle. */
function updateHeroOffscreen() {
  if (!hero) return
  const heroBottomDoc = hero.offsetTop + hero.offsetHeight
  const scrollY = lenis ? lenis.actualScroll : window.scrollY
  hero.classList.toggle('hero--offscreen', scrollY > heroBottomDoc + 4)
}
subscribeLenisScroll(updateHeroOffscreen)
window.addEventListener('resize', updateHeroOffscreen, { passive: true })
updateHeroOffscreen()

// Hero shader background
import { initHeroShader } from './shader.js'
const shaderContainer = document.querySelector('.hero-shader')
if (shaderContainer) {
  try {
    initHeroShader(shaderContainer)
  } catch (e) {
    console.warn('Hero shader failed:', e)
  }
}


// Contact / work / about page heroes — same palette as landing
;[
  { id: 'contact-shader',  speed: 0.4,  scale: 1.1  },
  { id: 'work-shader',     speed: 0.35, scale: 1.2  },
  { id: 'about-shader',   speed: 0.45, scale: 0.95 },
].forEach(({ id, speed, scale }) => {
  const el = document.getElementById(id)
  if (!el) return
  try {
    initHeroShader(el, { speed, scale })
  } catch (e) {
    console.warn(`Shader failed (${id}):`, e)
  }
})


// Section entrance via IntersectionObserver
const revealSections = document.querySelectorAll(
  '.s-what, .s-process, .s-programs, .s-cases, .s-team, .s-contact'
)
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('section-in-view')
      revealObserver.unobserve(entry.target)
    }
  })
}, { threshold: 0.01 })

revealSections.forEach(s => revealObserver.observe(s))

// Programs (landing): scroll-synced row focus — no separate scroll-indicator UI
;(function initProgramsScrollReveal() {
  const section = document.querySelector('.s-programs[data-programs-scroll]')
  if (!section) return

  const rows = Array.from(section.querySelectorAll('.program-row[data-program-index]'))
  if (!rows.length) return

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mqDesktop = window.matchMedia('(min-width: 901px)')

  const n = rows.length
  let lastAria = 0
  let lastThumbStr = ''
  const lastRowFocus = rows.map(() => '')

  function computeContinuousT() {
    if (!mqDesktop.matches || mqReduce.matches) return 1
    const mid = window.innerHeight / 2
    const centers = rows.map(r => {
      const rect = r.getBoundingClientRect()
      return rect.top + rect.height / 2
    })
    if (mid <= centers[0]) return 1
    if (mid >= centers[n - 1]) return n
    let s = 1
    while (s < n && centers[s] <= mid) s++
    const c0 = centers[s - 1]
    const c1 = centers[s]
    const span = c1 - c0
    const u = span > 1e-3 ? (mid - c0) / span : 0
    return s + Math.max(0, Math.min(1, u))
  }

  function rowFocusWeight(t, k) {
    const d = Math.abs(t - k)
    return Math.max(0, Math.min(1, 1.22 - 1.22 * d))
  }

  function applyDesktopVisuals(t) {
    const thumbStr = t.toFixed(3)
    if (thumbStr !== lastThumbStr) {
      lastThumbStr = thumbStr
      section.style.setProperty('--program-thumb-t', thumbStr)
    }
    rows.forEach((el, idx) => {
      const k = idx + 1
      const w = rowFocusWeight(t, k)
      const ws = w.toFixed(2)
      if (ws !== lastRowFocus[idx]) {
        lastRowFocus[idx] = ws
        el.style.setProperty('--row-focus', ws)
      }
    })
    const nearest = Math.min(n, Math.max(1, Math.round(t)))
    if (nearest !== lastAria) {
      lastAria = nearest
      rows.forEach((el, idx) => {
        if (idx + 1 === nearest) el.setAttribute('aria-current', 'step')
        else el.removeAttribute('aria-current')
      })
    }
  }

  function updateFromScroll() {
    if (!mqDesktop.matches || mqReduce.matches) return
    const vr = section.getBoundingClientRect()
    const margin = 80
    if (vr.top > window.innerHeight + margin) {
      if (lastThumbStr !== '1.000') applyDesktopVisuals(1)
      return
    }
    if (vr.bottom < -margin) {
      if (lastThumbStr !== String(n) + '.000') applyDesktopVisuals(n)
      return
    }
    applyDesktopVisuals(Math.round(computeContinuousT()))
  }

  function mobileOrReduceLayout() {
    lastAria = 0
    lastThumbStr = ''
    lastRowFocus.fill('')
    section.style.removeProperty('--program-thumb-t')
    section.style.removeProperty('--program-count')
    rows.forEach((el, idx) => {
      el.style.removeProperty('--row-focus')
      el.removeAttribute('aria-current')
      if (idx === 0) el.setAttribute('aria-current', 'step')
    })
  }

  function syncMode() {
    if (mqReduce.matches || !mqDesktop.matches) {
      mobileOrReduceLayout()
    } else {
      section.style.setProperty('--program-count', String(n))
      lastAria = 0
      lastThumbStr = ''
      lastRowFocus.fill('')
      updateFromScroll()
    }
  }

  syncMode()
  subscribeLenisScroll(updateFromScroll)
  window.addEventListener('resize', () => {
    syncMode()
  }, { passive: true })
  mqDesktop.addEventListener('change', syncMode)
  mqReduce.addEventListener('change', syncMode)
})()

// Copyright year
const yearEl = document.getElementById('year')
if (yearEl) yearEl.textContent = String(new Date().getFullYear())

// Scroll-driven case study carousel with snap-to-nearest
;(function () {
  const section = document.querySelector('.s-cases')
  const track = document.querySelector('.s-cases__track')
  const progressFill = document.querySelector('.s-cases__progress-fill')
  if (!section || !track) return

  let isSnapping = false
  /** Mobile/tablet stacks the carousel vertically (CSS `@media max-width: 900px`), so the
   *  programmatic snap is meaningless there and can fight native scroll. Skip the whole
   *  snap path under that breakpoint. */
  const mqDesktopCases = window.matchMedia('(min-width: 901px)')
  /** Document Y of section top — refresh on resize only (avoids layout thrash each scroll tick). */
  let sectionDocTop = 0
  function refreshSectionDocTop() {
    sectionDocTop = section.getBoundingClientRect().top + lenis.actualScroll
  }

  function rawProgress(scrollY) {
    return (scrollY - sectionDocTop) / window.innerHeight
  }

  function updateCarousel(scrollY) {
    if (!mqDesktopCases.matches) return
    const p = Math.max(0, Math.min(1, rawProgress(scrollY)))
    track.style.transform = `translate3d(${-p * 100}vw,0,0)`
    if (progressFill) progressFill.style.transform = `scaleX(${p})`
  }

  function snapToNearest() {
    if (isSnapping) return
    if (!mqDesktopCases.matches) return
    const p = rawProgress(lenis.scroll)
    if (p <= 0.02 || p >= 0.98) return
    const targetY = sectionDocTop + (p < 0.5 ? 0 : 1) * window.innerHeight
    isSnapping = true
    lenis.scrollTo(targetY, { duration: 1.1 })
    setTimeout(() => {
      isSnapping = false
    }, 1200)
  }

  refreshSectionDocTop()
  window.addEventListener(
    'resize',
    () => {
      refreshSectionDocTop()
      updateCarousel(lenis.scroll)
    },
    { passive: true }
  )

  /** Snap only after the user has stopped moving — never while velocity is meaningful (was fighting scroll). */
  let snapArmTimer = 0
  subscribeLenisScroll(l => {
    const scrollY = l.scroll
    updateCarousel(scrollY)
    if (!mqDesktopCases.matches) return
    if (isSnapping) return
    const p = rawProgress(scrollY)
    if (p <= 0.02 || p >= 0.98) {
      if (snapArmTimer) {
        clearTimeout(snapArmTimer)
        snapArmTimer = 0
      }
      return
    }
    if (Math.abs(l.velocity) > 0.055) {
      if (snapArmTimer) {
        clearTimeout(snapArmTimer)
        snapArmTimer = 0
      }
      return
    }
    if (snapArmTimer) clearTimeout(snapArmTimer)
    snapArmTimer = window.setTimeout(() => {
      snapArmTimer = 0
      if (isSnapping) return
      if (Math.abs(lenis.velocity) > 0.04) return
      const p2 = rawProgress(lenis.scroll)
      if (p2 > 0.02 && p2 < 0.98) snapToNearest()
    }, 320)
  })
  updateCarousel(lenis.scroll)
})()

// Program hero: pick a random shape image per load (assets/images/Shapes/)
const PROGRAM_SHAPE_IMAGES = [
  '/assets/images/Shapes/Halfcircle-.png',
  '/assets/images/Shapes/Paralelogram-.png',
  '/assets/images/Shapes/circle-.png',
]

function initProgramHeroShape() {
  if (!document.body.classList.contains('program-page')) return
  const img = document.querySelector('.program-hero__visual')
  if (!img || img.tagName !== 'IMG') return
  const url = PROGRAM_SHAPE_IMAGES[Math.floor(Math.random() * PROGRAM_SHAPE_IMAGES.length)]
  img.src = url
}

initProgramHeroShape()

// In-site page transition (same line + motion language as loader)
const PAGE_TRANSITION_PHRASE = 'In a world that copies, we create.'
let pageTransitionLock = false

function shouldRunPageTransition(anchor) {
  if (!anchor || anchor.tagName !== 'A') return false
  if (anchor.target === '_blank' || anchor.download) return false
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return false
  if (href === '#' || href.startsWith('#')) return false
  let url
  try {
    url = new URL(anchor.href, window.location.href)
  } catch {
    return false
  }
  if (url.origin !== window.location.origin) return false
  const sameDoc =
    normalizePathname(url.pathname) === normalizePathname(window.location.pathname) &&
    url.search === window.location.search
  if (sameDoc) return false
  return true
}

function runPageEnterTransition() {
  // Always shed the inline-script flash class once main.js has the wheel.
  // Otherwise an edge case (sessionStorage cleared between inline script and
  // module load) could leave .page-transition with `pointer-events: all`
  // and z-index 10000, making the entire viewport untappable.
  document.documentElement.classList.remove('js-nav-enter')

  const pendingNav = sessionStorage.getItem('webticNav') === 'pending'
  const navEntry = performance.getEntriesByType('navigation')[0]
  const isHistoryNav = navEntry && navEntry.type === 'back_forward'
  if (!pendingNav && !isHistoryNav) return

  const el = document.getElementById('page-transition')
  const textEl = document.getElementById('page-transition-text')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const cleanupOverlay = () => {
    sessionStorage.removeItem('webticNav')
    if (el) {
      el.hidden = true
      el.style.display = 'none'
      el.classList.remove('is-covering', 'is-leaving')
      el.setAttribute('aria-hidden', 'true')
    }
    if (textEl) textEl.textContent = ''
    document.body.style.overflow = ''
    pageTransitionLock = false
  }

  const attachPanelLeaveListener = () => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(fallback)
      el.removeEventListener('transitionend', onEnd)
      cleanupOverlay()
    }
    const onEnd = (e) => {
      if (e.propertyName !== 'transform') return
      finish()
    }
    const fallback = setTimeout(finish, 2500)
    el.addEventListener('transitionend', onEnd)
  }

  if (!el || !textEl) {
    sessionStorage.removeItem('webticNav')
    document.body.style.overflow = ''
    return
  }

  el.removeAttribute('hidden')
  el.style.display = 'flex'
  el.classList.add('is-covering')
  el.classList.remove('is-leaving')
  el.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'

  if (reduce) {
    textEl.textContent = ''
    markSessionIntroLineShown()
    sessionStorage.removeItem('webticNav')
    el.setAttribute('aria-hidden', 'true')
    el.hidden = true
    el.style.display = 'none'
    el.classList.remove('is-covering', 'is-leaving')
    document.body.style.overflow = ''
    return
  }

  const stagger = 18
  const charDuration = 240
  const holdAfter = 275

  const startPanelExit = () => {
    el.classList.add('is-leaving')
    attachPanelLeaveListener()
  }

  if (hasSessionIntroLineBeenShown()) {
    textEl.textContent = ''
    requestAnimationFrame(() => {
      requestAnimationFrame(startPanelExit)
    })
    return
  }

  textEl.textContent = ''
  PAGE_TRANSITION_PHRASE.split('').forEach((char, i) => {
    const span = document.createElement('span')
    span.className = 'page-transition-char'
    span.textContent = char === ' ' ? '\u00a0' : char
    span.style.animationDelay = `${i * stagger}ms`
    textEl.appendChild(span)
  })

  markSessionIntroLineShown()

  const totalMs = PAGE_TRANSITION_PHRASE.length * stagger + charDuration + holdAfter
  setTimeout(startPanelExit, totalMs)
}

function navigateOutWithTransition(url) {
  const el = document.getElementById('page-transition')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!el || reduce) {
    window.location.assign(url)
    return
  }

  el.removeAttribute('hidden')
  el.style.display = 'flex'
  el.classList.remove('is-covering', 'is-leaving')
  el.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'

  void el.offsetWidth
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('is-covering')
    })
  })

  let done = false
  const finish = () => {
    if (done) return
    done = true
    clearTimeout(fallback)
    el.removeEventListener('transitionend', onEnd)
    sessionStorage.setItem('webticNav', 'pending')
    window.location.assign(url)
  }
  const onEnd = (e) => {
    if (e.propertyName !== 'transform') return
    finish()
  }
  const fallback = setTimeout(finish, 2500)
  el.addEventListener('transitionend', onEnd)
}

document.addEventListener(
  'click',
  (e) => {
    if (e.defaultPrevented) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    const a = e.target.closest('a')
    if (!a || !shouldRunPageTransition(a)) return
    // Critical: check the lock BEFORE preventing default. If the lock is somehow
    // stuck true (e.g. bfcache restore preserved module state), letting the link
    // navigate natively is far better than swallowing the click silently.
    if (pageTransitionLock) return
    e.preventDefault()
    pageTransitionLock = true
    navigateOutWithTransition(a.href)
  },
  true
)

runPageEnterTransition()

// Ensure browser back/forward restores still get the enter transition.
// pagehide persisted=true means the page is being put in bfcache.
window.addEventListener('pagehide', (e) => {
  if (e.persisted) sessionStorage.setItem('webticNav', 'pending')
})
// When restored from bfcache (back/forward), the module doesn't re-run but this
// listener fires — dismiss the overlay that was covering when the page left.
// The lock MUST be reset here: bfcache preserves the `true` value from the
// outgoing navigation, which would otherwise kill every subsequent link click.
window.addEventListener('pageshow', (e) => {
  pageTransitionLock = false
  if (e.persisted) runPageEnterTransition()
})

// Mobile nav
const toggle = document.querySelector('.nav-toggle')
const mobileNav = document.getElementById('nav-mobile')

function closeMobileNav () {
  mobileNav.hidden = true
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-label', 'Open menu')
  document.body.style.overflow = ''
}

if (toggle && mobileNav) {
  toggle.addEventListener('click', () => {
    const open = mobileNav.hidden
    mobileNav.hidden = !open
    toggle.setAttribute('aria-expanded', open)
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
    document.body.style.overflow = open ? 'hidden' : ''
  })

  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMobileNav)
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !mobileNav.hidden) {
      closeMobileNav()
      toggle.focus()
    }
  })
}

// Team carousel — transform-based, no native scroll container.
// Desktop: CSS keyframe marquee. Mobile: JS touch-driven transform with snap.
const teamGridEl = document.querySelector('.team-grid')
if (teamGridEl) {
  const cards = Array.from(teamGridEl.querySelectorAll(':scope > .team-member'))
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  cards.forEach(li => teamGridEl.appendChild(li))

  const viewport = document.createElement('div')
  viewport.className = 'team-carousel'
  const track = document.createElement('div')
  track.className = 'team-carousel__track'

  const parent = teamGridEl.parentNode
  parent.insertBefore(viewport, teamGridEl)
  track.appendChild(teamGridEl)

  const cloneList = teamGridEl.cloneNode(true)
  cloneList.setAttribute('aria-hidden', 'true')
  cloneList.classList.add('team-grid--clone')
  track.appendChild(cloneList)

  viewport.appendChild(track)

  const mqMobile = window.matchMedia('(max-width: 900px)')
  let translateX = 0
  let isDragging = false
  let dragStartX = 0
  let dragStartTranslate = 0
  let dragStartY = 0
  let lastMoveX = 0
  let lastMoveT = 0
  let velocity = 0
  let dragAxisLocked = null

  let momentumRaf = 0
  let autoRaf = 0
  let autoLast = 0
  let viewportInView = true
  /** Mobile auto-scroll speed (px / ms). Match desktop marquee pace roughly. */
  const AUTO_PX_PER_MS = 0.028
  const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)')

  /** Stop animating when the carousel is scrolled out of view — otherwise the
   *  RAF + transform writes run every frame across the whole site, causing
   *  scroll jank on lower-end phones. */
  const inViewObserver = new IntersectionObserver(
    ([entry]) => {
      viewportInView = !!(entry && entry.isIntersecting)
      if (!viewportInView) {
        stopAuto()
      } else if (mqMobile.matches && !isDragging && !momentumRaf) {
        startAuto()
      }
    },
    { rootMargin: '120px 0px', threshold: 0 }
  )

  /** Distance from the start of the original grid to the start of the clone.
   *  getBoundingClientRect diff cancels out the current translateX so we get
   *  the natural layout distance, and works correctly in Safari where
   *  will-change:transform does not establish an offsetParent. */
  const getWrapWidth = () => {
    const d = cloneList.getBoundingClientRect().left - teamGridEl.getBoundingClientRect().left
    return d > 0 ? d : teamGridEl.offsetWidth
  }

  /** Normalize x into the half-open range (-w, 0]. Negative wraps cleanly. */
  const wrapX = (x) => {
    const w = getWrapWidth()
    if (w <= 0) return 0
    let r = x % w
    if (r > 0) r -= w
    return r
  }

  const cancelMomentum = () => {
    if (momentumRaf) {
      cancelAnimationFrame(momentumRaf)
      momentumRaf = 0
    }
  }

  const stopAuto = () => {
    if (autoRaf) {
      cancelAnimationFrame(autoRaf)
      autoRaf = 0
    }
  }

  /** Continuous left drift that wraps modulo one grid width. Pauses while the
   *  user touches, momentum is active, or the carousel is scrolled out of view. */
  const startAuto = () => {
    if (!mqMobile.matches) return
    if (reduceMotionMq.matches) return
    if (!viewportInView) return
    if (autoRaf) return
    autoLast = performance.now()
    const tick = (now) => {
      if (!mqMobile.matches || isDragging || momentumRaf || !viewportInView) {
        autoRaf = 0
        return
      }
      const dt = Math.min(48, now - autoLast)
      autoLast = now
      translateX = wrapX(translateX - AUTO_PX_PER_MS * dt)
      track.style.transition = 'none'
      track.style.transform = `translateX(${translateX}px)`
      autoRaf = requestAnimationFrame(tick)
    }
    autoRaf = requestAnimationFrame(tick)
  }

  const setMode = () => {
    cancelMomentum()
    stopAuto()
    if (mqMobile.matches) {
      viewport.classList.add('team-carousel--mobile')
      translateX = 0
      track.style.transition = 'none'
      track.style.transform = 'translateX(0px)'
      startAuto()
    } else {
      viewport.classList.remove('team-carousel--mobile')
      track.style.transition = ''
      track.style.transform = ''
      translateX = 0
    }
  }

  const onTouchStart = (e) => {
    if (!mqMobile.matches) return
    if (e.touches.length !== 1) return
    cancelMomentum()
    stopAuto()
    isDragging = true
    dragAxisLocked = null
    dragStartX = e.touches[0].clientX
    dragStartY = e.touches[0].clientY
    dragStartTranslate = translateX
    lastMoveX = dragStartX
    lastMoveT = performance.now()
    velocity = 0
    track.style.transition = 'none'
  }

  const onTouchMove = (e) => {
    if (!isDragging) return
    const t = e.touches[0]
    const dx = t.clientX - dragStartX
    const dy = t.clientY - dragStartY
    if (dragAxisLocked === null) {
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax > 8 || ay > 8) dragAxisLocked = ax > ay ? 'x' : 'y'
    }
    if (dragAxisLocked !== 'x') return
    translateX = wrapX(dragStartTranslate + dx)
    track.style.transform = `translateX(${translateX}px)`

    const now = performance.now()
    const dt = now - lastMoveT
    if (dt > 0) velocity = (t.clientX - lastMoveX) / dt
    lastMoveX = t.clientX
    lastMoveT = now
  }

  const onTouchEnd = () => {
    if (!isDragging) return
    isDragging = false
    if (dragAxisLocked === 'y') {
      // Vertical scroll, not a carousel swipe — restart the auto-drift.
      startAuto()
      return
    }

    /** RAF momentum: keep gliding with exponential velocity decay, wrap modulo
     *  one grid width each frame so the user never hits an end. */
    let last = performance.now()
    const decayPerSec = 1.6 // higher = stops faster (per-second exponential)
    const minVel = 0.018    // px/ms — below this, animation halts
    track.style.transition = 'none'

    const step = (now) => {
      const dt = Math.max(1, now - last)
      last = now
      translateX = wrapX(translateX + velocity * dt)
      track.style.transform = `translateX(${translateX}px)`
      velocity *= Math.exp(-decayPerSec * (dt / 1000))
      if (Math.abs(velocity) > minVel) {
        momentumRaf = requestAnimationFrame(step)
      } else {
        momentumRaf = 0
        // Resume the gentle auto-drift now that the user's flick has settled.
        startAuto()
      }
    }
    cancelMomentum()
    momentumRaf = requestAnimationFrame(step)
  }

  viewport.addEventListener('touchstart', onTouchStart, { passive: true })
  viewport.addEventListener('touchmove', onTouchMove, { passive: true })
  viewport.addEventListener('touchend', onTouchEnd, { passive: true })
  viewport.addEventListener('touchcancel', onTouchEnd, { passive: true })

  inViewObserver.observe(viewport)
  setMode()
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', setMode)
  window.addEventListener('resize', setMode)
}

// Case study lightbox
const csImgs = Array.from(
  document.querySelectorAll('.cs-img-wide__inner img, .cs-img-inline img, .cs-img-grid figure img')
).filter(el => !el.closest('.cs-img-link'))

if (csImgs.length) {
  const lb = document.createElement('div')
  lb.className = 'cs-lightbox'
  lb.setAttribute('role', 'dialog')
  lb.setAttribute('aria-modal', 'true')
  lb.setAttribute('aria-label', 'Image preview')
  const lbClose = document.createElement('button')
  lbClose.className = 'cs-lightbox__close'
  lbClose.setAttribute('aria-label', 'Close preview')
  lbClose.textContent = '✕'

  const lbImg = document.createElement('img')
  lbImg.className = 'cs-lightbox__img'
  lbImg.alt = ''

  lb.appendChild(lbClose)
  lb.appendChild(lbImg)
  document.body.appendChild(lb)

  const openLb = (src, alt) => {
    lbImg.src = src
    lbImg.alt = alt || ''
    requestAnimationFrame(() => lb.classList.add('is-open'))
    document.body.style.overflow = 'hidden'
  }

  const closeLb = () => {
    lb.classList.remove('is-open')
    let cleared = false
    const clear = () => {
      if (cleared) return
      cleared = true
      document.body.style.overflow = ''
    }
    lb.addEventListener('transitionend', clear, { once: true })
    // Fallback in case transitionend never fires (mobile Safari can drop it).
    setTimeout(clear, 400)
  }

  csImgs.forEach(el => {
    el.style.cursor = 'zoom-in'
    el.addEventListener('click', () => openLb(el.currentSrc || el.src, el.alt))
  })

  lbClose.addEventListener('click', closeLb)
  lb.addEventListener('click', e => { if (e.target === lb) closeLb() })
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLb()
  })
}

// Contact form
const form = document.querySelector('.contact-form')
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = form.querySelector('button[type="submit"]')
    btn.textContent = 'Sending…'
    btn.disabled = true

    try {
      const data = Object.fromEntries(new FormData(form))
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      btn.textContent = res.ok ? "Sent — we'll be in touch." : 'Error — please try again.'
      if (res.ok) form.reset()
      else btn.disabled = false
    } catch {
      btn.textContent = 'Error — please try again.'
      btn.disabled = false
    }
  })
}

;(function () {
  const originalTitle = document.title
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'Still here.' : originalTitle
    // Safety net: when the tab becomes visible again, clear any leftover
    // body-overflow lock unless a modal is genuinely open. Mobile Safari
    // bfcache restore can leave overlay state inconsistent.
    if (!document.hidden) {
      const lbOpen = !!document.querySelector('.cs-lightbox.is-open')
      const navMobile = document.getElementById('nav-mobile')
      const navOpen = !!(navMobile && !navMobile.hidden)
      const pt = document.getElementById('page-transition')
      const ptCovering = !!(pt && pt.classList.contains('is-covering') && !pt.classList.contains('is-leaving'))
      if (!lbOpen && !navOpen && !ptCovering) {
        document.body.style.overflow = ''
      }
    }
  })
})()
