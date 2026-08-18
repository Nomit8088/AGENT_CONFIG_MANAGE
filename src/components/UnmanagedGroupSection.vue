<template>
  <div class="glass-panel rounded-2xl p-4 border border-slate-200/80 dark:border-dark-800 bg-white/80 dark:bg-dark-900/60 space-y-4 shadow-sm">
    <!-- Header & Action Row -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-200/60 dark:border-transparent">
          <FolderSearch class="w-4 h-4" />
        </div>
        <div>
          <h3 class="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>本地存量 Skill 检测与纳管 (Agent Skills)</span>
            <span
              v-if="store.totalUnmanagedCount > 0"
              class="text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-mono font-bold animate-pulse"
            >
              {{ store.totalUnmanagedCount }} 个待纳管
            </span>
            <span v-else class="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-mono font-medium">
              全部受控
            </span>
          </h3>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            按 Agent 归类扫描本地未受控实体文件夹。点击卡片可快速纳入中央库或标记为私有忽略。
          </p>
        </div>
      </div>

      <!-- Controls: Filter, Sort & Scan -->
      <div class="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
        <!-- Search Input -->
        <div class="relative flex-1 md:w-48">
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索 Agent / 目录..."
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X class="w-3 h-3" />
          </button>
        </div>

        <!-- Filter Dropdown -->
        <select
          v-model="statusFilter"
          class="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-brand-500"
        >
          <option value="all">全部 Agent ({{ store.enabledAgents.length }})</option>
          <option value="unmanaged">仅显示有待纳管</option>
          <option value="clean">仅显示全部受控</option>
        </select>

        <!-- Sort Dropdown -->
        <select
          v-model="sortKey"
          class="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-brand-500"
        >
          <option value="unmanaged_desc">待纳管数量 (从多到少)</option>
          <option value="name_asc">Agent 名称 (A-Z)</option>
        </select>

        <!-- Rescan Button -->
        <button
          @click="store.scanUnmanaged()"
          class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 transition flex items-center gap-1"
          title="重新扫描各 Agent 目录"
        >
          <RefreshCw class="w-3 h-3" />
          <span>重新检测</span>
        </button>
      </div>
    </div>

    <!-- Agent Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="agent in displayAgents"
        :key="agent.id"
        @click="store.openAgentDetailModal(agent.id, 'unmanaged')"
        :class="[
          'p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between group relative overflow-hidden',
          getAgentUnmanagedCount(agent.id) > 0
            ? 'bg-amber-50/60 dark:bg-amber-500/5 border-amber-300 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500/60 shadow-sm'
            : 'bg-white dark:bg-dark-950/60 border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
        ]"
      >
        <div>
          <!-- Card Header -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 flex items-center justify-center group-hover:scale-105 transition">
                <AgentBrandIcon :agentId="agent.id" size="sm" />
              </div>
              <span class="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition truncate max-w-[120px]">
                {{ agent.name }}
              </span>
            </div>

            <span
              :class="[
                'w-2 h-2 rounded-full',
                agent.detected ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-600'
              ]"
            ></span>
          </div>

          <!-- Path -->
          <div class="text-[10px] text-slate-500 font-mono truncate mb-3" :title="agent.skillsDir">
            {{ agent.skillsDir }}
          </div>
        </div>

        <!-- Badges & Action -->
        <div class="pt-2 border-t border-slate-100 dark:border-dark-800/60 flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-2">
            <span
              v-if="getAgentUnmanagedCount(agent.id) > 0"
              class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-semibold font-mono"
            >
              {{ getAgentUnmanagedCount(agent.id) }} 待纳管
            </span>
            <span v-else class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-mono">
              0 实体
            </span>

            <span
              v-if="getAgentIgnoredCount(agent.id) > 0"
              class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-800 font-mono"
              title="已忽略私有技能"
            >
              {{ getAgentIgnoredCount(agent.id) }} 忽略
            </span>
          </div>

          <div class="flex items-center text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 text-xs transition">
            <span>管理</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="displayAgents.length === 0" class="py-6 text-center text-slate-500 text-xs">
      未匹配到符合筛选条件的 Agent
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  FolderSearch,
  RefreshCw,
  ChevronRight,
  Search,
  X,
} from 'lucide-vue-next';

const store = useAppStore();
const searchQuery = ref('');
const statusFilter = ref<'all' | 'unmanaged' | 'clean'>('all');
const sortKey = ref<'unmanaged_desc' | 'name_asc'>('unmanaged_desc');

function getAgentUnmanagedCount(agentId: string) {
  return store.unmanagedByAgent(agentId).length;
}

function getAgentIgnoredCount(agentId: string) {
  return store.ignoredByAgent(agentId).length;
}

const displayAgents = computed(() => {
  let list = [...store.enabledAgents];

  // 1. Search Query
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.skillsDir.toLowerCase().includes(q)
    );
  }

  // 2. Status Filter
  if (statusFilter.value === 'unmanaged') {
    list = list.filter(a => getAgentUnmanagedCount(a.id) > 0);
  } else if (statusFilter.value === 'clean') {
    list = list.filter(a => getAgentUnmanagedCount(a.id) === 0);
  }

  // 3. Sort
  list.sort((a, b) => {
    if (sortKey.value === 'unmanaged_desc') {
      const diff = getAgentUnmanagedCount(b.id) - getAgentUnmanagedCount(a.id);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  return list;
});
</script>
