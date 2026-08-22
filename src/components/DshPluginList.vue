<template>
  <div class="space-y-3">
    <!-- Empty state -->
    <div
      v-if="!store.dshPluginsScan || store.dshPluginsScan.profiles.length === 0"
      class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 p-8 text-center transition-colors duration-200"
    >
      <div class="mx-auto w-10 h-10 rounded-lg bg-black/5 dark:bg-[#282a32] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-white/50">
        <Puzzle class="w-5 h-5" />
      </div>
      <p class="mt-3 font-serif text-sm text-slate-900 dark:text-white/90">未发现 DSH profile</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-white/50">
        请先在 <span class="font-mono">{{ store.dshPluginsScan?.homeDir || '~/.dsh' }}\profiles\</span> 下创建 profile
      </p>
    </div>

    <template v-else>
      <!-- 单条 sticky 操作栏：profile + 搜索 + 视图切换 + 安装 + 终端 -->
      <div
        class="sticky top-0 z-10 rounded-xl bg-[#f4f4f5]/90 dark:bg-[#121316]/90 backdrop-blur-xl border border-black/8 dark:border-white/8 px-3 py-2 flex flex-wrap items-center gap-2"
      >
        <select
          v-model="selectedProfile"
          class="bg-white dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-xs font-mono text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
        >
          <option v-for="p in store.dshPluginsScan.profiles" :key="p.name" :value="p.name">{{ p.name }}</option>
        </select>

        <div class="relative flex-1 min-w-[140px]">
          <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索插件名 / spec..."
            class="w-full bg-white dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5"
          >
            <X class="w-3 h-3" />
          </button>
        </div>

        <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 text-xs shrink-0">
          <button
            @click="view = 'source'"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium',
              view === 'source'
                ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >按来源</button>
          <button
            @click="view = 'status'"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium',
              view === 'status'
                ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >按状态</button>
        </div>

        <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 text-xs shrink-0">
          <button
            @click="setViewMode('list')"
            :title="'列表视图'"
            :class="[
              'px-2 py-1 rounded-md transition-colors duration-200 flex items-center justify-center',
              viewMode === 'list'
                ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <List class="w-3.5 h-3.5" />
          </button>
          <button
            @click="setViewMode('card')"
            :title="'卡片视图'"
            :class="[
              'px-2 py-1 rounded-md transition-colors duration-200 flex items-center justify-center',
              viewMode === 'card'
                ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <LayoutGrid class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="relative shrink-0">
          <button
            @click="installMenuOpen = !installMenuOpen"
            :disabled="store.dshInstalling"
            class="px-2.5 py-1.5 rounded-lg bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
          >
            <Download class="w-3.5 h-3.5" />
            <span>安装</span>
            <ChevronDown class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-180': installMenuOpen }" />
          </button>
          <div
            v-if="installMenuOpen"
            class="fixed inset-0 z-20"
            @click="installMenuOpen = false"
          ></div>
          <div
            v-if="installMenuOpen"
            class="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 shadow-md dark:shadow-none p-1"
          >
            <button
              v-for="btn in installButtons"
              :key="btn.mode"
              type="button"
              :disabled="store.dshInstalling"
              @click="runInstall(btn.mode); installMenuOpen = false"
              class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200 disabled:opacity-50"
            >
              <component :is="btn.icon" class="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
              <span>{{ btn.label }}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          :title="store.installTerminal.visible ? '收起终端' : '展开安装终端'"
          @click="store.toggleInstallTerminal(!store.installTerminal.visible)"
          :class="[
            'p-1.5 rounded-lg border transition-colors duration-200 flex items-center gap-1.5 shrink-0',
            store.installTerminal.visible
              ? 'bg-black/5 dark:bg-[#282a32] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20'
              : 'bg-white dark:bg-[#1c1d22] text-slate-600 dark:text-white/70 border-black/8 dark:border-white/8 hover:text-slate-900 dark:hover:text-white/95'
          ]"
        >
          <Terminal class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- 健康胶囊行（点击即按状态筛选） -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="c in capsules"
          :key="c.value"
          @click="statusFilter = c.value"
          :class="[
            'px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors duration-200',
            statusFilter === c.value
              ? c.activeCls
              : 'bg-white dark:bg-[#1c1d22] text-slate-600 dark:text-white/70 border-black/8 dark:border-white/8 hover:text-slate-900 dark:hover:text-white/95'
          ]"
        >
          <span v-if="c.dot" class="w-1.5 h-1.5 rounded-sm shrink-0" :class="c.dot"></span>
          <span>{{ c.label }}</span>
          <span class="font-mono">{{ c.count }}</span>
        </button>

        <button
          v-if="hasActiveFilters"
          @click="resetFilters"
          class="px-2 py-1 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white/95 border border-black/10 dark:border-white/12 text-[11px] transition-colors duration-200 flex items-center gap-1"
        >
          <RotateCcw class="w-3 h-3" />
          <span>重置</span>
        </button>
      </div>

      <!-- 安装终端 -->
      <DshInstallTerminal v-if="store.installTerminal.visible" />

      <!-- 分组列表（按来源 / 按状态） -->
      <template v-for="sec in activeSections" :key="sec.id">
        <section v-if="sec.entries.length" class="space-y-2">
        <div class="flex items-center justify-between px-1 gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div :class="['w-6 h-6 rounded-md border flex items-center justify-center shrink-0', sec.iconClass]">
              <component :is="sec.icon" class="w-3 h-3" />
            </div>
            <h3 class="font-serif text-sm font-semibold text-slate-900 dark:text-white/95 shrink-0">{{ sec.title }}</h3>
            <span :class="['text-[10px] px-1.5 py-0.5 rounded-md font-mono border', sectionTint(sec.id)]">
              {{ sec.entries.length }}<template v-if="hasActiveFilters">/{{ sec.total }}</template>
            </span>
          </div>
          <span class="text-[11px] truncate ml-3" :class="sec.subtitleClass">{{ sec.subtitle }}</span>
        </div>
        <div
          v-if="viewMode === 'list'"
          class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 divide-y divide-black/5 dark:divide-white/5 shadow-xs overflow-hidden transition-colors duration-200"
          :class="sec.accentClass"
        >
          <DshPluginRow
            v-for="entry in pagedEntries(sec)"
            :key="entry.key"
            :entry="entry"
            :view="view"
            :layout="'list'"
            :update-check="store.dshPluginUpdates[entry.key]"
            @toggle="toggle"
            @remove="remove"
            @adopt="adopt"
            @show-error="showError = $event"
            @check-update="checkUpdate"
            @update="updatePlugin"
          />
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          <DshPluginRow
            v-for="entry in pagedEntries(sec)"
            :key="entry.key"
            :entry="entry"
            :view="view"
            :layout="'card'"
            :update-check="store.dshPluginUpdates[entry.key]"
            @toggle="toggle"
            @remove="remove"
            @adopt="adopt"
            @show-error="showError = $event"
            @check-update="checkUpdate"
            @update="updatePlugin"
          />
        </div>

        <!-- 分页条（用户插件分区，列表/卡片共用，右下角对齐） -->
        <div v-if="sec.paginated" class="flex items-center justify-end gap-3 pt-2 flex-wrap">
          <div v-if="totalPagesOf(sec) > 1" class="flex items-center gap-1">
            <button
              type="button"
              :disabled="pageOf(sec) <= 1"
              :title="'第一页'"
              @click="setPage(sec.id, 1)"
              class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
            >
              <ChevronsLeft class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              :disabled="pageOf(sec) <= 1"
              :title="'上一页'"
              @click="setPage(sec.id, pageOf(sec) - 1)"
              class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>
            <template v-for="n in pageNumbers(sec)" :key="n">
              <span v-if="n === '...'" class="px-1 text-[11px] text-slate-400 dark:text-white/40">…</span>
              <button
                v-else
                type="button"
                @click="setPage(sec.id, n)"
                :class="[
                  'min-w-[1.75rem] h-7 px-1.5 rounded-md text-[11px] font-medium border transition-colors duration-200',
                  n === pageOf(sec)
                    ? 'bg-black/5 dark:bg-[#282a32] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20 font-semibold'
                    : 'border-transparent text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white/95'
                ]"
              >{{ n }}</button>
            </template>
            <button
              type="button"
              :disabled="pageOf(sec) >= totalPagesOf(sec)"
              :title="'下一页'"
              @click="setPage(sec.id, pageOf(sec) + 1)"
              class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
            >
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              :disabled="pageOf(sec) >= totalPagesOf(sec)"
              :title="'最后一页'"
              @click="setPage(sec.id, totalPagesOf(sec))"
              class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
            >
              <ChevronsRight class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-slate-400 dark:text-white/40">每页</span>
            <select
              v-model.number="pageSize"
              class="bg-white dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 rounded-lg pl-2 pr-5 py-1 text-[11px] font-mono text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
            >
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
        </div>
        </section>
      </template>

      <!-- 无匹配 / 空态 -->
      <div
        v-if="entries.length > 0 && hasActiveFilters && filtered.length === 0 && !store.dshInstallEntriesLoading"
        class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 p-6 text-center text-xs text-slate-500 dark:text-white/50"
      >
        无匹配当前筛选条件的插件，可点击「重置」清空筛选
      </div>
      <div
        v-if="entries.length === 0 && !store.dshInstallEntriesLoading"
        class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 p-6 text-center text-xs text-slate-500 dark:text-white/50"
      >
        该 profile 暂无任何配置声明或本机安装的插件
      </div>

      <div v-if="hasFailedState" class="flex items-center justify-end">
        <button
          type="button"
          @click="clearFailed"
          class="text-[11px] text-[#f59e0b] hover:text-[#ef4444] transition-colors duration-200"
        >
          清除本 profile 失败状态
        </button>
      </div>
    </template>

    <!-- 失败堆栈弹窗 -->
    <div
      v-if="showError"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-colors duration-200"
      @click.self="showError = ''"
    >
      <div class="w-[min(720px,90vw)] max-h-[70vh] rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none p-4 flex flex-col">
        <div class="flex items-center justify-between">
          <h3 class="font-serif text-sm text-slate-900 dark:text-white/95">安装失败堆栈</h3>
          <button
            type="button"
            @click="showError = ''"
            class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-[#282a32] text-slate-500 dark:text-white/50 transition-colors duration-200"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <pre class="mt-3 flex-1 overflow-auto rounded-lg bg-black/5 dark:bg-[#121316] border border-black/8 dark:border-white/8 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-white/80 whitespace-pre-wrap break-all">{{ showError }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import {
  Puzzle,
  Download,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Terminal,
  X,
  Search,
  ChevronDown,
  List,
  LayoutGrid,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Globe,
  Wrench,
  Shield,
  Unlink,
  Clock,
  CheckCircle2,
  XCircle,
  ListTree,
} from 'lucide-vue-next';
import type { DshInstallMode, DshPluginInstallEntry, DshPluginInstallStatus } from '../types';
import DshInstallTerminal from './DshInstallTerminal.vue';
import DshPluginRow from './DshPluginRow.vue';

