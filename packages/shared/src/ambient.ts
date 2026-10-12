/**
 * 动态环境极光背景与鼠标跟随微交互
 *
 * 在页面底层挂载 GPU 极光光斑，并监听指针位置以提供丝滑的光影互动。
 */

let initialized = false

export function setupAmbientBackground(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  // 1. 注入背景层 DOM
  const bg = document.createElement('div')
  bg.className = 'mf-ambient-bg'
  bg.setAttribute('aria-hidden', 'true')
  bg.innerHTML = `
    <div class="mf-ambient-blob mf-ambient-blob--1"></div>
    <div class="mf-ambient-blob mf-ambient-blob--2"></div>
    <div class="mf-ambient-blob mf-ambient-blob--3"></div>
    <div class="mf-ambient-blob mf-ambient-blob--4"></div>
    <div class="mf-ambient-cursor-glow"></div>
  `
  document.body.prepend(bg)

  // 2. 指针移动微交互监听（rAF 节流，保证 60fps / 120fps 超丝滑）
  let rafId: number | null = null
  let lastX = -999
  let lastY = -999

  function onPointerMove(e: PointerEvent): void {
    lastX = e.clientX
    lastY = e.clientY

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--cursor-x', `${lastX}px`)
        document.documentElement.style.setProperty('--cursor-y', `${lastY}px`)
        rafId = null
      })
    }
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })

  // 3. 为交互式卡片绑定局部鼠标位置（Spotlight 流光跟随）
  document.addEventListener(
    'mousemove',
    (e) => {
      const target = (e.target as HTMLElement)?.closest?.('.mf-glass-card-interactive') as
        | HTMLElement
        | null
      if (target) {
        const rect = target.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        target.style.setProperty('--mouse-x', `${x}px`)
        target.style.setProperty('--mouse-y', `${y}px`)
      }
    },
    { passive: true },
  )
}
