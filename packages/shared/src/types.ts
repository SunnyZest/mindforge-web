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
  /** 排序字段（需在后端白名单内） */
  sortBy?: string
  /** 排序方向，默认 desc */
  sortOrder?: 'asc' | 'desc'
}

/** 当前登录用户（Java 的 `UserInfoVO`） */
export interface UserInfoVO {
  id: string
  username: string
  nickname: string | null
  /**
   * 头像地址，未设置为 null。
   *
   * ⚠️ 后端给的是**后端路径** `/api/app/avatars/{fileId}`，直接塞给 `<img>` / `<el-avatar>` 的 `src` 即可。
   *    那个读取接口是**公开**的（img 标签带不上 Authorization 头），每次请求 302 跳到现签的 OSS URL。
   *    再上传一次会拿到新的 fileId，所以 URL 会跟着变，不需要手动破缓存。
   */
  avatarUrl: string | null
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
  /**
   * 登录标识：用户名或邮箱。
   *
   * 后端 `CustomUserDetailsService` 先按用户名查，查不到且含 `@` 再按邮箱查 ——
   * 所以前端不需要告诉后端「我用哪种」，只需要按选择的模式做格式校验。
   * 上限 64（`user.email varchar(64)`）；用户名本身仍是 3-32。
   */
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
  /**
   * 必填。
   *
   * ★ 2026-10-18 起注册必须先证明「你拥有这个邮箱」：
   * 先调 `sendVerificationCode({ scene: 'REGISTER' })`，用户收信后把码一起提交。
   */
  email: string
  /** 邮箱验证码（scene = REGISTER），6 位 */
  code: string
  /** 6~64 位 */
  password: string
}

/** 验证码通道。短信还没开通，后端会明确报「通道尚未开通」 */
export type VerificationChannel = 'EMAIL' | 'SMS'

/**
 * 验证码场景。
 *
 * - REGISTER：注册
 * - RESET_PASSWORD：忘记密码（找回）
 *
 * ⚠️ 登录后的「修改密码」不需要验证码 —— 那条路径只验原密码。
 */
export type VerificationScene = 'REGISTER' | 'RESET_PASSWORD'

/** 发送验证码（Java 的 `SendVerificationCodeDTO`） */
export interface SendVerificationCodeDTO {
  channel: VerificationChannel
  /** 邮箱地址（SMS 时是手机号） */
  target: string
  scene: VerificationScene
}

