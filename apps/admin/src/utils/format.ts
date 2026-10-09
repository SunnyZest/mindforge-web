/** 后端返回的时间是 ISO 字符串（`2026-10-09T18:00:00`），展示时换成更常见的写法 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}
