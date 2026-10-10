import type { PermissionVO } from '@mindforge/shared'

/**
 * 权限码 → 中文模块名。
 *
 * ⚠️ 后端 `PermissionVO` 里 `path` / `method` 全是 null、`type` 恒为 "API"，
 *    所以分组只能靠**权限码的中间段**（`admin:user:list` → `admin` + `user`）。
 *    这张表是「中间段 → 中文名」的映射，缺了会回落成原始英文。
 *
 * 新增权限码时记得来这里补一条 —— 漏了不会报错，只是界面上显示英文。
 */
export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  'admin:ai': 'AI 配置',
  'admin:audit': '审计日志',
  'admin:dashboard': '后台首页',
  'admin:document': '文档管理',
  'admin:knowledge': '知识库',
  'admin:permission': '权限字典',
  'admin:prompt': 'Prompt 管理',
  'admin:role': '角色',
  'admin:usage': 'AI 用量',
  'admin:user': '用户',
  'app:conversation': '对话',
  'app:document': '文档',
  'app:interview': '面试',
  'app:job': '职位',
  'app:knowledge': '知识库',
  'app:rag': 'RAG 检索',
  'app:resume': '简历',
}

export type PermissionSide = 'admin' | 'app'

export interface PermissionGroup {
  /** 形如 `admin:user`，可作 v-for 的 key */
  key: string
  side: PermissionSide
  /** 「管理端」/「用户端」 */
  sideLabel: string
  /** 「用户」/「简历」这类模块名 */
  label: string
  items: PermissionVO[]
}

const SIDE_LABELS: Record<PermissionSide, string> = {
  admin: '管理端',
  app: '用户端',
}

/**
 * 把扁平权限列表按「端 → 模块」两层分组。
 *
 * 排序：管理端在前、用户端在后；同端内按权限码字典序 ——
 * 固定顺序很重要，否则每次进来顺序都不一样，找东西会很难受。
 */
export function groupPermissions(perms: PermissionVO[]): PermissionGroup[] {
  const map = new Map<string, PermissionGroup>()

  for (const p of perms) {
    const [rawSide, mod] = p.code.split(':')
    const side: PermissionSide = rawSide === 'admin' ? 'admin' : 'app'
    const key = `${side}:${mod}`

    let g = map.get(key)
    if (!g) {
      g = {
        key,
        side,
        sideLabel: SIDE_LABELS[side],
        label: PERMISSION_MODULE_LABELS[key] ?? mod,
        items: [],
      }
      map.set(key, g)
    }
    g.items.push(p)
  }

  return [...map.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.code.localeCompare(b.code)) }))
    .sort((a, b) => (a.side === b.side ? a.key.localeCompare(b.key) : a.side === 'admin' ? -1 : 1))
}

/** 取出某一端的全部模块（抽屉里要分两块展示） */
export function groupsOfSide(groups: PermissionGroup[], side: PermissionSide): PermissionGroup[] {
  return groups.filter((g) => g.side === side)
}
