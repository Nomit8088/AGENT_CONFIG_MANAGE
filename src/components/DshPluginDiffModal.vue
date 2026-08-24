<template>
  <div
    v-if="store.dshPluginDiffModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#121316] w-full max-w-3xl rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <GitCompare class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">
              {{ isApply ? '确认从仓库应用' : 'DSH 插件配置对账' }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-white/50">
              {{ isApply ? '将用仓库镜像覆盖本地配置，请确认以下变更' : '仓库镜像 vs 本地 ~/.dsh 的差异' }}
            </p>
          </div>
        </div>
        <button
          @click="close"
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
            class="rounded-lg border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1d22] p-3 transition-colors duration-200"
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
              <div class="rounded-md bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8 px-2 py-1.5">
                <div class="text-slate-400 dark:text-white/40">本地</div>
                <div class="text-slate-700 dark:text-white/70 break-all">{{ item.local || '—' }}</div>
              </div>
              <div class="rounded-md bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8 px-2 py-1.5">
                <div class="text-slate-400 dark:text-white/40">仓库</div>
                <div class="text-slate-700 dark:text-white/70 break-all">{{ item.remote || '—' }}</div>
              </div>
            </div>

            <div v-if="isApply" class="mt-2 flex items-center gap-2 flex-wrap">
              <span class="text-[10px] text-slate-400 dark:text-white/40">处理方式</span>
              <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-[11px]">
                <button
                  type="button"
                  @click="setDir(item, 'remote')"
                  :class="dirBtnClass(item, 'remote')"
                >{{ remoteLabel(item.kind) }}</button>
                <button
                  type="button"
                  @click="setDir(item, 'local')"
                  :class="dirBtnClass(item, 'local')"
                >{{ localLabel(item.kind) }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 pt-3 border-t border-black/8 dark:border-white/8 flex-shrink-0">
        <div class="text-[11px] text-slate-400 dark:text-white/50">
          <template v-if="isApply">按上方每条选择的方向写回本地并执行 pnpm install；「丢弃」会移除本地插件。</template>
          <template v-else>仅比较，不修改任何配置。如需以仓库覆盖本地，请使用「从仓库应用」。</template>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="close"
            class="px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
          >
            {{ isApply ? '取消' : '关闭' }}
          </button>
          <button
            v-if="isApply"
            @click="confirmApply"
            :disabled="applying"
            class="px-3 py-1.5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium border border-[#8b5cf6] transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            <span>{{ applying ? '应用中…' : '确认应用（以仓库为准）' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { CheckCircle, GitCompare, X } from 'lucide-vue-next';
import type { DshAlignDecision, DshAlignDirection, DshPluginDiffItem } from '../types';

const store = useAppStore();
const diff = computed(() => store.dshPluginDiff);
const isApply = computed(() => store.dshPluginDiffModal.mode === 'apply');
const applying = ref(false);
const overrides = ref<Record<string, DshAlignDirection>>({});

const REMOTE_LABEL: Record<DshPluginDiffItem['kind'], string> = {
  missing: '采纳仓库',
  extra: '丢弃',
  version: '采用仓库',
  patch: '采用仓库',
};
const LOCAL_LABEL: Record<DshPluginDiffItem['kind'], string> = {
  missing: '跳过',
  extra: '保留本地',
  version: '保留本地',
  patch: '保留本地',
};

function itemKey(item: DshPluginDiffItem): string {
  return `${item.profileName}|${item.kind}|${item.name}`;
}

function defaultDir(kind: DshPluginDiffItem['kind']): DshAlignDirection {
  return kind === 'missing' || kind === 'patch' ? 'remote' : 'local';
}

function dirOf(item: DshPluginDiffItem): DshAlignDirection {
  return overrides.value[itemKey(item)] || defaultDir(item.kind);
}

function setDir(item: DshPluginDiffItem, dir: DshAlignDirection) {
  overrides.value[itemKey(item)] = dir;
}

function remoteLabel(kind: DshPluginDiffItem['kind']): string {
  return REMOTE_LABEL[kind];
}

function localLabel(kind: DshPluginDiffItem['kind']): string {
  return LOCAL_LABEL[kind];
}

function dirBtnClass(item: DshPluginDiffItem, dir: DshAlignDirection): string {
  const active = dirOf(item) === dir;
  const base = 'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium';
  if (!active) return `${base} text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80`;
  if (item.kind === 'extra' && dir === 'remote') {
    return `${base} bg-[#ff453a]/10 text-[#ff453a] font-semibold shadow-xs`;
  }
  return `${base} bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs`;
}

function close() {
  store.dshPluginDiffModal.visible = false;
}

async function confirmApply() {
  applying.value = true;
  try {
    const items = diff.value?.items || [];
    const decisions: DshAlignDecision[] = items.map(item => ({
      profileName: item.profileName,
      name: item.name,
      direction: dirOf(item),
    }));
    await store.alignDshPlugins(undefined, decisions);
    store.dshPluginDiffModal.visible = false;
  } catch (e: any) {
    store.showToast({ title: '应用失败', message: e?.message || '无法应用仓库配置', type: 'error' });
  } finally {
    applying.value = false;
  }
}

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
    case 'missing': return 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30';
    case 'extra': return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30';
    case 'version': return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30';
    case 'patch': return 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10';
  }
}
</script>
