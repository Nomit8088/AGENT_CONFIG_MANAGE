<template>
  <div
    v-if="store.activeSkillId && store.activeSkill"
    class="fixed inset-y-0 right-0 w-full max-w-xl z-40 bg-white/98 dark:bg-dark-900/98 backdrop-blur-xl border-l border-slate-200 dark:border-dark-800 shadow-2xl flex flex-col transition-all duration-300 animate-slide-right select-text"
  >
    <!-- Drawer Header -->
    <div class="h-14 px-5 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between flex-shrink-0 select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-transparent">
          <Layers class="w-4 h-4" />
        </div>
        <div>
          <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">{{ store.activeSkill.name }}</h3>
          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">v{{ store.activeSkill.version }} · {{ store.activeSkill.source }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="openEditor"
          class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-dark-700 flex items-center gap-1 transition"
        >
          <Edit class="w-3.5 h-3.5" />
          <span>编辑</span>
        </button>

        <button
          @click="store.activeSkillId = null"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Drawer Content (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-6 space-y-5">
      <!-- Frontmatter & Metadata Card -->
      <div class="glass-card rounded-xl p-4 border border-slate-200/80 dark:border-dark-800 space-y-3 shadow-sm">
        <div class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">元数据 (Frontmatter)</div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-slate-500 dark:text-slate-400">技能名称:</span>
            <span class="ml-1 text-slate-800 dark:text-slate-200 font-mono font-medium">{{ store.activeSkill.name }}</span>
          </div>
          <div>
            <span class="text-slate-500 dark:text-slate-400">版本号:</span>
            <span class="ml-1 text-brand-600 dark:text-brand-400 font-mono font-medium">{{ store.activeSkill.version }}</span>
          </div>
          <div class="col-span-2">
            <span class="text-slate-500 dark:text-slate-400">功能描述:</span>
            <p class="mt-0.5 text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{{ store.activeSkill.description }}</p>
          </div>
          <div v-if="store.activeSkill.metadata?.slash_commands" class="col-span-2">
            <span class="text-slate-500 dark:text-slate-400">斜杠命令:</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span
                v-for="cmd in store.activeSkill.metadata.slash_commands"
                :key="cmd"
                class="px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 font-mono text-[11px]"
              >
                {{ cmd }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Mount Status -->
      <div class="glass-card rounded-xl p-4 border border-slate-200/80 dark:border-dark-800 space-y-2 shadow-sm">
        <div class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Agent 挂载状态 (NTFS Junction)</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="agent in store.agents"
            :key="agent.id"
            :class="[
              'px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border',
              store.activeSkill.mountedAgents.includes(agent.id)
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-dark-900 dark:text-slate-500 dark:border-dark-800'
            ]"
          >
            <span
              :class="[
                'w-1.5 h-1.5 rounded-full',
                store.activeSkill.mountedAgents.includes(agent.id) ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-600'
              ]"
            ></span>
            <span>{{ agent.name }}</span>
          </div>
        </div>
      </div>

      <!-- Raw Markdown Content Preview -->
      <div class="space-y-2">
        <div class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">SKILL.md 原始内容</div>
        <div class="rounded-xl bg-slate-100/80 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 p-4 font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto select-text shadow-inner">
          {{ store.activeSkill.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/useAppStore';
import { Layers, Edit, X } from 'lucide-vue-next';

const store = useAppStore();

function openEditor() {
  if (!store.activeSkill) return;
  store.skillEditorModal = {
    visible: true,
    skillName: store.activeSkill.id,
    content: store.activeSkill.content,
    isNew: false,
  };
}
</script>
