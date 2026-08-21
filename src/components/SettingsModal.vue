<template>
  <div
    v-if="store.settingsModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none space-y-5 text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">全局偏好设置</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">管理 AgentHub 客户端与数据存储策略</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Settings Items -->
      <div class="space-y-4 text-xs">
        <!-- Storage Path info -->
        <div class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 space-y-1">
          <div class="text-slate-500 dark:text-white/60 font-medium">数据存储路径 (Single Source of Truth)</div>
          <div class="font-mono text-slate-800 dark:text-white/90 text-[11px] truncate">
            %APPDATA%\AgentHub\skills\
          </div>
        </div>

        <!-- Theme Switcher (Dark / Light / System) -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">外观主题设置</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">切换深色模式、浅色模式或跟随系统设置</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="setTheme('dark')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
                form.theme === 'dark'
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <Moon class="w-3.5 h-3.5" />
              <span>深色</span>
            </button>
            <button
              type="button"
              @click="setTheme('light')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
                form.theme === 'light'
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <Sun class="w-3.5 h-3.5" />
              <span>浅色</span>
            </button>
            <button
              type="button"
              @click="setTheme('system')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
                form.theme === 'system'
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <Monitor class="w-3.5 h-3.5" />
              <span>跟随系统</span>
            </button>
          </div>
        </div>

        <!-- Default Rule Mode -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">默认项目规则模式</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">新建纳管项目时的默认规则应用策略</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.default_rule_mode = 'append'"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.default_rule_mode === 'append'
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>追加 (推荐)</span>
            </button>
            <button
              type="button"
              @click="form.default_rule_mode = 'overwrite'"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.default_rule_mode === 'overwrite'
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>覆盖</span>
            </button>
          </div>
        </div>

        <!-- Auto capture skills -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">自动捕获外部安装 (File Watcher)</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">检测 npx skills add -g 或外部技能创建并自动同步</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.auto_capture_skills = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.auto_capture_skills
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>开启</span>
            </button>
            <button
              type="button"
              @click="form.auto_capture_skills = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.auto_capture_skills
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>关闭</span>
            </button>
          </div>
        </div>

        <!-- Toast Notifications -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">桌面操作 Toast 提示</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">挂载/解绑及冲突处理完成时展示通知</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.toast_notifications = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.toast_notifications
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>开启</span>
            </button>
            <button
              type="button"
              @click="form.toast_notifications = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.toast_notifications
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>关闭</span>
            </button>
          </div>
        </div>

        <!-- Sync Repo Config (Global) -->
        <div class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 space-y-3">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">同步仓库配置（全局）</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">
              技能与 DSH 插件共用同一仓库；必须通过「连通性校验 / 初始化校验」后才能保存并启用同步
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-xs text-slate-500 dark:text-white/50">GitHub 仓库 URL</label>
            <input
              v-model="repoForm.remoteUrl"
              type="text"
              placeholder="https://github.com/you/agenthub-sync.git"
              class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-xs text-slate-500 dark:text-white/50">分支</label>
            <input
              v-model="repoForm.branch"
              type="text"
              placeholder="main"
              class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
            />
          </div>

          <div
            v-if="repoValidationMessage"
            :class="[
              'px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors duration-200',
              repoValidationOk
                ? 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30'
                : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30'
            ]"
          >
            {{ repoValidationMessage }}
          </div>

          <div class="flex gap-2">
            <button
              @click="validateRepo"
              :disabled="store.syncRepoValidating || !repoForm.remoteUrl.trim()"
              class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>{{ store.syncRepoValidating ? '校验中…' : '连通性校验 / 初始化校验' }}</span>
            </button>
            <button
              @click="saveRepo"
              :disabled="!canSaveRepo"
              class="flex-1 px-3 py-2 rounded-lg bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save class="w-3.5 h-3.5" />
              <span>保存仓库配置</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-black/8 dark:border-white/8">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
        >
          关闭
        </button>
        <button
          @click="save"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center gap-1.5"
        >
          <Save class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" />
          <span>保存配置</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Settings, X, Save, Moon, Sun, Monitor, ShieldCheck } from 'lucide-vue-next';

const store = useAppStore();

const form = reactive({
  auto_start: store.config.auto_start,
  theme: store.config.theme,
  default_rule_mode: store.config.default_rule_mode,
  auto_capture_skills: store.config.auto_capture_skills,
  toast_notifications: store.config.toast_notifications,
});

const repoForm = reactive({
  remoteUrl: store.syncRepo?.remoteUrl || '',
  branch: store.syncRepo?.branch || 'main',
});

let validatedRepoKey = '';

watch(
  () => store.config,
  (cfg) => {
    form.auto_start = cfg.auto_start;
    form.theme = cfg.theme;
    form.default_rule_mode = cfg.default_rule_mode;
    form.auto_capture_skills = cfg.auto_capture_skills;
    form.toast_notifications = cfg.toast_notifications;
  },
  { deep: true }
);

watch(
  () => store.syncRepo,
  (repo) => {
    if (!repo?.remoteUrl) return;
    repoForm.remoteUrl = repo.remoteUrl;
    repoForm.branch = repo.branch || 'main';
  },
  { deep: true }
);

const repoValidationOk = computed(() => !!store.syncRepoValidation?.ok);
const repoValidationMessage = computed(() => {
  const v = store.syncRepoValidation;
  if (!v) return '';
  if (v.ok) {
    return `校验通过：分支 ${v.resolvedBranch || repoForm.branch}，仓库已初始化且格式符合预期（skills/ + dsh/）`;
  }
  if (v.error) return v.error;
  return '校验未通过';
});
const repoKey = computed(() => `${repoForm.remoteUrl.trim()}||${repoForm.branch.trim() || 'main'}`);
const canSaveRepo = computed(() =>
  !!repoForm.remoteUrl.trim() &&
  !store.syncRepoValidating &&
  repoValidationOk.value &&
  validatedRepoKey === repoKey.value
);

function setTheme(theme: 'dark' | 'light' | 'system') {
  form.theme = theme;
  store.applyTheme(theme);
}

function close() {
  // Revert preview to saved config
  store.applyTheme(store.config.theme);
  store.settingsModal.visible = false;
}

async function save() {
  await store.saveConfig({
    ...store.config,
    auto_start: form.auto_start,
    theme: form.theme,
    default_rule_mode: form.default_rule_mode,
    auto_capture_skills: form.auto_capture_skills,
    toast_notifications: form.toast_notifications,
  });
  close();
}

async function validateRepo() {
  const remoteUrl = repoForm.remoteUrl.trim();
  if (!remoteUrl) return;
  validatedRepoKey = '';
  try {
    await store.validateSyncRepo(remoteUrl, repoForm.branch.trim() || 'main');
    if (store.syncRepoValidation?.ok) {
      validatedRepoKey = repoKey.value;
    }
  } catch (e: any) {
    store.showToast({ title: '仓库校验失败', message: e?.message || '无法执行校验', type: 'error' });
  }
}

async function saveRepo() {
  if (!canSaveRepo.value) return;
  try {
    await store.saveSyncRepo(repoForm.remoteUrl.trim(), repoForm.branch.trim() || 'main');
    validatedRepoKey = repoKey.value;
    store.showToast({ title: '仓库配置已保存', message: '同步功能已启用，可在同步中心执行拉取/推送', type: 'success' });
  } catch (e: any) {
    store.syncRepoValidation = { ok: false, error: e?.message || '保存失败', initialized: false, formatOk: false };
    validatedRepoKey = '';
    store.showToast({ title: '保存仓库配置失败', message: e?.message || '请先通过校验', type: 'error' });
  }
}
</script>

