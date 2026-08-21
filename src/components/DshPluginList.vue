<template>
  <div class="space-y-4">
    <!-- Empty state -->
    <div
      v-if="!store.dshPluginsScan || store.dshPluginsScan.profiles.length === 0"
      class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-8 text-center transition-colors duration-200"
    >
      <div class="mx-auto w-10 h-10 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-white/50">
        <Puzzle class="w-5 h-5" />
      </div>
      <p class="mt-3 font-serif text-sm text-slate-900 dark:text-white/90">未发现 DSH profile</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-white/50">
        请先在 <span class="font-mono">{{ store.dshPluginsScan?.homeDir || '~/.dsh' }}\profiles\</span> 下创建 profile
      </p>
    </div>

    <template v-else>
      <!-- Profile selector + install toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-slate-500 dark:text-white/50">Profile：</span>
        <button
          v-for="p in store.dshPluginsScan.profiles"
          :key="p.name"
          @click="selectProfile(p.name)"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors duration-200',
            selectedProfile === p.name
              ? 'bg-black/5 dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20 font-medium'
              : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-white/70 border-black/8 dark:border-white/8 hover:text-slate-900 dark:hover:text-white/95'
          ]"
        >
          {{ p.name }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5">
          <button
            v-for="btn in installButtons"
            :key="btn.mode"
            type="button"
            :disabled="store.dshInstalling"
            @click="runInstall(btn.mode)"
            :class="[
              'px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50',
              btn.mode === 'reinstall-all'
                ? 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30 hover:bg-[#ff453a]/20'
                : 'bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border-black/8 dark:border-white/8'
            ]"
          >
            <Download v-if="btn.mode === 'incremental'" class="w-3.5 h-3.5" />
            <RefreshCw v-else-if="btn.mode === 'update'" class="w-3.5 h-3.5" />
            <RotateCcw v-else-if="btn.mode === 'reinstall-all'" class="w-3.5 h-3.5" />
            <AlertTriangle v-else class="w-3.5 h-3.5" />
            <span>{{ btn.label }}</span>
          </button>
        </div>
        <button
          type="button"
          @click="store.toggleInstallTerminal(!store.installTerminal.visible)"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-200 flex items-center gap-1.5',
            store.installTerminal.visible
              ? 'bg-black/5 dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20'
              : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-white/70 border-black/8 dark:border-white/8 hover:text-slate-900 dark:hover:text-white/95'
          ]"
        >
          <Terminal class="w-3.5 h-3.5" />
          <span>终端</span>
        </button>
      </div>

      <!-- Install terminal -->
      <DshInstallTerminal v-if="store.installTerminal.visible" />

      <!-- Health summary strip -->
      <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        <div
          v-for="stat in summaryStats"
          :key="stat.label"
          class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-200"
        >
          <span class="w-2 h-2 rounded-sm shrink-0" :class="stat.dotClass"></span>
          <div class="min-w-0">
            <div class="font-mono text-sm text-slate-900 dark:text-white/95 leading-none">{{ stat.value }}</div>
            <div class="text-[10px] text-slate-500 dark:text-white/50 mt-1 truncate">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <!-- Official built-in group -->
      <section v-if="officialEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">官方内置插件</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10">{{ officialEntries.length }}</span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-white/40 truncate ml-3">@deepseek-ai/dsh-* · Harness 运行时解析 · 只读</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-3">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="entry in officialEntries"
              :key="entry.key"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/8 dark:border-white/8 text-xs transition-colors duration-200"
            >
              <span class="w-1.5 h-1.5 rounded-sm bg-[#0a84ff]"></span>
              <span class="font-mono text-slate-900 dark:text-white/90">{{ entry.name }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-[#0a84ff]/10 text-[#0a84ff] border border-[#0a84ff]/30">内置</span>
            </span>
          </div>
        </div>
      </section>

      <!-- Portable user plugins -->
      <section v-if="portableEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">用户插件 · 可移植</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10">{{ portableEntries.length }}</span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-white/40 truncate ml-3">可跨机复现安装 · 参与配置同步</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <PluginRow
            v-for="entry in portableEntries"
            :key="entry.key"
            :entry="entry"
            :update-check="store.dshPluginUpdates[entry.key]"
            @toggle="toggle"
            @remove="remove"
            @show-error="showError = $event"
            @check-update="checkUpdate"
            @update="updatePlugin"
          />
        </div>
      </section>

      <!-- Local dev (unportable) user plugins -->
      <section v-if="unportableEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">用户插件 · 本地开发</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30">{{ unportableEntries.length }}</span>
          </div>
          <span class="text-[11px] text-[#ff9f0a] truncate ml-3">link: / file: 等本机路径 · 不参与同步，推送时自动剔除</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#ff9f0a]/30 dark:border-[#ff9f0a]/30 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <PluginRow
            v-for="entry in unportableEntries"
            :key="entry.key"
            :entry="entry"
            @toggle="toggle"
            @remove="remove"
            @show-error="showError = $event"
          />
        </div>
      </section>

      <!-- Patch rows -->
      <section v-if="patchEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">Patch 配置行</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10">{{ patchEntries.length }}</span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-white/40 truncate ml-3">cordis.patch.yml 顶层条目 · 非 npm 包，只做启停</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <div
            v-for="entry in patchEntries"
            :key="entry.key"
            class="flex items-center gap-3 px-3.5 py-2.5 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            <span class="w-2 h-2 rounded-sm shrink-0" :class="entry.enabled ? 'bg-[#30d158]' : 'bg-[#ff9f0a]'"></span>
            <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80 shrink-0">
              <ListTree class="w-3.5 h-3.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs text-slate-900 dark:text-white/90 break-all">{{ entry.name }}</span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border"
                  :class="entry.enabled
                    ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
                    : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30'"
                >
                  {{ entry.enabled ? '生效中' : '已停用' }}
                </span>
              </div>
              <div class="mt-0.5 text-[11px] font-mono text-slate-400 dark:text-white/40">cordis.patch.yml</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <SegmentedToggle :enabled="entry.enabled" @toggle="toggle(entry, $event)" />
              <IconButton @click="remove(entry)" title="删除此 patch 行">
                <Trash2 class="w-3.5 h-3.5" />
              </IconButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Orphans -->
      <section v-if="orphanEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">孤儿安装</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30">{{ orphanEntries.length }}</span>
          </div>
          <span class="text-[11px] text-[#ff453a] truncate ml-3">本机已装但未在配置中声明 · 可纳入配置或移除</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#ff453a]/30 dark:border-[#ff453a]/30 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <div
            v-for="entry in orphanEntries"
            :key="entry.key"
            class="flex items-center gap-3 px-3.5 py-2.5 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            <span class="w-2 h-2 rounded-sm bg-[#ff9f0a] shrink-0"></span>
            <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80 shrink-0">
              <CircleDot class="w-3.5 h-3.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs text-slate-900 dark:text-white/90 break-all">{{ entry.name }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30">孤儿</span>
              </div>
              <div class="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-white/50">
                installed: {{ entry.installedVersion ? `v${entry.installedVersion}` : '?' }}
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <IconButton
                kind="primary"
                :title="`纳入配置（写入 dependencies(link:) + bundles）`"
                @click="adopt(entry)"
              >
                <Link2 class="w-3.5 h-3.5" />
              </IconButton>
              <IconButton @click="remove(entry)" title="从 node_modules 移除">
                <Trash2 class="w-3.5 h-3.5" />
              </IconButton>
            </div>
          </div>
        </div>
      </section>

      <!-- All clean / empty user entries -->
      <div
        v-if="entries.length === 0 && !store.dshInstallEntriesLoading"
        class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-6 text-center text-xs text-slate-500 dark:text-white/50"
      >
        该 profile 暂无任何配置声明或本机安装的插件
      </div>

      <div v-if="hasFailedState" class="flex items-center justify-end">
        <button
          type="button"
          @click="clearFailed"
          class="text-[11px] text-[#ff9f0a] hover:text-[#ff453a] transition-colors duration-200"
        >
          清除本 profile 失败状态
        </button>
      </div>
    </template>

    <!-- Failed stack modal -->
    <div
      v-if="showError"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-colors duration-200"
      @click.self="showError = ''"
    >
      <div class="w-[min(720px,90vw)] max-h-[70vh] rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none p-4 flex flex-col">
        <div class="flex items-center justify-between">
          <h3 class="font-serif text-sm text-slate-900 dark:text-white/95">安装失败堆栈</h3>
          <button
            type="button"
            @click="showError = ''"
            class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-[#3a3a3c] text-slate-500 dark:text-white/50 transition-colors duration-200"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <pre class="mt-3 flex-1 overflow-auto rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap break-all">{{ showError }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import {
  Package,
  CircleDot,
  ListTree,
  Puzzle,
  Trash2,
  Download,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Terminal,
  X,
  Link2,
} from 'lucide-vue-next';
import type { DshInstallMode, DshPluginInstallEntry, DshPluginInstallStatus, DshPluginKind, DshPluginUpdateCheck } from '../types';
import DshInstallTerminal from './DshInstallTerminal.vue';

// ---- 轻量本地子组件（本文件内部使用） ----

const PluginRow = defineComponent({
  props: {
    entry: { type: Object as () => DshPluginInstallEntry, required: true },
    updateCheck: { type: Object as () => DshPluginUpdateCheck | undefined, default: undefined },
  },
  emits: ['toggle', 'remove', 'show-error', 'check-update', 'update'],
  setup(props, { emit }) {
    return () => {
      const entry = props.entry;
      const icon =
        entry.kind === 'bundle'
          ? h(Package, { class: 'w-3.5 h-3.5' })
          : h(CircleDot, { class: 'w-3.5 h-3.5' });

      return h('div', { class: 'flex items-center gap-3 px-3.5 py-2.5 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]' }, [
        h('span', { class: ['w-2 h-2 rounded-sm shrink-0', dotClass(entry.status)] }),
        h('div', {
          class: 'w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80 shrink-0',
        }, [icon]),
        h('div', { class: 'flex-1 min-w-0' }, [
          h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
            h('span', { class: 'font-mono text-xs text-slate-900 dark:text-white/90 break-all' }, entry.name),
            h('span', {
              class: ['text-[10px] px-1.5 py-0.5 rounded-md font-mono border', kindBadgeClass(entry.kind)],
            }, kindLabel(entry.kind)),
            h('span', {
              class: ['text-[10px] px-1.5 py-0.5 rounded-md font-mono border', statusBadgeClass(entry.status)],
            }, statusLabel(entry.status)),
            entry.portability === 'unportable'
              ? h('span', {
                  class: 'text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30',
                }, '不可移植')
              : null,
          ]),
          h('div', { class: 'mt-1 grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-0.5 text-[11px] font-mono' }, [
            h('span', {
              class: ['truncate', entry.spec ? 'text-slate-500 dark:text-white/50' : 'text-slate-400 dark:text-white/40'],
            }, `spec: ${entry.spec || '—'}`),
            h('span', {
              class: [
                'truncate',
                entry.installed && entry.status !== 'version-mismatch'
                  ? 'text-[#30d158] dark:text-[#30d158]'
                  : 'text-slate-500 dark:text-white/50',
              ],
            }, `installed: ${entry.installed ? `v${entry.installedVersion || '?'}` : '未安装'}`),
            h('span', {
              class: [
                'truncate',
                entry.status === 'version-mismatch'
                  ? 'text-[#ff453a] dark:text-[#ff453a]'
                  : 'text-slate-500 dark:text-white/50',
              ],
            }, `required: ${entry.requiredVersion ? `v${entry.requiredVersion}` : '—'}`),
          ]),
          entry.installError
            ? h('div', { class: 'mt-1' }, [
                h('button', {
                  type: 'button',
                  onClick: () => emit('show-error', entry.installError || ''),
                  class: 'text-[11px] text-[#ff453a] hover:text-[#ff9f0a] transition-colors duration-200 font-medium',
                }, '查看失败堆栈'),
              ])
            : null,
          props.updateCheck?.updateAvailable
            ? h('div', { class: 'mt-1 text-[11px] font-mono text-[#ff9f0a]' }, [
                h('span', '可更新：'),
                h('span', props.updateCheck.current || '?'),
                h('span', ' → '),
                h('span', props.updateCheck.latest || '?'),
              ])
            : props.updateCheck?.error
              ? h('div', { class: 'mt-1 text-[11px] font-mono text-[#ff453a]' }, props.updateCheck.error)
              : props.updateCheck?.hint
                ? h('div', { class: 'mt-1 text-[11px] font-mono text-slate-400 dark:text-white/40' }, props.updateCheck.hint)
                : null,
        ]),
        h('div', { class: 'flex items-center gap-2 shrink-0' }, [
          h(SegmentedToggle, {
            enabled: entry.enabled,
            onToggle: (enabled: boolean) => emit('toggle', entry, enabled),
          }),
          entry.portability === 'portable' && entry.kind !== 'row'
            ? props.updateCheck?.updateAvailable
              ? h('button', {
                  type: 'button',
                  onClick: () => emit('update', entry),
                  class: 'px-2 py-1 rounded-lg text-[11px] font-medium bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30 hover:bg-[#ff9f0a]/20 transition-colors duration-200 flex items-center gap-1',
                }, [h(Download, { class: 'w-3 h-3' }), h('span', '更新')])
              : h(IconButton, {
                  title: '检查更新',
                  onClick: () => emit('check-update', entry),
                }, [h(RefreshCw, { class: 'w-3.5 h-3.5' })])
            : null,
          h(IconButton, {
            title: entry.declaredInConfig
              ? '卸载（从 dependencies / bundles / patch 中彻底移除）'
              : '从 node_modules 移除',
            onClick: () => emit('remove', entry),
          }, [h(Trash2, { class: 'w-3.5 h-3.5' })]),
        ]),
      ]);
    };
  },
});

const SegmentedToggle = defineComponent({
  props: {
    enabled: { type: Boolean, required: true },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs' }, [
        h('button', {
          type: 'button',
          onClick: () => emit('toggle', true),
          class: [
            'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            props.enabled
              ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80',
          ],
        }, [
          props.enabled ? h('span', { class: 'w-1.5 h-1.5 rounded-sm bg-[#30d158]' }) : null,
          h('span', '启用'),
        ]),
        h('button', {
          type: 'button',
          onClick: () => emit('toggle', false),
          class: [
            'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
            !props.enabled
              ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80',
          ],
        }, [h('span', '停用')]),
      ]);
  },
});

