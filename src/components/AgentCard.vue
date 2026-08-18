<template>
  <!-- 1. ENABLED AGENT CARD -->
  <div
    v-if="agent.enabled"
    class="glass-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between group border border-slate-200/90 dark:border-brand-500/30 hover:border-brand-500/60 dark:hover:border-brand-500/70 hover:shadow-lg dark:hover:shadow-brand-500/5 transition-all duration-300 bg-white dark:bg-dark-900/60 shadow-sm"
  >
    <!-- Top Row: Real Icon, Title & Switch -->
    <div>
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200/80 dark:border-brand-500/30 flex items-center justify-center group-hover:scale-105 transition shadow-sm">
            <AgentBrandIcon :agentId="agent.id" size="lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">{{ agent.name }}</h3>
              <span v-if="agent.isCustom" class="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-mono">自定义</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-medium">已启用</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  agent.detected ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-amber-500 dark:bg-amber-400'
                ]"
              ></span>
              <span class="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {{ agent.detected ? '环境已就绪 · 软链可用' : '本地未探测到目录' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Toggle Enable/Disable -->
        <label class="relative inline-flex items-center cursor-pointer" title="启用/停用 Agent">
          <input
            type="checkbox"
            :checked="agent.enabled"
            @change="toggleEnabled"
            class="sr-only peer"
          />
          <div class="w-9 h-5 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
        </label>
      </div>

      <!-- Config details -->
      <div class="space-y-2 text-xs mt-3 pt-3 border-t border-slate-100 dark:border-dark-800/80">
        <div class="flex items-start justify-between gap-2">
          <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
            <FolderOpen class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>技能目录:</span>
          </span>
          <span class="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]" :title="agent.skillsDir">
            {{ agent.skillsDir }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
            <FileCode class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>私有规则文件:</span>
          </span>
          <span class="font-mono text-brand-700 dark:text-brand-300 font-semibold truncate max-w-[200px]" :title="agent.localRuleFilename">
            {{ agent.localRuleFilename }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
            <Layers class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>已挂载技能:</span>
          </span>
          <span class="font-medium text-slate-700 dark:text-slate-200">
            <span class="text-brand-600 dark:text-brand-400 font-bold">{{ mountedCount }}</span> 个中央 Skill
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-dark-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200/80 dark:border-dark-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-mono">
        <Link2 class="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        <span>{{ agent.id === 'antigravity' ? 'NTFS Hardlink' : 'NTFS Junction' }}</span>
      </span>

      <div class="flex items-center gap-2">
        <button
          v-if="agent.isCustom"
          @click="deleteCustomAgent"
          class="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition text-xs flex items-center gap-1"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>移除</span>
        </button>
        <button
          @click="goToSkills"
          class="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 transition text-xs font-semibold flex items-center gap-1 shadow-sm"
        >
          <span>配置技能分发</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- 2. DISABLED AGENT CARD -->
  <div
    v-else
    class="glass-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border border-slate-200/70 dark:border-dark-800/80 bg-slate-50/70 dark:bg-dark-950/40 hover:bg-slate-100/70 dark:hover:bg-dark-900/60 transition-all duration-300 opacity-80 hover:opacity-100 shadow-sm"
  >
    <div>
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-dark-900/80 border border-slate-200 dark:border-dark-700/60 flex items-center justify-center grayscale-[0.6] opacity-70">
            <AgentBrandIcon :agentId="agent.id" size="lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-sm text-slate-700 dark:text-slate-300">{{ agent.name }}</h3>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-medium">已停用</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600"></span>
              <span class="text-xs text-slate-500">已从技能矩阵与规则中心隐藏</span>
            </div>
          </div>
        </div>

        <!-- Toggle Enable/Disable -->
        <label class="relative inline-flex items-center cursor-pointer" title="启用 Agent">
          <input
            type="checkbox"
            :checked="agent.enabled"
            @change="toggleEnabled"
            class="sr-only peer"
          />
          <div class="w-9 h-5 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
        </label>
      </div>

      <!-- Muted Config info -->
      <div class="space-y-1.5 text-xs mt-3 pt-3 border-t border-slate-200/80 dark:border-dark-800/60 text-slate-500 font-mono text-[11px]">
        <div class="truncate" :title="agent.skillsDir">📁 {{ agent.skillsDir }}</div>
        <div class="truncate" :title="agent.localRuleFilename">📄 {{ agent.localRuleFilename }}</div>
      </div>
    </div>

    <!-- Enable CTA Button -->
    <div class="mt-4 pt-3 border-t border-slate-200/80 dark:border-dark-800/60 flex items-center justify-between">
      <span class="text-[11px] text-slate-500">点击右侧按钮重新激活</span>
      <button
        @click="store.toggleAgentEnable(agent.id, true)"
        class="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-brand-600 dark:bg-dark-800 dark:hover:bg-brand-500 text-slate-700 hover:text-white dark:text-slate-300 dark:hover:text-white border border-slate-300 hover:border-brand-600 dark:border-dark-700 hover:border-brand-500 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
      >
        <Zap class="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
        <span>一键启用 Agent</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AgentInfo } from '../types';
import { useAppStore } from '../stores/useAppStore';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  FolderOpen,
  FileCode,
  Layers,
  Link2,
  Trash2,
  ChevronRight,
  Zap,
} from 'lucide-vue-next';

const props = defineProps<{
  agent: AgentInfo;
}>();

const store = useAppStore();

const mountedCount = computed(() => {
  return store.skills.filter(s => s.mountedAgents.includes(props.agent.id)).length;
});

function toggleEnabled(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  store.toggleAgentEnable(props.agent.id, checked);
}

function goToSkills() {
  store.currentTab = 'skills';
}

function deleteCustomAgent() {
  if (confirm(`确定要移除自定义 Agent [${props.agent.name}] 吗？`)) {
    store.deleteCustomAgent(props.agent.id);
  }
}
</script>
