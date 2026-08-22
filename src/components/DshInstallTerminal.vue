<template>
  <div class="rounded-xl bg-[#121316] border border-black/8 dark:border-white/8 overflow-hidden transition-colors duration-200">
    <!-- Status bar -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-black/8 dark:border-white/8 bg-black/5 dark:bg-[#1c1d22]">
      <div class="flex items-center gap-2 text-xs">
        <span
          class="w-2 h-2 rounded-sm transition-colors duration-200"
          :class="statusDotClass"
        ></span>
        <span class="font-mono text-slate-700 dark:text-white/90">{{ statusText }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="store.installTerminal.lines.length > 0"
          type="button"
          @click="clearLines"
          class="text-[11px] px-2 py-1 rounded-md text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 transition-colors duration-200"
        >
          清屏
        </button>
        <button
          type="button"
          @click="store.toggleInstallTerminal(false)"
          class="p-1 rounded-md text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Log output -->
    <div ref="logRef" class="h-36 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300 dark:text-[#e5e5ea] whitespace-pre-wrap break-all">
      <p v-if="store.installTerminal.lines.length === 0" class="text-slate-500 dark:text-white/40">
        终端空闲，点击上方安装按钮开始流式输出 pnpm 日志…
      </p>
      <template v-else>
        <div v-for="(line, idx) in store.installTerminal.lines" :key="idx">{{ line }}</div>
      </template>
    </div>

    <!-- Report summary -->
    <div
      v-if="store.dshInstallReport"
      class="px-3 py-2 border-t border-black/8 dark:border-white/8 bg-black/5 dark:bg-[#1c1d22] text-[11px] font-mono flex items-center gap-3 flex-wrap"
    >
      <span :class="store.dshInstallReport.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'">
        {{ store.dshInstallReport.ok ? '✓ 安装成功' : '✗ 安装存在失败' }}
      </span>
      <span class="text-slate-500 dark:text-white/50">mode: {{ store.dshInstallReport.mode }}</span>
      <span class="text-slate-500 dark:text-white/50">installed: {{ store.dshInstallReport.installed.length }}</span>
      <span class="text-slate-500 dark:text-white/50">updated: {{ store.dshInstallReport.updated.length }}</span>
      <span class="text-slate-500 dark:text-white/50">failed: {{ store.dshInstallReport.failed.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { X } from 'lucide-vue-next';

const store = useAppStore();
const logRef = ref<HTMLElement | null>(null);

const statusText = computed(() => {
  if (store.installTerminal.running) return '运行中 (pnpm)…';
  if (store.dshInstallReport) {
    return store.dshInstallReport.ok ? '完成 · 成功' : '完成 · 存在失败';
  }
  return '空闲';
});

const statusDotClass = computed(() => {
  if (store.installTerminal.running) return 'bg-[#f59e0b]';
  if (store.dshInstallReport) {
    return store.dshInstallReport.ok ? 'bg-[#22c55e]' : 'bg-[#ef4444]';
  }
  return 'bg-slate-400 dark:bg-white/40';
});

watch(
  () => store.installTerminal.lines.length,
  async () => {
    await nextTick();
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  }
);

function clearLines() {
  store.installTerminal.lines = [];
}
</script>