const IconButton = defineComponent({
  props: {
    title: { type: String, default: '' },
    kind: { type: String as () => 'danger' | 'primary', default: 'danger' },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () =>
      h('button', {
        type: 'button',
        title: props.title,
        onClick: () => emit('click'),
        class: [
          'p-1.5 rounded-lg bg-transparent border border-transparent transition-colors duration-200',
          props.kind === 'primary'
            ? 'text-slate-400 hover:text-[#0a84ff] dark:text-white/40 dark:hover:text-[#0a84ff] hover:bg-[#0a84ff]/10 hover:border-[#0a84ff]/30'
            : 'text-slate-400 hover:text-[#ff453a] dark:text-white/40 dark:hover:text-[#ff453a] hover:bg-[#ff453a]/10 hover:border-[#ff453a]/30',
        ],
      }, slots.default ? slots.default() : []);
  },
});

function dotClass(status: DshPluginInstallStatus): string {
  switch (status) {
    case 'ok': return 'bg-[#30d158]';
    case 'pending': return 'bg-[#ff9f0a]';
    case 'orphan': return 'bg-[#ff9f0a]';
    case 'version-mismatch': return 'bg-[#ff453a]';
    case 'failed': return 'bg-[#ff453a]';
  }
}

// ---- 状态与分组 ----

