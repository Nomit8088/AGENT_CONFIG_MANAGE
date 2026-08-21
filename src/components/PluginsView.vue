<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 transition-colors duration-200">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-lg bg-[#bf5af2]/10 border border-[#bf5af2]/20 text-[#bf5af2] flex items-center justify-center shrink-0">
          <Puzzle class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">DSH 插件中心</h2>
            <span
              v-if="store.dshProfileCount > 0"
              class="px-1.5 py-0.5 rounded-md text-[10px] font-mono border bg-[#bf5af2]/10 text-[#bf5af2] border-[#bf5af2]/30"
            >
              {{ store.dshProfileCount }} profile
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
            管理本地 <span class="font-mono">~/.dsh/profiles/*</span> 插件：扫描、对账、诊断修复
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="handleRefresh"
          :disabled="store.dshPluginsScanLoading"
          class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.dshPluginsScanLoading }" />
          <span>重新扫描</span>
        </button>
      </div>
    </div>

    <!-- Segmented Tabs -->
    <div class="flex items-center p-1 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 shadow-xs text-xs w-fit">
      <button
        v-for="t in tabs"
        :key="t.id"
        @click="activeTab = t.id"
        :class="[
          'px-3.5 py-1.5 rounded-lg transition-colors duration-200 font-medium flex items-center gap-1.5',
          activeTab === t.id
            ? 'bg-black/5 dark:bg-[#2c2c2e] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
            : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
        ]"
      >
        <component :is="t.icon" class="w-3.5 h-3.5" />
        <span>{{ t.label }}</span>
      </button>
    </div>

    <!-- Panels -->
    <DshPluginList v-if="activeTab === 'panel'" />
    <DshDiagnose v-else-if="activeTab === 'diagnose'" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Puzzle, Stethoscope, RefreshCw } from 'lucide-vue-next';
import DshPluginList from './DshPluginList.vue';
import DshDiagnose from './DshDiagnose.vue';

const store = useAppStore();
const activeTab = ref<'panel' | 'diagnose'>('panel');

const tabs = [
  { id: 'panel' as const, label: '插件面板', icon: Puzzle },
  { id: 'diagnose' as const, label: '诊断修复', icon: Stethoscope },
];

onMounted(async () => {
  if (!store.dshPluginsScan) {
    await store.loadDshPlugins().catch(() => {});
  }
});

async function handleRefresh() {
  await store.loadDshPlugins().catch(() => {});
}
</script>