interface SectionDef {
  id: string;
  title: string;
  subtitle: string;
  subtitleClass: string;
  icon: any;
  iconClass: string;
  accentClass: string;
  entries: DshPluginInstallEntry[];
  total: number;
  paginated?: boolean;
}

const store = useAppStore();
const selectedProfile = ref(store.dshPluginsScan?.profiles[0]?.name || 'web');
const showError = ref('');
const view = ref<'source' | 'status'>('source');
const installMenuOpen = ref(false);
const viewMode = ref<'list' | 'card'>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem('dsh_plugins_view_mode') as 'list' | 'card')) || 'list'
);

function setViewMode(mode: 'list' | 'card') {
  viewMode.value = mode;
  try {
    localStorage.setItem('dsh_plugins_view_mode', mode);
  } catch (e) {}
}

// 分页：用户插件分区（可移植/本地开发）在列表与卡片视图下均启用，默认每页 10 个
const pageSize = ref(10);
const currentPage = reactive<Record<string, number>>({});

function totalPagesOf(sec: SectionDef): number {
  return Math.max(1, Math.ceil(sec.entries.length / pageSize.value));
}

function pageOf(sec: SectionDef): number {
  if (!sec.paginated) return 1;
  return Math.min(Math.max(1, currentPage[sec.id] || 1), totalPagesOf(sec));
}

