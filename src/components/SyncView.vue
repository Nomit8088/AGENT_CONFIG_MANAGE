<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 transition-colors duration-200">
    <!-- 未配置 / 不可用：允许进入，并给出同步指引 -->
    <div
      v-if="!store.syncRepoConfigured"
      class="h-full flex flex-col items-center justify-center gap-4 text-center"
    >
      <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
        <UploadCloud class="w-6 h-6" />
      </div>
      <div class="space-y-1">
        <div class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">同步仓库未配置</div>
        <p class="text-xs text-slate-500 dark:text-white/50 max-w-md leading-relaxed">
          当前还未配置或校验 Git 同步仓库。配置后即可在同一仓库内按功能分别同步中央技能库（<span class="font-mono">skills/</span>）与 DSH 插件配置（<span class="font-mono">dsh/</span>）。
        </p>
      </div>

      <!-- 仓库格式规范指引 -->
      <div class="w-full max-w-lg rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-4 text-left space-y-2 text-xs transition-colors duration-200">
        <div class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">仓库格式规范</div>
        <ul class="space-y-1.5 text-[11px] text-slate-500 dark:text-white/60 leading-relaxed">
          <li>• 单个 Git 仓库，根目录必须包含 <span class="font-mono text-slate-700 dark:text-white/80">skills/</span> 与 <span class="font-mono text-slate-700 dark:text-white/80">dsh/</span> 两个目录（校验时会检查）</li>
          <li>• <span class="font-mono text-slate-700 dark:text-white/80">skills/</span> 存放中央技能库（各技能目录内的 SKILL.md）</li>
          <li>• <span class="font-mono text-slate-700 dark:text-white/80">dsh/profiles/&lt;name&gt;/</span> 存放 DSH 插件配置镜像（package.json / cordis.patch.yml / pnpm-lock.yaml / pnpm-workspace.yaml）</li>
          <li>• 建议使用 HTTPS 地址；私有仓库需在本机 Git 凭据中登录 GitHub，或使用带 PAT 的 URL</li>
          <li>• AgentHub 会在 <span class="font-mono text-slate-700 dark:text-white/80">%APPDATA%\AgentHub\</span> 初始化本地仓库，只提交 <span class="font-mono">skills/ dsh/ .gitignore</span>，不会触碰本机私有配置</li>
        </ul>
      </div>

      <button
        @click="store.settingsModal.visible = true"
        class="px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
      >
        打开全局设置配置仓库
      </button>
    </div>

    <template v-else>
      <!-- 共享仓库主视觉卡（视觉中心）：技能/DSH 插件共用同一 Git 仓库 -->
      <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 border-t-[#0a84ff]/60 overflow-hidden transition-colors duration-200">
        <div class="flex items-center justify-between gap-3 px-4 py-3 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-lg bg-[#0a84ff]/10 border border-[#0a84ff]/20 text-[#0a84ff] flex items-center justify-center shrink-0">
              <GitBranch class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">同步仓库</h2>
                <span
                  :class="[
                    'px-1.5 py-0.5 rounded-md text-[10px] font-mono border transition-colors duration-200',
                    repoStatus.initialized
                      ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
                      : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30'
                  ]"
                >
                  {{ repoStatus.initialized ? '已初始化' : '未初始化' }}
                </span>
              </div>
              <p class="text-[11px] font-mono text-slate-400 dark:text-white/40 truncate" :title="repoStatus.remoteUrl || ''">
                {{ repoStatus.remoteUrl || '未配置远端仓库' }}
              </p>
            </div>
          </div>
          <button
            @click="handleTestConnection"
            :disabled="skillsLoading"
            class="px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Wifi class="w-3.5 h-3.5" />
            <span>{{ skillsLoading ? '测试中…' : '测试连接' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-3 divide-x divide-black/6 dark:divide-white/6">
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-slate-400 dark:text-white/40">当前分支</div>
            <div class="mt-0.5 font-mono text-sm text-slate-900 dark:text-white/95">{{ repoStatus.branch || '—' }}</div>
          </div>
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-slate-400 dark:text-white/40">领先</div>
            <div class="mt-0.5 font-mono text-sm text-slate-900 dark:text-white/95">{{ repoStatus.ahead }}</div>
          </div>
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-slate-400 dark:text-white/40">落后</div>
            <div class="mt-0.5 font-mono text-sm text-slate-900 dark:text-white/95">{{ repoStatus.behind }}</div>
          </div>
        </div>

        <div
          v-if="!repoStatus.initialized"
          class="px-4 py-3 bg-amber-500/5 border-t border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2"
        >
          <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>本地同步仓库尚未初始化，请打开全局设置重新保存仓库配置。</span>
        </div>
      </div>

      <!-- 双功能卡片：技能同步 / DSH 插件同步（不再用顶部页签切换） -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <!-- 技能同步（蓝色标识） -->
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 border-t-[#0a84ff]/60 overflow-hidden transition-colors duration-200">
          <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-7 h-7 rounded-lg bg-[#0a84ff]/10 border border-[#0a84ff]/20 text-[#0a84ff] flex items-center justify-center shrink-0">
                <BookOpen class="w-3.5 h-3.5" />
              </div>
              <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">技能同步</h3>
              <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">skills/</span>
            </div>
            <span
              :class="[
                'px-1.5 py-0.5 rounded-md text-[10px] font-mono border transition-colors duration-200',
                skillsStatus.lastSyncStatus === 'success'
                  ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
                  : skillsStatus.lastSyncStatus === 'error'
                    ? 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30'
                    : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10'
              ]"
            >
              {{ skillsStatusLabel }}
            </span>
          </div>

          <div class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
              <div class="text-slate-500 dark:text-white/50">未提交修改</div>
              <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ skillsStatus.dirtyCount }}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
              <div class="text-slate-500 dark:text-white/50">最后同步</div>
              <div class="mt-0.5 font-mono text-[11px] text-slate-800 dark:text-white/90">{{ skillsLastSyncLabel }}</div>
            </div>
          </div>

          <template v-if="repoStatus.initialized">
            <div class="flex gap-2">
              <button
                @click="handlePull"
                :disabled="skillsLoading"
                class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadCloud class="w-3.5 h-3.5" />
                <span>拉取</span>
              </button>
              <button
                @click="handlePush"
                :disabled="skillsLoading"
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
                    skillsAutoPull
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
                    !skillsAutoPull
                      ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                  ]"
                >
                  <span>关闭</span>
                </button>
              </div>
            </div>
          </template>

          <!-- 分叉恢复 -->
          <div
            v-if="diverged"
            class="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-2 transition-colors duration-200"
          >
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div class="space-y-1">
                <div class="font-serif font-semibold text-xs text-slate-900 dark:text-white/90">本地与远端历史分叉，无法安全快进拉取</div>
                <p class="text-[11px] leading-relaxed text-slate-500 dark:text-white/50">
                  「以远端为准」会用远端中央技能库覆盖本地 <span class="font-mono">skills/</span>，但不会触碰 <span class="font-mono">config.json / agents.json / projects.json / backups/</span> 等本地私有文件。
                </p>
              </div>
            </div>
            <button
              @click="handleResetRemote"
              :disabled="skillsLoading"
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

          <!-- 错误横幅 -->
          <div
            v-if="skillsStatus.lastError"
            class="rounded-lg bg-red-500/5 border border-red-500/20 p-3 space-y-2 text-xs text-red-600 dark:text-red-400 transition-colors duration-200"
          >
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span class="font-mono break-all whitespace-pre-wrap leading-relaxed">{{ skillsStatus.lastError }}</span>
            </div>
            <div v-if="errorHint" class="pl-6 text-[11px] leading-relaxed text-red-500/90 dark:text-red-400/90">
              💡 {{ errorHint }}
            </div>
          </div>
          </div>
        </div>

        <!-- DSH 插件同步（紫色标识） -->
        <section class="space-y-2 min-w-0">
          <div class="flex items-center justify-between px-1 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-7 h-7 rounded-lg bg-[#bf5af2]/10 border border-[#bf5af2]/20 text-[#bf5af2] flex items-center justify-center shrink-0">
                <Puzzle class="w-3.5 h-3.5" />
              </div>
              <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">DSH 插件同步</h3>
              <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">dsh/</span>
            </div>
            <span class="text-[10px] font-mono text-slate-400 dark:text-white/40 shrink-0">
              未提交 {{ dshStatus.dirtyCount }} · {{ dshLastSyncLabel }}
            </span>
          </div>
          <DshPluginSync :show-repo-status="false" />
        </section>
      </div>

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
} from 'lucide-vue-next';
import DshPluginSync from './DshPluginSync.vue';
import DshPluginDiffModal from './DshPluginDiffModal.vue';

