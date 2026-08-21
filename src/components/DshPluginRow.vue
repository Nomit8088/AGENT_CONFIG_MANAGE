<template>
  <!-- 列表行形态 -->
  <div v-if="layout === 'list'" class="px-3.5 py-2.5 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
    <div class="flex items-center gap-2.5">
      <span class="w-2 h-2 rounded-sm ring-2 shrink-0" :class="dotClass(entry.status)"></span>

      <div
        class="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
        :class="iconTileClass"
      >
        <component :is="iconFor(entry.kind)" class="w-3.5 h-3.5" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span
            class="font-mono text-xs text-slate-900 dark:text-white/90 truncate max-w-[220px]"
            :title="entry.name"
          >{{ entry.name }}</span>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border shrink-0"
            :class="badge.cls"
          >{{ badge.label }}</span>
        </div>
        <div class="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
          <template v-if="isInbox">
            <span class="text-slate-400 dark:text-white/40">Harness 运行时解析 · 只读</span>
          </template>
          <template v-else-if="isOrphan">
            <span class="text-slate-500 dark:text-white/50">
              installed: {{ entry.installedVersion ? `v${entry.installedVersion}` : '?' }}
            </span>
          </template>
          <template v-else-if="entry.kind === 'row'">
            <span class="text-slate-400 dark:text-white/40">cordis.patch.yml</span>
          </template>
          <template v-else>
            <span
              class="truncate max-w-[200px]"
              :class="entry.spec ? 'text-slate-500 dark:text-white/50' : 'text-slate-400 dark:text-white/40'"
              :title="`spec: ${entry.spec || '—'}`"
            >spec: {{ entry.spec || '—' }}</span>
            <span class="text-slate-400 dark:text-white/40">·</span>
            <span
              :class="entry.installed && entry.status !== 'version-mismatch' ? 'text-[#30d158]' : 'text-slate-500 dark:text-white/50'"
            >installed: {{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}</span>
            <span class="text-slate-400 dark:text-white/40">·</span>
            <span
              :class="entry.status === 'version-mismatch' ? 'text-[#ff453a]' : 'text-slate-500 dark:text-white/50'"
            >required: {{ entry.requiredVersion ? `v${entry.requiredVersion}` : '—' }}</span>
          </template>
        </div>
      </div>

      <div v-if="showToggle" class="shrink-0" @click.stop>
        <div
          class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs"
        >
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
      </div>

      <div class="flex items-center gap-1 shrink-0" @click.stop>
        <button
          v-if="isOrphan"
          type="button"
          :title="'纳入配置（写入 dependencies(link:/git+) + bundles）'"
          :class="actionCls('primary')"
          @click="emit('adopt', entry)"
        >
          <Link2 class="w-3.5 h-3.5" />
        </button>
        <button
          v-else-if="entry.installError"
          type="button"
          :title="'查看失败堆栈'"
          :class="actionCls('danger')"
          @click="emit('show-error', entry.installError || '')"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="canCheckUpdate"
          type="button"
          :title="'检查更新'"
          :class="actionCls()"
          @click="emit('check-update', entry)"
        >
          <RefreshCw class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="updateAvailable"
          type="button"
          :title="`更新到 ${updateCheck?.latest || '最新'}`"
          :class="actionCls('warning')"
          @click="emit('update', entry)"
        >
          <Download class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="!isInbox"
          type="button"
          :title="removeTitle"
          :class="actionCls('danger')"
          @click="emit('remove', entry)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- 卡片形态 -->
  <div
    v-else
    class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/12 p-3.5 flex flex-col gap-2.5 transition-colors duration-200"
    :class="cardAccentClass"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-2 h-2 rounded-sm ring-2 shrink-0" :class="dotClass(entry.status)"></span>
        <div
          class="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
          :class="iconTileClass"
        >
          <component :is="iconFor(entry.kind)" class="w-3.5 h-3.5" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span
              class="font-mono text-xs text-slate-900 dark:text-white/90 truncate max-w-[180px]"
              :title="entry.name"
            >{{ entry.name }}</span>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border shrink-0"
              :class="badge.cls"
            >{{ badge.label }}</span>
          </div>
        </div>
      </div>

      <div v-if="showToggle" class="shrink-0" @click.stop>
        <div
          class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[11px]"
        >
          <button
            type="button"
            @click="emit('toggle', entry, true)"
            :class="[
              'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
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
              'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              !entry.enabled
                ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>停用</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
      <template v-if="isInbox">
        <span class="text-slate-400 dark:text-white/40">Harness 运行时解析 · 只读</span>
      </template>
      <template v-else-if="isOrphan">
        <span class="text-slate-500 dark:text-white/50">
          installed: {{ entry.installedVersion ? `v${entry.installedVersion}` : '?' }}
        </span>
      </template>
      <template v-else-if="entry.kind === 'row'">
        <span class="text-slate-400 dark:text-white/40">cordis.patch.yml</span>
      </template>
      <template v-else>
        <span
          class="truncate max-w-[200px]"
          :class="entry.spec ? 'text-slate-500 dark:text-white/50' : 'text-slate-400 dark:text-white/40'"
          :title="`spec: ${entry.spec || '—'}`"
        >spec: {{ entry.spec || '—' }}</span>
        <span class="text-slate-400 dark:text-white/40">·</span>
        <span
          :class="entry.installed && entry.status !== 'version-mismatch' ? 'text-[#30d158]' : 'text-slate-500 dark:text-white/50'"
        >installed: {{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}</span>
        <span class="text-slate-400 dark:text-white/40">·</span>
        <span
          :class="entry.status === 'version-mismatch' ? 'text-[#ff453a]' : 'text-slate-500 dark:text-white/50'"
        >required: {{ entry.requiredVersion ? `v${entry.requiredVersion}` : '—' }}</span>
      </template>
    </div>

    <div class="flex items-center gap-1 pt-2 border-t border-black/5 dark:border-white/5" @click.stop>
      <button
        v-if="isOrphan"
        type="button"
        :title="'纳入配置（写入 dependencies(link:/git+) + bundles）'"
        :class="actionCls('primary')"
        @click="emit('adopt', entry)"
      >
        <Link2 class="w-3.5 h-3.5" />
      </button>
      <button
        v-else-if="entry.installError"
        type="button"
        :title="'查看失败堆栈'"
        :class="actionCls('danger')"
        @click="emit('show-error', entry.installError || '')"
      >
        <AlertTriangle class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="canCheckUpdate"
        type="button"
        :title="'检查更新'"
        :class="actionCls()"
        @click="emit('check-update', entry)"
      >
        <RefreshCw class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="updateAvailable"
        type="button"
        :title="`更新到 ${updateCheck?.latest || '最新'}`"
        :class="actionCls('warning')"
        @click="emit('update', entry)"
      >
        <Download class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="!isInbox"
        type="button"
        :title="removeTitle"
        :class="actionCls('danger')"
        @click="emit('remove', entry)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Package,
  CircleDot,
  ListTree,
  Layers,
  Link2,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
} from 'lucide-vue-next';
import type {
  DshPluginInstallEntry,
  DshPluginInstallStatus,
  DshPluginKind,
  DshPluginUpdateCheck,
} from '../types';

const props = defineProps<{
  entry: DshPluginInstallEntry;
  updateCheck?: DshPluginUpdateCheck;
  view: 'source' | 'status';
  layout: 'list' | 'card';
}>();

const emit = defineEmits<{
  (e: 'toggle', entry: DshPluginInstallEntry, enabled: boolean): void;
  (e: 'remove', entry: DshPluginInstallEntry): void;
  (e: 'adopt', entry: DshPluginInstallEntry): void;
  (e: 'show-error', stack: string): void;
  (e: 'check-update', entry: DshPluginInstallEntry): void;
  (e: 'update', entry: DshPluginInstallEntry): void;
}>();

const entry = computed(() => props.entry);
const isInbox = computed(() => entry.value.kind === 'inbox');
const isOrphan = computed(() => entry.value.status === 'orphan');
const showToggle = computed(() => !isInbox.value && !isOrphan.value);
const updateAvailable = computed(() => Boolean(props.updateCheck?.updateAvailable));
const canCheckUpdate = computed(
  () =>
    !isInbox.value &&
    !isOrphan.value &&
    entry.value.kind !== 'row' &&
    entry.value.portability === 'portable' &&
    !updateAvailable.value
);

const removeTitle = computed(() => {
  if (isOrphan.value) return '从 node_modules 移除';
  if (entry.value.kind === 'row') return '删除此 patch 行';
  return entry.value.declaredInConfig ? '卸载（移出 dependencies / bundles / patch）' : '从 node_modules 移除';
});

function dotClass(status: DshPluginInstallStatus): string {
  switch (status) {
    case 'ok': return 'bg-[#30d158] ring-[#30d158]/20';
    case 'pending': return 'bg-[#ff9f0a] ring-[#ff9f0a]/20';
    case 'orphan': return 'bg-[#ff9f0a] ring-[#ff9f0a]/20';
    case 'version-mismatch': return 'bg-[#ff453a] ring-[#ff453a]/20';
    case 'failed': return 'bg-[#ff453a] ring-[#ff453a]/20';
  }
}

function iconFor(kind: DshPluginKind) {
  switch (kind) {
    case 'inbox': return Layers;
    case 'bundle': return Package;
    case 'row': return ListTree;
    case 'plain': return CircleDot;
  }
}

// 卡片形态顶部语义色强调线（与分区/同步页顶部标识线一致）
const cardAccentClass = computed(() => {
  switch (entry.value.status) {
    case 'ok': return 'border-t-[#30d158]/60';
    case 'pending': return 'border-t-[#ff9f0a]/60';
    case 'orphan': return 'border-t-[#ff9f0a]/60';
    case 'version-mismatch': return 'border-t-[#ff453a]/60';
    case 'failed': return 'border-t-[#ff453a]/60';
    default: return '';
  }
});

// 图标瓦片按 kind 上色：官方=蓝 / 用户 bundle=绿 / 依赖(含孤儿)=琥珀 / patch 行=紫
const iconTileClass = computed(() => {
  switch (entry.value.kind) {
    case 'inbox': return 'bg-[#0a84ff]/10 border-[#0a84ff]/20 text-[#0a84ff]';
    case 'bundle': return 'bg-[#30d158]/10 border-[#30d158]/20 text-[#30d158]';
    case 'row': return 'bg-[#bf5af2]/10 border-[#bf5af2]/20 text-[#bf5af2]';
    case 'plain': return 'bg-[#ff9f0a]/10 border-[#ff9f0a]/20 text-[#ff9f0a]';
    default: return 'bg-black/5 dark:bg-[#3a3a3c] border-black/10 dark:border-white/10 text-slate-600 dark:text-white/80';
  }
});

const badge = computed<{ label: string; cls: string }>(() => {
  if (isInbox.value) {
    return { label: '官方', cls: 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30' };
  }
  if (isOrphan.value) {
    return { label: '孤儿', cls: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30' };
  }
  if (entry.value.kind === 'row') {
    if (props.view === 'source') {
      return entry.value.enabled
        ? { label: '生效中', cls: 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30' }
        : { label: '已停用', cls: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30' };
    }
    return { label: 'patch 行', cls: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30' };
  }
  if (props.view === 'source') {
    return statusBadge(entry.value.status);
  }
  if (entry.value.portability === 'unportable') {
    return { label: '本地开发', cls: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30' };
  }
  return entry.value.kind === 'bundle'
    ? { label: 'bundle', cls: 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30' }
    : { label: '依赖', cls: 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10' };
});

function statusBadge(status: DshPluginInstallStatus): { label: string; cls: string } {
  switch (status) {
    case 'ok':
      return { label: '正常', cls: 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30' };
    case 'pending':
      return { label: '待装', cls: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30' };
    case 'version-mismatch':
      return { label: '版本冲突', cls: 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30' };
    case 'failed':
      return { label: '失败', cls: 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30' };
    case 'orphan':
      return { label: '孤儿', cls: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30' };
  }
}

function actionCls(variant: 'default' | 'danger' | 'primary' | 'warning' = 'default'): string {
  const base = 'p-1.5 rounded-lg bg-transparent border transition-colors duration-200';
  switch (variant) {
    case 'danger':
      return `${base} border-transparent text-slate-400 hover:text-[#ff453a] dark:text-white/40 dark:hover:text-[#ff453a] hover:bg-[#ff453a]/10 hover:border-[#ff453a]/30`;
    case 'primary':
      return `${base} border-transparent text-slate-400 hover:text-[#0a84ff] dark:text-white/40 dark:hover:text-[#0a84ff] hover:bg-[#0a84ff]/10 hover:border-[#0a84ff]/30`;
    case 'warning':
      return `${base} border-[#ff9f0a]/30 text-[#ff9f0a] hover:bg-[#ff9f0a]/10`;
    default:
      return `${base} border-transparent text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/8`;
  }
}
</script>
