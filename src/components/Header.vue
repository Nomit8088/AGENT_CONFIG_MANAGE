<template>
  <header class="h-12 border-b border-black/8 dark:border-white/8 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl px-4 flex items-center justify-between z-20 flex-shrink-0 select-none transition-colors duration-200">
    <!-- Brand Logo & Status -->
    <div class="flex items-center gap-3 min-w-0">
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center">
          <Layers class="w-3.5 h-3.5 text-slate-800 dark:text-white/90" />
        </div>
        <span class="font-serif font-semibold text-sm tracking-wide text-slate-900 dark:text-white/95">AgentHub</span>
        <button
          @click="store.openUpdateModal()"
          title="检查更新"
          :class="[
            'hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono border transition-colors duration-200',
            store.appUpdate?.updateAvailable
              ? 'bg-[#ff9f0a]/15 text-[#ff9f0a] border-[#ff9f0a]/30'
              : 'bg-black/5 dark:bg-white/6 text-slate-500 dark:text-white/60 border-black/8 dark:border-white/8 hover:text-slate-800 dark:hover:text-white/90'
          ]"
        >
          <span v-if="store.appUpdate?.updateAvailable" class="w-1.5 h-1.5 rounded-sm bg-[#ff9f0a]"></span>
          <span>v{{ versionShort }}</span>
        </button>
      </div>

      <!-- Quick Status Badges (仅大窗展示，小窗自动隐藏避免拥挤) -->
      <div class="hidden lg:flex items-center gap-2 pl-3 border-l border-black/8 dark:border-white/8 text-xs">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 text-slate-600 dark:text-white/70">
          <span class="w-2 h-2 rounded-sm bg-[#30d158]"></span>
          <span>{{ store.detectedAgentsCount }} / {{ store.enabledAgents.length }} Agents 活跃</span>
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 text-slate-600 dark:text-white/70">
          <Layers class="w-3.5 h-3.5 text-slate-500 dark:text-white/70" />
          <span>{{ store.skills.length }} 中央 Skills</span>
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 text-slate-600 dark:text-white/70">
          <ShieldCheck class="w-3.5 h-3.5 text-slate-500 dark:text-white/70" />
          <span>{{ store.activeProjectsCount }} 项目守卫中</span>
        </div>
      </div>
    </div>

    <!-- Center / Right Actions -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <!-- Quick Theme Switcher Button -->
      <button
        @click="cycleTheme"
        :title="themeTitle"
        class="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 border border-black/8 dark:border-white/8 text-slate-700 dark:text-white/80 transition-colors duration-200 flex items-center gap-1 text-xs"
      >
        <Moon v-if="store.config.theme === 'dark'" class="w-3.5 h-3.5 text-slate-800 dark:text-white/90" />
        <Sun v-else-if="store.config.theme === 'light'" class="w-3.5 h-3.5 text-[#ff9f0a]" />
        <Monitor v-else class="w-3.5 h-3.5 text-slate-600 dark:text-white/80" />
      </button>

      <!-- Scan Agents Button -->
      <button
        @click="store.scanAgents()"
        :disabled="store.isLoading"
        title="重新扫描本机 Agent 环境"
        class="px-2.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 border border-black/8 dark:border-white/8 text-xs font-medium text-slate-800 dark:text-white/90 flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
      >
        <RefreshCw class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" :class="{ 'animate-spin': store.isLoading }" />
        <span class="hidden md:inline">扫描</span>
      </button>

      <!-- Settings Button -->
      <button
        @click="store.settingsModal.visible = true"
        title="全局设置与偏好"
        class="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 border border-black/8 dark:border-white/8 text-slate-700 hover:text-slate-900 dark:text-white/80 dark:hover:text-white/95 transition-colors duration-200"
      >
        <Settings class="w-3.5 h-3.5" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { APP_VERSION } from '../types';
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

const versionShort = computed(() => {
  const v = store.appUpdate?.currentVersion || APP_VERSION;
  return v.split('.').slice(0, 2).join('.');
});

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

