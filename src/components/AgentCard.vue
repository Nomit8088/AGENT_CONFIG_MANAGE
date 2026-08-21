<template>
  <!-- 1. ENABLED AGENT — 卡片形式（参考纳管卡片样式） -->
  <div
    v-if="agent.enabled"
    class="bg-white dark:bg-[#2c2c2e] rounded-xl p-3.5 border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/14 shadow-sm dark:shadow-none transition-colors duration-200 flex flex-col"
  >
    <!-- Header: icon + name + status + toggle -->
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 flex items-center justify-center flex-shrink-0">
          <AgentBrandIcon :agentId="agent.id" size="md" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h3 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 truncate">{{ agent.name }}</h3>
            <span v-if="agent.isCustom" class="text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8 font-mono shrink-0">自定义</span>
          </div>
          <div class="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 dark:text-white/60 min-w-0">
            <span class="w-1.5 h-1.5 rounded-sm shrink-0" :class="agent.detected ? 'bg-[#30d158]' : 'bg-[#ff9f0a]'"></span>
            <span class="truncate">{{ agent.detected ? '环境已就绪 · 软链可用' : '本地未探测到目录' }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, true)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            agent.enabled
              ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span v-if="agent.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
          <span>启用</span>
        </button>
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, false)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            !agent.enabled
              ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span>停用</span>
        </button>
      </div>
    </div>

    <!-- Skills directory path -->
    <div class="mt-2 text-[10px] text-slate-400 dark:text-white/40 font-mono truncate" :title="agent.skillsDir">
      📁 {{ agent.skillsDir }}
    </div>

    <!-- Status badges (只读提示，不单独可点；统一走下方「管理」入口) -->
    <div class="mt-2 flex items-center gap-1.5 flex-wrap">
      <span
        :class="[
          'px-1.5 py-0.5 rounded-md border font-mono text-[10px]',
          unmanagedCount > 0
            ? 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30'
            : 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
        ]"
        :title="unmanagedCount > 0 ? '待纳管：该 Agent 本地技能目录中尚未纳入中央库的实体技能数量' : '存量受控：该 Agent 本地技能已全部由中央库软链受控'"
      >
        {{ unmanagedCount > 0 ? `${unmanagedCount} 待纳管` : '存量受控' }}
      </span>

      <span
        v-if="ignoredCount > 0"
        class="px-1.5 py-0.5 rounded-md border font-mono text-[10px] bg-black/5 dark:bg-white/10 text-slate-500 dark:text-white/50 border-black/8 dark:border-white/10"
        title="忽略：该 Agent 被标记为私有的本地技能数量，不参与中央库纳管"
      >
        {{ ignoredCount }} 忽略
      </span>

      <span
        class="px-1.5 py-0.5 rounded-md border font-mono text-[10px] bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30"
        title="已挂载：中央技能库中已软链分发到该 Agent 的技能数量"
      >
        {{ mountedCount }} 已挂载
      </span>
    </div>

    <!-- Footer: 统一管理入口 -->
    <div class="mt-3 pt-2 border-t border-black/8 dark:border-white/8 flex items-center justify-between gap-2">
      <div class="min-w-0 flex items-center gap-2 text-[10px] font-mono text-slate-400 dark:text-white/40">
        <span class="shrink-0">{{ agent.id === 'antigravity' ? 'Hardlink' : 'Junction' }}</span>
        <span class="truncate" :title="agent.localRuleFilename">私有规则 {{ agent.localRuleFilename }}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          @click="openManager"
          title="打开该 Agent 的技能管理：存量纳管 / 忽略 / 中央技能分发"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1 transition-colors duration-200"
        >
          <FolderSearch class="w-3.5 h-3.5" />
          <span>技能管理</span>
          <ChevronRight class="w-3 h-3" />
        </button>
        <button
          v-if="agent.isCustom"
          @click="deleteCustomAgent"
          title="移除自定义 Agent"
          class="p-1.5 rounded-lg text-slate-400 hover:text-[#ff453a] dark:text-white/50 dark:hover:text-[#ff453a] transition-colors duration-200"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- 2. DISABLED AGENT — 卡片形式（参考纳管卡片样式） -->
  <div
    v-else
    class="bg-black/[0.02] dark:bg-[#1c1c1e] rounded-xl p-3.5 border border-black/6 dark:border-white/8 opacity-80 hover:opacity-100 transition-colors duration-200 flex flex-col"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/6 dark:border-white/8 flex items-center justify-center grayscale-[0.6] opacity-60 flex-shrink-0">
          <AgentBrandIcon :agentId="agent.id" size="md" />
        </div>
        <div class="min-w-0">
          <h3 class="font-serif font-semibold text-xs text-slate-600 dark:text-white/70 truncate">{{ agent.name }}</h3>
          <div class="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/40">
            <span class="w-1.5 h-1.5 rounded-sm bg-slate-300 dark:bg-white/30 shrink-0"></span>
            <span>已从技能矩阵与规则中心隐藏</span>
          </div>
        </div>
      </div>

      <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, true)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            agent.enabled
              ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span>启用</span>
        </button>
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, false)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            !agent.enabled
              ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span>停用</span>
        </button>
      </div>
    </div>

    <div class="mt-2 text-[10px] text-slate-400 dark:text-white/40 font-mono truncate" :title="agent.skillsDir">
      📁 {{ agent.skillsDir }}
    </div>
    <div class="mt-1 text-[10px] text-slate-400 dark:text-white/40 font-mono truncate" :title="agent.localRuleFilename">
      📄 {{ agent.localRuleFilename }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AgentInfo } from '../types';
import { useAppStore } from '../stores/useAppStore';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  FolderSearch,
  Trash2,
  ChevronRight,
} from 'lucide-vue-next';

const props = defineProps<{
  agent: AgentInfo;
}>();

const store = useAppStore();

const mountedCount = computed(() => {
  return store.skills.filter(s => s.mountedAgents.includes(props.agent.id)).length;
});

const unmanagedCount = computed(() => {
  return store.unmanagedByAgent(props.agent.id).length;
});

const ignoredCount = computed(() => {
  return store.ignoredByAgent(props.agent.id).length;
});

function openManager() {
  // 统一管理入口：有待纳管优先进入待纳管页签，否则进入中央技能分发页签
  const tab = unmanagedCount.value > 0 ? 'unmanaged' : 'skills';
  store.openAgentDetailModal(props.agent.id, tab);
}

function deleteCustomAgent() {
  if (confirm(`确定要移除自定义 Agent [${props.agent.name}] 吗？`)) {
    store.deleteCustomAgent(props.agent.id);
  }
}
</script>
