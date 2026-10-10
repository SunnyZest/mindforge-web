/**
 * 展示用的格式化函数 —— 纯函数，两端共用。
 *
 * ★ 为什么放共享层：这些逻辑两端都要用（管理端的列表、用户端的个人资料），
 *   各写一份的话，日期格式一旦不一致，同一个时间在两个端显示成两个样子 ——
 *   这种「看起来都不算错」的差异最难发现。
 */

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

/**
 * 文件大小：后端给的是字节数（`AdminDocumentVO.fileSize`），
 * 原样显示 `1048576` 对人没意义。进位用 1024（操作系统习惯），不是 1000。
 */
export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(2)} GB`
}
