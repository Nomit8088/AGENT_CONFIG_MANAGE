<template>
  <div class="h-full overflow-y-auto p-4 space-y-3">
    <!-- Top bar -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <h2 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">Agent Hub</h2>
        <span class="hidden md:inline text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-500 dark:text-white/60 border border-black/8 dark:border-white/8 font-mono">
          {{ store.agents.length }} 款 Agent 适配
        </span>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button
          v-if="store.totalUnmanagedCount > 0"
          @click="store.takeoverAllUnmanagedSkills()"
          title="一键将所有 Agent 下的存量物理技能全部纳管并替换为中央受控链接"
          class="px-2.5 py-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
        >
          <PackageCheck class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">一键纳管全部 ({{ store.totalUnmanagedCount }})</span>
          <span class="sm:hidden">{{ store.totalUnmanagedCount }}</span>
        </button>

        <button
          @click="store.addAgentModal.visible = true"
          class="px-2.5 py-1.5 rounded-lg bg-transparent text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 hover:bg-black/5 dark:hover:bg-white/8 border border-black/10 dark:border-white/12 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
        >
          <Plus class="w-3.5 h-3.5 text-slate-600 dark:text-white/80" />
          <span class="hidden sm:inline">添加 Agent</span>
        </button>

        <button
          @click="store.scanAgents()"
          :disabled="store.isLoading"
          class="px-2.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 disabled:opacity-50 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
        >
          <RefreshCw class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" :class="{ 'animate-spin': store.isLoading }" />
          <span class="hidden sm:inline">重新扫描</span>
        </button>
      </div>
    </div>

    <!-- Search + Segmented filter tabs -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="relative flex-1 min-w-[180px] max-w-xs">
        <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索 Agent 名称、私有规则文件名、路径..."
          class="w-full bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Segmented control: 已启用 / 未启用 -->
      <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
        <button
          type="button"
          @click="agentFilterTab = 'enabled'"
          :class="[
            'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            agentFilterTab === 'enabled'
              ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span v-if="agentFilterTab === 'enabled'" class="w-1.5 h-1.5 rounded-sm bg-[#22c55e]"></span>
          <span>已启用 ({{ filteredEnabled.length }})</span>
        </button>
        <button
          type="button"
          @click="agentFilterTab = 'disabled'"
          :class="[
            'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            agentFilterTab === 'disabled'
              ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span v-if="agentFilterTab === 'disabled'" class="w-1.5 h-1.5 rounded-sm bg-slate-300 dark:bg-white/30"></span>
          <span>未启用 ({{ filteredDisabled.length }})</span>
        </button>
      </div>
    </div>

    <!-- Active list -->
    <template v-if="currentList.length > 0">
      <div class="flex items-center justify-between px-1">
        <h3 class="font-serif text-xs font-semibold text-slate-900 dark:text-white/90 tracking-wider flex items-center gap-2">
          <span class="w-2 h-2 rounded-sm" :class="agentFilterTab === 'enabled' ? 'bg-[#22c55e]' : 'bg-slate-300 dark:bg-white/30'"></span>
          <span>{{ agentFilterTab === 'enabled' ? '已启用 Agent' : '未启用 / 待激活 Agent' }} ({{ currentList.length }})</span>
        </h3>
        <button
          v-if="agentFilterTab === 'disabled' && filteredDisabled.length > 1"
          @click="enableAllDisabled"
          class="text-xs text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white/95 flex items-center gap-1 font-medium transition-colors duration-200"
        >
          <Zap class="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>全部一键启用</span>
        </button>
      </div>

      <!-- 卡片形式（参考纳管卡片样式，小窗 3 列，大窗 4 列） -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <AgentCard
          v-for="agent in currentList"
          :key="agent.id"
          :agent="agent"
        />
      </div>
    </template>

    <!-- Empty state -->
    <div
      v-else
      class="bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 rounded-xl p-8 text-center text-slate-400 dark:text-white/50"
    >
      <Bot class="w-8 h-8 mx-auto text-slate-300 dark:text-white/40 mb-2" />
      <p class="text-xs">
        {{ emptyText }}
      </p>
    </div>

    <AgentDetailModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import AgentCard from './AgentCard.vue';
import AgentDetailModal from './AgentDetailModal.vue';
import {
  Plus,
  RefreshCw,
  Search,
  X,
  Zap,
  Bot,
  PackageCheck,
} from 'lucide-vue-next';

const store = useAppStore();
const searchQuery = ref('');
const agentFilterTab = ref<'enabled' | 'disabled'>('enabled');

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

const filteredEnabled = computed(() => filteredAgents.value.filter(a => a.enabled));
const filteredDisabled = computed(() => filteredAgents.value.filter(a => !a.enabled));

const currentList = computed(() =>
  agentFilterTab.value === 'enabled' ? filteredEnabled.value : filteredDisabled.value
);

const emptyText = computed(() => {
  if (searchQuery.value.trim()) return '未搜索到匹配的 Agent，请尝试其他关键词';
  if (agentFilterTab.value === 'enabled') return '暂无已启用的 Agent，请切换到「未启用」页签一键开启';
  return '全部 Agent 均已启用 🎉';
});

async function enableAllDisabled() {
  for (const a of filteredDisabled.value) {
    await store.toggleAgentEnable(a.id, true);
  }
}
</script>