/** 找回密码（Java 的 `ResetPasswordDTO`）—— 未登录可用 */
export interface ResetPasswordDTO {
  email: string
  /** 邮箱验证码（scene = RESET_PASSWORD） */
  code: string
  /** 6~64 位 */
  newPassword: string
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
   * 角色 id 列表（雪花 ID 字符串）；不传或为空则只绑定默认角色 USER。
   */
  roleIds?: Array<string | number>
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
  /** 传空数组 = 清空该用户所有角色（雪花 ID 字符串数组） */
  roleIds: Array<string | number>
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
  /** 传空数组 = 清空该角色所有权限（雪花 ID 字符串数组） */
  permissionIds: Array<string | number>
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
  /** 是否官方系统全局智库：1 是 / 0 否 */
  isSystem?: number
  /** 文档数（实时统计，不是表里的冗余字段） */
  documentCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface AdminKnowledgeBaseQuery extends PageQuery {
  status?: number
  userId?: string | number
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
  knowledgeBaseId?: string | number
  userId?: string | number
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
  /** 从 0 开始。⚠️ Java 侧是 Integer，理论上可空 */
  chunkIndex: number | null
  content: string
  /** 估算值，仅用于展示，不影响检索。同上，可空 */
  tokenCount: number | null
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
  userId?: string | number
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

// ============================================================================
//  用户端 —— 简历
//  字段名和枚举取值都是对着后端 VO / Python 服务实际产出核过的，不是猜的：
//    · VO    见 Java 的 pojo/vo/ResumeVO、ResumeDetailVO、ResumeParsedVO、ResumeOptimizeVO
//    · 结构化 见 Python 的 app/services/resume.py 的 _normalize()
//    · 枚举   见同文件的 _SKILL_TYPES / _PROFICIENCY / _ANALYZE_TARGETS
// ============================================================================

/** 解析状态机：PENDING → PARSING → SUCCESS / FAILED */
export type ResumeParseStatus = 'PENDING' | 'PARSING' | 'SUCCESS' | 'FAILED'

/** 技能类型（Python `_SKILL_TYPES`，白名单外的值会被后端置空） */
export type SkillType = 'LANGUAGE' | 'FRAMEWORK' | 'TOOL' | 'SOFT'

/** 熟练度（Python `_PROFICIENCY`，同上） */
export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'

/** 优化建议针对的部分（Python `_ANALYZE_TARGETS`） */
export type OptimizeTarget =
  'SUMMARY' | 'WORK_EXPERIENCE' | 'PROJECT_EXPERIENCE' | 'SKILLS' | 'EDUCATION' | 'OVERALL'

/** 简历列表行（Java 的 `ResumeVO`） */
export interface ResumeVO {
  id: string
  name: string
  targetPosition: string | null
  parseStatus: ResumeParseStatus
  fileName: string | null
  fileSize: number | null
  status: number
  createdAt: string | null
  updatedAt: string | null
}

// ---------- 结构化简历 ----------
// ⚠️ 每个字段都可能为 null —— Python 侧的 clean_str() 拿不到就置空，
//    而不是留空串。展示时一律按「可能没有」处理，别直接 .length。

export interface ResumeSkill {
  name: string
  type: SkillType | null
  proficiency: ProficiencyLevel | null
  years: number | null
}

export interface ResumeEducation {
  school: string
  major: string | null
  degree: string | null
  /** 年份是整数（Python clean_int(1900~2100)），不是字符串 */
  startYear: number | null
  endYear: number | null
}

export interface ResumeWorkExperience {
  company: string
  position: string | null
  startDate: string | null
  endDate: string | null
  description: string | null
}

export interface ResumeProject {
  name: string
  role: string | null
  description: string | null
  techStack: string[]
}

/** 结构化简历内容（`resume.structured_json` 列的 JSON，未解析时为 null） */
export interface StructuredResume {
  name: string | null
  phone: string | null
  email: string | null
  location: string | null
  targetPosition: string | null
  summary: string | null
  selfEvaluation: string | null
  yearsOfExperience: number | null
  education: ResumeEducation[]
  workExperience: ResumeWorkExperience[]
  projects: ResumeProject[]
  skills: ResumeSkill[]
  /** 证书/奖项，字符串数组 */
  certificates: string[]
}

/** 简历详情（Java 的 `ResumeDetailVO`）—— 比列表多 rawContent 和 structuredJson */
export interface ResumeDetailVO {
  id: string
  name: string
  targetPosition: string | null
  /** 关联的文件 id（下载用） */
  fileId: string | null
  fileName: string | null
  fileSize: number | null
  summary: string | null
  /** 简历原文 —— 「左原文 / 右结构化」对照的左半边就靠它 */
  rawContent: string | null
  structuredJson: StructuredResume | null
  parseStatus: ResumeParseStatus
  errorMessage: string | null
  status: number
  createdAt: string | null
  updatedAt: string | null
}

/** 解析结果（Java 的 `ResumeParsedVO`）—— 轮询解析进度用这个，响应体比详情小 */
export interface ResumeParsedVO {
  resumeId: string
  parseStatus: ResumeParseStatus
  summary: string | null
  structuredJson: StructuredResume | null
  errorMessage: string | null
  updatedAt: string | null
}

// ---------- AI 优化 ----------

/** 优化请求（Java 的 `ResumeOptimizeDTO`）—— 两个字段都可空 */
export interface ResumeOptimizeDTO {
  /** 目标岗位 id。不传 = 按通用标准评 */
  jobId?: string
  /** 重点分析的部分。不传 = 整体 */
  target?: OptimizeTarget
}

/** 单条优化建议 */
export interface ResumeOptimizeItem {
  target: OptimizeTarget | null
  /** 简历里的原句 */
  original: string | null
  issue: string | null
  /** 怎么改 —— 任何情况下都有 */
  suggestion: string | null
  /** ★ needsFact = true 时【一定】是 null */
  rewritten: string | null
  /**
   * ★★ 决定这条该怎么展示：
   *   false → 「改写建议」，rewritten 可以直接用
   *   true  → 「待补事实」，没有 rewritten，只有 missingFact 说缺什么
   * 两类绝不能混着展示 —— 见 ResumeOptimizeVO 里的说明。
   */
  needsFact: boolean
  /** 缺什么事实；needsFact = false 时为 null */
  missingFact: string | null
}

/** AI 优化建议（Java 的 `ResumeOptimizeVO`）—— ⚠️ 只返回建议，不改简历 */
export interface ResumeOptimizeVO {
  resumeId: string
  /** 0~100，仅作参考 —— 真正该看的是 items */
  overallScore: number | null
  summary: string | null
  /** 简历里已经写得好的地方 */
  highlights: string[]
  /** ⚠️ 后端硬上限 5 条，别按 8 条设计布局 */
  items: ResumeOptimizeItem[]
  /** 需要用户补事实的条数，页头直接显示这个，别让用户自己数 */
  needsFactCount: number | null
  /** 简历太长时只分析了前面一段 */
  truncated: boolean | null
}

/** 简历列表查询 */
export interface ResumeQuery extends PageQuery {
  parseStatus?: ResumeParseStatus
}

/** 在线精修或采纳 AI 改写后更新简历（Java 的 `ResumeUpdateDTO`） */
export interface ResumeUpdateDTO {
  name?: string
  targetPosition?: string
  summary?: string
  rawContent?: string
  structuredJson?: StructuredResume | null
}

// ============================================================================
//  用户端 —— 职位 JD
//  同样是对着源码核过的：Java 的 pojo/vo/JobVO、JobDetailVO、
//  pojo/dto/JobCreateDTO、JobUpdateDTO；Python 的 app/services/job.py 的 _normalize()
// ============================================================================

/** 职位技能（Python `_normalize_skills`） */
export interface JobSkill {
  name: string
  type: SkillType | null
  /**
   * 保留 JD 原话（「精通」「熟悉」「了解」），**不做标准化** ——
   * 招聘方的用词本身就是信息，换算是丢信息。
   */
  requiredLevel: string | null
  /**
   * 是不是硬性要求。
   * ⚠️ JD 里没写「必须」的一律按加分项处理（false）—— 后端定的默认值。
   */
  required: boolean
}

/** 结构化后的职位 JD（`job.structured_json` 列的 JSON） */
export interface StructuredJob {
  title: string | null
  companyName: string | null
  location: string | null
  /** 经验要求，保留原文表述（「3-5 年」「不限」） */
  experienceRequired: string | null
  /** 学历要求，同上 */
  educationRequired: string | null
  summary: string | null
  /** 岗位职责 */
  responsibilities: string[]
  skills: JobSkill[]
  /** 福利待遇 */
  benefits: string[]
}

/** 职位投递阶段标准编码 */
export type JobApplicationStage =
  | 'WISHLIST'
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW_1'
  | 'INTERVIEW_2'
  | 'HR'
  | 'OFFER'
  | 'REJECTED'

/** 职位列表行（Java 的 `JobVO`） */
export interface JobVO {
  id: string
  title: string
  companyName: string | null
  location: string | null
  experienceRequired: string | null
  educationRequired: string | null
  parseStatus: ResumeParseStatus
  applicationStage?: JobApplicationStage
  linkedResumeId?: string | null
  salaryOffer?: string | null
  nextActionAt?: string | null
  crmNotes?: string | null
  status: number
  createdAt: string | null
  updatedAt: string | null
}

/** 职位详情（Java 的 `JobDetailVO`）—— 比列表多 rawContent / structuredJson / sourceUrl */
export interface JobDetailVO {
  id: string
  title: string
  companyName: string | null
  location: string | null
  sourceUrl: string | null
  experienceRequired: string | null
  educationRequired: string | null
  /** JD 原文 —— 「左原文 / 右结构化」对照的左半边 */
  rawContent: string | null
  structuredJson: StructuredJob | null
  parseStatus: ResumeParseStatus
  applicationStage?: JobApplicationStage
  linkedResumeId?: string | null
  salaryOffer?: string | null
  nextActionAt?: string | null
  crmNotes?: string | null
  errorMessage: string | null
  status: number
  createdAt: string | null
  updatedAt: string | null
}

/**
 * 创建职位（Java 的 `JobCreateDTO`）。
 * 长度上限照抄后端的 @Size，前端先挡一道给个清楚的提示。
 */
export interface JobCreateDTO {
  /** 必填，最长 255 */
  title: string
  companyName?: string
  location?: string
  /** 最长 1000 */
  sourceUrl?: string
  /** 最长 128 */
  experienceRequired?: string
  /** 最长 128 */
  educationRequired?: string
  /** 必填 —— JD 正文，解析就是拿它去跑模型 */
  jobDescription: string
}

/**
 * 修改职位（Java 的 `JobUpdateDTO`）。
 * ⚠️ 和 Create 的区别：**没有必填项**，另外多了 `status` 与求职 CRM 字段。
 *    后端是「传了才改」的语义。
 * ⚠️ `nextActionAt` 传 null 是「不修改」，不是「清空」——要清空必须传 `clearNextActionAt: true`。
 */
export interface JobUpdateDTO {
  title?: string
  companyName?: string
  location?: string
  sourceUrl?: string
  experienceRequired?: string
  educationRequired?: string
  jobDescription?: string
  applicationStage?: JobApplicationStage
  linkedResumeId?: string | null
  salaryOffer?: string | null
  /** 有值时直接覆盖；要清空请用 clearNextActionAt */
  nextActionAt?: string | null
  /** 显式清空待办提醒（nextActionAt 有值时以 nextActionAt 为准） */
  clearNextActionAt?: boolean
  crmNotes?: string | null
  status?: number
}

/** 职位列表查询 */
export type JobQuery = PageQuery

/** 求职投递看板卡片项（Java 的 `JobKanbanCardVO`） */
export interface JobKanbanCardVO {
  id: string
  title: string
  companyName: string | null
  location: string | null
  experienceRequired: string | null
  educationRequired: string | null
  parseStatus: ResumeParseStatus
  applicationStage: JobApplicationStage
  linkedResumeId: string | null
  linkedResumeName: string | null
  salaryOffer: string | null
  nextActionAt: string | null
  crmNotes: string | null
  matchScore: number | null
  interviewCount: number
  bestInterviewScore: number | null
  createdAt: string | null
  updatedAt: string | null
}

/** 求职投递看板单列数据（Java 的 `JobKanbanColumnVO`） */
export interface JobKanbanColumnVO {
  stage: JobApplicationStage
  title: string
  count: number
  cards: JobKanbanCardVO[]
}

/** 求职投递看板顶部统计概览（Java 的 `JobKanbanStatsVO`） */
export interface JobKanbanStatsVO {
  totalTracked: number
  appliedCount: number
  interviewingCount: number
  offerCount: number
  upcomingScheduleCount: number
}

/** 快速拖拽/变更职位投递阶段请求（Java 的 `JobStageUpdateDTO`） */
export interface JobStageUpdateDTO {
  stage: JobApplicationStage
}

/** 更新求职 CRM 信息请求（Java 的 `JobCrmUpdateDTO`） */
export interface JobCrmUpdateDTO {
  applicationStage?: JobApplicationStage
  /** 传空字符串 = 解除绑定；不传 = 不动 */
  linkedResumeId?: string | null
  salaryOffer?: string | null
  /** 有值时直接覆盖；要清空请用 clearNextActionAt（传 null 只是「不修改」） */
  nextActionAt?: string | null
  /** 显式清空待办提醒（nextActionAt 有值时以 nextActionAt 为准） */
  clearNextActionAt?: boolean
  crmNotes?: string | null
}

// ============================================================================
//  用户端 —— 模拟面试
//  对着 Java 的 pojo/vo/Interview*.java、pojo/dto/Interview*.java
//  和 Python 的 app/services/interview.py 核过。
//
//  ★ 流程是【五步】，别把「创建」和「出题」合成一步：
//    创建（快）→ 出题（慢）→ 开始作答（快）→ 逐题提交（慢）→ 结束出报告（慢）
//    后端刻意拆开：创建失败（参数错）和出题失败（AI 超时）是两类问题，
//    合成一个接口前端说不清该提示什么，而且出题失败后没法重试。
// ============================================================================

/** 面试类型（创建时选） */
export type InterviewType = 'TECHNICAL' | 'BEHAVIORAL' | 'MIXED'

/** 难度 */
export type InterviewDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

/** 状态机：CREATED → IN_PROGRESS → FINISHED */
export type InterviewStatus = 'CREATED' | 'IN_PROGRESS' | 'FINISHED'

/** 单题的类型（由 AI 出题时决定，和面试类型不是一回事） */
export type QuestionType = 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL'

/** 单题的 AI 分析（Java 的 `InterviewAnalysisVO`） */
export interface InterviewAnalysis {
  score: number | null
  technical: {
    score: number | null
    strengths: string[]
    weaknesses: string[]
  } | null
  communication: {
    clarity: number | null
    issues: string[]
  } | null
  /** 你答漏了的点 —— 这是逐题反馈里最有用的部分 */
  missingPoints: string[]
  comment: string | null
  /** 追问（如果 AI 觉得这题还能再挖） */
  followUp: string | null
}

/** 单题（Java 的 `InterviewQuestionVO`） */
export interface InterviewQuestionVO {
  id: string
  /** ⚠️ 后端【重排过】的编号，从 1 开始连续 —— 可以放心按它排序和找下一题 */
  questionNo: number
  questionType: QuestionType | null
  question: string
  difficulty: InterviewDifficulty | null
  answered: boolean
  userAnswer: string | null
  score: number | null
  aiAnalysis: InterviewAnalysis | null
  answeredAt: string | null
  /** 参考答案的要点 —— 作答前别展示（等于给答案） */
  expectedPoints: string[]
}

/** 面试列表行（Java 的 `InterviewVO`） */
export interface InterviewVO {
  id: string
  title: string
  interviewType: InterviewType
  difficulty: InterviewDifficulty
  status: InterviewStatus
  questionCount: number | null
  answeredCount: number | null
  averageScore: number | null
  resumeId: string | null
  jobId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
}

/** 面试详情（Java 的 `InterviewDetailVO`）—— 比列表多 questions */
export interface InterviewDetailVO {
  id: string
  title: string
  interviewType: InterviewType
  difficulty: InterviewDifficulty
  status: InterviewStatus
  questionCount: number | null
  answeredCount: number | null
  resumeId: string | null
  jobId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
  questions: InterviewQuestionVO[]
}

/** 创建面试（Java 的 `InterviewCreateDTO`）—— resumeId / jobId 都可空 */
export interface InterviewCreateDTO {
  /** 可空 —— 支持「不基于简历的通用面试」 */
  resumeId?: string
  jobId?: string
  /** 可空，不传按岗位/简历名自动生成；最长 255 */
  title?: string
  /** 默认 TECHNICAL */
  interviewType?: InterviewType
  /** 默认 MEDIUM */
  difficulty?: InterviewDifficulty
  /** 1~20，默认 5 */
  questionCount?: number
}

/** 提交单题回答（Java 的 `InterviewAnswerDTO`） */
export interface InterviewAnswerDTO {
  /** 必填 */
  questionId: string
  answer?: string
}

/** 提交回答后的返回（Java 的 `InterviewAnswerResultVO`）—— 自带下一题，省一次请求 */
export interface InterviewAnswerResultVO {
  questionId: string
  questionNo: number
  score: number | null
  analysis: InterviewAnalysis | null
  /** 下一题；已经是最后一题时为 null */
  nextQuestion: {
    id: string
    questionNo: number
    question: string
    questionType: QuestionType | null
    difficulty: InterviewDifficulty | null
  } | null
  answeredCount: number
  totalCount: number
  /** 全答完了 —— 这时候才该把「结束面试」的按钮亮出来 */
  allAnswered: boolean
}

/** 面试报告（Java 的 `InterviewReportVO`） */
export interface InterviewReportVO {
  id: string
  interviewId: string
  overallScore: number | null
  technicalScore: number | null
  communicationScore: number | null
  problemSolvingScore: number | null
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  /** 长文本总评 */
  reportText: string | null
  createdAt: string | null
}

/** 面试列表查询 */
export interface InterviewQuery extends PageQuery {
  status?: InterviewStatus
}

/** 错题本掌握状态过滤 */
export type MistakeMasteryStatus = 'WEAK' | 'MASTERED' | 'ALL'

/** 错题本统计概览（Java 的 `InterviewMistakeStatsVO`） */
export interface InterviewMistakeStatsVO {
  totalAnswered: number
  weakCount: number
  masteredCount: number
  averageScore: number | null
}

/** 错题本单题记录（Java 的 `InterviewMistakeVO`） */
export interface InterviewMistakeVO {
  questionId: string
  interviewId: string
  interviewTitle: string
  interviewType: InterviewType
  questionNo: number
  questionType: QuestionType | null
  difficulty: InterviewDifficulty | null
  question: string
  userAnswer: string | null
  score: number | null
  mastered: boolean
  aiAnalysis: InterviewAnalysis | null
  expectedPoints: string[]
  answeredAt: string | null
}

/** 错题本分页查询 */
export interface InterviewMistakeQuery extends PageQuery {
  masteryStatus?: MistakeMasteryStatus
  questionType?: QuestionType
  difficulty?: InterviewDifficulty
}

/** 错题本单题重练请求（Java 的 `InterviewPracticeDTO`） */
export interface InterviewPracticeDTO {
  answer: string
}

// ============================================================================
//  用户端 —— 知识库 / 文档 / 分块
//  对着 Java 的 pojo/vo/KnowledgeBase*.java、Document*.java、ChunkVO.java
//  和 pojo/dto/KnowledgeBase*.java 核过。
// ============================================================================

/** 知识库（Java 的 `KnowledgeBaseVO`）—— 列表和详情是同一个 VO */
export interface KnowledgeBaseVO {
  id: string
  name: string
  description: string | null
  status: number
  /** 是否官方系统全局智库：1 是 / 0 否 */
  isSystem?: number
  documentCount: number | null
  createdAt: string | null
  updatedAt: string | null
}

/** 创建知识库（Java 的 `KnowledgeBaseCreateDTO`） */
export interface KnowledgeBaseCreateDTO {
  /** 必填，最长 100 */
  name: string
  /** 最长 500 */
  description?: string
}

/** 修改知识库（Java 的 `KnowledgeBaseUpdateDTO`）—— 无必填项，「传了才改」 */
export interface KnowledgeBaseUpdateDTO {
  name?: string
  description?: string
  status?: number
}

/** 网页 URL 导入请求（Java 的 `ImportUrlDTO`） */
export interface ImportUrlDTO {
  url: string
}

/** 知识库统计（Java 的 `KnowledgeBaseStatsVO`）—— 注意是 Long，不是 Integer */
export interface KnowledgeBaseStatsVO {
  documentCount: number
  chunkCount: number
  /** 处理完成的文档数 */
  completedDocuments: number
  /** 处理失败的文档数 */
  failedDocuments: number
}

/** 文档（Java 的 `DocumentVO`） */
export interface DocumentVO {
  documentId: string
  knowledgeBaseId: string
  fileName: string
  fileType: string | null
  fileSize: number | null
  /** 总状态：UPLOADED / PARSING / PARSED / CHUNKED / COMPLETED / FAILED */
  status: string
  parseStatus: ParseStatus | null
  chunkStatus: ChunkStatus | null
  vectorStatus: VectorStatus | null
  errorMessage: string | null
  pageCount: number | null
  createdAt: string | null
}

/** 文档处理状态（Java 的 `DocumentStatusVO`）—— 轮询用，比 DocumentVO 窄 */
export interface DocumentStatusVO {
  documentId: string
  status: string
  parseStatus: ParseStatus | null
  chunkStatus: ChunkStatus | null
  vectorStatus: VectorStatus | null
  errorMessage: string | null
  updatedAt: string | null
}

// ============================================================================
//  用户端 —— 对话问答（RAG）
// ============================================================================

/** 引用来源（Java 的 `SourceVO`）—— 正文里标注的就是它 */
export interface SourceVO {
  documentId: string
  documentName: string | null
  /** ★ 点它去 GET /app/chunks/{chunkId} 拿原文片段 —— 这是「引用溯源」的关键 */
  chunkId: string
  pageNo: number | null
  /** 相关度得分 */
  score: number | null
}

/** 会话（Java 的 `ConversationVO`） */
export interface ConversationVO {
  conversationId: string
  knowledgeBaseId: string | null
  title: string
  modelName: string | null
  messageCount: number | null
  createdAt: string | null
  updatedAt: string | null
}

/** 消息（Java 的 `MessageVO`） */
export interface MessageVO {
  messageId: string
  /** USER / ASSISTANT */
  role: string
  content: string
  modelName: string | null
  /**
   * ★ 助手消息带的引用来源。
   *
   * ⚠️ **可能是 null** —— 实测确认：用户消息的 sources 就是 null。
   *    原因在后端：`ConversationServiceImpl` 只在来源非空时才 set，
   *    其它服务（简历/职位/面试）都有 `nullToEmpty` 兜底，只有它没有。
   *    所以这里必须按可空处理 —— 直接 `.length` 会让「打开带历史的会话」整页白屏。
   */
  sources: SourceVO[] | null
  createdAt: string | null
}

/** 会话详情（Java 的 `ConversationDetailVO`） */
export interface ConversationDetailVO extends ConversationVO {
  messages: MessageVO[]
}

/** 创建会话（Java 的 `CreateConversationDTO`）—— 两个字段都必填 */
export interface CreateConversationDTO {
  knowledgeBaseId?: string | null
  /** 最长 255 */
  title: string
}

/** 发消息（Java 的 `SendMessageDTO`） */
export interface SendMessageDTO {
  message: string
  /** 1~50，默认 8 */
  topK?: number
  /** 是否重排，默认 false */
  enableRerank?: boolean
  promptId?: string
}

/** 非流式发消息的返回（Java 的 `SendMessageResultVO`） */
export interface SendMessageResultVO {
  messageId: string
  answer: string
  sources: SourceVO[]
  /** 知识库里有没有检索到相关内容 */
  hasContext: boolean
  /** 模型有没有给出回答 */
  hasAnswer: boolean
}

/** RAG 检索（Java 的 `RagSearchDTO`）—— 只检索不生成 */
export interface RagSearchDTO {
  /**
   * 知识库 id。**可以不传** —— 不传 = 搜「我的全部知识库 + 官方智库」。
   * 这是搜索页的主用法：用户不该为了搜一句话先想清楚内容在哪个库。
   * 传了就必须是我有权访问的库，否则 404。
   */
  knowledgeBaseId?: string
  query: string
  /** 1~50，默认 8 */
  topK?: number
  enableRerank?: boolean
}

/**
 * 语义检索命中的片段。
 *
 * ⚠️ 和聊天引用（`SourceVO`）不是一回事：那个只给文件名+页码用于溯源，
 * **不带正文**；搜索页的结果主体就是正文，所以另有此类型。
 */
export interface SearchHitVO {
  documentId: string
  documentName: string
  /** 来源知识库 id / 名 —— 跨库检索时用来标明「这条来自哪个库」 */
  knowledgeBaseId: string | null
  knowledgeBaseName: string | null
  /** 是否来自官方智库 */
  fromSystemKb: boolean
  /** 分块 id —— 取完整原文用 */
  chunkId: string
  chunkIndex: number | null
  /** 页码（当前与 chunkIndex 同值，PDF 才有意义） */
  pageNo: number | null
  /** ★ 片段正文 */
  content: string | null
  /** 相关度 0~1（开启重排时是 rerank 分数，量纲不同但同样落在 0~1） */
  score: number | null
}

/** RAG 检索返回（2026-10-16 起 results 带正文，并新增 searchedKbCount） */
export interface RagSearchResultVO {
  results: SearchHitVO[]
  /** 本次结果是否真的经过 rerank 精排（enableRerank=true 但未配精排模型或降级时为 false） */
  reranked: boolean
  /** 本次实际覆盖的知识库数量 */
  searchedKbCount: number
}

/** 给回答打分（Java 的 `RagFeedbackDTO`） */
export interface RagFeedbackDTO {
  messageId: string
  /** 评价 —— 后端只校验非空，取值由前端约定 */
  rating: string
  /** 最长 500 */
  reason?: string
}

/**
 * SSE 流式返回的事件（Java 的 `ChatStreamEvents`）。
 * 事件名固定四个：sources / delta / done / error。
 */
export interface ChatStreamSourcesEvent {
  sources: SourceVO[]
  hasContext: boolean
  contextTruncated: boolean
}

/** 增量文本 —— 每次拿一小段，拼起来才是完整回答 */
export interface ChatStreamDeltaEvent {
  text: string
}

export interface ChatStreamDoneEvent {
  messageId: string
  answer: string
  hasAnswer: boolean
}

export interface ChatStreamErrorEvent {
  code: number
  message: string
  traceId: string | null
}

// ============================================================================
//  管理端 —— Prompt 管理 / AI 用量
//  对着 Java 的 pojo/vo/Prompt*.java、Usage*.java、pojo/dto/Prompt*.java 核过。
// ============================================================================

/**
 * 提示词版本状态。
 * ⚠️ **是大写** —— 后端 `AdminPromptServiceImpl` 里定义的就是 DRAFT / PUBLISHED / ARCHIVED。
 *    别按小写比较，否则「生效中」的高亮和「生效中不能删」都会失效（实测踩过）。
 */
export type PromptStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

/**
 * 提示词版本（Java 的 `PromptVO`）。
 *
 * ★ 有版本管理：同一个 (scene, name) 每次新建都是**加一个版本**，不是新建变体。
 *   想加变体要换 `name`。
 */
export interface PromptVO {
  id: string
  /**
   * 场景，如 RAG_CHAT / RESUME_PARSE。
   * ⚠️ **后端会统一转成大写**（`scene.trim().toUpperCase()`），
   *    对齐 Python 侧的提示词文件名。所以这里拿到的永远是大写。
   */
  scene: string
  /** 变体名，同一个 scene 下可以有多套说法 */
  name: string
  version: number
  content: string
  /** 只有 published 的那个版本会被真正使用 */
  status: PromptStatus
  isDefault: boolean
  /** 是否让用户端能选它 */
  userSelectable: boolean
  /** 给用户看的选项名 */
  label: string | null
  description: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 按变体分组（Java 的 `PromptGroupVO`）—— 列表就是这个结构 */
export interface PromptGroupVO {
  scene: string
  name: string
  label: string | null
  userSelectable: boolean
  isDefault: boolean
  /** 当前已发布版本的 id */
  publishedId: string | null
  /** 最新版本号（不一定等于已发布的那个） */
  latestVersion: number | null
  /** 版本历史，版本号倒序 */
  versions: PromptVO[]
}

/** 用户端可选的回答风格（Java 的 `PromptOptionVO`） */
export interface PromptOptionVO {
  /** 提交时传这个 id（字符串） */
  id: string
  /** 给用户看的名字，如「严谨」「简洁」 */
  label: string
  /** 一句话说明这个风格的特点 */
  description: string | null
  /** 是否是默认风格 */
  isDefault: boolean
}

/** 新建版本（Java 的 `PromptCreateDTO`）—— 同 (scene, name) 再加就是加版本 */
export interface PromptCreateDTO {
  /** 必填，最长 32。⚠️ 后端会转成大写，填小写也存成大写 */
  scene: string
  /** 必填，最长 64 */
  name: string
  /** 必填 —— 提示词正文 */
  content: string
  userSelectable?: boolean
  /** 最长 64 */
  label?: string
  isDefault?: boolean
  /** 最长 255 */
  description?: string
}

/**
 * 修改版本（Java 的 `PromptUpdateDTO`）。
 * ⚠️ **改不了 scene / name** —— 那相当于换一个变体了，得新建。
 */
export interface PromptUpdateDTO {
  content?: string
  userSelectable?: boolean
  label?: string
  isDefault?: boolean
  description?: string
}

/** 用量总览（Java 的 `UsageSummaryVO`） */
export interface UsageSummaryVO {
  requests: number
  successCount: number
  failedCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  avgDurationMs: number | null
}

/** 按天用量（Java 的 `UsageDailyVO`）—— 只返回有记录的天 */
export interface UsageDailyVO {
  /** ISO 日期字符串 yyyy-MM-dd */
  date: string
  requests: number
  successCount: number
  failedCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** 按「场景 + 模型」用量（Java 的 `UsageByModelVO`） */
export interface UsageByModelVO {
  scene: string
  provider: string | null
  modelName: string | null
  requests: number
  successCount: number
  failedCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  avgDurationMs: number | null
}

/** 用量查询 —— 三个接口共用同一套日期参数 */
export interface UsageQuery {
  /** ISO 日期 yyyy-MM-dd */
  from?: string
  to?: string
}

// ---------- 管理端：高危操作告警（Java 的 AlertVO / AdminAlertController）----------
export interface AdminAlertVO {
  id: string
  /** 触发操作的用户 id；系统触发时为 null */
  userId: string | null
  /** 高危操作，如 ROLE_ASSIGN_PERMISSION */
  action: string
  /** 资源类型 */
  resourceType: string | null
  /** 资源 id */
  resourceId: string | null
  /** 触发请求的 traceId，可跳审计日志对照 */
  requestId: string | null
  /** 告警标题，如「高危操作告警：ROLE_CREATE（成功）」 */
  title: string
  /** 操作明细 JSON 字符串，前端自行解析 */
  detailJson: string | null
  /** 是否已读 */
  read: boolean
  /** 标记已读的管理员 id */
  readBy: string | null
  /** 标记已读时间 */
  readAt: string | null
  /** 发生时间 */
  createdAt: string
}

export interface AdminAlertQuery {
  page?: number
  pageSize?: number
  /** 是否只看未读 */
  unreadOnly?: boolean
  /** 排序字段白名单：action | resourceType | createdAt */
  sortBy?: 'action' | 'resourceType' | 'createdAt'
  /** 排序方向：asc | desc */
  sortOrder?: 'asc' | 'desc'
}

// ---------- 用户端：简历-JD 匹配分析 ----------
export type AnalysisCategory = 'SKILL' | 'EXPERIENCE' | 'EDUCATION' | 'OTHER'

export type AnalysisVerdict =
  | 'MATCHED'
  | 'EXPRESSION_GAP'
  | 'INSUFFICIENT_EVIDENCE'
  | 'REAL_GAP'
  | 'UNCERTAIN'

export interface ResumeJobAnalysisItemVO {
  category: AnalysisCategory
  requirement: string
  verdict: AnalysisVerdict
  /** 简历原文中的凭据。verdict = MATCHED 时一定非空；判断不出依据时为 null */
  evidence: string | null
  /** 具体可执行的修改建议 */
  advice: string
}

export interface ResumeJobAnalysisVO {
  analysisId: string
  resumeId: string
  jobId: string
  /** 仅展示参考，别拿它当主要结论 */
  overallScore: number
  summary: string
  items: ResumeJobAnalysisItemVO[]
  matchedSkills: string[]
  missingSkills: string[]
  matchedExperience: string[]
  missingExperience: string[]
  suggestions: string[]
  createdAt: string
}

export interface ResumeJobAnalysisDTO {
  resumeId: string
  jobId: string
}

export interface ResumeJobAnalysisQuery {
  resumeId: string
  jobId: string
}


// ---------- 用户端：ATS 关键词跑分 ----------

/**
 * ATS 跑分里的一个关键词。
 *
 * ⚠️ 和「简历-JD 匹配分析」是两回事：这个只算「JD 里的关键词在简历里出现了没有」，
 * 纯本地计算、毫秒级、不烧 token、同一输入永远同一分。
 */
export interface AtsKeywordVO {
  keyword: string
  /** 技能类型，如 LANGUAGE / FRAMEWORK / TOOL，可空 */
  skillType: string | null
  /** 是否 JD 明确要求的必须项（必须项在算分时权重翻倍） */
  required: boolean
  /** 简历里是否命中 */
  hit: boolean
  /** 命中来源：SKILL = 简历技能表里有；TEXT = 只在正文里出现；null = 未命中 */
  hitSource: 'SKILL' | 'TEXT' | null
  /** 简历里标注的熟练度（结构化命中时才有） */
  proficiency: string | null
  /** 在简历原文里出现的次数 */
  occurrences: number
}

export interface AtsScoreVO {
  resumeId: string
  jobId: string
  /** 加权覆盖率得分 0-100（必须项 2 倍权重） */
  score: number
  /** 档位：≥80 HIGH / ≥60 MEDIUM / 其他 LOW，前端用它决定配色 */
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  totalKeywords: number
  matchedKeywords: number
  requiredTotal: number
  requiredMatched: number
  /** 一句话结论，可直接展示 */
  summary: string
  /** 全部关键词及命中情况（渲染成标签墙） */
  keywords: AtsKeywordVO[]
  /** 缺失的必须项 —— 最该先处理的 */
  missingRequired: AtsKeywordVO[]
  advice: string[]
  /** 固定免责说明：本分数只反映关键词是否出现，不代表能力匹配度。建议原样展示 */
  disclaimer: string
}

// ---------- 用户端：Offer 对比（五维打分表）----------

/** Offer 状态：考虑中 / 已接受 / 已拒绝 */
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

/** 五个维度的 key（后端刻意用英文短名，中文标签由前端映射） */
export type OfferDimension = 'salary' | 'tech' | 'brand' | 'wlb' | 'commute'

export interface OfferVO {
  id: string
  /** 关联的职位 id（从投递看板导入时带上），可空 */
  jobId: string | null
  companyName: string
  positionName: string | null
  /** 年薪（万元）。只用于展示参考，不参与算分 */
  salaryAnnual: number | null
  salaryScore: number
  techScore: number
  brandScore: number
  /** 加班强度评分，分越高越轻松 */
  wlbScore: number
  /** 通勤距离评分，分越高越方便 */
  commuteScore: number
  /** 各维度打分的理由（JSON 字符串，前端自行 parse） */
  dimensionNotes: string | null
  status: OfferStatus
  createdAt: string
  updatedAt: string
}

/** 五个维度的评分，1~10。创建时必填，修改时可只传要改的维度 */
export interface OfferScoreInput {
  salaryScore: number
  techScore: number
  brandScore: number
  wlbScore: number
  commuteScore: number
}

export interface OfferCreateDTO extends OfferScoreInput {
  /** 可空（从投递看板导入时带上） */
  jobId?: string
  companyName: string
  positionName?: string
  salaryAnnual?: number
  dimensionNotes?: string
}

export interface OfferUpdateDTO {
  companyName?: string
  positionName?: string
  salaryAnnual?: number
  /** 只传要改的维度，未传的保持不变 */
  salaryScore?: number
  techScore?: number
  brandScore?: number
  wlbScore?: number
  commuteScore?: number
  dimensionNotes?: string
}

export interface OfferStatusDTO {
  status: OfferStatus
}

export interface OfferCompareDTO {
  /** 要比对的 Offer id，2~5 个 */
  offerIds: string[]
  /**
   * 五个维度的权重，0-100（前端滑块直接用这个量纲）。
   * 全不传 = 五维等权；传了部分就按传的算（未传的按 0）；全 0 会 40001。
   */
  salaryWeight?: number
  techWeight?: number
  brandWeight?: number
  wlbWeight?: number
  commuteWeight?: number
}

export interface OfferCompareItemVO {
  offerId: string
  companyName: string
  positionName: string | null
  salaryAnnual: number | null
  status: OfferStatus
  salaryScore: number
  techScore: number
  brandScore: number
  wlbScore: number
  commuteScore: number
  /** 加权总分，0-10 */
  totalScore: number
  /** 排名，从 1 开始（同分并列同名次） */
  rank: number
  /** 这家在哪些维度并列最优（维度英文名列表） */
  bestDimensions: OfferDimension[]
}

export interface OfferCompareVO {
  offerIds: string[]
  /** 归一化后的权重（五个加起来 = 1），可直接展示占比 */
  weights: Record<OfferDimension, number>
  /** 已按加权总分从高到低排好序 */
  offers: OfferCompareItemVO[]
  /** 各维度的最优 Offer（并列时多个），key 是维度英文名 */
  bestByDimension: Record<OfferDimension, string[]>
  /** 一句话决策建议，可直接展示 */
  recommendation: string
}

export interface OfferQuery {
  page?: number
  pageSize?: number
  /** 匹配公司名 / 岗位名 */
  keyword?: string
  status?: OfferStatus
  /** 排序字段白名单：companyName | salaryAnnual | createdAt | updatedAt */
  sortBy?: 'companyName' | 'salaryAnnual' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

// ---------- 用户端：面试日历（求职日程）----------

/**
 * 日程类型。后端用英文短名，中文标签由前端映射。
 */
export type JobEventType =
  | 'WRITTEN_TEST'
  | 'INTERVIEW_1'
  | 'INTERVIEW_2'
  | 'HR'
  | 'OFFER_TALK'
  | 'OTHER'

/** 面试形式：现场 / 线上 / 电话 */
export type JobEventMode = 'ONSITE' | 'ONLINE' | 'PHONE'

/** 日程状态：待进行 / 已完成 / 已取消 */
export type JobEventStatus = 'PENDING' | 'DONE' | 'CANCELLED'

export interface JobEventVO {
  id: string
  /** 关联职位 id —— 每条日程必挂一个职位 */
  jobId: string
  /** 关联职位名称（职位被删时为 null） */
  jobTitle: string | null
  companyName: string | null
  /** 该职位的投递阶段，日历上用来着色/分组 */
  applicationStage: string | null
  eventType: JobEventType
  title: string
  /** ISO 本地时间字符串 */
  eventAt: string
  /** = eventAt + durationMinutes，未填时长时为 null */
  endAt: string | null
  durationMinutes: number | null
  eventMode: JobEventMode | null
  location: string | null
  note: string | null
  status: JobEventStatus
  createdAt: string
  updatedAt: string
}

/**
 * 新建 / 修改日程。
 *
 * ⚠️ 后端新建和修改共用同一个 DTO（字段与校验完全一致，修改是整体覆盖），
 * 所以这里也只有一个类型。
 */
export interface JobEventSaveDTO {
  jobId: string
  eventType: JobEventType
  title: string
  /** ISO 本地时间字符串，如 2026-10-20T14:00:00 */
  eventAt: string
  durationMinutes?: number | null
  eventMode?: JobEventMode | null
  location?: string | null
  note?: string | null
  status?: JobEventStatus
}

/** 日程类型 → 中文标签（日历、标签墙共用） */
export const JOB_EVENT_TYPE_LABELS: Record<JobEventType, string> = {
  WRITTEN_TEST: '笔试',
  INTERVIEW_1: '一面',
  INTERVIEW_2: '二面',
  HR: 'HR 面',
  OFFER_TALK: '谈薪',
  OTHER: '其他',
}

/** 面试形式 → 中文标签 */
export const JOB_EVENT_MODE_LABELS: Record<JobEventMode, string> = {
  ONSITE: '现场',
  ONLINE: '线上',
  PHONE: '电话',
}

// ---------- 用户端：AI 能力状态 ----------

/**
 * AI 引擎状态。前端据此决定首页徽章的颜色与文案。
 *
 * ⚠️ 后端刻意**不返回模型名** —— 只回答「能不能用」。模型会换、会降级，
 * 把它摊到用户端没有好处。
 */
export type AiEngineStatus =
  /** 服务连得上、模型密钥也配好了 */
  | 'READY'
  /** 服务活着但模型没配全（缺 key）—— AI 功能会全部报「未配置模型」 */
  | 'DEGRADED'
  /** 服务连不上或探测超时 */
  | 'OFFLINE'

export interface AiStatusVO {
  status: AiEngineStatus
  /** AI 模型密钥是否已配置（配合 status 排查用） */
  llmConfigured: boolean
}

// ---------- 管理端：高危操作二次确认 ----------

/**
 * 二次确认临时凭证。
 *
 * 后端对「删用户 / 批量删用户 / 删角色」这类不可逆操作要求带凭据：
 * 优先 `X-Confirm-Token`（本凭证，Redis 存 5 分钟、用过即核销），
 * 备选 `X-Confirm-Password`（直接带密码）。
 *
 * 前端走前者 —— 密码只在换凭证时发一次，不在每个请求里重复传。
 */
export interface ConfirmTokenVO {
  /** 放进 `X-Confirm-Token` 请求头 */
  confirmToken: string
  /** 有效时长（秒） */
  expiresInSeconds: number
}

// ---------- 用户端：薪酬估算 ----------

/**
 * 薪酬估算入参。
 *
 * ★ 刻意不要求绑简历：绑了就得先上传、先解析，门槛比收益还高。
 * 只要城市、岗位、年限三个必填，其余都是微调项。
 */
export interface SalaryEstimateDTO {
  city: string
  position: string
  yearsOfExperience: number
  /** 大专 / 本科 / 硕士 / 博士 */
  education?: string
  /** 大厂 / 中厂 / 创业 / 国企 / 外企 */
  companyType?: string
  /** 技术栈，最多 20 个 */
  skills?: string[]
  /** 当前年包（元），填了可以给涨幅参考 */
  currentAnnualSalary?: number
}

/**
 * 估算结果的置信度。
 *
 * ⚠️ 这是**服务端按规则钳制后**的值，不是模型自评 ——
 * 城市 / 岗位 / 年限不在常见组合里时会被降档。
 */
export type SalaryConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * 薪酬估算结果。
 *
 * ★ 金额单位是**元**（不是 K、也不是万），展示时前端自己换算 ——
 * 后端存一个明确的数，比存「25.5」再靠约定猜单位可靠。
 *
 * ★ 这是 AI 估算，不是市场行情：所以没有「样本量 / 数据来源」这类字段，
 * 并且一定带 `caveat`（免责声明）。
 */
export interface SalaryEstimateVO {
  id: string
  city: string
  position: string
  yearsOfExperience: number
  education: string | null
  companyType: string | null
  skills: string[]
  currentAnnualSalary: number | null
  /** 月薪 P50 / P75 / P90（元） */
  monthlyP50: number | null
  monthlyP75: number | null
  monthlyP90: number | null
  /** 年包 P50 / P75 / P90（元） */
  annualP50: number | null
  annualP75: number | null
  annualP90: number | null
  /** 一年发几个月（12~16），模型没给出时为空 */
  monthsPerYear: number | null
  confidence: SalaryConfidence | null
  /** 估算依据，2~4 条 */
  basis: string[]
  /** 加减分项，0~4 条 */
  factors: string[]
  /** 免责声明（服务端固定文案，不要在前端改写或隐藏） */
  caveat: string | null
  /** 是否命中 7 天缓存（同参数直接复用上次结果） */
  cached: boolean
  createdAt: string
}

/** 回收站支持的资源类型（一期只有这两种：删除时没有物理清理，恢复是完整的） */
export type RecycleResourceType = 'OFFER' | 'JOB_EVENT'

/** 回收站记录 */
export interface RecycleBinVO {
  /** 回收站记录 id —— 恢复与彻底删除都用它，**不是**原资源 id */
  id: string
  resourceType: RecycleResourceType
  /** 类型中文名（服务端给，前端不自己映射，避免两处维护） */
  resourceTypeName: string
  /** 原资源 id */
  resourceId: string
  /** 展示名（公司名 / 日程标题） */
  title: string
  deletedAt: string
  /** 到期时间，过了就不能再恢复 */
  expireAt: string
  /** 剩余可恢复天数，0 表示今天到期 */
  remainingDays: number
}
