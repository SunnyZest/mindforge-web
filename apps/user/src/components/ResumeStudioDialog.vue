<script setup lang="ts">
import { Check, Delete, Download, Plus, RefreshLeft } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'

import {
  BizError,
  type ResumeDetailVO,
  type StructuredResume,
} from '@mindforge/shared'

import { resumeApi } from '@/api/resume'

const props = defineProps<{
  modelValue: boolean
  detail: ResumeDetailVO | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [updated: ResumeDetailVO]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const saving = ref(false)
const activeTab = ref<'basic' | 'work' | 'projects' | 'edu' | 'raw'>('basic')

/** 本地可编辑副本 */
const resumeTitle = ref('')
const rawContent = ref('')
const form = ref<StructuredResume>( createEmptyStructured() )
const skillsText = ref('')
const certsText = ref('')

function createEmptyStructured(): StructuredResume {
  return {
    name: '',
    phone: '',
    email: '',
    location: '',
    targetPosition: '',
    summary: '',
    selfEvaluation: '',
    yearsOfExperience: null,
    education: [],
    workExperience: [],
    projects: [],
    skills: [],
    certificates: [],
  }
}

function initFromDetail(d: ResumeDetailVO | null): void {
  if (!d) return
  resumeTitle.value = d.name || '个人简历'
  rawContent.value = d.rawContent || ''
  const s = d.structuredJson
  form.value = {
    name: s?.name ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    location: s?.location ?? '',
    targetPosition: s?.targetPosition ?? d.targetPosition ?? '',
    summary: s?.summary ?? d.summary ?? '',
    selfEvaluation: s?.selfEvaluation ?? '',
    yearsOfExperience: s?.yearsOfExperience ?? null,
    education: (s?.education ?? []).map((e) => ({ ...e })),
    workExperience: (s?.workExperience ?? []).map((w) => ({ ...w })),
    projects: (s?.projects ?? []).map((p) => ({
      ...p,
      techStack: [...(p.techStack ?? [])],
    })),
    skills: (s?.skills ?? []).map((sk) => ({ ...sk })),
    certificates: [...(s?.certificates ?? [])],
  }
  skillsText.value = form.value.skills.map((sk) => sk.name).join('、')
  certsText.value = form.value.certificates.join('\n')
}

watch(
  () => [props.modelValue, props.detail] as const,
  ([open, d]) => {
    if (open && d) {
      initFromDetail(d)
    }
  },
  { immediate: true },
)

function syncSkillsAndCerts(): void {
  const names = skillsText.value
    .split(/[,，、;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const existingMap = new Map(form.value.skills.map((s) => [s.name, s]))
  form.value.skills = names.map((name) => existingMap.get(name) ?? {
    name,
    type: null,
    proficiency: null,
    years: null,
  })
  form.value.certificates = certsText.value
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function addWork(): void {
  form.value.workExperience.push({
    company: '',
    position: '',
    startDate: '',
    endDate: '至今',
    description: '',
  })
}

function removeWork(idx: number): void {
  form.value.workExperience.splice(idx, 1)
}

function addProject(): void {
  form.value.projects.push({
    name: '',
    role: '',
    description: '',
    techStack: [],
  })
}

function removeProject(idx: number): void {
  form.value.projects.splice(idx, 1)
}

function addEdu(): void {
  form.value.education.push({
    school: '',
    major: '',
    degree: '本科',
    startYear: 2020,
    endYear: 2024,
  })
}

function removeEdu(idx: number): void {
  form.value.education.splice(idx, 1)
}

/** 根据结构化表单重新生成干净的 Markdown 原文，保证后续 AI 面试与岗位匹配读到最新文本 */
function syncStructuredToRaw(): void {
  syncSkillsAndCerts()
  const s = form.value
  const lines: string[] = []
  lines.push(`# ${s.name || resumeTitle.value || '个人简历'}`)
  const meta = [
    s.targetPosition ? `求职意向：${s.targetPosition}` : '',
    s.phone ? `电话：${s.phone}` : '',
    s.email ? `邮箱：${s.email}` : '',
    s.location ? `城市：${s.location}` : '',
    s.yearsOfExperience !== null && s.yearsOfExperience !== undefined
      ? `工作经验：${s.yearsOfExperience}年`
      : '',
  ].filter(Boolean)
  if (meta.length) lines.push(meta.join(' | '))

  if (s.summary) {
    lines.push('\n## 个人总结\n' + s.summary.trim())
  }
  if (s.skills.length) {
    lines.push('\n## 专业技能\n' + s.skills.map((k) => k.name).join('、'))
  }
  if (s.workExperience.length) {
    lines.push('\n## 工作经历')
    for (const w of s.workExperience) {
      lines.push(`### ${w.company || '公司'} · ${w.position || '岗位'} (${w.startDate || ''} ~ ${w.endDate || '至今'})`)
      if (w.description) lines.push(w.description.trim())
    }
  }
  if (s.projects.length) {
    lines.push('\n## 项目经历')
    for (const p of s.projects) {
      const stack = p.techStack?.length ? ` [${p.techStack.join(', ')}]` : ''
      lines.push(`### ${p.name || '项目'}${p.role ? ' · ' + p.role : ''}${stack}`)
      if (p.description) lines.push(p.description.trim())
    }
  }
  if (s.education.length) {
    lines.push('\n## 教育经历')
    for (const e of s.education) {
      lines.push(`- ${e.school} | ${e.major || ''} | ${e.degree || ''} (${e.startYear ?? ''} - ${e.endYear ?? ''})`)
    }
  }
  if (s.certificates.length) {
    lines.push('\n## 证书与荣誉\n' + s.certificates.map((c) => `- ${c}`).join('\n'))
  }
  if (s.selfEvaluation) {
    lines.push('\n## 自我评价\n' + s.selfEvaluation.trim())
  }
  rawContent.value = lines.join('\n')
  ElMessage.success('已根据结构化内容同步更新简历原文')
}

async function onSave(): Promise<void> {
  if (!props.detail) return
  syncSkillsAndCerts()
  saving.value = true
  try {
    const updated = await resumeApi.update(props.detail.id, {
      name: resumeTitle.value.trim() || props.detail.name,
      targetPosition: form.value.targetPosition || undefined,
      summary: form.value.summary || undefined,
      rawContent: rawContent.value,
      structuredJson: form.value,
    })
    ElMessage.success('简历精修内容已保存')
    emit('saved', updated)
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '保存简历失败')
  } finally {
    saving.value = false
  }
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 导出高清矢量 A4 PDF（通过独立打印窗口渲染标准 A4 样式，可选中文字、兼容大厂 ATS 解析） */
function onExportPdf(): void {
  syncSkillsAndCerts()
  const s = form.value
  const docTitle = escapeHtml(s.name || resumeTitle.value || '个人简历')
  const contactItems = [
    s.targetPosition ? `意向岗位：${escapeHtml(s.targetPosition)}` : '',
    s.phone ? escapeHtml(s.phone) : '',
    s.email ? escapeHtml(s.email) : '',
    s.location ? escapeHtml(s.location) : '',
    s.yearsOfExperience !== null && s.yearsOfExperience !== undefined
      ? `${s.yearsOfExperience}年经验`
      : '',
  ].filter(Boolean)

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}${s.targetPosition ? ' - ' + escapeHtml(s.targetPosition) : ''}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 10.5pt;
      line-height: 1.58;
      color: #1f2329;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #1f2329;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header h1 {
      margin: 0 0 6px;
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header .meta {
      font-size: 9.5pt;
      color: #4e5969;
    }
    .sec {
      margin-bottom: 14px;
    }
    .sec-title {
      margin: 0 0 8px;
      padding-bottom: 3px;
      font-size: 11.5pt;
      font-weight: 700;
      color: #1d2129;
      border-bottom: 1px solid #d9d9d9;
      letter-spacing: 0.5px;
    }
    .entry {
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .entry-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 600;
      font-size: 10.5pt;
    }
    .entry-sub {
      font-size: 9.5pt;
      color: #4e5969;
      margin: 2px 0 4px;
    }
    .entry-desc {
      margin: 0;
      white-space: pre-wrap;
      font-size: 10pt;
      color: #272e3b;
    }
    .skills {
      font-size: 10pt;
      color: #272e3b;
    }
    .cert-list {
      margin: 0;
      padding-left: 18px;
      font-size: 10pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${docTitle}</h1>
    <div class="meta">${contactItems.join(' &nbsp;|&nbsp; ')}</div>
  </div>
  ${
    s.summary
      ? `<div class="sec"><h2 class="sec-title">个人总结</h2><p class="entry-desc">${escapeHtml(s.summary)}</p></div>`
      : ''
  }
  ${
    s.skills.length
      ? `<div class="sec"><h2 class="sec-title">专业技能</h2><div class="skills">${s.skills.map((k) => escapeHtml(k.name)).join(' &nbsp;·&nbsp; ')}</div></div>`
      : ''
  }
  ${
    s.workExperience.length
      ? `<div class="sec"><h2 class="sec-title">工作经历</h2>${s.workExperience
          .map(
            (w) => `<div class="entry">
          <div class="entry-head">
            <span>${escapeHtml(w.company)}${w.position ? ' · ' + escapeHtml(w.position) : ''}</span>
            <span>${escapeHtml(w.startDate)} ~ ${escapeHtml(w.endDate || '至今')}</span>
          </div>
          ${w.description ? `<p class="entry-desc">${escapeHtml(w.description)}</p>` : ''}
        </div>`,
          )
          .join('')}</div>`
      : ''
  }
  ${
    s.projects.length
      ? `<div class="sec"><h2 class="sec-title">项目经历</h2>${s.projects
          .map(
            (p) => `<div class="entry">
          <div class="entry-head">
            <span>${escapeHtml(p.name)}${p.role ? ' · ' + escapeHtml(p.role) : ''}</span>
            <span>${p.techStack?.length ? escapeHtml(p.techStack.join(' / ')) : ''}</span>
          </div>
          ${p.description ? `<p class="entry-desc">${escapeHtml(p.description)}</p>` : ''}
        </div>`,
          )
          .join('')}</div>`
      : ''
  }
  ${
    s.education.length
      ? `<div class="sec"><h2 class="sec-title">教育经历</h2>${s.education
          .map(
            (e) => `<div class="entry">
          <div class="entry-head">
            <span>${escapeHtml(e.school)} · ${[e.major, e.degree].filter(Boolean).map(escapeHtml).join(' · ')}</span>
            <span>${e.startYear ?? ''}${e.endYear ? ' ~ ' + e.endYear : ''}</span>
          </div>
        </div>`,
          )
          .join('')}</div>`
      : ''
  }
  ${
    s.certificates.length
      ? `<div class="sec"><h2 class="sec-title">证书与奖项</h2><ul class="cert-list">${s.certificates.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>`
      : ''
  }
  ${
    s.selfEvaluation
      ? `<div class="sec"><h2 class="sec-title">自我评价</h2><p class="entry-desc">${escapeHtml(s.selfEvaluation)}</p></div>`
      : ''
  }
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 150);
    };
  <\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) {
    ElMessage.warning('浏览器拦截了弹出窗口，请允许本站弹窗后重试')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="简历在线精修与高清 A4 PDF 导出"
    width="min(1180px, 92vw)"
    top="4vh"
    :close-on-click-modal="false"
  >
    <div class="studio">
      <!-- 左栏：结构化编辑表单 -->
      <div class="studio__editor">
        <div class="studio__tabs">
          <button
            type="button"
            class="stab"
            :class="{ 'stab--on': activeTab === 'basic' }"
            @click="activeTab = 'basic'"
          >
            基本信息与技能
          </button>
          <button
            type="button"
            class="stab"
            :class="{ 'stab--on': activeTab === 'work' }"
            @click="activeTab = 'work'"
          >
            工作经历 ({{ form.workExperience.length }})
          </button>
          <button
            type="button"
            class="stab"
            :class="{ 'stab--on': activeTab === 'projects' }"
            @click="activeTab = 'projects'"
          >
            项目经历 ({{ form.projects.length }})
          </button>
          <button
            type="button"
            class="stab"
            :class="{ 'stab--on': activeTab === 'edu' }"
            @click="activeTab = 'edu'"
          >
            教育与证书
          </button>
          <button
            type="button"
            class="stab"
            :class="{ 'stab--on': activeTab === 'raw' }"
            @click="activeTab = 'raw'"
          >
            简历原文
          </button>
        </div>

        <div class="studio__form">
          <!-- Tab 1: 基本信息与技能 -->
          <template v-if="activeTab === 'basic'">
            <div class="fgrid">
              <label class="ffield">
                <span>简历档案名称</span>
                <el-input v-model="resumeTitle" maxlength="100" placeholder="例如：Java后端开发_张三" />
              </label>
              <label class="ffield">
                <span>候选人姓名</span>
                <el-input v-model="form.name" maxlength="50" placeholder="真实姓名" />
              </label>
              <label class="ffield">
                <span>目标求职岗位</span>
                <el-input v-model="form.targetPosition" maxlength="128" placeholder="例如：高级 Java 后端工程师" />
              </label>
              <label class="ffield">
                <span>工作年限（年）</span>
                <el-input-number v-model="form.yearsOfExperience" :min="0" :max="50" style="width: 100%" />
              </label>
              <label class="ffield">
                <span>联系电话</span>
                <el-input v-model="form.phone" maxlength="40" placeholder="手机号" />
              </label>
              <label class="ffield">
                <span>电子邮箱</span>
                <el-input v-model="form.email" maxlength="100" placeholder="邮箱地址" />
              </label>
              <label class="ffield ffield--full">
                <span>所在城市</span>
                <el-input v-model="form.location" maxlength="60" placeholder="例如：北京 / 上海 / 深圳" />
              </label>
            </div>

            <label class="ffield">
              <span>个人优势总结（Summary）</span>
              <el-input
                v-model="form.summary"
                type="textarea"
                :rows="4"
                maxlength="2000"
                placeholder="提炼核心技术栈、代表性高并发/架构落地经验与量化成果..."
              />
            </label>

            <label class="ffield">
              <span>核心技术栈（用顿号「、」或逗号分隔）</span>
              <el-input
                v-model="skillsText"
                type="textarea"
                :rows="3"
                placeholder="Java、Spring Boot、MySQL、Redis、Kafka、微服务架构"
                @blur="syncSkillsAndCerts"
              />
            </label>
          </template>

          <!-- Tab 2: 工作经历 -->
          <template v-else-if="activeTab === 'work'">
            <div v-for="(w, idx) in form.workExperience" :key="idx" class="subcard">
              <div class="subcard__head">
                <strong>工作经历 #{{ idx + 1 }}</strong>
                <el-button size="small" text type="danger" :icon="Delete" @click="removeWork(idx)">
                  删除
                </el-button>
              </div>
              <div class="fgrid">
                <label class="ffield">
                  <span>公司名称</span>
                  <el-input v-model="w.company" placeholder="公司名称" />
                </label>
                <label class="ffield">
                  <span>担任职位</span>
                  <el-input v-model="w.position" placeholder="职位名称" />
                </label>
                <label class="ffield">
                  <span>开始时间</span>
                  <el-input v-model="w.startDate" placeholder="如 2023.07" />
                </label>
                <label class="ffield">
                  <span>结束时间</span>
                  <el-input v-model="w.endDate" placeholder="如 至今 或 2025.06" />
                </label>
              </div>
              <label class="ffield">
                <span>工作内容与核心业绩（建议采用 STAR 法则 + 量化指标）</span>
                <el-input v-model="w.description" type="textarea" :rows="4" />
              </label>
            </div>
            <el-button :icon="Plus" @click="addWork">新增一段工作经历</el-button>
          </template>

          <!-- Tab 3: 项目经历 -->
          <template v-else-if="activeTab === 'projects'">
            <div v-for="(p, idx) in form.projects" :key="idx" class="subcard">
              <div class="subcard__head">
                <strong>项目经历 #{{ idx + 1 }}</strong>
                <el-button size="small" text type="danger" :icon="Delete" @click="removeProject(idx)">
                  删除
                </el-button>
              </div>
              <div class="fgrid">
                <label class="ffield">
                  <span>项目名称</span>
                  <el-input v-model="p.name" placeholder="项目名称" />
                </label>
                <label class="ffield">
                  <span>担任角色</span>
                  <el-input v-model="p.role" placeholder="如 核心开发 / 负责人" />
                </label>
              </div>
              <label class="ffield">
                <span>项目背景、架构设计与量化成果</span>
                <el-input v-model="p.description" type="textarea" :rows="4" />
              </label>
            </div>
            <el-button :icon="Plus" @click="addProject">新增一段项目经历</el-button>
          </template>

          <!-- Tab 4: 教育与证书 -->
          <template v-else-if="activeTab === 'edu'">
            <div v-for="(e, idx) in form.education" :key="idx" class="subcard">
              <div class="subcard__head">
                <strong>教育经历 #{{ idx + 1 }}</strong>
                <el-button size="small" text type="danger" :icon="Delete" @click="removeEdu(idx)">
                  删除
                </el-button>
              </div>
              <div class="fgrid">
                <label class="ffield">
                  <span>学校名称</span>
                  <el-input v-model="e.school" placeholder="院校名称" />
                </label>
                <label class="ffield">
                  <span>专业</span>
                  <el-input v-model="e.major" placeholder="专业名称" />
                </label>
                <label class="ffield">
                  <span>学历</span>
                  <el-input v-model="e.degree" placeholder="本科 / 硕士 / 博士" />
                </label>
                <label class="ffield">
                  <span>毕业年份</span>
                  <el-input-number v-model="e.endYear" :min="1980" :max="2035" style="width: 100%" />
                </label>
              </div>
            </div>
            <el-button :icon="Plus" @click="addEdu">新增教育经历</el-button>

            <label class="ffield" style="margin-top: 12px">
              <span>证书与荣誉奖项（每行一条）</span>
              <el-input
                v-model="certsText"
                type="textarea"
                :rows="3"
                placeholder="例如：ACM-ICPC 区域赛银奖&#10;阿里云 ACP 认证"
                @blur="syncSkillsAndCerts"
              />
            </label>
          </template>

          <!-- Tab 5: 简历原文 -->
          <template v-else>
            <div class="raw-toolbar">
              <span>此文本将用于后续 AI 模拟面试出题与职位 JD 匹配分析：</span>
              <el-button size="small" :icon="RefreshLeft" @click="syncStructuredToRaw">
                从左侧结构化表单生成全文
              </el-button>
            </div>
            <el-input
              v-model="rawContent"
              type="textarea"
              :rows="18"
              maxlength="50000"
              show-word-limit
            />
          </template>
        </div>
      </div>

      <!-- 右栏：实时 A4 简历排版预览 -->
      <div class="studio__preview">
        <div class="a4-sheet">
          <header class="a4-head">
            <h2 class="a4-name">{{ form.name || resumeTitle || '姓名' }}</h2>
            <p class="a4-meta">
              {{
                [
                  form.targetPosition ? `意向：${form.targetPosition}` : '',
                  form.phone,
                  form.email,
                  form.location,
                  form.yearsOfExperience !== null && form.yearsOfExperience !== undefined
                    ? `${form.yearsOfExperience}年经验`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </p>
          </header>

          <section v-if="form.summary" class="a4-sec">
            <h3 class="a4-sec__title">个人总结</h3>
            <p class="a4-text">{{ form.summary }}</p>
          </section>

          <section v-if="skillsText.trim()" class="a4-sec">
            <h3 class="a4-sec__title">专业技能</h3>
            <p class="a4-text">{{ skillsText }}</p>
          </section>

          <section v-if="form.workExperience.length" class="a4-sec">
            <h3 class="a4-sec__title">工作经历</h3>
            <div v-for="(w, idx) in form.workExperience" :key="idx" class="a4-item">
              <div class="a4-item__head">
                <strong>{{ w.company }}{{ w.position ? ` · ${w.position}` : '' }}</strong>
                <span>{{ w.startDate }} ~ {{ w.endDate || '至今' }}</span>
              </div>
              <p v-if="w.description" class="a4-text">{{ w.description }}</p>
            </div>
          </section>

          <section v-if="form.projects.length" class="a4-sec">
            <h3 class="a4-sec__title">项目经历</h3>
            <div v-for="(p, idx) in form.projects" :key="idx" class="a4-item">
              <div class="a4-item__head">
                <strong>{{ p.name }}{{ p.role ? ` · ${p.role}` : '' }}</strong>
                <span v-if="p.techStack?.length">{{ p.techStack.join(' / ') }}</span>
              </div>
              <p v-if="p.description" class="a4-text">{{ p.description }}</p>
            </div>
          </section>

          <section v-if="form.education.length" class="a4-sec">
            <h3 class="a4-sec__title">教育经历</h3>
            <div v-for="(e, idx) in form.education" :key="idx" class="a4-item">
              <div class="a4-item__head">
                <strong>{{ e.school }} · {{ [e.major, e.degree].filter(Boolean).join(' · ') }}</strong>
                <span>{{ e.startYear ?? '' }}{{ e.endYear ? ` ~ ${e.endYear}` : '' }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="studio-foot">
        <span class="studio-foot__tip">
          提示：点击「导出高清 A4 PDF」将在打印预览中生成文字可选中、支持大厂 ATS 解析的标准 A4 简历
        </span>
        <div class="studio-foot__btns">
          <el-button @click="visible = false">关闭</el-button>
          <el-button type="success" :icon="Download" @click="onExportPdf">
            导出高清 A4 PDF
          </el-button>
          <el-button type="primary" :icon="Check" :loading="saving" @click="onSave">
            保存修改到简历库
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.studio {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: var(--mf-space-5);
  height: 70vh;
}

@media (max-width: 960px) {
  .studio {
    grid-template-columns: 1fr;
    height: auto;
  }
}

.studio__editor {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  overflow: hidden;
}

.studio__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.stab {
  padding: 6px 12px;
  font-family: inherit;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--mf-radius-sm);
}

.stab--on {
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  background-color: var(--mf-bg-elevated);
  box-shadow: var(--mf-shadow-xs);
}

.studio__form {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding-right: 6px;
  overflow-y: auto;
}

.fgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-3);
}

.ffield {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.ffield--full {
  grid-column: 1 / -1;
}

.subcard {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-3);
  background-color: var(--mf-bg-subtle);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
}

.subcard__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--mf-font-xs);
}

.raw-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
  justify-content: space-between;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.studio__preview {
  padding: var(--mf-space-4);
  overflow-y: auto;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-lg);
}

.a4-sheet {
  min-height: 100%;
  padding: 28px 32px;
  color: #1f2329;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.a4-head {
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 2px solid #1f2329;
}

.a4-name {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.a4-meta {
  margin: 0;
  font-size: 12px;
  color: #4b5563;
}

.a4-sec {
  margin-bottom: 12px;
}

.a4-sec__title {
  padding-bottom: 3px;
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  border-bottom: 1px solid #e5e7eb;
}

.a4-item {
  margin-bottom: 8px;
}

.a4-item__head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 12.5px;
  color: #111827;
}

.a4-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
}

.studio-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.studio-foot__tip {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.studio-foot__btns {
  display: flex;
  gap: var(--mf-space-2);
}
</style>