function pagedEntries(sec: SectionDef): DshPluginInstallEntry[] {
  if (!sec.paginated) return sec.entries;
  const page = pageOf(sec);
  const start = (page - 1) * pageSize.value;
  return sec.entries.slice(start, start + pageSize.value);
}

function pageNumbers(sec: SectionDef): (number | '...')[] {
  const total = totalPagesOf(sec);
  const current = pageOf(sec);
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total]);
  for (let n = current - 2; n <= current + 2; n += 1) {
    if (n > 1 && n < total) set.add(n);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '...')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('...');
    out.push(p);
    prev = p;
  }
  return out;
}

function setPage(secId: string, page: number) {
  currentPage[secId] = page;
}

// 筛选状态：仅保留搜索 + 状态（状态经健康胶囊驱动；来源靠分组/徽章表达）
const searchQuery = ref('');
const statusFilter = ref<'all' | DshPluginInstallStatus>('all');

onMounted(async () => {
  if (!store.dshPluginsScan) {
    await store.loadDshPlugins().catch(() => {});
  }
  const prof = selectedProfile.value || store.dshPluginsScan?.profiles[0]?.name || 'web';
  selectedProfile.value = prof;
  await store.loadDshInstallEntries(prof).catch(() => {});
});

// 切换 profile / 搜索 / 状态筛选 / 每页条数时重置分页，避免停留在越界页
watch([selectedProfile, searchQuery, statusFilter, pageSize], () => {
  for (const k of Object.keys(currentPage)) delete currentPage[k];
});

