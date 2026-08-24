<template>
  <div class="space-y-3">
    <!-- 当前版本 + 远端检测 -->
    <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 border-t-[#8b5cf6]/60 overflow-hidden transition-colors duration-200">
      <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] flex items-center justify-center shrink-0">
            <Rocket class="w-3.5 h-3.5" />
          </div>
          <div class="min-w-0">
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">DSH 版本</h3>
            <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 truncate">
              全局 npm 包 · 影响所有 profile
            </p>
          </div>
        </div>
      </div>

      <div class="p-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] text-slate-500 dark:text-white/50 mb-1">当前版本</p>
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="font-mono text-2xl font-semibold text-slate-900 dark:text-white/95">
                {{ info?.current || '未检测到' }}
              </span>
              <span class="font-mono text-[11px] text-slate-400 dark:text-white/40">{{ info?.packageName }}</span>
            </div>
            <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 mt-1.5 truncate">
              dsh: {{ info?.dshCommand || '（未探测到）' }}
            </p>
            <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 truncate">
              npm: {{ info?.npmCommand || '（未探测到）' }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              @click="launchDsh"
              :disabled="store.dshLaunching"
              class="px-3 py-1.5 rounded-lg bg-[#30d158]/10 hover:bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
            >
              <Play class="w-3.5 h-3.5" />
              <span>{{ store.dshLaunching ? '启动中…' : '启动 dsh' }}</span>
            </button>
            <button
              type="button"
              @click="checkUpdate"
              :disabled="store.dshVersionChecking"
              class="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1c1d22] hover:bg-black/5 dark:hover:bg-white/5 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.dshVersionChecking }" />
              <span>检测远端</span>
            </button>
            <button
              v-if="check?.updateAvailable"
              type="button"
              @click="upgrade"
              :disabled="store.dshVersionUpgrading"
              class="px-3 py-1.5 rounded-lg bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
            >
              <ArrowUp class="w-3.5 h-3.5" />
              <span>升级到 {{ check.latest }}</span>
            </button>
          </div>
        </div>

        <div v-if="check" class="mt-3 pt-3 border-t border-black/8 dark:border-white/8 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] text-slate-500 dark:text-white/50">远端最新：</span>
            <span class="font-mono text-xs text-slate-900 dark:text-white/90">{{ check.latest || '—' }}</span>
            <span
              v-if="check.updateAvailable"
              class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30"
            >
              有更新
            </span>
            <span
              v-else-if="!check.error"
              class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-black/5 dark:bg-white/5 text-slate-500 dark:text-white/50 border-black/10 dark:border-white/10"
            >
              已是最新
            </span>
          </div>
          <p v-if="check.error" class="text-[11px] text-[#ff453a] dark:text-[#ff453a]/90">{{ check.error }}</p>
        </div>
      </div>
    </div>

    <!-- 版本变更实时终端 -->
    <DshVersionTerminal v-if="store.dshVersionTerminal.visible" />

    <!-- 指定版本安装 / 降级 / 切换（平铺列表 + 分页） -->
    <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 overflow-hidden transition-colors duration-200">
      <div class="px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-[#0a84ff]/10 border border-[#0a84ff]/20 text-[#0a84ff] flex items-center justify-center shrink-0">
            <Package class="w-3.5 h-3.5" />
          </div>
          <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">安装指定版本</h3>
          <span
            v-if="available"
            class="text-[10px] px-1.5 py-0.5 rounded-md font-mono border bg-black/5 dark:bg-white/10 text-slate-500 dark:text-white/50 border-black/8 dark:border-white/10 shrink-0"
          >
            {{ available.versions.length }} 个版本
          </span>
        </div>
        <button
          type="button"
          @click="loadAvailableVersions"
          :disabled="store.dshAvailableVersionsLoading"
          class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1c1d22] hover:bg-black/5 dark:hover:bg-white/5 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.dshAvailableVersionsLoading }" />
          <span>刷新</span>
        </button>
      </div>

      <!-- 错误态 -->
      <div v-if="available?.error" class="p-6 text-center">
        <p class="text-[11px] text-[#ff453a]">{{ available.error }}</p>
        <button
          type="button"
          @click="loadAvailableVersions"
          :disabled="store.dshAvailableVersionsLoading"
          class="mt-2 px-3 py-1.5 rounded-lg bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-xs font-medium transition-colors duration-200 disabled:opacity-50"
        >
          重试
        </button>
      </div>

      <template v-else>
        <!-- 加载 / 空态 -->
        <div
          v-if="store.dshAvailableVersionsLoading && availableVersions.length === 0"
          class="p-6 text-center text-xs text-slate-500 dark:text-white/50"
        >
          正在拉取 npm registry 版本列表…
        </div>
        <div
          v-else-if="availableVersions.length === 0"
          class="p-6 text-center text-xs text-slate-500 dark:text-white/50"
        >
          暂无可安装版本
        </div>

        <!-- 平铺版本列表 -->
        <div v-else class="divide-y divide-black/5 dark:divide-white/5">
          <div
            v-for="v in pagedAvailableVersions"
            :key="v"
            class="px-4 py-3 flex items-center justify-between gap-3 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] group"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div
                class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 bg-[#0a84ff]/10 border-[#0a84ff]/20 text-[#0a84ff]"
              >
                <Tag class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-mono text-sm font-semibold text-slate-900 dark:text-white/95">{{ v }}</span>
                  <span
                    v-if="v === info?.current"
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30 shrink-0"
                  >
                    当前
                  </span>
                  <span
                    v-else-if="v === available?.latest"
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30 shrink-0"
                  >
                    最新
                  </span>
                </div>
                <p class="text-[10px] font-mono text-slate-400 dark:text-white/40 mt-0.5 truncate">
                  {{ info?.packageName || '@deepseek-ai/dsh' }}@{{ v }}
                </p>
              </div>
            </div>

            <button
              type="button"
              @click="installVersion(v)"
              :disabled="store.dshVersionUpgrading || v === info?.current"
              class="px-3 py-1.5 rounded-lg bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 shrink-0"
            >
              <ArrowDown class="w-3.5 h-3.5" />
              <span>{{ v === info?.current ? '当前版本' : '安装' }}</span>
            </button>
          </div>
        </div>

        <!-- 分页条 -->
        <div
          v-if="availableVersions.length > 0"
          class="flex items-center justify-between gap-3 px-3 py-2 border-t border-black/8 dark:border-white/8"
        >
          <span class="text-[11px] font-mono text-slate-400 dark:text-white/40">
            第 {{ currentVersionPage }} / {{ totalVersionPages }} 页
          </span>
          <div class="flex items-center gap-2 flex-wrap">
            <div v-if="totalVersionPages > 1" class="flex items-center gap-1">
              <button
                type="button"
                :disabled="currentVersionPage <= 1"
                title="第一页"
                @click="goVersionPage(1)"
                class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
              >
                <ChevronsLeft class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="currentVersionPage <= 1"
                title="上一页"
                @click="goVersionPage(currentVersionPage - 1)"
                class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
              >
                <ChevronLeft class="w-3.5 h-3.5" />
              </button>
              <template v-for="n in versionPageNumbers()" :key="n">
                <span v-if="n === '...'" class="px-1 text-[11px] text-slate-400 dark:text-white/40">…</span>
                <button
                  v-else
                  type="button"
                  @click="goVersionPage(n)"
                  :class="[
                    'min-w-[1.75rem] h-7 px-1.5 rounded-md text-[11px] font-medium border transition-colors duration-200',
                    n === currentVersionPage
                      ? 'bg-black/5 dark:bg-[#282a32] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20 font-semibold'
                      : 'border-transparent text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white/95'
                  ]"
                >{{ n }}</button>
              </template>
              <button
                type="button"
                :disabled="currentVersionPage >= totalVersionPages"
                title="下一页"
                @click="goVersionPage(currentVersionPage + 1)"
                class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
              >
                <ChevronRight class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="currentVersionPage >= totalVersionPages"
                title="最后一页"
                @click="goVersionPage(totalVersionPages)"
                class="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-200"
              >
                <ChevronsRight class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="text-[11px] text-slate-400 dark:text-white/40">每页</span>
              <select
                v-model.number="versionPageSize"
                class="bg-white dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 rounded-lg pl-2 pr-5 py-1 text-[11px] font-mono text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 最近一次变更结果 + 一键回滚 -->
    <div
      v-if="result"
      class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 p-3 space-y-2 transition-colors duration-200"
    >
      <div class="flex items-center justify-between gap-2">
        <h4 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">最近变更结果</h4>
        <span
          :class="[
            'px-1.5 py-0.5 rounded-md text-[10px] font-medium border',
            result.ok ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30' : 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30'
          ]"
        >
          {{ result.ok ? '成功' : '需关注' }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px]">
        <div class="rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/8 dark:border-white/8 px-2.5 py-2">
          <p class="text-slate-400 dark:text-white/40">变更前</p>
          <p class="font-mono text-slate-900 dark:text-white/90">{{ result.beforeVersion || '未知' }}</p>
        </div>
        <div class="rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/8 dark:border-white/8 px-2.5 py-2">
          <p class="text-slate-400 dark:text-white/40">变更后</p>
          <p class="font-mono text-slate-900 dark:text-white/90">{{ result.afterVersion || result.targetVersion }}</p>
        </div>
        <div class="rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/8 dark:border-white/8 px-2.5 py-2">
          <p class="text-slate-400 dark:text-white/40">失败插件（前）</p>
          <p class="font-mono text-slate-900 dark:text-white/90">{{ result.diagnosisBefore }}</p>
        </div>
        <div class="rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/8 dark:border-white/8 px-2.5 py-2">
          <p class="text-slate-400 dark:text-white/40">失败插件（后）</p>
          <p class="font-mono text-slate-900 dark:text-white/90">{{ result.diagnosisAfter }}</p>
        </div>
      </div>

      <div
        v-if="result.massFailure"
        class="rounded-lg bg-[#ff453a]/10 border border-[#ff453a]/30 px-3 py-2 text-[11px] text-[#ff453a]"
      >
        检测到插件大面积失效（失败数 {{ result.diagnosisBefore }} → {{ result.diagnosisAfter }}），建议立即回滚。
      </div>

      <p v-if="result.error" class="text-[11px] text-[#ff453a]">{{ result.error }}</p>
      <p v-if="result.warnings.length" class="text-[11px] text-[#ff9f0a] whitespace-pre-wrap">{{ result.warnings.join('\n') }}</p>

      <div v-if="result.output" class="rounded-lg bg-black/[0.03] dark:bg-[#121316] border border-black/8 dark:border-white/8 p-2 max-h-40 overflow-y-auto">
        <pre class="text-[10px] font-mono text-slate-500 dark:text-white/50 whitespace-pre-wrap">{{ result.output }}</pre>
      </div>

      <button
        v-if="canRollback"
        type="button"
        @click="rollback"
        :disabled="store.dshVersionRollingBack"
        class="w-full px-3 py-2 rounded-lg bg-[#ff453a]/10 hover:bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>一键回滚（装回 {{ result.beforeVersion }} + 回滚配置快照）</span>
      </button>
    </div>

    <!-- 版本历史 -->
    <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 overflow-hidden transition-colors duration-200">
      <div class="px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8 flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-[#ff9f0a]/10 border border-[#ff9f0a]/20 text-[#ff9f0a] flex items-center justify-center shrink-0">
          <History class="w-3.5 h-3.5" />
        </div>
        <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">版本历史</h3>
      </div>

      <div
        v-if="versions.length === 0"
        class="p-6 text-center text-xs text-slate-500 dark:text-white/50"
      >
        暂无版本记录。执行升级 / 降级 / 回滚后，这里会记录本机装过的版本。
      </div>

      <div v-else class="divide-y divide-black/5 dark:divide-white/5">
        <div
          v-for="v in versions"
          :key="`${v.version}-${v.installedAt}`"
          class="px-3 py-2.5 flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-1.5 h-1.5 rounded-sm mt-1.5 shrink-0" :class="actionDot(v.action)"></span>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-mono text-xs text-slate-900 dark:text-white/90">{{ v.version }}</span>
                <span class="px-1.5 py-0.5 rounded-md text-[10px] font-medium border" :class="actionBadge(v.action)">
                  {{ actionLabel(v.action) }}
                </span>
              </div>
              <p class="text-[10px] text-slate-400 dark:text-white/40 mt-0.5">
                {{ formatTime(v.installedAt) }}<template v-if="v.fromVersion"> · 来自 {{ v.fromVersion }}</template><template v-if="v.note"> · {{ v.note }}</template>
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="installVersion(v.version)"
            :disabled="store.dshVersionUpgrading || v.version === info?.current"
            class="px-2.5 py-1.5 rounded-lg bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 shrink-0"
          >
            <ArrowDown class="w-3.5 h-3.5" />
            <span>安装</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  Package,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  Tag,
} from 'lucide-vue-next';
import type { DshVersionAction } from '../types';
import DshVersionTerminal from './DshVersionTerminal.vue';

