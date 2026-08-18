<template>
  <header class="h-14 border-b border-slate-200 dark:border-dark-800 bg-white/90 dark:bg-dark-900/80 backdrop-blur-md px-5 flex items-center justify-between z-20 flex-shrink-0 select-none transition-colors">
    <!-- Brand Logo & Status -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-md shadow-brand-500/20">
          <Layers class="w-4 h-4 text-white" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-sm tracking-wide text-slate-900 dark:text-slate-100">AgentHub</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 font-mono font-medium">v1.0</span>
          </div>
        </div>
      </div>

      <!-- Quick Status Badges -->
      <div class="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-dark-800 text-xs">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-700/50 text-slate-700 dark:text-slate-300">
          <span class="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse"></span>
          <span>{{ store.detectedAgentsCount }} / {{ store.enabledAgents.length }} Agents 活跃</span>
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-700/50 text-slate-700 dark:text-slate-300">
          <Layers class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>{{ store.skills.length }} 中央 Skills</span>
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-700/50 text-slate-700 dark:text-slate-300">
          <ShieldCheck class="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>{{ store.activeProjectsCount }} 项目守卫中</span>
        </div>
      </div>
    </div>

    <!-- Center / Right Actions -->
    <div class="flex items-center gap-2">
      <!-- Quick Theme Switcher Button -->
      <button
        @click="cycleTheme"
        :title="themeTitle"
        class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700/70 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition active:scale-95 flex items-center gap-1 text-xs"
      >
        <Moon v-if="store.config.theme === 'dark'" class="w-4 h-4 text-brand-400" />
        <Sun v-else-if="store.config.theme === 'light'" class="w-4 h-4 text-amber-500" />
        <Monitor v-else class="w-4 h-4 text-sky-500 dark:text-sky-400" />
      </button>

      <!-- Scan Agents Button -->
      <button
        @click="store.scanAgents()"
        :disabled="store.isLoading"
        title="重新扫描本机 Agent 环境"
        class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700/70 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
      >
        <RefreshCw class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" :class="{ 'animate-spin': store.isLoading }" />
        <span class="hidden sm:inline">扫描环境</span>
      </button>

      <!-- Settings Button -->
      <button
        @click="store.settingsModal.visible = true"
        title="全局设置与偏好"
        class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700/70 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition active:scale-95"
      >
        <Settings class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import {
  Layers,
  ShieldCheck,
  RefreshCw,
  Settings,
  Moon,
  Sun,
  Monitor,
} from 'lucide-vue-next';

const store = useAppStore();

const themeTitle = computed(() => {
  if (store.config.theme === 'dark') return '当前: 深色模式 (点击切换浅色)';
  if (store.config.theme === 'light') return '当前: 浅色模式 (点击切换跟随系统)';
  const sys = store.config.system_theme === 'dark' ? '深色' : '浅色';
  return `当前: 跟随系统 (系统检测为: ${sys}模式，点击切换深色)`;
});

async function cycleTheme() {
  let nextTheme: 'dark' | 'light' | 'system' = 'dark';
  if (store.config.theme === 'dark') nextTheme = 'light';
  else if (store.config.theme === 'light') nextTheme = 'system';
  else nextTheme = 'dark';

  await store.saveConfig({
    ...store.config,
    theme: nextTheme,
  });
}
</script>
