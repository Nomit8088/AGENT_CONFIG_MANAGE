<template>
  <div class="space-y-3">
    <!-- 创建快照卡片 -->
    <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 border-t-[#8b5cf6]/60 overflow-hidden transition-colors duration-200">
      <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] flex items-center justify-center shrink-0">
            <History class="w-3.5 h-3.5" />
          </div>
          <div class="min-w-0">
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">配置快照与回滚</h3>
            <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 truncate">
              backups/dsh-profiles/ · 最近 20 份 + 永久保留
            </p>
          </div>
        </div>
        <select
          v-model="selectedProfile"
          class="bg-white dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-xs font-mono text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200 shrink-0"
        >
          <option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}</option>
        </select>
      </div>

      <div class="p-3 flex items-center gap-2">
        <input
          v-model="note"
          type="text"
          placeholder="备注（可选，说明本次快照的配置状态）..."
          class="flex-1 min-w-0 bg-white dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          @keyup.enter="createSnapshot"
        />
        <button
          type="button"
          @click="createSnapshot"
          :disabled="creating || !selectedProfile"
          class="px-3 py-1.5 rounded-lg bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 shrink-0"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>创建快照</span>
        </button>
      </div>
    </div>

    <!-- 时间线 -->
    <div
      v-if="!store.dshSnapshotsLoading && snapshots.length === 0"
      class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 p-6 text-center text-xs text-slate-500 dark:text-white/50"
    >
      暂无配置快照。创建快照或执行安装/对齐后，这里会出现可回滚的时间线。
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="s in snapshots"
        :key="s.id"
        class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 px-3 py-2.5 flex items-center justify-between gap-3 shadow-xs transition-colors duration-200"
      >
        <div class="flex items-start gap-2.5 min-w-0">
          <span class="w-1.5 h-1.5 rounded-sm mt-1.5 shrink-0" :class="triggerDot(s.trigger)"></span>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono text-xs text-slate-900 dark:text-white/90">{{ formatTime(s.createdAt) }}</span>
              <span class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border" :class="triggerBadge(s.trigger)">
                {{ triggerLabel(s.trigger) }}
              </span>
              <span
                v-if="s.permanent"
                class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30"
              >
                永久
              </span>
            </div>
            <p v-if="s.note" class="text-[11px] text-slate-500 dark:text-white/50 mt-0.5 truncate">{{ s.note }}</p>
            <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 mt-0.5 truncate">
              {{ s.files.length > 0 ? s.files.join(' · ') : '（快照时 profile 无配置文件）' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            :title="s.permanent ? '取消永久保留' : '标记永久保留'"
            @click="togglePermanent(s)"
            :class="[
              'p-1.5 rounded-lg border transition-colors duration-200 flex items-center justify-center',
              s.permanent
                ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
                : 'bg-white dark:bg-[#1c1d22] text-slate-500 dark:text-white/50 border-black/8 dark:border-white/8 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <PinOff v-if="s.permanent" class="w-3.5 h-3.5" />
            <Pin v-else class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="rollback(s)"
            class="px-2.5 py-1.5 rounded-lg bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>回滚</span>
          </button>
          <button
            type="button"
            title="删除快照"
            @click="remove(s)"
            class="p-1.5 rounded-lg bg-white dark:bg-[#1c1d22] text-slate-500 dark:text-white/50 border border-black/8 dark:border-white/8 hover:text-[#ff453a] dark:hover:text-[#ff453a] hover:border-[#ff453a]/30 transition-colors duration-200 flex items-center justify-center"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { History, Plus, Pin, PinOff, RotateCcw, Trash2 } from 'lucide-vue-next';
import type { DshConfigSnapshot, DshSnapshotTrigger } from '../types';

const store = useAppStore();
const selectedProfile = ref(store.dshPluginsScan?.profiles[0]?.name || 'web');
const note = ref('');
const creating = ref(false);

const profiles = computed(() => store.dshPluginsScan?.profiles || []);
const snapshots = computed(() => store.dshSnapshots);

onMounted(async () => {
  if (!store.dshPluginsScan) {
    await store.loadDshPlugins().catch(() => {});
  }
  const prof = store.dshPluginsScan?.profiles[0]?.name || 'web';
  if (!selectedProfile.value || !store.dshPluginsScan?.profiles.some(p => p.name === selectedProfile.value)) {
    selectedProfile.value = prof;
  }
  await store.loadDshSnapshots(selectedProfile.value).catch(() => {});
});

watch(selectedProfile, (p) => {
  if (p) store.loadDshSnapshots(p).catch(() => {});
});

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function triggerLabel(t: DshSnapshotTrigger): string {
  if (t === 'manual') return '手动';
  if (t === 'install') return '安装';
  if (t === 'upgrade') return 'DSH 升级';
  return '对齐';
}

function triggerBadge(t: DshSnapshotTrigger): string {
  if (t === 'manual') return 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30';
  if (t === 'install') return 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30';
  if (t === 'upgrade') return 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30';
  return 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30';
}

function triggerDot(t: DshSnapshotTrigger): string {
  if (t === 'manual') return 'bg-[#0a84ff]';
  if (t === 'install') return 'bg-[#8b5cf6]';
  if (t === 'upgrade') return 'bg-[#30d158]';
  return 'bg-[#ff9f0a]';
}

async function createSnapshot() {
  const prof = selectedProfile.value;
  if (!prof) return;
  creating.value = true;
  try {
    await store.createDshConfigSnapshot(prof, note.value.trim() || undefined);
    note.value = '';
  } catch (e: any) {
    store.showToast({ title: '创建快照失败', message: e?.message || '无法创建快照', type: 'error' });
  } finally {
    creating.value = false;
  }
}

async function rollback(s: DshConfigSnapshot) {
  const ok = window.confirm(
    `确认回滚到快照「${formatTime(s.createdAt)}」？\n\n将覆盖 profile [${s.profileName}] 的配置文件（package.json / cordis.patch.yml / pnpm-lock.yaml / pnpm-workspace.yaml），不覆盖 node_modules。`
  );
  if (!ok) return;
  try {
    await store.rollbackDshConfigSnapshot(s.id);
  } catch (e: any) {
    store.showToast({ title: '回滚失败', message: e?.message || '无法回滚配置', type: 'error' });
  }
}

async function togglePermanent(s: DshConfigSnapshot) {
  try {
    await store.setDshConfigSnapshotPermanent(s.id, !s.permanent);
  } catch (e: any) {
    store.showToast({ title: '操作失败', message: e?.message || '无法更新快照', type: 'error' });
  }
}

async function remove(s: DshConfigSnapshot) {
  const ok = window.confirm(`确认删除快照「${formatTime(s.createdAt)}」？`);
  if (!ok) return;
  try {
    await store.deleteDshConfigSnapshot(s.id);
  } catch (e: any) {
    store.showToast({ title: '删除失败', message: e?.message || '无法删除快照', type: 'error' });
  }
}
</script>
