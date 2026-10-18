import { computed, onUnmounted, ref } from 'vue'

/**
 * 验证码发送倒计时。
 *
 * ★ 这个倒计时**不是装饰**：后端有 60 秒冷却（`42904`），
 * 不挡住按钮的话用户连点几次全是失败，看起来像「点了没反应」。
 * 倒计时只是把后端的规则提前告诉用户。
 *
 * @param seconds 冷却秒数，要和后端 `mindforge.verification.cooldown-seconds` 一致
 */
export function useCodeCountdown(seconds = 60) {
  const remaining = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  const counting = computed(() => remaining.value > 0)

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function start(): void {
    remaining.value = seconds
    stopTimer()
    timer = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) {
        remaining.value = 0
        stopTimer()
      }
    }, 1000)
  }

  // 页面切走就停 —— 不然定时器会一直跑，控制台还会报组件已卸载
  onUnmounted(stopTimer)

  return { remaining, counting, start }
}
