import { computed, onScopeDispose, ref, watch } from 'vue'

/**
 * ⚠️ <b>这个文件和 apps/admin/src/composables/useAutoRefresh.ts 是同一份</b> ——
 * 改这里的时候记得也改那边。
 *
 * <b>为什么不做成共享的</b>：它依赖 vue 的 ref / computed / watch / onScopeDispose，
 * 而 packages/shared 刻意不引 vue（那会引入 peerDependency 的安装问题，
 * 见 shared/src/theme.ts 的说明）。
 *
 * 顺带说一下这条边界：shared 放的是<b>领域与协议</b>（类型、HTTP、权限、格式化），
 * 而「轮询节奏、切后台要不要停」属于 <b>UI 层行为</b> —— 两个端将来完全可能
 * 调成不同的间隔（管理端看批量文档、用户端看单份简历）。放 UI 层是合理的。
 */

export interface UseAutoRefreshOptions {
  /** 轮询间隔（毫秒），默认 5 秒 */
  interval?: number
  /**
   * 最多刷多少轮就自动停，默认 120 轮（5 秒 × 120 = 10 分钟）。
   *
   * ⚠️ 这是**安全阀**，不是可有可无的：如果某条数据卡在处理中一直不变
   *    （后端 worker 挂了、任务丢了），只靠 `shouldContinue` 会永远刷下去，
   *    每 5 秒打一次后端。停掉之后界面上给个「继续」让用户自己决定。
   */
  maxRounds?: number
  /**
   * 还需不需要继续刷 —— 由调用方根据**当前数据**判断。
   *
   * ⚠️ 必须读响应式数据（比如 `() => rows.value.some(...)`），
   *    这样刷完一轮数据变了，`active` 会自动重算、该停就停。
   *    写成常量或缓存值的话会一直刷下去。
   */
  shouldContinue: () => boolean
  /** 每次轮询真正执行的刷新动作 */
  onRefresh: () => Promise<unknown> | unknown
}

/**
 * 自动刷新（轮询）。
 *
 * 用来盯着「后端还在处理中」的列表 —— 文档的解析/分块/向量都是异步的，
 * 光靠手动点「查询」根本不知道什么时候好。
 *
 * 处理了这些容易埋雷的地方：
 *   · **数据变了自动停** —— `active` 是 computed，刷完发现没有处理中的就自己停，
 *     不会一直空转打后端
 *   · **有轮数上限** —— 卡住不动时最多刷 10 分钟就停，不会永远打后端
 *   · **切到后台就不发请求** —— 没人看，白耗流量和配额；回到前台立刻补一次
 *   · **不会并发堆积** —— 上一次没回来就跳过这一轮（慢接口尤其重要，
 *     文档列表虽然快，但同一套逻辑将来给 AI 接口用得上）
 *   · **组件卸载自动清理** —— 用 `onScopeDispose`，不用调用方记着停
 *   · **用户可以关掉** —— 有些人就是想自己控制
 *
 * 用法：
 * ```ts
 * const { enabled, active, exhausted, resume } = useAutoRefresh({
 *   shouldContinue: () => rows.value.some(isProcessing),
 *   onRefresh: () => load({ silent: true }),
 * })
 * ```
 */
export function useAutoRefresh(options: UseAutoRefreshOptions) {
  const { interval = 5000, maxRounds = 120, shouldContinue, onRefresh } = options

  /** 用户开关。默认开 —— 这是「省事」的功能，默认关就没意义了 */
  const enabled = ref(true)
  /** 已经刷了多少轮 */
  const rounds = ref(0)
  /** 轮数用完被强制停掉了 —— 界面上要提示，并给个「继续」 */
  const exhausted = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  /** 上一次刷新还没回来 —— 用来跳过这一轮，避免并发堆积 */
  let busy = false
  let disposed = false

  /**
   * 界面上的「自动刷新中」指示，同时也是定时器的开关依据。
   *
   * ⚠️ 用 computed 而不是手动维护的 ref：手动维护迟早会忘记同步，
   *    出现「数据早就刷完了但还在刷」或者反过来「该刷却不刷」。
   */
  const active = computed(() => enabled.value && !exhausted.value && shouldContinue())

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(): void {
    clearTimer()
    if (disposed || !active.value) return
    timer = setTimeout(() => void tick(), interval)
  }

  async function tick(): Promise<void> {
    timer = null
    if (disposed || !active.value) return

    // 标签页在后台：不发请求。等切回前台时补一次（见下面的 visibilitychange）
    if (document.hidden) return

    // 上一轮还没回来 —— 跳过，等它回来后自然会把下一轮排上
    if (busy) return

    // 安全阀：轮数用完就停，别无限刷下去
    rounds.value += 1
    if (rounds.value >= maxRounds) {
      exhausted.value = true
      return
    }

    busy = true
    try {
      await onRefresh()
    } finally {
      busy = false
    }

    // 刷完再排下一轮。数据如果变了，上面的 watch 会先停掉定时器，
    // 这里 schedule() 内部也会再判一次 active —— 两重保险。
    schedule()
  }

  /** 用户手动点了「继续」：清掉轮数重新开始 */
  function resume(): void {
    rounds.value = 0
    exhausted.value = false
  }

  // 该刷 / 不该刷 一变就同步定时器。
  // immediate 让首次挂载时（如果初始数据就有处理中的）直接开始。
  watch(active, (on) => (on ? schedule() : clearTimer()), { immediate: true })

  function onVisibilityChange(): void {
    if (disposed) return
    if (document.hidden) {
      clearTimer() // 切后台：停掉，别白跑
      return
    }
    // 切回前台：如果还需要刷就立刻补一次，别让用户干等一个间隔
    clearTimer()
    void tick()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  onScopeDispose(() => {
    disposed = true
    clearTimer()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { enabled, active, exhausted, resume }
}