const store = useAppStore();
const selectedProfile = ref('');
const showError = ref('');

// 先注册 selectedProfile 监听（immediate），再注册 profiles 监听（immediate），
// 避免 profiles 已存在时在 setup 期间赋值 selectedProfile 但监听器尚未建立，导致对账数据不加载。
watch(selectedProfile, (profile) => {
  if (profile) {
    store.loadDshInstallEntries(profile).catch(() => {});
  }
}, { immediate: true });

watch(
  () => store.dshPluginsScan?.profiles,
  (profiles) => {
    if (profiles && profiles.length > 0 && !profiles.some(p => p.name === selectedProfile.value)) {
      selectedProfile.value = profiles[0].name;
    }
  },
  { immediate: true }
);

const entries = computed(() =>
  store.dshInstallEntries.filter(e => e.profileName === selectedProfile.value)
);

const officialEntries = computed(() => entries.value.filter(e => e.kind === 'inbox'));
const patchEntries = computed(() => entries.value.filter(e => e.kind === 'row'));
const orphanEntries = computed(() => entries.value.filter(e => e.status === 'orphan'));

const userPackageEntries = computed(() =>
  entries.value.filter(e => e.kind !== 'inbox' && e.kind !== 'row' && e.status !== 'orphan')
);

const portableEntries = computed(() => userPackageEntries.value.filter(e => e.portability === 'portable'));
const unportableEntries = computed(() => userPackageEntries.value.filter(e => e.portability === 'unportable'));

