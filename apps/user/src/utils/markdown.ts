/**
 * 极简 Markdown 渲染 —— 只覆盖模型实际会输出的那几种语法。
 *
 * ★ 为什么需要它：AI 的回答是 **Markdown**（实测输出里有 `**加粗**`、`- 列表`、
 *   `1. 有序`）。按纯文本渲染的话，用户会直接看到这些符号，像坏了一样。
 *
 * ⚠️⚠️ **安全：必须先转义 HTML，再做替换，顺序不能反。**
 *    模型输出属于外部内容，直接丢进 `v-html` 会有 XSS。
 *    先转义 `< > &`，后面所有替换插入的都是我们自己的标签 —— 这样就安全了。
 *
 * ⚠️ 这是**子集**，不是完整实现：只支持 标题 / 无序列表 / 有序列表 /
 *    **加粗** / `行内代码` / 段落。要表格、链接、图片、代码块的话，
 *    请引入 marked + DOMPurify，**别在这里一点点加** ——
 *    手写 Markdown 解析很容易写出漏洞，而且越加越像在重造轮子。
 */

/** 行内语法 —— 只在已转义的文本上做替换 */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="md__code">$1</code>')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderMarkdown(text: string): string {
  const safe = escapeHtml(text)

  // 空行分段 —— 段内换行保留成 <br>
  return safe
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''

      // 标题（模型偶尔会用 # 分节）
      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
      if (heading) return `<p class="md__h">${inline(heading[2])}</p>`

      const lines = trimmed.split('\n')

      // 无序列表
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')
        return `<ul class="md__ul">${items}</ul>`
      }

      // 有序列表
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')
        return `<ol class="md__ol">${items}</ol>`
      }

      // 普通段落：段内换行保留
      return `<p class="md__p">${inline(trimmed).replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}
