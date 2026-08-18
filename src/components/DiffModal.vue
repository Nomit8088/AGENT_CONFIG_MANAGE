<template>
  <div
    v-if="store.diffModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fade"
  >
    <div class="glass-panel w-full max-w-4xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-dark-700 bg-white/98 dark:bg-dark-900/98 flex flex-col max-h-[90vh]">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center border border-amber-200/60 dark:border-transparent">
            <GitCompare class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">{{ store.diffModal.title }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">检测到同名 Skill 或内容差异，请选择冲突处理策略</p>
          </div>
        </div>
        <button
          @click="store.closeDiffModal()"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Diff Comparison Body (Side-by-Side) -->
      <div class="flex-1 overflow-hidden py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Left: Local incoming version -->
        <div class="flex flex-col rounded-xl border border-amber-200 dark:border-dark-800 bg-amber-50/20 dark:bg-dark-950/70 overflow-hidden shadow-sm">
          <div class="px-3 py-2 border-b border-amber-200 dark:border-dark-800 bg-amber-50/80 dark:bg-dark-900/60 flex items-center justify-between text-xs">
            <span class="font-bold text-amber-800 dark:text-amber-300">{{ store.diffModal.localLabel }}</span>
            <span class="text-[10px] text-slate-500 font-mono">Incoming / Local</span>
          </div>
          <div class="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text shadow-inner">
            {{ store.diffModal.localContent }}
          </div>
        </div>

        <!-- Right: Central current version -->
        <div class="flex flex-col rounded-xl border border-sky-200 dark:border-dark-800 bg-sky-50/20 dark:bg-dark-950/70 overflow-hidden shadow-sm">
          <div class="px-3 py-2 border-b border-sky-200 dark:border-dark-800 bg-sky-50/80 dark:bg-dark-900/60 flex items-center justify-between text-xs">
            <span class="font-bold text-sky-800 dark:text-sky-300">{{ store.diffModal.remoteLabel }}</span>
            <span class="text-[10px] text-slate-500 font-mono">Central / Current</span>
          </div>
          <div class="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text shadow-inner">
            {{ store.diffModal.remoteContent }}
          </div>
        </div>
      </div>

      <!-- Decision Actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-dark-800 flex-shrink-0">
        <div class="text-[11px] text-slate-500 dark:text-slate-400">
          决策后将自动完成文件移入与软链替换
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="handleAction('skip')"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-dark-700 transition"
          >
            跳过 (Skip)
          </button>
          <button
            @click="handleAction('rename')"
            class="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition active:scale-95"
          >
            保留两者并重命名 (Keep Both)
          </button>
          <button
            @click="handleAction('overwrite')"
            class="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95"
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