const summaryStats = computed(() => {
  const users = userPackageEntries.value;
  const count = (status: DshPluginInstallStatus) => users.filter(e => e.status === status).length;
  return [
    { label: '正常', value: count('ok'), dotClass: 'bg-[#30d158]' },
    { label: '待装', value: count('pending'), dotClass: 'bg-[#ff9f0a]' },
    { label: '版本冲突', value: count('version-mismatch'), dotClass: 'bg-[#ff453a]' },
    { label: '失败', value: count('failed'), dotClass: 'bg-[#ff453a]' },
    { label: '孤儿', value: orphanEntries.value.length, dotClass: 'bg-[#ff9f0a]' },
    { label: '不可移植', value: users.filter(e => e.portability === 'unportable').length, dotClass: 'bg-[#ff9f0a]' },
  ];
});

const hasFailedState = computed(() => entries.value.some(e => e.status === 'failed'));

const installButtons: { mode: DshInstallMode; label: string }[] = [
  { mode: 'incremental', label: '增量安装' },
  { mode: 'update', label: '更新' },
  { mode: 'reinstall-failed', label: '仅失败重装' },
  { mode: 'reinstall-all', label: '全部重新安装' },
];

function selectProfile(name: string) {
  selectedProfile.value = name;
  store.loadDshInstallEntries(name).catch(() => {});
}

