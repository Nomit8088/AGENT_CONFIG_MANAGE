<template>
  <!-- DSH 插件配置对账：本地 ~/.dsh ↔ 同步镜像 dsh/（与「DSH 插件同步」卡片区分，仅做只读差异预览；覆盖操作统一走「从仓库应用」） -->
  <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 border-t-[#8b5cf6]/60 overflow-hidden transition-colors duration-200">
    <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-7 h-7 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] flex items-center justify-center shrink-0">
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
          @click="handlePreview"
          :disabled="loading"
          class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
        >
          <GitCompare class="w-3.5 h-3.5" />
          <span>预览差异</span>
        </button>
      </div>
    </div>

    <div class="p-4 space-y-2.5">
      <div v-if="diff" class="space-y-2">
        <div
          :class="[
            'px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors duration-200',
            diff.compatible
              ? 'bg-black/5 dark:bg-white/6 text-slate-700 dark:text-white/80 border-black/8 dark:border-white/8'
              : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
          ]"
        >
          {{ diff.compatible ? '配置一致，无需对齐' : `${diff.items.length} 处差异` }}
        </div>

        <div v-if="diff.warnings.length > 0" class="space-y-1">
          <div
            v-for="(w, i) in diff.warnings"
            :key="i"
            class="px-2.5 py-1.5 rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/20 text-[11px] text-[#f59e0b] font-mono"
          >
            {{ w }}
          </div>
        </div>

        <button
          v-if="diff.items.length > 0"
          @click="store.dshPluginDiffModal = { visible: true, mode: 'preview' }"
          class="text-xs text-[#8b5cf6] hover:underline transition-colors duration-200"
        >
          查看差异详情 →
        </button>
      </div>
      <p v-else class="text-[11px] text-slate-400 dark:text-white/50">
        点击「预览差异」比较本地 <span class="font-mono">~/.dsh/profiles/*</span> 与同步镜像 <span class="font-mono">dsh/profiles/*</span>；以仓库覆盖本地的操作统一走上方「从仓库应用」，应用前会先展示差异
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { GitCompare } from 'lucide-vue-next';

const store = useAppStore();

const loading = computed(() => store.dshPluginsSyncLoading);
const diff = computed(() => store.dshPluginDiff);

async function handlePreview() {
  try {
    await store.reconcileDshPlugins();
    store.dshPluginDiffModal = { visible: true, mode: 'preview' };
  } catch (e: any) {
    store.showToast({ title: '预览差异失败', message: e?.message || '无法执行对账', type: 'error' });
  }
}
</script>
