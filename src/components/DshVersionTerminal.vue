<template>
  <div class="rounded-xl bg-[#121316] border border-black/8 dark:border-white/8 overflow-hidden transition-colors duration-200">
    <!-- Status bar -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-black/8 dark:border-white/8 bg-black/5 dark:bg-[#1c1d22]">
      <div class="flex items-center gap-2 text-xs min-w-0">
        <span
          class="w-2 h-2 rounded-sm shrink-0 transition-colors duration-200"
          :class="statusDotClass"
        ></span>
        <span class="font-mono text-slate-700 dark:text-white/90 truncate">{{ $t('version.terminalTitle', { status: statusText }) }}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          v-if="store.dshVersionTerminal.lines.length > 0"
          type="button"
          @click="clearLines"
          class="text-[11px] px-2 py-1 rounded-md text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 transition-colors duration-200"
        >
          {{ $t('dshPlugin.terminalClear') }}
        </button>
        <button
          type="button"
          @click="store.dshVersionTerminal.visible = false"
          class="p-1 rounded-md text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Log output -->
    <div ref="logRef" class="h-40 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300 dark:text-[#e5e5ea] whitespace-pre-wrap break-all">
      <p v-if="store.dshVersionTerminal.lines.length === 0" class="text-slate-500 dark:text-white/40">
        {{ $t('version.terminalIdle') }}
      </p>
      <template v-else>
        <div v-for="(line, idx) in store.dshVersionTerminal.lines" :key="idx">{{ line }}</div>
      </template>
    </div>

    <!-- Report summary -->
    <div
      v-if="store.dshVersionResult"
      class="px-3 py-2 border-t border-black/8 dark:border-white/8 bg-black/5 dark:bg-[#1c1d22] text-[11px] font-mono flex items-center gap-3 flex-wrap"
    >
      <span :class="store.dshVersionResult.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'">
        {{ store.dshVersionResult.ok ? $t('version.changeSuccess') : $t('version.changeAttention') }}
      </span>
      <span class="text-slate-500 dark:text-white/50">
        {{ store.dshVersionResult.beforeVersion || $t('common.unknown') }} → {{ store.dshVersionResult.afterVersion || store.dshVersionResult.targetVersion }}
      </span>
      <span class="text-slate-500 dark:text-white/50">{{ $t('version.failedPlugins', { before: store.dshVersionResult.diagnosisBefore, after: store.dshVersionResult.diagnosisAfter }) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { t } from '../i18n';
import { X } from 'lucide-vue-next';

const store = useAppStore();
const logRef = ref<HTMLElement | null>(null);

const statusText = computed(() => {
  if (store.dshVersionTerminal.running) return t('version.runningStatus');
  if (store.dshVersionResult) {
    return store.dshVersionResult.ok ? t('version.doneSuccessStatus') : t('version.doneAttentionStatus');
  }
  return t('version.idleStatus');
});

const statusDotClass = computed(() => {
  if (store.dshVersionTerminal.running) return 'bg-[#f59e0b]';
  if (store.dshVersionResult) {
    return store.dshVersionResult.ok ? 'bg-[#22c55e]' : 'bg-[#ef4444]';
  }
  return 'bg-slate-400 dark:bg-white/40';
});

watch(
  () => store.dshVersionTerminal.lines.length,
  async () => {
    await nextTick();
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  }
);

function clearLines() {
  store.dshVersionTerminal.lines = [];
}
</script>
