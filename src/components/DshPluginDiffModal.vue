<template>
  <div
    v-if="store.dshPluginDiffModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#1c1c1e] w-full max-w-3xl rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <GitCompare class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">DSH 插件配置对账</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">仓库镜像 vs 本地 <span class="font-mono">~/.dsh</span> 的差异</p>
          </div>
        </div>
        <button
          @click="store.dshPluginDiffModal.visible = false"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto py-4 space-y-3">
        <div v-if="!diff || diff.items.length === 0" class="text-center py-8 text-xs text-slate-500 dark:text-white/50">
          暂无差异
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(item, i) in diff.items"
            :key="i"
            class="rounded-lg border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#2c2c2e] p-3 transition-colors duration-200"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.5 rounded-md font-mono border',
                  kindClass(item.kind)
                ]"
              >
                {{ kindLabel(item.kind) }}
              </span>
              <span class="font-mono text-xs text-slate-900 dark:text-white/90 break-all">{{ item.name }}</span>
              <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">profile: {{ item.profileName }}</span>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div class="rounded-md bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 px-2 py-1.5">
                <div class="text-slate-400 dark:text-white/40">本地</div>
                <div class="text-slate-700 dark:text-white/70 break-all">{{ item.local || '—' }}</div>
              </div>
              <div class="rounded-md bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 px-2 py-1.5">
                <div class="text-slate-400 dark:text-white/40">仓库</div>
                <div class="text-slate-700 dark:text-white/70 break-all">{{ item.remote || '—' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 pt-3 border-t border-black/8 dark:border-white/8 flex-shrink-0">
        <div class="text-[11px] text-slate-400 dark:text-white/50">
          一键对齐会以仓库镜像为准写回本地，并执行 pnpm install
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="store.dshPluginDiffModal.visible = false"
            class="px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { GitCompare, X } from 'lucide-vue-next';
import type { DshPluginDiffItem } from '../types';

const store = useAppStore();
const diff = computed(() => store.dshPluginDiff);

function kindLabel(kind: DshPluginDiffItem['kind']): string {
  switch (kind) {
    case 'missing': return '缺失';
    case 'extra': return '多余';
    case 'version': return '版本差异';
    case 'patch': return 'patch 差异';
  }
}

function kindClass(kind: DshPluginDiffItem['kind']): string {
  switch (kind) {
    case 'missing': return 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30';
    case 'extra': return 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30';
    case 'version': return 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30';
    case 'patch': return 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10';
  }
}
</script>
