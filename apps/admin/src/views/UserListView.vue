<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import type { UserSummaryVO } from '@mindforge/shared'

import { userApi } from '@/api/user'
import StatusTag from '@/components/StatusTag.vue'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const rows = ref<UserSummaryVO[]>([])
const total = ref(0)

/**
 * 查询条件。
 *
 * ⚠️ `status` 用 `undefined` 表示「不筛」，**不能用 0** ——
 * 0 是有意义的取值（禁用）。拿它当「不筛」的话，选「禁用」和「全部」会变成同一个结果。
 */
const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: undefined as number | undefined,
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await userApi.page({
      page: query.page,
      pageSize: query.pageSize,
      // 空串要转成 undefined：否则会拼成 `keyword=` 发过去，
      // 后端拿到的是「空字符串」而不是「没传」，匹配逻辑会不一样
      keyword: query.keyword.trim() || undefined,
      status: query.status,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  // 换条件要回到第一页 —— 否则可能停在一个新结果集里不存在的页码上，看到空列表
  query.page = 1
  void load()
}

function onReset(): void {
  query.keyword = ''
  query.status = undefined
  onSearch()
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <div class="filters">
      <el-input
        v-model="query.keyword"
        placeholder="用户名 / 昵称"
        clearable
        class="filters__input"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select v-model="query.status" placeholder="状态" clearable class="filters__select">
        <el-option label="启用" :value="1" />
        <el-option label="禁用" :value="0" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="120">
        <template #default="{ row }">{{ row.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180">
        <template #default="{ row }">{{ row.email || '-' }}</template>
      </el-table-column>
      <el-table-column label="角色" min-width="190">
        <template #default="{ row }">
          <span class="roles">
            <StatusTag v-for="r in row.roles" :key="r" tone="info">{{ r }}</StatusTag>
            <span v-if="!row.roles.length">-</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <StatusTag :tone="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </StatusTag>
        </template>
      </el-table-column>
      <el-table-column label="最后登录" width="170">
        <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <template #empty>没有匹配的用户</template>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @change="load"
    />
  </el-card>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--mf-space-3);
  margin-bottom: var(--mf-space-4);
}

.filters__input {
  width: 240px;
}

.filters__select {
  width: 140px;
}

.roles {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.pagination {
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