// 先注册 selectedProfile 监听（immediate），再注册 profiles 监听（immediate），避免竞态。
watch(selectedProfile, (profile) => {
  if (profile) {
    store.loadDshInstallEntries(profile).catch(() => {});
  }
}, { immediate: true });

watch(
  () => store.dshPluginsScan?.profiles,
  (profiles) => {
    if (profiles && profiles.length > 0 && (!selectedProfile.value || !profiles.some(p => p.name === selectedProfile.value))) {
      selectedProfile.value = profiles[0].name;
    }
  },
  { immediate: true }
);

const entries = computed(() =>
  store.dshInstallEntries.filter(e => e.profileName === selectedProfile.value)
);

const hasActiveFilters = computed(
  () => searchQuery.value.trim() !== '' || statusFilter.value !== 'all'
);

function matchesFilters(entry: DshPluginInstallEntry): boolean {
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    const haystack = [entry.name, entry.spec || '', entry.key].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (statusFilter.value !== 'all' && entry.status !== statusFilter.value) return false;
  return true;
}

const filtered = computed(() => entries.value.filter(matchesFilters));

function groupEntries(list: DshPluginInstallEntry[]) {
  return {
    inbox: list.filter(e => e.kind === 'inbox'),
    portable: list.filter(
      e => e.kind !== 'inbox' && e.kind !== 'row' && e.status !== 'orphan' && e.portability === 'portable'
    ),
    unportable: list.filter(
      e => e.kind !== 'inbox' && e.kind !== 'row' && e.status !== 'orphan' && e.portability === 'unportable'
    ),
    row: list.filter(e => e.kind === 'row'),
    orphan: list.filter(e => e.status === 'orphan'),
    ok: list.filter(e => e.status === 'ok'),
    pending: list.filter(e => e.status === 'pending'),
    mismatch: list.filter(e => e.status === 'version-mismatch'),
    failed: list.filter(e => e.status === 'failed'),
  };
}

const groups = computed(() => groupEntries(filtered.value));
const totals = computed(() => groupEntries(entries.value));

const activeSections = computed<SectionDef[]>(() => {
  if (view.value === 'source') {
    return [
      {
        id: 'portable',
        title: '用户插件 · 可移植',
        subtitle: '可跨机复现安装 · 参与配置同步',
        subtitleClass: 'text-indigo-600 dark:text-indigo-400 font-medium',
        icon: Globe,
        iconClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        accentClass: '',
        entries: groups.value.portable,
        total: totals.value.portable.length,
        paginated: true,
      },
      {
        id: 'unportable',
        title: '用户插件 · 本地开发',
        subtitle: 'link:/file: 本机路径 · 不参与同步',
        subtitleClass: 'text-amber-600 dark:text-amber-400 font-medium',
        icon: Wrench,
        iconClass: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
        accentClass: 'border-t-amber-500/60',
        entries: groups.value.unportable,
        total: totals.value.unportable.length,
        paginated: true,
      },
      {
        id: 'inbox',
        title: '官方插件',
        subtitle: '@deepseek-ai/dsh-* · Harness 运行时解析 · 只读',
        subtitleClass: 'text-blue-600 dark:text-blue-400 font-medium',
        icon: Shield,
        iconClass: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
        accentClass: 'border-t-blue-500/60',
        entries: groups.value.inbox,
        total: totals.value.inbox.length,
      },
      {
        id: 'row',
        title: 'Patch 配置行',
        subtitle: 'cordis.patch.yml 顶层条目 · 非 npm 包',
        subtitleClass: 'text-purple-600 dark:text-purple-400 font-medium',
        icon: ListTree,
        iconClass: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
        accentClass: 'border-t-purple-500/60',
        entries: groups.value.row,
        total: totals.value.row.length,
      },
      {
        id: 'orphan',
        title: '孤儿安装',
        subtitle: '本机已装但未声明 · 可纳入配置或移除',
        subtitleClass: 'text-red-600 dark:text-red-400 font-medium',
        icon: Unlink,
        iconClass: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
        accentClass: 'border-t-red-500/60',
        entries: groups.value.orphan,
        total: totals.value.orphan.length,
      },
    ];
  }
  return [
    {
      id: 'ok',
      title: '正常',
      subtitle: '配置声明与磁盘安装一致',
      subtitleClass: 'text-slate-500 dark:text-white/50',
      icon: CheckCircle2,
      iconClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      accentClass: '',
      entries: groups.value.ok,
      total: totals.value.ok.length,
    },
    {
      id: 'pending',
      title: '待装',
      subtitle: '配置已声明 · 本机未安装',
      subtitleClass: 'text-amber-600 dark:text-amber-400 font-medium',
      icon: Clock,
      iconClass: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
      accentClass: 'border-t-amber-500/60',
      entries: groups.value.pending,
      total: totals.value.pending.length,
    },
    {
      id: 'mismatch',
      title: '版本冲突',
      subtitle: '本机版本与配置 / lock 不一致',
      subtitleClass: 'text-red-600 dark:text-red-400 font-medium',
      icon: AlertTriangle,
      iconClass: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
      accentClass: 'border-t-red-500/60',
      entries: groups.value.mismatch,
      total: totals.value.mismatch.length,
    },
    {
      id: 'failed',
      title: '失败',
      subtitle: '上次安装失败',
      subtitleClass: 'text-red-600 dark:text-red-400 font-medium',
      icon: XCircle,
      iconClass: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
      accentClass: 'border-t-red-500/60',
      entries: groups.value.failed,
      total: totals.value.failed.length,
    },
    {
      id: 'orphan',
      title: '孤儿安装',
      subtitle: '本机已装但未声明 · 可纳入配置或移除',
      subtitleClass: 'text-red-600 dark:text-red-400 font-medium',
      icon: Unlink,
      iconClass: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
      accentClass: 'border-t-red-500/60',
      entries: groups.value.orphan,
      total: totals.value.orphan.length,
    },
  ];
});

