<template>
  <!-- 1. ENABLED AGENT CARD -->
  <div
    v-if="agent.enabled"
    class="bg-white dark:bg-[#2c2c2e] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/14 shadow-sm dark:shadow-none transition-colors duration-200"
  >
    <!-- Top Row: Real Icon, Title & Status Button -->
    <div>
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 flex items-center justify-center flex-shrink-0">
            <AgentBrandIcon :agentId="agent.id" size="lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ agent.name }}</h3>
              <span v-if="agent.isCustom" class="text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8 font-mono">自定义</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span
                :class="[
                  'w-2 h-2 rounded-sm',
                  agent.detected ? 'bg-[#30d158]' : 'bg-[#ff9f0a]'
                ]"
              ></span>
              <span class="text-xs text-slate-500 dark:text-white/60">
                {{ agent.detected ? '环境已就绪 · 软链可用' : '本地未探测到目录' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Segmented Slider Switch -->
        <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
          <button
            type="button"
            @click="store.toggleAgentEnable(agent.id, true)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
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
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              !agent.enabled
                ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>停用</span>
          </button>
        </div>
      </div>

      <!-- Config details -->
      <div class="space-y-2 text-xs mt-3 pt-3 border-t border-black/8 dark:border-white/8">
        <div class="flex items-start justify-between gap-2">
          <span class="text-slate-400 dark:text-white/40 flex items-center gap-1 flex-shrink-0">
            <FolderOpen class="w-3.5 h-3.5" />
            <span>技能目录:</span>
          </span>
          <span class="font-mono text-slate-700 dark:text-white/80 truncate max-w-[200px]" :title="agent.skillsDir">
            {{ agent.skillsDir }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-400 dark:text-white/40 flex items-center gap-1 flex-shrink-0">
            <FileCode class="w-3.5 h-3.5" />
            <span>私有规则:</span>
          </span>
          <span class="font-mono text-slate-800 dark:text-white/90 truncate max-w-[200px]" :title="agent.localRuleFilename">
            {{ agent.localRuleFilename }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-400 dark:text-white/40 flex items-center gap-1 flex-shrink-0">
            <Layers class="w-3.5 h-3.5" />
            <span>已挂载技能:</span>
          </span>
          <span class="font-medium text-slate-700 dark:text-white/80">
            <span class="text-slate-900 dark:text-white/95 font-bold font-mono">{{ mountedCount }}</span> 个中央 Skill
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="mt-4 pt-3 border-t border-black/8 dark:border-white/8 flex items-center justify-between text-xs text-slate-500 dark:text-white/50">
      <span class="px-2 py-0.5 rounded-md bg-black/5 dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 text-[11px] text-slate-600 dark:text-white/60 flex items-center gap-1 font-mono">
        <Link2 class="w-3 h-3 text-[#30d158]" />
        <span>{{ agent.id === 'antigravity' ? 'NTFS Hardlink' : 'NTFS Junction' }}</span>
      </span>

      <div class="flex items-center gap-2">
        <button
          v-if="agent.isCustom"
          @click="deleteCustomAgent"
          class="text-slate-400 hover:text-[#ff453a] dark:text-white/50 dark:hover:text-[#ff453a] transition-colors duration-200 text-xs flex items-center gap-1"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>移除</span>
        </button>
        <button
          @click="goToSkills"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 transition-colors duration-200 text-xs font-medium flex items-center gap-1"
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
    class="bg-black/[0.02] dark:bg-[#1c1c1e] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between border border-black/6 dark:border-white/8 opacity-80 hover:opacity-100 transition-colors duration-200"
  >
    <div>
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/6 dark:border-white/8 flex items-center justify-center grayscale-[0.6] opacity-60">
            <AgentBrandIcon :agentId="agent.id" size="lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-serif font-semibold text-sm text-slate-600 dark:text-white/70">{{ agent.name }}</h3>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="w-2 h-2 rounded-sm bg-slate-300 dark:bg-white/30"></span>
              <span class="text-xs text-slate-400 dark:text-white/40">已从技能矩阵与规则中心隐藏</span>
            </div>
          </div>
        </div>

        <!-- Segmented Slider Switch -->
        <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 text-xs flex-shrink-0">
          <button
            type="button"
            @click="store.toggleAgentEnable(agent.id, true)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
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
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              !agent.enabled
                ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>停用</span>
          </button>
        </div>
      </div>

      <!-- Muted Config info -->
      <div class="space-y-1.5 text-xs mt-3 pt-3 border-t border-black/6 dark:border-white/8 text-slate-400 dark:text-white/40 font-mono text-[11px]">
        <div class="truncate" :title="agent.skillsDir">📁 {{ agent.skillsDir }}</div>
        <div class="truncate" :title="agent.localRuleFilename">📄 {{ agent.localRuleFilename }}</div>
      </div>
    </div>

    <!-- Enable CTA Button -->
    <div class="mt-4 pt-3 border-t border-black/6 dark:border-white/8 flex items-center justify-between">
      <span class="text-[11px] text-slate-400 dark:text-white/40">点击右侧按钮重新激活</span>
      <button
        @click="store.toggleAgentEnable(agent.id, true)"
        class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
      >
        <Zap class="w-3.5 h-3.5 text-[#ff9f0a]" />
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

