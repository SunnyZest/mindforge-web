/** 后端返回的时间是 ISO 字符串（`2026-10-09T18:00:00`），展示时换成更常见的写法 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

/**
 * 大数字用「万」压缩。
 *
 * 为什么不用 `toLocaleString` 一路到底：Token 消耗动辄几十万上百万，
 * 原样显示（`1,204,318`）会把统计卡片撑变形，而且那个精度对人没意义。
 * 一万以下才给千分位 —— 那才是需要看清具体值的量级。
 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (value < 10_000) return value.toLocaleString('zh-CN')

  const wan = value / 10_000
  // 整数就不显示小数点：10.0万 → 10万
  return (Number.isInteger(wan) ? String(wan) : wan.toFixed(1)) + '万'
}

