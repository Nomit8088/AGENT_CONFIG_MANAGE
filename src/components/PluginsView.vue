<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 transition-colors duration-200">
    <!-- Header Banner -->
    <div class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
          <Puzzle class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="font-serif font-bold text-base text-slate-900 dark:text-white">DSH 插件中心</h2>
            <span
              v-if="store.dshProfileCount > 0"
              class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25"
            >
              {{ store.dshProfileCount }} profile
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
            管理本地 <span class="font-mono text-purple-600 dark:text-purple-400">~/.dsh/profiles/*</span> 插件：扫描、对账、诊断修复
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="handleRefresh"
          :disabled="store.dshPluginsScanLoading"
          class="px-3.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5 text-purple-500" :class="{ 'animate-spin': store.dshPluginsScanLoading }" />
          <span>重新扫描</span>
        </button>
      </div>
    </div>

    <!-- Segmented Tabs -->
    <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs w-fit">
      <button
        v-for="t in tabs"
        :key="t.id"
        @click="activeTab = t.id"
        :class="[
          'px-3 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
          activeTab === t.id
            ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
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
    <DshConfigSnapshots v-else-if="activeTab === 'snapshots'" />
    <DshVersionManager v-else-if="activeTab === 'version'" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Puzzle, Stethoscope, RefreshCw, History, Rocket } from 'lucide-vue-next';
import DshPluginList from './DshPluginList.vue';
import DshDiagnose from './DshDiagnose.vue';
import DshConfigSnapshots from './DshConfigSnapshots.vue';
import DshVersionManager from './DshVersionManager.vue';

const store = useAppStore();
const activeTab = ref<'panel' | 'diagnose' | 'snapshots' | 'version'>('panel');

const tabs = [
  { id: 'panel' as const, label: '插件面板', icon: Puzzle },
  { id: 'diagnose' as const, label: '诊断修复', icon: Stethoscope },
  { id: 'snapshots' as const, label: '快照回滚', icon: History },
  { id: 'version' as const, label: 'DSH 版本', icon: Rocket },
];

onMounted(async () => {
  if (!store.dshPluginsScan) {
    await store.loadDshPlugins().catch(() => {});
  }
  const prof = store.dshPluginsScan?.profiles[0]?.name || 'web';
  await store.loadDshInstallEntries(prof).catch(() => {});
});

async function handleRefresh() {
  await store.loadDshPlugins().catch(() => {});
  const prof = store.dshPluginsScan?.profiles[0]?.name || 'web';
  await store.loadDshInstallEntries(prof).catch(() => {});
}
</script>
