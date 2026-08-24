<template>
  <div
    v-if="store.skillsDiffModal.visible"
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
              {{ isApply ? '确认从仓库应用' : '确认上传到仓库' }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-white/50">
              {{ isApply ? '逐文件选择「采用仓库」或「保留本地」' : '逐文件勾选要上传的本地文件' }}
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
        <div v-if="!diff || diff.length === 0" class="text-center py-8 text-xs text-slate-500 dark:text-white/50">
          暂无文件差异
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(e, i) in diff"
            :key="`${e.side}:${e.status}:${e.path}:${i}`"
            class="rounded-lg border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1d22] p-3 transition-colors duration-200"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.5 rounded-md font-mono border',
                  statusClass(e.status)
                ]"
              >
                {{ statusLabel(e.status) }}
              </span>
              <span class="font-mono text-xs text-slate-900 dark:text-white/90 break-all">{{ e.path }}</span>
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.5 rounded-md font-mono border',
                  sideClass(e.side)
                ]"
              >
                {{ sideLabel(e.side) }}
              </span>
            </div>

            <div class="mt-2 flex items-center gap-2 flex-wrap">
              <span class="text-[10px] text-slate-400 dark:text-white/40">处理方式</span>
              <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-[11px]">
                <button
                  type="button"
                  @click="setDir(e, 'remote')"
                  :class="dirBtnClass(e, 'remote')"
                >{{ remoteLabel }}</button>
                <button
                  type="button"
                  @click="setDir(e, 'local')"
                  :class="dirBtnClass(e, 'local')"
                >{{ localLabel }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 pt-3 border-t border-black/8 dark:border-white/8 flex-shrink-0">
        <div class="text-[11px] text-slate-400 dark:text-white/50">
          <template v-if="isApply">「采用仓库」会用远端版本覆盖本地对应文件，「保留本地」则不动。</template>
          <template v-else>仅上传勾选为「上传」的文件，其余跳过。</template>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="close"
            class="px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
          >
            取消
          </button>
          <button
            @click="confirm"
            :disabled="busy"
            class="px-3 py-1.5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium border border-[#8b5cf6] transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            <span>{{ busy ? '处理中…' : (isApply ? '确认应用' : '确认上传') }}</span>
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
import type { SkillsSyncDecision, SyncDiffEntry } from '../types';

const store = useAppStore();
const diff = computed(() => store.skillsSyncDiff);
const isApply = computed(() => store.skillsDiffModal.mode === 'apply');
const busy = ref(false);
const overrides = ref<Record<string, 'remote' | 'local'>>({});

const remoteLabel = computed(() => (isApply.value ? '采用仓库' : '跳过'));
const localLabel = computed(() => (isApply.value ? '保留本地' : '上传'));

function defaultDir(e: SyncDiffEntry): 'remote' | 'local' {
  // 远端领先默认采用仓库；本地领先/双方修改默认保留本地（不丢数据）
  return e.side === 'remote' ? 'remote' : 'local';
}

function dirOf(e: SyncDiffEntry): 'remote' | 'local' {
  return overrides.value[e.path] || defaultDir(e);
}

function setDir(e: SyncDiffEntry, dir: 'remote' | 'local') {
  overrides.value[e.path] = dir;
}

function dirBtnClass(e: SyncDiffEntry, dir: 'remote' | 'local'): string {
  const active = dirOf(e) === dir;
  const base = 'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium';
  if (!active) return `${base} text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80`;
  // apply 模式下「采用仓库」覆盖本地改动（side 含 local 成分）时红色警示
  if (isApply.value && dir === 'remote' && e.side !== 'remote') {
    return `${base} bg-[#ff453a]/10 text-[#ff453a] font-semibold shadow-xs`;
  }
  return `${base} bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs`;
}

function close() {
  store.skillsDiffModal.visible = false;
}

async function confirm() {
  busy.value = true;
  try {
    const items = diff.value || [];
    if (isApply.value) {
      const decisions: SkillsSyncDecision[] = items.map(e => ({
        path: e.path,
        direction: dirOf(e),
      }));
      await store.applySkillsFromRemote(decisions);
    } else {
      const paths = items.filter(e => dirOf(e) === 'local').map(e => e.path);
      await store.pushSkillsSync(undefined, paths);
    }
    store.skillsDiffModal.visible = false;
  } catch (err: any) {
    store.showToast({
      title: isApply.value ? '应用失败' : '上传失败',
      message: err?.message || (isApply.value ? '无法应用远端文件' : '无法上传文件'),
      type: 'error',
    });
  } finally {
    busy.value = false;
  }
}

function statusLabel(s: SyncDiffEntry['status']): string {
  if (s === 'added') return '新增';
  if (s === 'deleted') return '删除';
  return '修改';
}

function statusClass(s: SyncDiffEntry['status']): string {
  if (s === 'added') return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30';
  if (s === 'deleted') return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30';
  return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30';
}

function sideLabel(s: SyncDiffEntry['side']): string {
  if (s === 'local') return '本地领先';
  if (s === 'remote') return '远端领先';
  return '双方修改';
}

function sideClass(s: SyncDiffEntry['side']): string {
  if (s === 'local') return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30';
  if (s === 'remote') return 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30';
  return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30';
}
</script>
