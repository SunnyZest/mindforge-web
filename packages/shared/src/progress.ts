/**
 * 极简极光路由进度条 —— 零依赖、纯原生 DOM。
 * 在路由切换时提供 0 延迟即时视觉反馈，消除「以为没点上」的顿挫感。
 */

let barEl: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let trickleTimer: ReturnType<typeof setInterval> | null = null
let currentProgress = 0

function createBar(): HTMLDivElement {
  const el = document.createElement('div')
  el.id = 'mf-router-progress'
  el.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 2.5px;
    width: 0%;
    z-index: 99999;
    pointer-events: none;
    background: linear-gradient(90deg, #007aff, #5ac8fa, #5856d6);
    box-shadow: 0 0 10px rgba(0, 122, 255, 0.7), 0 0 4px rgba(90, 200, 250, 0.5);
    transition: width 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease;
    opacity: 0;
  `
  document.body.appendChild(el)
  return el
}

export function startProgress(): void {
  if (trickleTimer) clearInterval(trickleTimer)
  if (timer) clearTimeout(timer)

  if (!barEl) {
    barEl = createBar()
  }

  currentProgress = 15
  barEl.style.opacity = '1'
  barEl.style.width = '15%'

  // 滴漏推进：未加载完时平滑推到 85%
  trickleTimer = setInterval(() => {
    if (currentProgress < 85) {
      currentProgress += Math.random() * 12 + 4
      if (barEl) {
        barEl.style.width = `${Math.min(currentProgress, 88)}%`
      }
    }
  }, 180)
}

export function doneProgress(): void {
  if (trickleTimer) {
    clearInterval(trickleTimer)
    trickleTimer = null
  }

  if (!barEl) return

  currentProgress = 100
  barEl.style.width = '100%'

  timer = setTimeout(() => {
    if (barEl) {
      barEl.style.opacity = '0'
      setTimeout(() => {
        if (barEl) {
          barEl.style.width = '0%'
        }
      }, 200)
    }
  }, 200)
}
