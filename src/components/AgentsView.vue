<template>
  <div class="h-full overflow-y-auto p-6 space-y-6">
    <!-- Top Summary Banner -->
    <div class="glass-panel rounded-2xl p-5 border border-slate-200/80 dark:border-dark-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
      <div class="space-y-1">
        <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>多 Agent 统一适配中枢</span>
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-medium">
            自动探测引擎就绪
          </span>
        </h2>
        <p class="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          已自动适配 Claude Code、Google Antigravity、Codex/OpenCode、Cursor、Windsurf、ZCode、DSH 等 16 款主流 Agent。
          开启 Agent 后，中央技能库将秒级无损挂载。未启用的 Agent 将在技能矩阵与规则中心全局隐藏。
        </p>
      </div>

      <div class="flex items-center gap-2.5 flex-shrink-0">
        <button
          @click="store.addAgentModal.visible = true"
          class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
        >
          <Plus class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>添加自定义 Agent</span>
        </button>

        <button
          @click="store.scanAgents()"
          :disabled="store.isLoading"
          class="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-brand-500/20"
        >
          <RefreshCw class="w-3.5 h-3.5 text-white" :class="{ 'animate-spin': store.isLoading }" />
          <span>重新扫描本机</span>
        </button>
      </div>
    </div>

    <!-- Search & Filter Bar for Agents -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-1">
      <div class="relative flex-1 max-w-md">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索 Agent 名称、私有规则文件名、路径..."
          class="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition shadow-sm"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quick Stats / Badges -->
      <div class="flex items-center gap-2 text-xs">
        <div class="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
          <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{{ enabledList.length }} 已启用</span>
        </div>
        <div class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
          <PauseCircle class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>{{ disabledList.length }} 未启用</span>
        </div>
      </div>
    </div>

    <!-- SECTION 1: ENABLED AGENTS -->
    <div class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          <span>已启用 Agent 矩阵 ({{ enabledList.length }})</span>
        </h3>
        <span class="text-[11px] text-slate-500">已接入中央技能库分发与规则管理</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AgentCard
          v-for="agent in enabledList"
          :key="agent.id"
          :agent="agent"
        />
      </div>

      <div v-if="enabledList.length === 0" class="glass-panel rounded-2xl p-8 text-center text-slate-500 border border-slate-200 dark:border-dark-800">
        <Bot class="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <p class="text-xs">暂无已启用的 Agent，可在下方列表中一键开启常用智能体</p>
      </div>
    </div>

    <!-- SECTION 2: DISABLED AGENTS -->
    <div v-if="disabledList.length > 0" class="space-y-3 pt-4 border-t border-slate-200 dark:border-dark-800/80">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600"></span>
          <span>未启用 / 待激活 Agent ({{ disabledList.length }})</span>
        </h3>
        <button
          @click="enableAllDisabled"
          class="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 font-medium transition"
        >
          <Zap class="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>全部一键启用</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AgentCard
          v-for="agent in disabledList"
          :key="agent.id"
          :agent="agent"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import AgentCard from './AgentCard.vue';
import {
  Plus,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  PauseCircle,
  Zap,
  Bot,
} from 'lucide-vue-next';

const store = useAppStore();
const searchQuery = ref('');

const filteredAgents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return store.agents;
  return store.agents.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.id.toLowerCase().includes(q) ||
    a.skillsDir.toLowerCase().includes(q) ||
    a.localRuleFilename.toLowerCase().includes(q)
  );
});

const enabledList = computed(() => {
  return filteredAgents.value.filter(a => a.enabled);
});

const disabledList = computed(() => {
  return filteredAgents.value.filter(a => !a.enabled);
});

async function enableAllDisabled() {
  for (const a of disabledList.value) {
    await store.toggleAgentEnable(a.id, true);
  }
}
</script>
