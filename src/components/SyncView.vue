<template>
  <div class="h-full overflow-y-auto p-5 space-y-4 transition-colors duration-200">
    <!-- 未配置全局仓库时不允许使用同步功能 -->
    <div
      v-if="!store.syncRepoConfigured"
      class="h-full flex flex-col items-center justify-center gap-3 text-center"
    >
      <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
        <Lock class="w-5 h-5" />
      </div>
      <div class="space-y-1">
        <div class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">同步功能未启用</div>
        <p class="text-xs text-slate-500 dark:text-white/50 max-w-sm leading-relaxed">
          尚未配置全局同步仓库。请先在「全局设置 → 同步仓库配置」中填写仓库地址，并通过连通性 / 初始化校验后保存。
        </p>
      </div>
      <button
        @click="store.settingsModal.visible = true"
        class="px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
      >
        打开全局设置
      </button>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="font-serif font-semibold text-base text-slate-900 dark:text-white/95">同步中心</h2>
        <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5">
          技能库与 DSH 插件共用同一同步仓库 <span class="font-mono">%APPDATA%\AgentHub\</span>，按功能分开同步 / 拉取 / 推送
        </p>
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
        {{ activeTab === 'skills' ? '技能' : 'DSH 插件' }} · {{ statusLabel }}
      </div>
    </div>

    <!-- Segmented Tabs -->
    <div class="flex items-center p-1 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 shadow-xs text-xs w-fit">
      <button
        v-for="t in tabs"
        :key="t.id"
        @click="activeTab = t.id"
        :class="[
          'px-3.5 py-1.5 rounded-lg transition-colors duration-200 font-medium flex items-center gap-1.5',
          activeTab === t.id
            ? 'bg-black/5 dark:bg-[#2c2c2e] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
            : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
        ]"
      >
        <component :is="t.icon" class="w-3.5 h-3.5" />
        <span>{{ t.label }}</span>
      </button>
    </div>

    <template v-if="activeTab === 'skills'">

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

        <div
          v-if="!status.initialized"
          class="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 space-y-2"
        >
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>本地同步仓库尚未初始化，请打开全局设置重新保存仓库配置。</span>
          </div>
        </div>

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

          <button
            @click="handleTestConnection"
            :disabled="loading"
            class="w-full px-3 py-2 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] dark:bg-[#1c1c1e] dark:hover:bg-[#3a3a3c] text-slate-700 dark:text-white/80 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wifi class="w-3.5 h-3.5" />
            <span>{{ loading ? '测试中…' : '测试连接远端仓库' }}</span>
          </button>

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

    <!-- Divergence recovery -->
    <div
      v-if="diverged"
      class="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-3 transition-colors duration-200"
    >
      <div class="flex items-start gap-2">
        <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div class="space-y-1">
          <div class="font-serif font-semibold text-xs text-slate-900 dark:text-white/90">本地与远端历史分叉，无法安全快进拉取</div>
          <p class="text-[11px] leading-relaxed text-slate-500 dark:text-white/50">
            通常是因为本地与远端各自有独立提交（例如本地曾用不同仓库初始化过）。选择「以远端为准」会用远端中央技能库覆盖本地
            <span class="font-mono">skills/</span>，但不会触碰
            <span class="font-mono">config.json / agents.json / projects.json / backups/</span> 等本地私有文件。
          </p>
        </div>
      </div>
      <button
        @click="handleResetRemote"
        :disabled="loading"
        :class="[
          'w-full px-3 py-2 rounded-lg text-xs font-medium border transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
          confirmReset
            ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
            : 'bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border-black/8 dark:border-white/8'
        ]"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>{{ confirmReset ? '再次点击确认：以远端为准（覆盖本地 skills）' : '以远端为准（重置本地）' }}</span>
      </button>
    </div>

    <!-- Error banner -->
    <div
      v-if="status.lastError"
      class="rounded-xl bg-red-500/5 border border-red-500/20 p-3 space-y-2 text-xs text-red-600 dark:text-red-400 transition-colors duration-200"
    >
      <div class="flex items-start gap-2">
        <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span class="font-mono break-all whitespace-pre-wrap leading-relaxed">{{ status.lastError }}</span>
      </div>
      <div
        v-if="errorHint"
        class="pl-6 text-[11px] leading-relaxed text-red-500/90 dark:text-red-400/90"
      >
        💡 {{ errorHint }}
      </div>
    </div>
    </template>

    <DshPluginSync v-else />

    <DshPluginDiffModal />
    </template>
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
  AlertTriangle,
  Wifi,
  RotateCcw,
  BookOpen,
  Puzzle,
  Lock,
} from 'lucide-vue-next';
import DshPluginSync from './DshPluginSync.vue';
import DshPluginDiffModal from './DshPluginDiffModal.vue';

const store = useAppStore();

const activeTab = ref<'skills' | 'dshPlugins'>('skills');
const tabs = [
  { id: 'skills' as const, label: '技能同步', icon: BookOpen },
  { id: 'dshPlugins' as const, label: 'DSH 插件同步', icon: Puzzle },
];

const confirmReset = ref(false);

onMounted(async () => {
  await store.loadSyncRepo().catch(() => {});
  await store.loadSkillsSyncStatus();
});

const status = computed(() =>
  activeTab.value === 'skills' ? store.skillsSyncStatus : store.dshPluginsSyncStatus
);
const loading = computed(() =>
  activeTab.value === 'skills' ? store.skillsSyncLoading : store.dshPluginsSyncLoading
);
const autoPullOnStartup = computed(() =>
  activeTab.value === 'skills'
    ? store.config.skills_sync?.autoPullOnStartup ?? false
    : store.config.dsh_plugins?.sync?.autoPullOnStartup ?? false
);

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

const errorHint = computed(() => {
  const e = status.value.lastError || '';
  if (/unable to access|connection was reset|failed to connect|could not connect|schannel|recv failure|timed out/i.test(e)) {
    return '看起来是网络或代理问题。AgentHub 已自动注入 Windows 系统代理，请确认代理软件正在运行；私有仓库还需在系统凭据管理器登录 GitHub，或改用带 PAT 的 URL。';
  }
  if (/authentication|credential|permission|403|404|repository not found|not found|access denied/i.test(e)) {
    return '远端地址可能有误，或该仓库为私有仓库但当前没有访问凭据。请检查 URL，并在系统凭据管理器登录 GitHub（或使用带 Personal Access Token 的 URL）。';
  }
  if (/diverging|fast-forward|not possible to fast-forward|non-fast-forward|rejected|fetch first/i.test(e)) {
    return '本地与远端历史分叉。若希望把远端的中央技能库拉到本地，请使用下方「以远端为准（重置本地）」。';
  }
  return '';
});

const diverged = computed(() => {
  const e = status.value.lastError || '';
  return /diverging|fast-forward|not possible to fast-forward|non-fast-forward|rejected|fetch first/i.test(e);
});

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

async function handleTestConnection() {
  try {
    await store.testSkillsSyncConnection();
  } catch {}
}

async function handleResetRemote() {
  if (!confirmReset.value) {
    confirmReset.value = true;
    return;
  }
  confirmReset.value = false;
  try {
    await store.resetSkillsSyncToRemote();
  } catch {}
}

async function toggleAutoPull(enabled: boolean) {
  try {
    await store.setSkillsSyncAutoPull(enabled);
  } catch {}
}
</script>
