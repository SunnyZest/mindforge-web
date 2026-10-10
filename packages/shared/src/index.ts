/**
 * `@mindforge/shared` 的统一出口。
 *
 * ⚠️ 这里用显式的 `export type` / `export` 而不是 `export *`：
 * 项目开了 `verbatimModuleSyntax`，类型必须用 `export type` 才能保证
 * 编译后不会留下一条指向不存在东西的 import。
 */

// ---------- 类型（后端 VO / DTO 的对应物）----------
export type {
  Result,
  PageResult,
  PageQuery,
  LoginDTO,
  LoginVO,
  TokenVO,
  UserInfoVO,
  UserSummaryVO,
  UserListQuery,
  // 用户端：注册 / 改密 / 个人资料
  RegisterDTO,
  ChangePasswordDTO,
  UserProfileVO,
  UserProfileUpdateDTO,
  // 用户管理（写操作）
  AdminUserCreateDTO,
  UserUpdateDTO,
  UserStatusDTO,
  AssignRolesDTO,
  // 角色与权限
  RoleVO,
  PermissionVO,
  RoleCreateDTO,
  RoleUpdateDTO,
  AssignPermissionsDTO,
  // 知识库 / 文档 / 分块
  AdminKnowledgeBaseVO,
  AdminKnowledgeBaseQuery,
  AdminDocumentVO,
  AdminDocumentQuery,
  DocumentStatusUpdateDTO,
  ChunkVO,
  ParseStatus,
  ChunkStatus,
  VectorStatus,
  // AI 模型
  AiModelVO,
  AiModelCreateDTO,
  AiModelUpdateDTO,
  AiScene,
  // 审计日志 / 仪表盘
  AuditLogVO,
  AuditLogQuery,
  DashboardVO,
  // 用户端：简历
  ResumeParseStatus,
  SkillType,
  ProficiencyLevel,
  OptimizeTarget,
  ResumeVO,
  ResumeQuery,
  ResumeDetailVO,
  ResumeParsedVO,
  StructuredResume,
  ResumeSkill,
  ResumeEducation,
  ResumeWorkExperience,
  ResumeProject,
  ResumeOptimizeDTO,
  ResumeOptimizeVO,
  ResumeOptimizeItem,
  // 用户端：职位 JD
  JobVO,
  JobQuery,
  JobDetailVO,
  JobCreateDTO,
  JobUpdateDTO,
  StructuredJob,
  JobSkill,
  // 用户端：模拟面试
  InterviewType,
  InterviewDifficulty,
  InterviewStatus,
  QuestionType,
  InterviewVO,
  InterviewQuery,
  InterviewDetailVO,
  InterviewQuestionVO,
  InterviewAnalysis,
  InterviewCreateDTO,
  InterviewAnswerDTO,
  InterviewAnswerResultVO,
  InterviewReportVO,
  // 用户端：知识库 / 文档 / 分块
  KnowledgeBaseVO,
  KnowledgeBaseCreateDTO,
  KnowledgeBaseUpdateDTO,
  KnowledgeBaseStatsVO,
  DocumentVO,
  DocumentStatusVO,
  // ChunkVO 上面已经导出过（管理端在用），这里不重复 —— 同一个类型别导出两次
  // 用户端：对话问答（RAG）
  SourceVO,
  ConversationVO,
  ConversationDetailVO,
  MessageVO,
  CreateConversationDTO,
  SendMessageDTO,
  SendMessageResultVO,
  RagSearchDTO,
  RagFeedbackDTO,
  ChatStreamSourcesEvent,
  ChatStreamDeltaEvent,
  ChatStreamDoneEvent,
  ChatStreamErrorEvent,
  // 管理端：Prompt 管理 / AI 用量
  PromptStatus,
  PromptVO,
  PromptGroupVO,
  PromptCreateDTO,
  PromptUpdateDTO,
  UsageSummaryVO,
  UsageDailyVO,
  UsageByModelVO,
  UsageQuery,
} from './types'

// ---------- HTTP 客户端 ----------
export { createHttp, BizError, HttpError } from './http'
export type { HttpClient, HttpClientOptions } from './http'

// ---------- token 存储 ----------
export { createTokenStore } from './auth'
export type { TokenStore } from './auth'

// ---------- 权限 ----------
export { hasPermission, hasAnyPermission, hasAllPermissions } from './permission'
export type { Permission, AdminPermission, AppPermission } from './permission'

// ---------- 主题（两端共用，不依赖框架）----------
export { THEME_ATTR, normalizeTheme, readStoredTheme, applyTheme, persistTheme } from './theme'
export type { ThemeMode } from './theme'

// ---------- 展示用的格式化（纯函数，两端共用）----------
export { formatDateTime, formatCount, formatBytes } from './format'
