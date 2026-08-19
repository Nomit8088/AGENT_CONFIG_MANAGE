<template>
  <div class="h-full overflow-y-auto p-6 space-y-6">
    <!-- Top Summary Banner -->
    <div class="bg-white dark:bg-[#2c2c2e] rounded-xl p-5 border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors duration-200">
      <div class="space-y-1.5">
        <h2 class="font-serif font-semibold text-base text-slate-900 dark:text-white/95 flex items-center gap-2">
          <span>多 Agent 统一适配中枢</span>
          <span class="text-xs px-2.5 py-0.5 rounded-lg bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8 font-sans font-normal">
            自动探测引擎就绪
          </span>
        </h2>
        <p class="text-xs text-slate-600 dark:text-white/70 max-w-2xl leading-relaxed">
          已自动适配 Claude Code、Google Antigravity、Codex/OpenCode、Cursor、Windsurf、ZCode、DeepSeek HARNESS 等 16 款主流 Agent。
          开启 Agent 后，中央技能库将秒级无损挂载。未启用的 Agent 将在技能矩阵与规则中心全局隐藏。
        </p>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          @click="store.addAgentModal.visible = true"
          class="px-3.5 py-2 rounded-lg bg-transparent text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 hover:bg-black/5 dark:hover:bg-white/8 border border-black/10 dark:border-white/12 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
        >
          <Plus class="w-3.5 h-3.5 text-slate-600 dark:text-white/80" />
          <span>添加自定义 Agent</span>
        </button>

        <button
          @click="store.scanAgents()"
          :disabled="store.isLoading"
          class="px-3.5 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 disabled:opacity-50 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
        >
          <RefreshCw class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" :class="{ 'animate-spin': store.isLoading }" />
          <span>重新扫描本机</span>
        </button>
      </div>
    </div>

    <!-- Search & Filter Bar for Agents -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-1">
      <div class="relative flex-1 max-w-md">
        <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索 Agent 名称、私有规则文件名、路径..."
          class="w-full bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quick Stats / Badges -->
      <div class="flex items-center gap-2 text-xs">
        <div class="px-3 py-1.5 rounded-lg bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 text-slate-700 dark:text-white/80 flex items-center gap-1.5 font-medium">
          <span class="w-2 h-2 rounded-sm bg-[#30d158]"></span>
          <span>{{ enabledList.length }} 已启用</span>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 text-slate-500 dark:text-white/60 flex items-center gap-1.5 font-medium">
          <span class="w-2 h-2 rounded-sm bg-slate-300 dark:bg-white/30"></span>
          <span>{{ disabledList.length }} 未启用</span>
        </div>
      </div>
    </div>

    <!-- SECTION 1: ENABLED AGENTS -->
    <div class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <h3 class="font-serif text-xs font-semibold text-slate-900 dark:text-white/90 tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-sm bg-[#30d158]"></span>
          <span>已启用 Agent 矩阵 ({{ enabledList.length }})</span>
        </h3>
        <span class="text-[11px] text-slate-400 dark:text-white/40">已接入中央技能库分发与规则管理</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AgentCard
          v-for="agent in enabledList"
          :key="agent.id"
          :agent="agent"
        />
      </div>

      <div v-if="enabledList.length === 0" class="bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 rounded-xl p-8 text-center text-slate-400 dark:text-white/50">
        <Bot class="w-8 h-8 mx-auto text-slate-300 dark:text-white/40 mb-2" />
        <p class="text-xs">暂无已启用的 Agent，可在下方列表中一键开启常用智能体</p>
      </div>
    </div>

    <!-- SECTION 2: DISABLED AGENTS -->
    <div v-if="disabledList.length > 0" class="space-y-3 pt-4 border-t border-black/8 dark:border-white/8">
      <div class="flex items-center justify-between px-1">
        <h3 class="font-serif text-xs font-semibold text-slate-500 dark:text-white/60 tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-sm bg-slate-300 dark:bg-white/30"></span>
          <span>未启用 / 待激活 Agent ({{ disabledList.length }})</span>
        </h3>
        <button
          @click="enableAllDisabled"
          class="text-xs text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white/95 flex items-center gap-1 font-medium transition-colors duration-200"
        >
          <Zap class="w-3.5 h-3.5 text-[#ff9f0a]" />
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

