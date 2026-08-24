<template>
  <div
    v-if="store.activeSkillId && store.activeSkill"
    class="fixed inset-y-0 right-0 w-full max-w-xl z-40 bg-white/95 dark:bg-[#121316]/95 backdrop-blur-xl border-l border-black/8 dark:border-white/8 shadow-2xl dark:shadow-none flex flex-col transition-all duration-200 animate-slide-right select-text text-slate-900 dark:text-white"
  >
    <!-- Drawer Header -->
    <div class="h-14 px-5 border-b border-black/8 dark:border-white/8 flex items-center justify-between flex-shrink-0 select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
          <Layers class="w-4 h-4" />
        </div>
        <div>
          <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ store.activeSkill.name }}</h3>
          <span class="text-[10px] text-slate-400 dark:text-white/40 font-mono">v{{ store.activeSkill.version }} · {{ store.activeSkill.source }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="copyContent"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1 transition-colors duration-200"
          title="复制 SKILL.md 内容"
        >
          <Copy class="w-3.5 h-3.5" />
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </button>

        <button
          @click="openEditor"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1 transition-colors duration-200"
        >
          <Edit class="w-3.5 h-3.5" />
          <span>编辑</span>
        </button>

        <button
          @click="store.activeSkillId = null"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Drawer Content (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-6 space-y-5">
      <!-- Frontmatter & Metadata Card -->
      <div class="bg-black/[0.02] dark:bg-[#1c1d22] rounded-xl p-4 border border-black/8 dark:border-white/8 space-y-3">
        <div class="text-xs font-serif font-semibold text-slate-900 dark:text-white/90 tracking-wider">元数据 (Frontmatter)</div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-slate-400 dark:text-white/40">技能名称:</span>
            <span class="ml-1 text-slate-800 dark:text-white/90 font-mono font-medium">{{ store.activeSkill.name }}</span>
          </div>
          <div>
            <span class="text-slate-400 dark:text-white/40">版本号:</span>
            <span class="ml-1 text-slate-800 dark:text-white/90 font-mono font-medium">v{{ store.activeSkill.version }}</span>
          </div>
          <div class="col-span-2">
            <span class="text-slate-400 dark:text-white/40">功能描述:</span>
            <p class="mt-0.5 text-slate-600 dark:text-white/70 text-xs leading-relaxed">{{ store.activeSkill.description }}</p>
          </div>
          <div v-if="store.activeSkill.metadata?.slash_commands" class="col-span-2">
            <span class="text-slate-400 dark:text-white/40">斜杠命令:</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span
                v-for="cmd in store.activeSkill.metadata.slash_commands"
                :key="cmd"
                class="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-700 dark:text-white/80 border border-black/8 dark:border-white/8 font-mono text-[11px]"
              >
                {{ cmd }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Mount Status -->
      <div class="bg-black/[0.02] dark:bg-[#1c1d22] rounded-xl p-4 border border-black/8 dark:border-white/8 space-y-2">
        <div class="text-xs font-serif font-semibold text-slate-900 dark:text-white/90 tracking-wider">Agent 挂载状态 (NTFS Hardlink / Junction)</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="agent in store.agents"
            :key="agent.id"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-colors duration-200',
              store.activeSkill.mountedAgents.includes(agent.id)
                ? 'bg-black/5 dark:bg-white/8 text-slate-900 dark:text-white/90 border-black/10 dark:border-white/12'
                : 'bg-transparent dark:bg-[#121316] text-slate-400 dark:text-white/40 border-black/6 dark:border-white/6'
            ]"
          >
            <span
              :class="[
                'w-1.5 h-1.5 rounded-sm',
                store.activeSkill.mountedAgents.includes(agent.id) ? 'bg-[#22c55e] ring-2 ring-[#22c55e]/20' : 'bg-slate-300 dark:bg-white/30'
              ]"
            ></span>
            <span>{{ agent.name }}</span>
          </div>
        </div>
      </div>

      <!-- Raw Markdown Content Preview -->
      <div class="space-y-2">
        <div class="text-xs font-serif font-semibold text-slate-900 dark:text-white/90 tracking-wider">SKILL.md 原始内容</div>
        <div class="rounded-xl bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8 p-4 font-mono text-xs text-slate-800 dark:text-white/80 whitespace-pre-wrap leading-relaxed overflow-x-auto select-text">
          {{ store.activeSkill.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Layers, Edit, X, Copy } from 'lucide-vue-next';

const store = useAppStore();
const copied = ref(false);

function openEditor() {
  if (!store.activeSkill) return;
  store.skillEditorModal = {
    visible: true,
    skillName: store.activeSkill.id,
    content: store.activeSkill.content,
    isNew: false,
  };
}

async function copyContent() {
  if (!store.activeSkill?.content) return;
  try {
    await navigator.clipboard.writeText(store.activeSkill.content);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (e) {}
}
</script>

