import { onUnmounted, ref } from 'vue'

/**
 * 慢接口的「运行中 + 秒表」。
 *
 * ★ 为什么值得抽出来：AI 接口动辄几十秒到几分钟，**不给计时器用户会以为卡死**，
 *   然后刷新页面 —— 而刷新会丢掉正在跑的那次请求。
 *   这个模式在项目里要用很多次（简历优化、出题、评分、出报告），
 *   写四遍的话漏一个就是一个「看起来没反应」的页面。
 *
 * 用法：
 * ```ts
 * const { running, elapsed, run } = useSlowTask()
 * async function onGenerate() {
 *   const res = await run(() => interviewApi.generate(id))
 *   if (res) detail.value = res      // run() 出错时返回 undefined
 * }
 * ```
 *
 * ⚠️ 出错时 `run()` 返回 `undefined` 并把异常原样抛出 —— 调用方要么用返回值
 *    判断成功，要么自己在外面 try/catch。
 */
export function useSlowTask() {
  const running = ref(false)
  /** 已经跑了多少秒 */
  const elapsed = ref(0)

  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (running.value) return undefined // 防重复点击（按钮虽然会 disabled，但别只靠 UI）

    running.value = true
    elapsed.value = 0
    timer = setInterval(() => (elapsed.value += 1), 1000)

    try {
      return await task()
    } finally {
      stop()
      running.value = false
    }
  }

  // ⚠️ 组件卸载必须停掉计时器，否则用户切走页面它还在后台跳秒
  onUnmounted(stop)

  return { running, elapsed, run }
}
