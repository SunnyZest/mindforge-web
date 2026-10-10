/**
 * 后端接口的类型定义 —— 照着 Java 侧的 VO 抄过来的。
 *
 * ⚠️ 后端【没有】配置 Jackson 的 NON_NULL，所以 null 字段会照样出现在 JSON 里
 * （实测响应里有 `"createdAt":null`）。所以这里用 `string | null` 而不是可选属性 `?` ——
 * 两者含义不同：`?` 是「字段可能不存在」，`| null` 是「字段在，但值是 null」。
 * 写错了前端会出现 `undefined` 和 `null` 两套判断，很烦。
 */

/** 所有接口的统一信封（Java 的 `Result<T>`） */
export interface Result<T> {
  /** 0 = 成功；非 0 见 Java 的 ErrorCode */
  code: number
  message: string
  data: T
  /** 后端日志的追踪 id —— 出问题时把它报给运维能直接定位到那条日志 */
  traceId?: string
}

/** 分页结果（Java 的 `PageResultVO<T>`） */
export interface PageResult<T> {
  page: number
  pageSize: number
  total: number
  records: T[]
}

/** 分页查询的公共参数 */
export interface PageQuery {
  page?: number
  pageSize?: number
  /** 关键词，各模块的匹配字段不同（用户是用户名/昵称，简历是名称/目标职位…） */
  keyword?: string
}

/** 当前登录用户（Java 的 `UserInfoVO`） */
export interface UserInfoVO {
  id: string
  username: string
  nickname: string | null
  /** 角色 code，如 SUPER_ADMIN / ADMIN / USER */
  roles: string[]
  /** 权限码，如 admin:user:list —— 前端拿它决定菜单和按钮显不显示 */
  permissions: string[]
}

/** 登录返回（Java 的 `LoginVO`） */
export interface LoginVO {
  accessToken: string
  refreshToken: string
  /** accessToken 有效期（秒）。后端现在是 30 分钟 —— 刻意设短，靠刷新续期 */
  expiresIn: number
  user: UserInfoVO
}