const store = useAppStore();
const confirmReset = ref(false);

onMounted(async () => {
  await store.loadSyncRepo().catch(() => {});
  await store.loadSkillsSyncStatus().catch(() => {});
});

// 共享仓库信息复用技能同步状态（同一 Git 仓库，initialized/branch/ahead/behind/remoteUrl 一致）
const repoStatus = computed(() => store.skillsSyncStatus);
const skillsStatus = computed(() => store.skillsSyncStatus);
const dshStatus = computed(() => store.dshPluginsSyncStatus);
const skillsLoading = computed(() => store.skillsSyncLoading);
const skillsAutoPull = computed(() => store.config.skills_sync?.autoPullOnStartup ?? false);

const skillsStatusLabel = computed(() => {
  switch (skillsStatus.value.lastSyncStatus) {
    case 'success': return '已同步';
    case 'error': return '同步错误';
    case 'syncing': return '同步中';
    default: return '待机';
  }
});

const skillsLastSyncLabel = computed(() => {
  if (!skillsStatus.value.lastSyncAt) return '从未同步';
  return new Date(skillsStatus.value.lastSyncAt).toLocaleString();
});

const dshLastSyncLabel = computed(() => {
  if (!dshStatus.value.lastSyncAt) return '从未同步';
  return new Date(dshStatus.value.lastSyncAt).toLocaleString();
});

const errorHint = computed(() => {
  const e = skillsStatus.value.lastError || '';
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
  const e = skillsStatus.value.lastError || '';
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