async function checkUpdate(entry: DshPluginInstallEntry) {
  try {
    const result = await store.checkDshPluginUpdate(entry.profileName, entry.key);
    if (result.error) {
      store.showToast({
        title: '检查更新失败',
        message: result.error,
        type: 'error',
      });
    } else if (result.updateAvailable) {
      store.showToast({
        title: '发现新版本',
        message: `${result.name}: ${result.current || '?'} → ${result.latest || '?'}`,
        type: 'info',
      });
    } else {
      store.showToast({
        title: '已是最新',
        message: result.hint || `${result.name} 暂无可用更新`,
        type: 'info',
      });
    }
  } catch (e: any) {
    store.showToast({
      title: '检查更新失败',
      message: e?.message || '无法检查更新',
      type: 'error',
    });
  }
}

async function updatePlugin(entry: DshPluginInstallEntry) {
  const ok = window.confirm(
    `确认将插件「${entry.name}」更新到最新？\n\n将执行 pnpm update ${entry.name}，更新范围仅限该包。`
  );
  if (!ok) return;
  try {
    await store.updateDshPlugin(entry.profileName, entry.key);
  } catch (e: any) {
    // store 已 toast
  }
}

async function runInstall(mode: DshInstallMode) {
  const profile = selectedProfile.value;
  if (!profile) return;
  if (mode === 'reinstall-all') {
    const ok = window.confirm(
      `确认对 profile [${profile}] 执行「全部重新安装」？\n\n将运行 pnpm install --force 全量重拉所有依赖，可能耗时较长且消耗流量。`
    );
    if (!ok) return;
  }
  if (mode === 'update') {
    const ok = window.confirm(
      `确认对 profile [${profile}] 执行「更新」？\n\n将运行 pnpm update，在 spec 允许范围内升级依赖版本。`
    );
    if (!ok) return;
  }
  try {
    await store.installDshPluginsStreamed(profile, mode);
  } catch (e: any) {
    // store 已 toast
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

async function toggle(entry: DshPluginInstallEntry, enabled: boolean) {
  if (entry.enabled === enabled) return;
  try {
    await store.toggleDshPlugin(entry.profileName, entry.key, enabled);
  } catch (e: any) {
    store.showToast({
      title: '切换失败',
      message: e?.message || '无法切换插件状态',
      type: 'error',
    });
  }
}

async function adopt(entry: DshPluginInstallEntry) {
  const ok = window.confirm(
    `确认将孤儿包「${entry.name}」纳入 profile [${entry.profileName}] 配置？\n\n将写入 dependencies（link: 指向本机源码目录）并加入 dsh.profile.bundles，仅支持本地 link/junction 安装。`
  );
  if (!ok) return;
  try {
    await store.adoptDshOrphan(entry.profileName, entry.name);
  } catch (e: any) {
    store.showToast({
      title: '纳入配置失败',
      message: e?.message || '无法纳入配置',
      type: 'error',
    });
  }
}

async function remove(entry: DshPluginInstallEntry) {
  const label = entry.status === 'orphan'
    ? `确认移除孤儿包「${entry.name}」？\n\n将仅从 profile [${entry.profileName}] 的 node_modules 中移除该包，不影响任何配置声明。`
    : `确认卸载插件「${entry.name}」？\n\n将从 profile [${entry.profileName}] 的 package.json（dependencies / bundles）或 cordis.patch.yml 中彻底移除，并尽力清理 node_modules。`;
  const ok = window.confirm(label);
  if (!ok) return;
  try {
    await store.removeDshPlugin(entry.profileName, entry.key);
  } catch (e: any) {
    store.showToast({
      title: entry.status === 'orphan' ? '移除失败' : '卸载失败',
      message: e?.message || '无法操作插件',
      type: 'error',
    });
  }
}

async function clearFailed() {
  try {
    await store.clearDshInstallState(selectedProfile.value);
  } catch (e: any) {
    store.showToast({
      title: '清除失败',
      message: e?.message || '无法清除安装状态',
      type: 'error',
    });
  }
}
</script>
