<template>
  <div
    v-if="store.logViewerModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#121316] w-full max-w-2xl rounded-xl border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none flex flex-col max-h-[85vh] text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-black/8 dark:border-white/8">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <FileText class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('logs.title') }}</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">{{ $t('logs.subtitle') }}</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Desensitization hint -->
      <div class="px-6 pt-3">
        <div class="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[11px] leading-relaxed">
          {{ $t('logs.desensitizeHint') }}
        </div>
      </div>

      <!-- Toolbar -->
      <div class="px-6 py-3 flex flex-wrap items-center gap-2">
        <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
          <button
            v-for="lv in levels"
            :key="lv.value"
            type="button"
            @click="setLevel(lv.value)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium',
              store.appLogLevel === lv.value
                ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>{{ lv.value === '' ? $t('common.all') : lv.value }}</span>
          </button>
        </div>

        <div class="flex-1"></div>

        <button
          type="button"
          @click="refresh"
          :disabled="store.appLogsLoading"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#1c1d22] dark:hover:bg-white/8 text-slate-700 dark:text-white/80 border border-black/10 dark:border-white/10 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw :class="['w-3.5 h-3.5', store.appLogsLoading ? 'animate-spin' : '']" />
          <span>{{ $t('logs.refresh') }}</span>
        </button>

        <button
          type="button"
          @click="exportLogs"
          :disabled="store.appLogsLoading"
          class="px-2.5 py-1 rounded-lg bg-[#3b82f6]/10 hover:bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download class="w-3.5 h-3.5" />
          <span>{{ $t('logs.export') }}</span>
        </button>

        <button
          type="button"
          @click="copyPath"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#1c1d22] dark:hover:bg-white/8 text-slate-700 dark:text-white/80 border border-black/10 dark:border-white/10 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
        >
          <Check v-if="copied" class="w-3.5 h-3.5" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copied ? $t('logs.copied') : $t('logs.copyPath') }}</span>
        </button>
      </div>

      <!-- Log path -->
      <div class="px-6 pb-3">
        <div class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/50">
          <span class="shrink-0 font-medium">{{ $t('logs.pathLabel') }}</span>
          <span class="font-mono text-slate-800 dark:text-white/80 truncate">{{ store.appLogPath || '—' }}</span>
        </div>
      </div>

      <!-- Log list -->
      <div class="flex-1 min-h-0 mx-6 mb-6 rounded-lg bg-black/[0.02] dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 overflow-y-auto">
        <div v-if="store.appLogsLoading" class="p-4 text-xs text-slate-500 dark:text-white/50">
          {{ $t('logs.loading') }}
        </div>
        <div v-else-if="store.appLogs.length === 0" class="p-4 text-xs text-slate-500 dark:text-white/50">
          {{ $t('logs.empty') }}
        </div>
        <ul v-else class="divide-y divide-black/5 dark:divide-white/5">
          <li
            v-for="(entry, i) in store.appLogs"
            :key="`${i}-${entry.message.length}`"
            class="flex items-start gap-2 px-3 py-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-200"
          >
            <span
              :class="[
                'shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border',
                levelClass(entry.level)
              ]"
            >
              {{ entry.level }}
            </span>
            <span class="font-mono text-[11px] leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap break-all">
              {{ entry.message }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { FileText, X, RefreshCw, Download, Copy, Check } from 'lucide-vue-next';
import { AppLogLevel } from '../types';

const store = useAppStore();
const copied = ref(false);

const levels: { value: '' | AppLogLevel }[] = [
  { value: '' },
  { value: 'DEBUG' },
  { value: 'INFO' },
  { value: 'WARN' },
  { value: 'ERROR' },
];

function close() {
  store.closeLogViewer();
}

function setLevel(level: '' | AppLogLevel) {
  store.appLogLevel = level;
  store.loadAppLogs(undefined, level || undefined).catch(() => {});
}

function refresh() {
  store.loadAppLogs(undefined, store.appLogLevel || undefined).catch(() => {});
}

async function exportLogs() {
  await store.exportAppLogs();
}

async function copyPath() {
  try {
    await store.refreshAppLogPath();
    await navigator.clipboard.writeText(store.appLogPath);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // 某些 WebView 环境不支持剪贴板 API，静默降级
  }
}

function levelClass(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    case 'WARN':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'INFO':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'DEBUG':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
  }
}
</script>
