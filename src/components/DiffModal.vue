<template>
  <div
    v-if="store.diffModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#1c1c1e] w-full max-w-4xl rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <GitCompare class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ store.diffModal.title }}</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">检测到同名 Skill 或内容差异，请选择冲突处理策略</p>
          </div>
        </div>
        <button
          @click="store.closeDiffModal()"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Diff Comparison Body (Side-by-Side) -->
      <div class="flex-1 overflow-hidden py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Left: Local incoming version -->
        <div class="flex flex-col rounded-xl border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#2c2c2e] overflow-hidden">
          <div class="px-3 py-2 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1c1e] flex items-center justify-between text-xs">
            <span class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ store.diffModal.localLabel }}</span>
            <span class="text-[10px] text-slate-400 dark:text-white/40 font-mono">Incoming / Local</span>
          </div>
          <div class="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-700 dark:text-white/70 whitespace-pre-wrap leading-relaxed select-text bg-transparent">
            {{ store.diffModal.localContent }}
          </div>
        </div>

        <!-- Right: Central current version -->
        <div class="flex flex-col rounded-xl border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#2c2c2e] overflow-hidden">
          <div class="px-3 py-2 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1c1e] flex items-center justify-between text-xs">
            <span class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ store.diffModal.remoteLabel }}</span>
            <span class="text-[10px] text-slate-400 dark:text-white/40 font-mono">Central / Current</span>
          </div>
          <div class="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-700 dark:text-white/70 whitespace-pre-wrap leading-relaxed select-text bg-transparent">
            {{ store.diffModal.remoteContent }}
          </div>
        </div>
      </div>

      <!-- Decision Actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/8 dark:border-white/8 flex-shrink-0">
        <div class="text-[11px] text-slate-400 dark:text-white/50">
          决策后将自动完成文件移入与软链替换
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="handleAction('skip')"
            class="px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
          >
            跳过 (Skip)
          </button>
          <button
            @click="handleAction('rename')"
            class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
          >
            保留两者并重命名 (Keep Both)
          </button>
          <button
            @click="handleAction('overwrite')"
            class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
          >
            覆盖现有版本 (Overwrite)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/useAppStore';
import { GitCompare, X } from 'lucide-vue-next';

const store = useAppStore();

function handleAction(action: 'overwrite' | 'rename' | 'skip') {
  if (store.diffModal.onResolve) {
    store.diffModal.onResolve(action);
  }
}
</script>

