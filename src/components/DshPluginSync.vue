<template>
  <div class="space-y-4">
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
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ status.initialized ? '已初始化' : '未初始化' }}</div>
          </div>
          <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
            <div class="text-slate-500 dark:text-white/50">当前分支</div>
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ status.branch || '—' }}</div>
          </div>
          <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8">
            <div class="text-slate-500 dark:text-white/50">领先 / 落后</div>
            <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ status.ahead }} / {{ status.behind }}</div>
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
            <label class="block text-xs text-slate-500 dark:text-white/50">GitHub 私有仓库 URL（与技能同步共用）</label>
            <input
              v-model="remoteUrl"
              type="text"
              placeholder="https://github.com/you/agenthub-sync.git"
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

    <!-- 对账 -->
    <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-4 space-y-3 transition-colors duration-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80">
            <GitCompare class="w-3.5 h-3.5" />
          </div>
          <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">配置对账（仓库 vs 本地）</h3>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="handleReconcile"
            :disabled="loading"
            class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>对账</span>
          </button>
          <button
            @click="handleAlign"
            :disabled="loading || (diff && diff.compatible)"
            class="px-3 py-1.5 rounded-lg bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle class="w-3.5 h-3.5" />
            <span>一键对齐</span>
          </button>
        </div>
      </div>

      <div v-if="diff" class="space-y-2">
        <div
          :class="[
            'px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors duration-200',
            diff.compatible
              ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
              : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30'
          ]"
        >
          {{ diff.compatible ? '配置一致，无需对齐' : `${diff.items.length} 处差异` }}
        </div>

        <div v-if="diff.warnings.length > 0" class="space-y-1">
          <div
            v-for="(w, i) in diff.warnings"
            :key="i"
            class="px-2.5 py-1.5 rounded-lg bg-[#ff9f0a]/5 border border-[#ff9f0a]/20 text-[11px] text-[#ff9f0a] font-mono"
          >
            {{ w }}
          </div>
        </div>

        <button
          v-if="diff.items.length > 0"
          @click="store.dshPluginDiffModal.visible = true"
          class="text-xs text-[#0a84ff] hover:underline transition-colors duration-200"
        >
          查看差异详情 →
        </button>
      </div>
      <p v-else class="text-[11px] text-slate-400 dark:text-white/50">
        点击「对账」比较本地 <span class="font-mono">~/.dsh</span> 与镜像 <span class="font-mono">%APPDATA%\AgentHub\dsh</span> 的配置差异
      </p>
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
  GitCompare,
  CheckCircle,
} from 'lucide-vue-next';

const store = useAppStore();

const remoteUrl = ref(store.dshPluginsSyncStatus.remoteUrl || '');
const branch = ref(store.dshPluginsSyncStatus.branch || 'main');

onMounted(async () => {
  await store.loadDshPluginsSyncStatus().catch(() => {});
  remoteUrl.value = store.dshPluginsSyncStatus.remoteUrl || '';
  branch.value = store.dshPluginsSyncStatus.branch || 'main';
  await store.reconcileDshPlugins().catch(() => {});
});

const status = computed(() => store.dshPluginsSyncStatus);
const loading = computed(() => store.dshPluginsSyncLoading);
const diff = computed(() => store.dshPluginDiff);
const autoPullOnStartup = computed(() => store.config.dsh_plugins?.sync?.autoPullOnStartup ?? false);

async function handleInit() {
  if (!remoteUrl.value.trim()) return;
  try {
    await store.initDshPluginsSync(remoteUrl.value.trim(), branch.value.trim() || 'main');
  } catch (e: any) {
    store.showToast({ title: '初始化失败', message: e?.message || '无法初始化插件同步', type: 'error' });
  }
}

async function handlePull() {
  try {
    await store.pullDshPluginsSync();
    await store.reconcileDshPlugins().catch(() => {});
  } catch (e: any) {
    store.showToast({ title: '拉取失败', message: e?.message || '无法拉取插件配置', type: 'error' });
  }
}

async function handlePush() {
  try {
    await store.pushDshPluginsSync();
  } catch (e: any) {
    store.showToast({ title: '推送失败', message: e?.message || '无法推送插件配置', type: 'error' });
  }
}

async function toggleAutoPull(enabled: boolean) {
  try {
    await store.setDshPluginsSyncAutoPull(enabled);
  } catch (e: any) {
    store.showToast({ title: '设置失败', message: e?.message || '无法设置自动拉取', type: 'error' });
  }
}

async function handleReconcile() {
  try {
    await store.reconcileDshPlugins();
  } catch (e: any) {
    store.showToast({ title: '对账失败', message: e?.message || '无法执行对账', type: 'error' });
  }
}

async function handleAlign() {
  try {
    await store.alignDshPlugins();
  } catch (e: any) {
    store.showToast({ title: '对齐失败', message: e?.message || '无法对齐插件配置', type: 'error' });
  }
}
</script>
