<template>
  <!-- 列表行形态 -->
  <div
    v-if="layout === 'list'"
    class="px-4 py-3 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] flex items-center justify-between gap-3 group"
  >
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <div
        class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105"
        :class="protocolInfo.iconCls"
      >
        <component :is="iconFor(entry.kind)" class="w-4 h-4" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span
            class="font-mono text-xs md:text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[240px]"
            :title="entry.name"
          >{{ entry.name }}</span>

          <span
            class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border tracking-wider uppercase shrink-0"
            :class="protocolInfo.cls"
          >{{ protocolInfo.label }}</span>

          <span
            v-if="statusPill"
            class="text-[10px] px-2 py-0.2 rounded-full font-mono border flex items-center gap-1 shrink-0"
            :class="statusPill.cls"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="statusPill.dot"></span>
            <span>{{ statusPill.label }}</span>
          </span>
        </div>

        <div class="mt-1 flex items-center gap-2 text-[11px] font-mono flex-wrap">
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
              class="px-1.5 py-0.2 rounded bg-black/5 dark:bg-black/30 text-slate-500 dark:text-white/50 text-[10px] truncate max-w-[240px]"
              :title="`spec: ${entry.spec || '—'}`"
            >{{ entry.spec || '—' }}</span>
            <span class="text-slate-300 dark:text-white/20">·</span>
            <span
              :class="entry.installed && entry.status !== 'version-mismatch' ? 'text-slate-800 dark:text-white/90 font-medium' : 'text-slate-500 dark:text-white/50'"
            >installed: {{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}</span>
            <span v-if="entry.requiredVersion" class="text-slate-300 dark:text-white/20">·</span>
            <span
              v-if="entry.requiredVersion"
              :class="entry.status === 'version-mismatch' ? 'text-red-500 font-semibold' : 'text-slate-400 dark:text-white/40'"
            >req: v{{ entry.requiredVersion }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0" @click.stop>
      <div v-if="showToggle">
        <div
          class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs"
        >
          <button
            type="button"
            @click="emit('toggle', entry, true)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
              entry.enabled
                ? 'bg-white dark:bg-[#1d202d] text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span v-if="entry.enabled" class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>启用</span>
          </button>
          <button
            type="button"
            @click="emit('toggle', entry, false)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              !entry.enabled
                ? 'bg-white dark:bg-[#1d202d] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>停用</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1">
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
    class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 hover:border-indigo-500/30 dark:hover:border-indigo-400/40 p-4 flex flex-col justify-between space-y-3.5 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md group"
    :class="cardAccentClass"
  >
    <div>
      <div class="flex items-start justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
            :class="protocolInfo.iconCls"
          >
            <component :is="iconFor(entry.kind)" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h4
              class="font-mono text-xs md:text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[170px]"
              :title="entry.name"
            >{{ entry.name }}</h4>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span
                class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border tracking-wider uppercase"
                :class="protocolInfo.cls"
              >{{ protocolInfo.label }}</span>
              <span
                v-if="statusPill"
                class="text-[9px] px-1.5 py-0.2 rounded-full font-mono border flex items-center gap-1"
                :class="statusPill.cls"
              >
                <span class="w-1 h-1 rounded-full" :class="statusPill.dot"></span>
                <span>{{ statusPill.label }}</span>
              </span>
            </div>
          </div>
        </div>

        <div v-if="showToggle" class="shrink-0" @click.stop>
          <div
            class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-[11px]"
          >
            <button
              type="button"
              @click="emit('toggle', entry, true)"
              :class="[
                'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                entry.enabled
                  ? 'bg-white dark:bg-[#1d202d] text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span v-if="entry.enabled" class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              <span>启用</span>
            </button>
            <button
              type="button"
              @click="emit('toggle', entry, false)"
              :class="[
                'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !entry.enabled
                  ? 'bg-white dark:bg-[#1d202d] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>停用</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Spec & Version Inset Box -->
      <div class="mt-3 p-2.5 rounded-lg bg-black/[0.03] dark:bg-black/30 border border-black/5 dark:border-white/5 font-mono text-[11px] space-y-1">
        <div class="text-slate-500 dark:text-white/50 truncate flex items-center gap-1.5" :title="entry.spec || '—'">
          <Link2 class="w-3 h-3 shrink-0 opacity-60" />
          <span class="truncate">{{ entry.spec || '—' }}</span>
        </div>
        <div class="flex items-center justify-between text-[10px] pt-0.5 text-slate-600 dark:text-white/60">
          <span>installed: <strong class="text-slate-900 dark:text-white font-mono">{{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}</strong></span>
          <span v-if="entry.requiredVersion" class="opacity-60 font-mono">req: v{{ entry.requiredVersion }}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-1 pt-2 border-t border-black/5 dark:border-white/5 text-[11px]" @click.stop>
      <span class="text-slate-400 dark:text-white/40 font-mono text-[10px] flex items-center gap-1">
        <i data-lucide="check-circle" class="w-3 h-3 text-indigo-400"></i>
        <span>就绪</span>
      </span>
      <div class="flex items-center gap-1">
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

const protocolInfo = computed(() => {
  if (isInbox.value) {
    return {
      label: 'OFFICIAL',
      cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      iconCls: 'bg-gradient-to-br from-indigo-500/15 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    };
  }
  if (entry.value.kind === 'row') {
    return {
      label: 'PATCH',
      cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      iconCls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  }
  if (entry.value.portability === 'unportable' || entry.value.spec?.startsWith('link:') || entry.value.spec?.startsWith('file:')) {
    return {
      label: 'LOCAL',
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      iconCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  const spec = entry.value.spec || '';
  if (spec.startsWith('github:')) {
    return {
      label: 'GITHUB',
      cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      iconCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
  }
  if (spec.startsWith('git+') || spec.startsWith('https:')) {
    return {
      label: 'GIT+',
      cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      iconCls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    };
  }
  return {
    label: 'NPM',
    cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconCls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  };
});

const statusPill = computed(() => {
  switch (entry.value.status) {
    case 'ok':
      return {
        label: '正常',
        cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500',
      };
    case 'pending':
      return {
        label: '待装',
        cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500',
      };
    case 'version-mismatch':
      return {
        label: '版本冲突',
        cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        dot: 'bg-red-500',
      };
    case 'failed':
      return {
        label: '失败',
        cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        dot: 'bg-red-500',
      };
    case 'orphan':
      return {
        label: '孤儿',
        cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500',
      };
  }
});

function iconFor(kind: DshPluginKind) {
  switch (kind) {
    case 'inbox': return Layers;
    case 'bundle': return Package;
    case 'row': return ListTree;
    case 'plain': return CircleDot;
  }
}

// 卡片形态顶部语义色强调线（仅在异常/警告时显示，正常状态保持素雅一致）
const cardAccentClass = computed(() => {
  switch (entry.value.status) {
    case 'version-mismatch': return 'border-t-[#f59e0b]/60';
    case 'failed': return 'border-t-[#ef4444]/60';
    default: return '';
  }
});

function actionCls(variant: 'default' | 'danger' | 'primary' | 'warning' = 'default'): string {
  const base = 'p-1.5 rounded-lg bg-transparent border transition-colors duration-200';
  switch (variant) {
    case 'danger':
      return `${base} border-transparent text-slate-400 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30`;
    case 'primary':
      return `${base} border-transparent text-slate-400 hover:text-indigo-500 dark:text-white/40 dark:hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30`;
    case 'warning':
      return `${base} border-amber-500/30 text-amber-500 hover:bg-amber-500/10`;
    default:
      return `${base} border-transparent text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/8`;
  }
}
</script>
