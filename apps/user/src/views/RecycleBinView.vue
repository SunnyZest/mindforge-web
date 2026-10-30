<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { BizError, type RecycleBinVO } from '@mindforge/shared'

import { recycleApi } from '@/api/recycle'
import { useSecondaryConfirm } from '@/composables/useSecondaryConfirm'

/**
 * 最近删除（回收站）。
 *
 * ★ 这一页的语义要说清楚：**恢复不是「撤销操作」**。
 *   它只是把逻辑删除改回去，不还原删除之后发生的任何变化。
 *   一期只收 Offer 与面试日程 —— 这两种删除时没有物理清理，恢复是完整的。
 *
 * ★ 恢复窗口 30 天与 OSS 对象保留期对齐：文件都被清了还允许「恢复」，
 *   恢复出来只会是个空壳。
 */

const { runConfirm } = useSecondaryConfirm()

const loading = ref(false)
const records = ref<RecycleBinVO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
/** 正在恢复的那条 —— 只转它自己的按钮，不锁整张表 */
const restoringId = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await recycleApi.page({ page: page.value, pageSize: pageSize.value })
    records.value = data.records
    total.value = data.total
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '加载回收站失败')
  } finally {
    loading.value = false
  }
}

async function restore(row: RecycleBinVO): Promise<void> {
  restoringId.value = row.id
  try {
    const result = await recycleApi.restore(row.id)

    // ★ 不完整必须说清楚：主记录回来了、关联数据没回来。
    //   只报成功的话，用户要打开详情才发现技能/题目/消息少了一半。
    if (result.complete) {
      ElMessage.success(`已恢复「${row.title}」`)
    } else {
      ElMessage.warning(`已恢复「${row.title}」，但${result.warning ?? '关联数据没有回来'}`)
    }
    await load()
  } catch (e) {
    // 常见两种：过了恢复期、原记录已经被恢复过一次
    ElMessage.error(e instanceof BizError ? e.message : '恢复失败，请稍后重试')
  } finally {
    restoringId.value = null
  }
}

async function purge(row: RecycleBinVO): Promise<void> {
  try {
    // 不可逆 + 后端强制要求凭据：弹框收密码 → 换一次性 token → 带头发请求。
    // 文案里把「名称」念出来，防止点错行。
    const res = await runConfirm({
      message: `「${row.title}」将被永久删除，无法恢复。请输入登录密码确认。`,
      title: '彻底删除',
      action: (confirmToken) => recycleApi.purge(row.id, confirmToken),
    })
    // 用户点了取消 —— 正常操作，不当错误处理
    if (!res.ok) return

    ElMessage.success('已彻底删除')
    await load()
  } catch (e) {
    // 密码错误、凭据过期（40305）都会走到这里，BizError 带着后端的话
    ElMessage.error(e instanceof BizError ? e.message : '删除失败，请稍后重试')
  }
}

/** 后端给的是 ISO 串，列表里只要到分钟 */
function formatTime(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h2 class="page__title">最近删除</h2>
        <p class="page__desc">
          删除的 Offer 与面试日程会先放在这里，<strong>30 天内可以恢复</strong>。
          过期后无法找回 —— 恢复只是把删除标记去掉，不会还原删除之后做过的修改。
        </p>
      </div>
    </header>

    <el-card class="page__card" shadow="never">
      <el-table v-loading="loading" :data="records" empty-text="回收站是空的">
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.resourceTypeName }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="title" label="名称" min-width="180" show-overflow-tooltip />

        <el-table-column label="删除时间" width="160">
          <template #default="{ row }">{{ formatTime(row.deletedAt) }}</template>
        </el-table-column>

        <el-table-column label="剩余" width="110">
          <template #default="{ row }">
            <!-- 3 天内标红：这是「再不恢复就真没了」的提示，不该是普通灰字 -->
            <span :class="{ 'rb__expiring': row.remainingDays <= 3 }">
              {{ row.remainingDays }} 天
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="170" align="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              :loading="restoringId === row.id"
              @click="restore(row as RecycleBinVO)"
            >
              恢复
            </el-button>
            <el-button type="danger" link @click="purge(row as RecycleBinVO)">彻底删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        class="rb__pager"
        @current-change="load"
      />
    </el-card>
  </div>
</template>

<style scoped>
.rb__expiring {
  color: var(--mf-danger-text);
  font-weight: var(--mf-weight-medium);
}

.rb__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
