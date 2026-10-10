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

/** 职位列表行（Java 的 `JobVO`） */
export interface JobVO {
  id: string
  title: string
  companyName: string | null
  location: string | null
  experienceRequired: string | null
  educationRequired: string | null
  parseStatus: ResumeParseStatus
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
 * ⚠️ 和 Create 的区别：**没有必填项**，另外多了 `status`。
 *    后端是「传了才改」的语义。
 */
export interface JobUpdateDTO {
  title?: string
  companyName?: string
  location?: string
  sourceUrl?: string
  experienceRequired?: string
  educationRequired?: string
  jobDescription?: string
  status?: number
}

/**
 * 职位列表查询。
 * ⚠️ 用类型别名而不是 `interface JobQuery extends PageQuery {}` ——
 *    空接口继承会被 ESLint 的 no-empty-object-type 拦下，而且它确实没有意义。
 *    留这个别名是为了调用方能写 JobQuery，比裸用 PageQuery 语义清楚。
 */
export type JobQuery = PageQuery

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