const store = useAppStore();

const info = computed(() => store.dshVersionInfo);
const check = computed(() => store.dshVersionCheck);
const versions = computed(() => store.dshVersions);
const result = computed(() => store.dshVersionResult);
const available = computed(() => store.dshAvailableVersions);
const availableVersions = computed(() => store.dshAvailableVersions?.versions ?? []);

// 历史版本平铺列表分页：默认每页 5 行，可选 5/10/20/50
const versionPageSize = ref(5);
const currentVersionPage = ref(1);

const totalVersionPages = computed(() =>
  Math.max(1, Math.ceil(availableVersions.value.length / versionPageSize.value))
);

const pagedAvailableVersions = computed(() => {
  const page = Math.min(Math.max(1, currentVersionPage.value), totalVersionPages.value);
  const start = (page - 1) * versionPageSize.value;
  return availableVersions.value.slice(start, start + versionPageSize.value);
});

function goVersionPage(n: number) {
  currentVersionPage.value = Math.min(Math.max(1, n), totalVersionPages.value);
}

function versionPageNumbers(): (number | '...')[] {
  const total = totalVersionPages.value;
  const current = currentVersionPage.value;
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

// 每页条数或版本列表变化时回到第一页，避免停留在越界页
watch([versionPageSize, () => availableVersions.value.length], () => {
  currentVersionPage.value = 1;
});

const canRollback = computed(() => {
  const r = result.value;
  return !!r && !!r.beforeVersion && r.snapshotIds.length > 0;
});

onMounted(async () => {
  await store.loadDshVersion().catch(() => {});
  await store.loadDshAvailableVersions().catch(() => {});
});

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function actionLabel(a: DshVersionAction): string {
  return a === 'upgrade' ? '升级' : a === 'rollback' ? '回滚' : '安装';
}

function actionBadge(a: DshVersionAction): string {
  if (a === 'upgrade') return 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30';
  if (a === 'rollback') return 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30';
  return 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30';
}

function actionDot(a: DshVersionAction): string {
  if (a === 'upgrade') return 'bg-[#8b5cf6]';
  if (a === 'rollback') return 'bg-[#ff453a]';
  return 'bg-[#0a84ff]';
}

async function launchDsh() {
  await store.launchDsh('web').catch(() => {});
}

async function loadAvailableVersions() {
  await store.loadDshAvailableVersions().catch(() => {});
}

async function checkUpdate() {
  try {
    await store.checkDshVersionUpdate();
  } catch (e: any) {
    store.showToast({ title: '检测远端失败', message: e?.message || '无法查询 npm registry', type: 'error' });
  }
}

function confirmGlobal(): boolean {
  return window.confirm(
    'DSH 版本变更会修改全局 npm 包，影响所有 profile。\n\n操作前会自动创建配置快照，变更后自动运行诊断对比失败插件数。确认继续？'
  );
}

async function upgrade() {
  if (!confirmGlobal()) return;
  try {
    await store.upgradeDsh();
  } catch (e: any) {
    store.showToast({ title: '升级失败', message: e?.message || '无法升级 DSH', type: 'error' });
  }
}

async function installVersion(version: string) {
  if (!confirmGlobal()) return;
  try {
    await store.installDshVersion(version);
  } catch (e: any) {
    store.showToast({ title: '安装失败', message: e?.message || '无法安装指定版本', type: 'error' });
  }
}

async function rollback() {
  const r = result.value;
  if (!r || !r.beforeVersion) return;
  if (!window.confirm(`确认回滚 DSH？\n\n将装回版本 ${r.beforeVersion}，并回滚升级前创建的 ${r.snapshotIds.length} 份配置快照。`)) return;
  try {
    await store.rollbackDsh(r.beforeVersion, r.snapshotIds);
  } catch (e: any) {
    store.showToast({ title: '回滚失败', message: e?.message || '无法回滚 DSH', type: 'error' });
  }
}
</script>
