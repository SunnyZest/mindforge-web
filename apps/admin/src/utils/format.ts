/**
 * 格式化函数 —— 实现都在 `@mindforge/shared` 的 format.ts 里，两端共用一份。
 *
 * ⚠️ 这里只做转发，别再往这个文件里加实现 ——
 *    两端各写一份的话，同一个时间可能显示成两个样子，而且极难发现。
 *    真需要新的格式化函数，加到 packages/shared/src/format.ts 去。
 */
export { formatBytes, formatCount, formatDateTime } from '@mindforge/shared'
