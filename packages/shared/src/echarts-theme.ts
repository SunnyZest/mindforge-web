/**
 * ECharts 主题与辅助配置 —— 专为 Liquid Glass & Apple 设计系统打造
 */

export const APPLE_PALETTE = [
  '#007aff', // Apple System Blue
  '#34c759', // Apple System Green
  '#af52de', // Apple System Purple
  '#ff9500', // Apple System Orange
  '#30b0c7', // Apple System Cyan
  '#ff2d55', // Apple System Pink
  '#5856d6', // Apple System Indigo
  '#ffd60a', // Apple System Yellow
]

export function getGlassTooltipOption(isDark: boolean): Record<string, unknown> {
  return {
    trigger: 'axis',
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.85)' : 'rgba(255, 255, 255, 0.88)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    padding: [10, 14],
    textStyle: {
      color: isDark ? '#f5f5f7' : '#1d1d1f',
      fontSize: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    extraCssText: `
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, ${isDark ? '0.45' : '0.12'});
      border-radius: 12px;
    `,
  }
}

export function getPieTooltipOption(isDark: boolean): Record<string, unknown> {
  const base = getGlassTooltipOption(isDark)
  return {
    ...base,
    trigger: 'item',
  }
}

export function getCommonGrid(): Record<string, unknown> {
  return {
    left: '3%',
    right: '4%',
    top: '16%',
    bottom: '4%',
    containLabel: true,
  }
}
