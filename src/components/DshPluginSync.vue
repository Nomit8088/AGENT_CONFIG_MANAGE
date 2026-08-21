<template>
  <!-- DSH 插件配置对账：本地 ~/.dsh ↔ 同步镜像 dsh/（与「DSH 插件同步」卡片区分，仅做配置一致性对账与一键对齐） -->
  <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 border-t-[#bf5af2]/60 overflow-hidden transition-colors duration-200">
    <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-7 h-7 rounded-lg bg-[#bf5af2]/10 border border-[#bf5af2]/20 text-[#bf5af2] flex items-center justify-center shrink-0">
          <GitCompare class="w-3.5 h-3.5" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">DSH 插件配置对账</h3>
            <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">dsh/</span>
          </div>
          <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 truncate">
            本地 ~/.dsh ↔ 同步镜像 dsh/
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="handleReconcile"
          :disabled="loading"
          class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>对账</span>
        </button>
        <button
          @click="handleAlign"
          :disabled="loading || (diff && diff.compatible)"
          class="px-3 py-1.5 rounded-lg bg-[#bf5af2]/10 hover:bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle class="w-3.5 h-3.5" />
          <span>一键对齐</span>
        </button>
      </div>
    </div>

    <div class="p-4 space-y-2.5">
      <div v-if="diff" class="space-y-2">
        <div
          :class="[
            'px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors duration-200',
            diff.compatible
              ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
              : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30'
          ]"
        >
          {{ diff.compatible ? '配置一致，无需对齐' : `${diff.items.length} 处差异` }}
        </div>

        <div v-if="diff.warnings.length > 0" class="space-y-1">
          <div
            v-for="(w, i) in diff.warnings"
            :key="i"
            class="px-2.5 py-1.5 rounded-lg bg-[#ff9f0a]/5 border border-[#ff9f0a]/20 text-[11px] text-[#ff9f0a] font-mono"
          >
            {{ w }}
          </div>
        </div>

        <button
          v-if="diff.items.length > 0"
          @click="store.dshPluginDiffModal.visible = true"
          class="text-xs text-[#bf5af2] hover:underline transition-colors duration-200"
        >
          查看差异详情 →
        </button>
      </div>
      <p v-else class="text-[11px] text-slate-400 dark:text-white/50">
        点击「对账」比较本地 <span class="font-mono">~/.dsh/profiles/*</span> 与同步镜像 <span class="font-mono">dsh/profiles/*</span> 的插件配置差异
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import {
  RefreshCw,
  GitCompare,
  CheckCircle,
} from 'lucide-vue-next';

const store = useAppStore();

const loading = computed(() => store.dshPluginsSyncLoading);
const diff = computed(() => store.dshPluginDiff);

async function handleReconcile() {
  try {
    await store.reconcileDshPlugins();
  } catch (e: any) {
    store.showToast({ title: '对账失败', message: e?.message || '无法执行对账', type: 'error' });
  }
}

async function handleAlign() {
  try {
    await store.alignDshPlugins();
  } catch (e: any) {
    store.showToast({ title: '对齐失败', message: e?.message || '无法对齐插件配置', type: 'error' });
  }
}
</script>
