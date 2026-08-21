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

      <!-- Filter toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索插件名 / spec / key..."
            class="w-full bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5"
          >
            <X class="w-3 h-3" />
          </button>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[11px] text-slate-400 dark:text-white/40">状态:</span>
          <select
            v-model="statusFilter"
            class="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          >
            <option value="all">全部状态</option>
            <option value="ok">正常</option>
            <option value="pending">待装</option>
            <option value="version-mismatch">版本冲突</option>
            <option value="failed">失败</option>
            <option value="orphan">孤儿</option>
          </select>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[11px] text-slate-400 dark:text-white/40">类型:</span>
          <select
            v-model="kindFilter"
            class="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          >
            <option value="all">全部类型</option>
            <option value="inbox">内置</option>
            <option value="bundle">bundle</option>
            <option value="plain">依赖</option>
            <option value="row">patch 行</option>
          </select>
        </div>

        <button
          v-if="hasActiveFilters"
          @click="resetFilters"
          class="px-2 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white/95 border border-black/10 dark:border-white/12 text-xs transition-colors duration-200 flex items-center gap-1"
        >
          <RotateCcw class="w-3 h-3" />
          <span>重置</span>
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
      <section v-if="filteredOfficialEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">官方内置插件</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10">{{ filteredOfficialEntries.length }}<template v-if="hasActiveFilters">/{{ officialEntries.length }}</template></span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-white/40 truncate ml-3">@deepseek-ai/dsh-* · Harness 运行时解析 · 只读</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-3">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="entry in filteredOfficialEntries"
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
      <section v-if="filteredPortableEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">用户插件 · 可移植</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10">{{ filteredPortableEntries.length }}<template v-if="hasActiveFilters">/{{ portableEntries.length }}</template></span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-white/40 truncate ml-3">可跨机复现安装 · 参与配置同步</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <DshPluginRow
            v-for="entry in filteredPortableEntries"
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
      <section v-if="filteredUnportableEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">用户插件 · 本地开发</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30">{{ filteredUnportableEntries.length }}<template v-if="hasActiveFilters">/{{ unportableEntries.length }}</template></span>
          </div>
          <span class="text-[11px] text-[#ff9f0a] truncate ml-3">link: / file: 等本机路径 · 不参与同步，推送时自动剔除</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#ff9f0a]/30 dark:border-[#ff9f0a]/30 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <DshPluginRow
            v-for="entry in filteredUnportableEntries"
            :key="entry.key"
            :entry="entry"
            @toggle="toggle"
            @remove="remove"
            @show-error="showError = $event"
          />
        </div>
      </section>

      <!-- Patch rows -->
      <section v-if="filteredPatchEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">Patch 配置行</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10">{{ filteredPatchEntries.length }}<template v-if="hasActiveFilters">/{{ patchEntries.length }}</template></span>
          </div>
          <span class="text-[11px] text-slate-400 dark:text-white/40 truncate ml-3">cordis.patch.yml 顶层条目 · 非 npm 包，只做启停</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <div
            v-for="entry in filteredPatchEntries"
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
      <section v-if="filteredOrphanEntries.length" class="space-y-2">
        <div class="flex items-baseline justify-between px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95">孤儿安装</h3>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30">{{ filteredOrphanEntries.length }}<template v-if="hasActiveFilters">/{{ orphanEntries.length }}</template></span>
          </div>
          <span class="text-[11px] text-[#ff453a] truncate ml-3">本机已装但未在配置中声明 · 可纳入配置或移除</span>
        </div>
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#ff453a]/30 dark:border-[#ff453a]/30 divide-y divide-black/5 dark:divide-white/5 transition-colors duration-200">
          <div
            v-for="entry in filteredOrphanEntries"
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

      <!-- No match under active filters -->
      <div
        v-if="entries.length > 0 && hasActiveFilters && filteredTotalCount === 0 && !store.dshInstallEntriesLoading"
        class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-6 text-center text-xs text-slate-500 dark:text-white/50"
      >
        无匹配当前筛选条件的插件，可点击「重置」清空筛选
      </div>

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
  Search,
} from 'lucide-vue-next';
import type { DshInstallMode, DshPluginInstallEntry, DshPluginInstallStatus } from '../types';
import DshInstallTerminal from './DshInstallTerminal.vue';
import DshPluginRow from './DshPluginRow.vue';

// ---- 轻量本地子组件（本文件内部使用） ----

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

// ---- 筛选状态 ----

const searchQuery = ref('');
const statusFilter = ref<'all' | DshPluginInstallStatus>('all');
const kindFilter = ref<'all' | 'inbox' | 'bundle' | 'plain' | 'row'>('all');

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

const hasActiveFilters = computed(
  () =>
    searchQuery.value.trim() !== '' ||
    statusFilter.value !== 'all' ||
    kindFilter.value !== 'all'
);

function matchesFilters(entry: DshPluginInstallEntry): boolean {
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    const haystack = [
      entry.name,
      entry.spec || '',
      entry.key,
      entry.kind,
      entry.status,
    ].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (statusFilter.value !== 'all' && entry.status !== statusFilter.value) return false;
  if (kindFilter.value !== 'all' && entry.kind !== kindFilter.value) return false;
  return true;
}

const filteredOfficialEntries = computed(() => officialEntries.value.filter(matchesFilters));
const filteredPatchEntries = computed(() => patchEntries.value.filter(matchesFilters));
const filteredOrphanEntries = computed(() => orphanEntries.value.filter(matchesFilters));
const filteredPortableEntries = computed(() => portableEntries.value.filter(matchesFilters));
const filteredUnportableEntries = computed(() => unportableEntries.value.filter(matchesFilters));

const filteredTotalCount = computed(
  () =>
    filteredOfficialEntries.value.length +
    filteredPatchEntries.value.length +
    filteredOrphanEntries.value.length +
    filteredPortableEntries.value.length +
    filteredUnportableEntries.value.length
);

function resetFilters() {
  searchQuery.value = '';
  statusFilter.value = 'all';
  kindFilter.value = 'all';
}

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
    `确认将孤儿包「${entry.name}」纳入 profile [${entry.profileName}] 配置？\n\n将优先写入可移植的 git+http(s) spec（若源目录有 http(s) 远端），否则写入 link: 本地路径；并加入 dsh.profile.bundles。`
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