/** 刷新 token 返回（Java 的 `TokenVO`） */
export interface TokenVO {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginDTO {
  username: string
  password: string
}

/**
 * 用户端注册（Java 的 `RegisterDTO`）。
 *
 * ⚠️ 长度约束是照后端注解抄的（`@Size`），改后端时要一起改 ——
 *    前端只是提前拦一下，后端那层才是真校验。
 */
export interface RegisterDTO {
  /** 3~32 位 */
  username: string
  /** 可空 —— 后端 required 里没有 email */
  email?: string
  /** 6~64 位 */
  password: string
}

/** 修改密码（Java 的 `ChangePasswordDTO`）—— 用户端和管理端共用这个形状 */
export interface ChangePasswordDTO {
  oldPassword: string
  /** 6~64 位 */
  newPassword: string
}

/** 个人资料（Java 的 `UserProfileVO`） */
export interface UserProfileVO {
  id: string
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  /** 1 正常 / 0 禁用 */
  status: number
  createdAt: string | null
}

/** 修改个人资料（Java 的 `UserProfileUpdateDTO`）—— 两个字段都可空，传了才改 */
export interface UserProfileUpdateDTO {
  /** 最长 64 */
  nickname?: string
  /** 最长 500 */
  avatarUrl?: string
}

/** 用户列表行（Java 的 `UserSummaryVO`） */
export interface UserSummaryVO {
  id: string
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  /** 1 启用 / 0 禁用 */
  status: number
  roles: string[]
  lastLoginAt: string | null
  createdAt: string | null
}

/** 用户列表的查询参数（比通用分页多两个筛选） */
export interface UserListQuery extends PageQuery {
  /** 1 启用 / 0 禁用；不传 = 全部 */
  status?: number
  /** 角色 code；不传 = 全部 */
  role?: string
}

/* ============================================================
   管理端 · 用户管理（写操作）
   ============================================================ */

export interface AdminUserCreateDTO {
  username: string
  email?: string
  password: string
  /** 昵称；不传则后端默认与用户名相同 */
  nickname?: string
  /**
   * 角色 id 列表；不传或为空则只绑定默认角色 USER。
   *
   * ⚠️ 这里是 `number[]`，但 `RoleVO.id` 是 **string**（后端为了防 JS 精度丢失
   * 把 id 序列化成了字符串）。所以从角色列表取 id 再回传时必须转一下：
   * `roleIds: roles.map((r) => Number(r.id))`。两边类型不一致是后端的历史遗留。
   */
  roleIds?: number[]
}

export interface UserUpdateDTO {
  nickname?: string
  email?: string
  phone?: string
  avatarUrl?: string
}

export interface UserStatusDTO {
  /** 1 启用 / 0 禁用 */
  status: number
}

export interface AssignRolesDTO {
  /** 传空数组 = 清空该用户所有角色（⚠️ 类型是 number[]，见 AdminUserCreateDTO 的说明） */
  roleIds: number[]
}

/* ============================================================
   管理端 · 角色与权限
   ============================================================ */

/** 角色（Java 的 `RoleVO`） */
export interface RoleVO {
  id: string
  name: string
  /** 角色 code，如 ADMIN */
  code: string
  description: string | null
  /** 1 启用 / 0 禁用 */
  status: number
  /** 已绑定的权限数量 */
  permissionCount: number
  /** 内置角色 —— 后端不允许删除 */
  builtin: boolean
  createdAt: string | null
}

/** 权限项（Java 的 `PermissionVO`） */
export interface PermissionVO {
  id: string
  name: string
  /** 权限码，如 admin:user:list */
  code: string
  type: string | null
  /** 接口路径 */
  path: string | null
  /** HTTP 方法 */
  method: string | null
  description: string | null
}

export interface RoleCreateDTO {
  name: string
  /** 仅大写字母 / 数字 / 下划线，且以大写字母开头 */
  code: string
  description?: string
}

export interface RoleUpdateDTO {
  name?: string
  description?: string
  status?: number
}

export interface AssignPermissionsDTO {
  /** 传空数组 = 清空该角色所有权限 */
  permissionIds: number[]
}

/* ============================================================
   管理端 · 知识库 / 文档 / 分块
   ============================================================ */

/** 管理端知识库列表项（Java 的 `AdminKnowledgeBaseVO`）—— 比用户端多带归属人 */
export interface AdminKnowledgeBaseVO {
  id: string
  userId: string
  username: string | null
  name: string
  description: string | null
  /** 1 正常 / 0 禁用 */
  status: number
  /** 文档数（实时统计，不是表里的冗余字段） */
  documentCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface AdminKnowledgeBaseQuery extends PageQuery {
  status?: number
  userId?: number
}

/** 文档处理流水线的三段状态 —— 后端各自独立推进，失败互不影响 */
export type ParseStatus = 'PENDING' | 'PARSING' | 'SUCCESS' | 'FAILED'
export type ChunkStatus = 'PENDING' | 'CHUNKING' | 'SUCCESS' | 'FAILED'
export type VectorStatus = 'PENDING' | 'EMBEDDING' | 'SUCCESS' | 'FAILED'

/** 管理端文档列表项（Java 的 `AdminDocumentVO`） */
export interface AdminDocumentVO {
  documentId: string
  knowledgeBaseId: string
  knowledgeBaseName: string | null
  userId: string
  username: string | null
  fileName: string
  /** 扩展名（大写），如 PDF */
  fileType: string | null
  /** 字节 */
  fileSize: number
  /** 三段状态聚合后的总状态 */
  status: string
  parseStatus: ParseStatus | null
  chunkStatus: ChunkStatus | null
  vectorStatus: VectorStatus | null
  errorMessage: string | null
  pageCount: number | null
  createdAt: string | null
}

export interface AdminDocumentQuery extends PageQuery {
  knowledgeBaseId?: number
  userId?: number
  status?: string
}

export interface DocumentStatusUpdateDTO {
  parseStatus?: ParseStatus
  chunkStatus?: ChunkStatus
  vectorStatus?: VectorStatus
  /** 失败原因；传空字符串 = 清空，传 null = 不改 */
  errorMessage?: string
  /** 页数；null = 不改 */
  pageCount?: number
}

/** 分块（Java 的 `ChunkVO`）—— 引用溯源就是靠它指回文档 */
export interface ChunkVO {
  chunkId: string
  documentId: string
  /** 所属文档的文件名 —— 溯源时展示「来自哪个文档」 */
  documentName: string | null
  knowledgeBaseId: string
  /** 从 0 开始 */
  chunkIndex: number
  content: string
  /** 估算值，仅用于展示，不影响检索 */
  tokenCount: number
  /** 所在页码，仅 PDF 有值 */
  pageNo: number | null
}

/* ============================================================
   管理端 · AI 模型配置
   ============================================================ */

/** 模型用途 */
export type AiScene = 'CHAT' | 'EMBEDDING' | 'RERANK'

/** AI 模型配置（Java 的 `AiModelVO`）—— ⚠️ 永远不含明文 apiKey */
export interface AiModelVO {
  id: string
  name: string
  scene: AiScene
  provider: string
  modelName: string
  baseUrl: string | null
  /** 尾部提示，如 `****abcd`；未配置时为 null */
  apiKeyHint: string | null
  hasApiKey: boolean
  temperature: number | null
  maxTokens: number | null
  timeoutSeconds: number | null
  /** 是否该用途下的默认配置 */
  isDefault: boolean
  /** 1 启用 / 0 禁用 */
  status: number
  description: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface AiModelCreateDTO {
  name: string
  scene: AiScene
  provider: string
  modelName: string
  baseUrl?: string
  /** 明文只在本次请求里出现，后端落库前加密 */
  apiKey?: string
  /** 0 ~ 2 */
  temperature?: number
  maxTokens?: number
  timeoutSeconds?: number
  isDefault?: boolean
  /** 不传默认 1 */
  status?: number
  description?: string
}

export interface AiModelUpdateDTO {
  name?: string
  scene?: AiScene
  provider?: string
  modelName?: string
  baseUrl?: string
  /** ⚠️ 传 null = 保持原有 Key 不变（不是清空） */
  apiKey?: string
  temperature?: number
  maxTokens?: number
  timeoutSeconds?: number
  isDefault?: boolean
  status?: number
  description?: string
}

/* ============================================================
   管理端 · 审计日志 / 仪表盘
   ============================================================ */

/** 审计日志（Java 的 `AuditLogVO`） */
export interface AuditLogVO {
  id: string
  /** 操作人；未登录（如登录失败）时为 null */
  userId: string | null
  /** 动作，如 ADMIN_LOGIN */
  action: string
  resourceType: string | null
  resourceId: string | null
  /** 链路 id，可与后端日志文件关联 */
  requestId: string | null
  httpMethod: string | null
  requestUri: string | null
  ip: string | null
  userAgent: string | null
  /** SUCCESS / FAIL */
  result: string
  /** 明细，JSON 字符串 —— 前端自行解析 */
  detailJson: string | null
  createdAt: string | null
}

export interface AuditLogQuery extends PageQuery {
  userId?: number
  action?: string
  resourceType?: string
  result?: string
  /** ISO 时间字符串 */
  from?: string
  to?: string
}

/** 仪表盘统计（Java 的 `DashboardVO`）—— 各项都不含已删除数据 */
export interface DashboardVO {
  userCount: number
  knowledgeBaseCount: number
  documentCount: number
  aiRequestCount: number
  tokenUsage: number
}