function sectionTint(id: string): string {
  switch (id) {
    case 'portable':
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    case 'ok':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    case 'unportable':
    case 'pending':
    case 'orphan':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'inbox':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'row':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    case 'mismatch':
    case 'failed':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    default:
      return 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10';
  }
}

const capsules = computed(() => [
  { value: 'all' as const, label: '全部', count: entries.value.length, dot: '', activeCls: 'bg-black/5 dark:bg-[#282a32] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20' },
  { value: 'ok' as const, label: '正常', count: totals.value.ok.length, dot: 'bg-[#3b82f6] ring-2 ring-[#3b82f6]/20', activeCls: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30' },
  { value: 'pending' as const, label: '待装', count: totals.value.pending.length, dot: 'bg-[#f59e0b] ring-2 ring-[#f59e0b]/20', activeCls: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30' },
  { value: 'version-mismatch' as const, label: '版本冲突', count: totals.value.mismatch.length, dot: 'bg-[#ef4444] ring-2 ring-[#ef4444]/20', activeCls: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30' },
  { value: 'failed' as const, label: '失败', count: totals.value.failed.length, dot: 'bg-[#ef4444] ring-2 ring-[#ef4444]/20', activeCls: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30' },
  { value: 'orphan' as const, label: '孤儿', count: totals.value.orphan.length, dot: 'bg-[#f59e0b] ring-2 ring-[#f59e0b]/20', activeCls: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30' },
]);

const hasFailedState = computed(() => entries.value.some(e => e.status === 'failed'));

const installButtons: { mode: DshInstallMode; label: string; icon: any }[] = [
  { mode: 'incremental', label: '增量安装', icon: Download },
  { mode: 'update', label: '更新', icon: RefreshCw },
  { mode: 'reinstall-failed', label: '仅失败重装', icon: AlertTriangle },
  { mode: 'reinstall-all', label: '全部重新安装', icon: RotateCcw },
];

function resetFilters() {
  searchQuery.value = '';
  statusFilter.value = 'all';
}

async function checkUpdate(entry: DshPluginInstallEntry) {
  try {
    const result = await store.checkDshPluginUpdate(entry.profileName, entry.key);
    if (result.error) {
      store.showToast({ title: '检查更新失败', message: result.error, type: 'error' });
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
    store.showToast({ title: '检查更新失败', message: e?.message || '无法检查更新', type: 'error' });
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
    store.showToast({ title: '切换失败', message: e?.message || '无法切换插件状态', type: 'error' });
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
    store.showToast({ title: '纳入配置失败', message: e?.message || '无法纳入配置', type: 'error' });
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
    store.showToast({ title: '清除失败', message: e?.message || '无法清除安装状态', type: 'error' });
  }
}
</script>
