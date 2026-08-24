<template>
  <!-- 1. ENABLED AGENT — 卡片形式（参考纳管卡片样式） -->
  <div
    v-if="agent.enabled"
    class="bg-white dark:bg-[#1c1d22] rounded-xl p-3.5 border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/14 shadow-sm dark:shadow-none transition-colors duration-200 flex flex-col"
  >
    <!-- Header: icon + name + status + toggle -->
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 flex items-center justify-center flex-shrink-0">
          <AgentBrandIcon :agentId="agent.id" size="md" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h3 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 truncate">{{ agent.name }}</h3>
            <span v-if="agent.isCustom" class="text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8 font-mono shrink-0">{{ $t('agent.custom') }}</span>
          </div>
          <div class="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 dark:text-white/60 min-w-0">
            <span class="w-1.5 h-1.5 rounded-sm shrink-0" :class="agent.detected ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'"></span>
            <span class="truncate">{{ agent.detected ? $t('agent.ready') : $t('agent.notDetected') }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, true)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            agent.enabled
              ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span v-if="agent.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#22c55e]"></span>
          <span>{{ $t('common.enable') }}</span>
        </button>
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, false)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            !agent.enabled
              ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span>{{ $t('common.disable') }}</span>
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
            ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
            : 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
        ]"
        :title="unmanagedCount > 0 ? $t('agent.unmanagedTitle') : $t('agent.managedTitle')"
      >
        {{ unmanagedCount > 0 ? $t('agent.unmanagedCount', { count: unmanagedCount }) : $t('agent.managed') }}
      </span>

      <span
        v-if="ignoredCount > 0"
        class="px-1.5 py-0.5 rounded-md border font-mono text-[10px] bg-black/5 dark:bg-white/10 text-slate-500 dark:text-white/50 border-black/8 dark:border-white/10"
        :title="$t('agent.ignoredTitle')"
      >
        {{ $t('agent.ignoredCount', { count: ignoredCount }) }}
      </span>

      <span
        class="px-1.5 py-0.5 rounded-md border font-mono text-[10px] bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30"
        :title="$t('agent.mountedTitle')"
      >
        {{ $t('agent.mountedCount', { count: mountedCount }) }}
      </span>
    </div>

    <!-- Footer: 统一管理入口 -->
    <div class="mt-3 pt-2 border-t border-black/8 dark:border-white/8 flex items-center justify-between gap-2">
      <div class="min-w-0 flex items-center gap-2 text-[10px] font-mono text-slate-400 dark:text-white/40">
        <span class="shrink-0">{{ linkStrategyFor(agent.id) === 'hardlinkTree' ? 'Hardlink' : 'Junction' }}</span>
        <span class="truncate" :title="agent.localRuleFilename">{{ $t('agent.privateRule', { name: agent.localRuleFilename }) }}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          @click="openManager"
          :title="$t('agent.skillManageTitle')"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1 transition-colors duration-200"
        >
          <FolderSearch class="w-3.5 h-3.5" />
          <span>{{ $t('agent.skillManage') }}</span>
          <ChevronRight class="w-3 h-3" />
        </button>
        <button
          v-if="agent.isCustom"
          @click="deleteCustomAgent"
          :title="$t('agent.removeTitle')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-[#ef4444] dark:text-white/50 dark:hover:text-[#ef4444] transition-colors duration-200"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- 2. DISABLED AGENT — 卡片形式（参考纳管卡片样式） -->
  <div
    v-else
    class="bg-black/[0.02] dark:bg-[#121316] rounded-xl p-3.5 border border-black/6 dark:border-white/8 opacity-80 hover:opacity-100 transition-colors duration-200 flex flex-col"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/6 dark:border-white/8 flex items-center justify-center grayscale-[0.6] opacity-60 flex-shrink-0">
          <AgentBrandIcon :agentId="agent.id" size="md" />
        </div>
        <div class="min-w-0">
          <h3 class="font-serif font-semibold text-xs text-slate-600 dark:text-white/70 truncate">{{ agent.name }}</h3>
          <div class="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/40">
            <span class="w-1.5 h-1.5 rounded-sm bg-slate-300 dark:bg-white/30 shrink-0"></span>
            <span>{{ $t('agent.hiddenHint') }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, true)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            agent.enabled
              ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span>{{ $t('common.enable') }}</span>
        </button>
        <button
          type="button"
          @click="store.toggleAgentEnable(agent.id, false)"
          :class="[
            'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            !agent.enabled
              ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <span>{{ $t('common.disable') }}</span>
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
import { t } from '../i18n';
import AgentBrandIcon from './AgentBrandIcon.vue';
import { linkStrategyFor } from '../shared/linkStrategy';
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
  if (confirm(t('agent.removeConfirm', { name: props.agent.name }))) {
    store.deleteCustomAgent(props.agent.id);
  }
}
</script>
