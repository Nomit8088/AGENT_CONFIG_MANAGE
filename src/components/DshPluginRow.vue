<template>
  <div>
    <!-- Collapsed row (always visible) -->
    <div
      class="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      @click="expanded = !expanded"
    >
      <span class="w-2 h-2 rounded-sm shrink-0" :class="dotClass(entry.status)"></span>

      <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80 shrink-0">
        <Package v-if="entry.kind === 'bundle'" class="w-3.5 h-3.5" />
        <CircleDot v-else class="w-3.5 h-3.5" />
      </div>

      <div class="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        <span class="font-mono text-xs text-slate-900 dark:text-white/90 truncate max-w-[200px]" :title="entry.name">{{ entry.name }}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border shrink-0" :class="kindBadgeClass(entry.kind)">
          {{ kindLabel(entry.kind) }}
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border shrink-0" :class="statusBadgeClass(entry.status)">
          {{ statusLabel(entry.status) }}
        </span>
        <span
          v-if="entry.portability === 'unportable'"
          class="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30 shrink-0"
          title="link:/file: 等本机路径，不参与同步"
        >
          不可移植
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0" @click.stop>
        <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
          <button
            type="button"
            @click="emit('toggle', entry, true)"
            :class="[
              'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              entry.enabled
                ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span v-if="entry.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
            <span>启用</span>
          </button>
          <button
            type="button"
            @click="emit('toggle', entry, false)"
            :class="[
              'px-2 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              !entry.enabled
                ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>停用</span>
          </button>
        </div>

        <button
          type="button"
          @click.stop="expanded = !expanded"
          :title="expanded ? '收起详情' : '展开查看 spec / installed / required 与操作'"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
        >
          <ChevronDown class="w-3.5 h-3.5 transition-transform duration-200" :class="{ 'rotate-180': expanded }" />
        </button>
      </div>
    </div>

    <!-- Expanded detail (click to expand) -->
    <div v-if="expanded" class="px-3.5 pb-3 pl-[3.25rem] space-y-2">
      <!-- Version / spec tri-column -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px] font-mono">
        <span class="truncate" :class="entry.spec ? 'text-slate-500 dark:text-white/50' : 'text-slate-400 dark:text-white/40'" :title="`spec: ${entry.spec || '—'}`">
          spec: {{ entry.spec || '—' }}
        </span>
        <span
          class="truncate"
          :class="entry.installed && entry.status !== 'version-mismatch' ? 'text-[#30d158] dark:text-[#30d158]' : 'text-slate-500 dark:text-white/50'"
          :title="`installed: ${entry.installed ? `v${entry.installedVersion || '?'}` : '未安装'}`"
        >
          installed: {{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}
        </span>
        <span
          class="truncate"
          :class="entry.status === 'version-mismatch' ? 'text-[#ff453a] dark:text-[#ff453a]' : 'text-slate-500 dark:text-white/50'"
          :title="`required: ${entry.requiredVersion ? `v${entry.requiredVersion}` : '—'}`"
        >
          required: {{ entry.requiredVersion ? `v${entry.requiredVersion}` : '—' }}
        </span>
      </div>

      <!-- Update check info -->
      <div v-if="updateCheck?.updateAvailable" class="text-[11px] font-mono text-[#ff9f0a]">
        可更新：{{ updateCheck.current || '?' }} → {{ updateCheck.latest || '?' }}
      </div>
      <div v-else-if="updateCheck?.error" class="text-[11px] font-mono text-[#ff453a]">{{ updateCheck.error }}</div>
      <div v-else-if="updateCheck?.hint" class="text-[11px] font-mono text-slate-400 dark:text-white/40">{{ updateCheck.hint }}</div>

      <!-- Action buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-if="entry.installError"
          type="button"
          @click="emit('show-error', entry.installError || '')"
          class="text-[11px] text-[#ff453a] hover:text-[#ff9f0a] transition-colors duration-200 font-medium"
        >
          查看失败堆栈
        </button>

        <button
          v-if="entry.portability === 'portable' && entry.kind !== 'row' && !updateCheck?.updateAvailable"
          type="button"
          @click="emit('check-update', entry)"
          class="px-2 py-1 rounded-lg text-[11px] font-medium bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center gap-1"
        >
          <RefreshCw class="w-3 h-3" />
          <span>检查更新</span>
        </button>

        <button
          v-if="updateCheck?.updateAvailable"
          type="button"
          @click="emit('update', entry)"
          class="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30 hover:bg-[#ff9f0a]/20 transition-colors duration-200 flex items-center gap-1"
        >
          <Download class="w-3 h-3" />
          <span>更新</span>
        </button>

        <button
          type="button"
          :title="entry.declaredInConfig ? '卸载（从 dependencies / bundles / patch 中彻底移除）' : '从 node_modules 移除'"
          @click="emit('remove', entry)"
          class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-[#ff453a] dark:text-white/40 dark:hover:text-[#ff453a] hover:bg-[#ff453a]/10 hover:border-[#ff453a]/30 border border-transparent transition-colors duration-200 flex items-center gap-1"
        >
          <Trash2 class="w-3 h-3" />
          <span>{{ entry.declaredInConfig ? '卸载' : '移除' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Package, CircleDot, ChevronDown, RefreshCw, Download, Trash2 } from 'lucide-vue-next';
import type { DshPluginInstallEntry, DshPluginInstallStatus, DshPluginKind, DshPluginUpdateCheck } from '../types';

const props = defineProps<{
  entry: DshPluginInstallEntry;
  updateCheck?: DshPluginUpdateCheck;
}>();

const emit = defineEmits<{
  (e: 'toggle', entry: DshPluginInstallEntry, enabled: boolean): void;
  (e: 'remove', entry: DshPluginInstallEntry): void;
  (e: 'show-error', stack: string): void;
  (e: 'check-update', entry: DshPluginInstallEntry): void;
  (e: 'update', entry: DshPluginInstallEntry): void;
}>();

// 异常状态默认展开，让用户第一时间看到原因与修复入口
const expanded = ref(
  props.entry.status === 'failed' ||
    props.entry.status === 'version-mismatch' ||
    Boolean(props.updateCheck?.updateAvailable)
);

function dotClass(status: DshPluginInstallStatus): string {
  switch (status) {
    case 'ok': return 'bg-[#30d158]';
    case 'pending': return 'bg-[#ff9f0a]';
    case 'orphan': return 'bg-[#ff9f0a]';
    case 'version-mismatch': return 'bg-[#ff453a]';
    case 'failed': return 'bg-[#ff453a]';
  }
}

function kindLabel(kind: DshPluginKind): string {
  switch (kind) {
    case 'inbox': return '内置';
    case 'bundle': return 'bundle';
    case 'plain': return '依赖';
    case 'row': return 'patch 行';
  }
}

function kindBadgeClass(kind: DshPluginKind): string {
  switch (kind) {
    case 'inbox':
      return 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30';
    case 'bundle':
      return 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30';
    case 'plain':
      return 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10';
    case 'row':
      return 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30';
  }
}

function statusLabel(status: DshPluginInstallStatus): string {
  switch (status) {
    case 'ok': return '正常';
    case 'pending': return '待装';
    case 'orphan': return '孤儿';
    case 'version-mismatch': return '版本冲突';
    case 'failed': return '失败';
  }
}

function statusBadgeClass(status: DshPluginInstallStatus): string {
  switch (status) {
    case 'ok':
      return 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30';
    case 'pending':
    case 'orphan':
      return 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30';
    case 'version-mismatch':
    case 'failed':
      return 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30';
  }
}
</script>
