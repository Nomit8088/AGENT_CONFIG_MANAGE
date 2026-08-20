<template>
  <div class="h-full overflow-y-auto p-5 space-y-4 transition-colors duration-200">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="font-serif font-semibold text-base text-slate-900 dark:text-white/95">同步中心</h2>
        <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5">仅同步中央技能库 <span class="font-mono">%APPDATA%\AgentHub\skills\</span>，不涉及 Agent/项目配置</p>
      </div>
      <div
        :class="[
          'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors duration-200',
          status.lastSyncStatus === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : status.lastSyncStatus === 'error'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
              : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10'
        ]"
      >
        {{ statusLabel }}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 仓库状态 -->
      <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-4 space-y-3 transition-colors duration-200">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80">
            <GitBranch class="w-3.5 h-3.5" />
          </div>
          <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">仓库状态</h3>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
            <div class="text-slate-500 dark:text-white/50">初始化状态</div>
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">
              {{ status.initialized ? '已初始化' : '未初始化' }}
            </div>
          </div>
          <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
            <div class="text-slate-500 dark:text-white/50">当前分支</div>
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ status.branch || '—' }}</div>
          </div>
          <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
            <div class="text-slate-500 dark:text-white/50">领先 / 落后</div>
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">
              {{ status.ahead }} / {{ status.behind }}
            </div>
          </div>
          <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
            <div class="text-slate-500 dark:text-white/50">未提交修改</div>
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ status.dirtyCount }}</div>
          </div>
        </div>

        <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 text-xs space-y-1">
          <div class="text-slate-500 dark:text-white/50">远端仓库</div>
          <div class="font-mono text-[11px] text-slate-800 dark:text-white/90 break-all">{{ status.remoteUrl || '未配置' }}</div>
        </div>

        <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 text-xs space-y-1">
          <div class="text-slate-500 dark:text-white/50">最后同步时间</div>
          <div class="font-mono text-[11px] text-slate-800 dark:text-white/90">{{ lastSyncLabel }}</div>
        </div>
      </div>

      <!-- 操作 -->
      <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-4 space-y-4 transition-colors duration-200">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80">
            <RefreshCw class="w-3.5 h-3.5" />
          </div>
          <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">操作</h3>
        </div>

        <template v-if="!status.initialized">
          <div class="space-y-2">
            <label class="block text-xs text-slate-500 dark:text-white/50">GitHub 私有仓库 URL</label>
            <input
              v-model="remoteUrl"
              type="text"
              placeholder="https://github.com/you/agenthub-skills.git"
              class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-xs text-slate-500 dark:text-white/50">分支</label>
            <input
              v-model="branch"
              type="text"
              placeholder="main"
              class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
            />
          </div>
          <button
            @click="handleInit"
            :disabled="loading || !remoteUrl.trim()"
            class="w-full px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link2 class="w-3.5 h-3.5" />
            <span>{{ loading ? '连接中…' : '初始化并连接' }}</span>
          </button>
        </template>

        <template v-else>
          <div class="flex gap-2">
            <button
              @click="handlePull"
              :disabled="loading"
              class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadCloud class="w-3.5 h-3.5" />
              <span>拉取</span>
            </button>
            <button
              @click="handlePush"
              :disabled="loading"
              class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud class="w-3.5 h-3.5" />
              <span>推送</span>
            </button>
          </div>

          <div class="flex items-center justify-between py-2 border-t border-black/8 dark:border-white/8">
            <div>
              <div class="font-serif font-semibold text-slate-900 dark:text-white/90">启动自动拉取</div>
              <div class="text-[11px] text-slate-500 dark:text-white/50">仅 fast-forward，有本地修改/冲突时自动跳过</div>
            </div>
            <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
              <button
                type="button"
                @click="toggleAutoPull(true)"
                :class="[
                  'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                  autoPullOnStartup
                    ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                ]"
              >
                <span>开启</span>
              </button>
              <button
                type="button"
                @click="toggleAutoPull(false)"
                :class="[
                  'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                  !autoPullOnStartup
                    ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                ]"
              >
                <span>关闭</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Error banner -->
    <div
      v-if="status.lastError"
      class="rounded-xl bg-red-500/5 border border-red-500/20 p-3 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 transition-colors duration-200"
    >
      <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span class="font-mono break-all">{{ status.lastError }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import {
  RefreshCw,
  DownloadCloud,
  UploadCloud,
  GitBranch,
  Link2,
  AlertTriangle,
} from 'lucide-vue-next';

const store = useAppStore();

const remoteUrl = ref(store.skillsSyncStatus.remoteUrl || '');
const branch = ref(store.skillsSyncStatus.branch || 'main');

onMounted(async () => {
  await store.loadSkillsSyncStatus();
  remoteUrl.value = store.skillsSyncStatus.remoteUrl || '';
  branch.value = store.skillsSyncStatus.branch || 'main';
});

const status = computed(() => store.skillsSyncStatus);
const loading = computed(() => store.skillsSyncLoading);
const autoPullOnStartup = computed(() => store.config.skills_sync?.autoPullOnStartup ?? false);

const statusLabel = computed(() => {
  switch (status.value.lastSyncStatus) {
    case 'success': return '已同步';
    case 'error': return '同步错误';
    case 'syncing': return '同步中';
    default: return '待机';
  }
});

const lastSyncLabel = computed(() => {
  if (!status.value.lastSyncAt) return '从未同步';
  return new Date(status.value.lastSyncAt).toLocaleString();
});

async function handleInit() {
  if (!remoteUrl.value.trim()) return;
  try {
    await store.initSkillsSync(remoteUrl.value.trim(), branch.value.trim() || 'main');
  } catch {}
}

async function handlePull() {
  try {
    await store.pullSkillsSync();
  } catch {}
}

async function handlePush() {
  try {
    await store.pushSkillsSync();
  } catch {}
}

async function toggleAutoPull(enabled: boolean) {
  try {
    await store.setSkillsSyncAutoPull(enabled);
  } catch {}
}
</script>
