<template>
  <div
    v-if="store.settingsModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#121316] w-full max-w-lg rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none space-y-5 text-slate-900 dark:text-white transition-colors duration-200 max-h-[85vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('settings.title') }}</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">{{ $t('settings.subtitle') }}</p>
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
        <div class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 space-y-1">
          <div class="text-slate-500 dark:text-white/60 font-medium">{{ $t('settings.storageTitle') }}</div>
          <div class="font-mono text-slate-800 dark:text-white/90 text-[11px] truncate">
            %APPDATA%\AgentHub\skills\
          </div>
        </div>

        <!-- Application Logs -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.logsTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.logsSubtitle') }}</div>
          </div>
          <button
            type="button"
            @click="openLogs"
            class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#1c1d22] dark:hover:bg-white/8 text-slate-700 dark:text-white/80 border border-black/10 dark:border-white/10 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
          >
            <FileText class="w-3.5 h-3.5" />
            <span>{{ $t('settings.openLogs') }}</span>
          </button>
        </div>

        <!-- Theme Switcher (Dark / Light / System) -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.themeTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.themeSubtitle') }}</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="setTheme('dark')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
                form.theme === 'dark'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <Moon class="w-3.5 h-3.5" />
              <span>{{ $t('settings.dark') }}</span>
            </button>
            <button
              type="button"
              @click="setTheme('light')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
                form.theme === 'light'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <Sun class="w-3.5 h-3.5" />
              <span>{{ $t('settings.light') }}</span>
            </button>
            <button
              type="button"
              @click="setTheme('system')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
                form.theme === 'system'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <Monitor class="w-3.5 h-3.5" />
              <span>{{ $t('settings.system') }}</span>
            </button>
          </div>
        </div>

        <!-- Language Switcher -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.languageTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.languageSubtitle') }}</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="setLocale('zh')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium',
                form.locale === 'zh'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>中文</span>
            </button>
            <button
              type="button"
              @click="setLocale('en')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium',
                form.locale === 'en'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>English</span>
            </button>
          </div>
        </div>

        <!-- Default Rule Mode -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.ruleModeTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.ruleModeSubtitle') }}</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.default_rule_mode = 'append'"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.default_rule_mode === 'append'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('settings.append') }}</span>
            </button>
            <button
              type="button"
              @click="form.default_rule_mode = 'overwrite'"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.default_rule_mode === 'overwrite'
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('settings.overwrite') }}</span>
            </button>
          </div>
        </div>

        <!-- Auto capture skills -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.autoCaptureTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.autoCaptureSubtitle') }}</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.auto_capture_skills = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.auto_capture_skills
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('common.on') }}</span>
            </button>
            <button
              type="button"
              @click="form.auto_capture_skills = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.auto_capture_skills
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('common.off') }}</span>
            </button>
          </div>
        </div>

        <!-- Toast Notifications -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.toastTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.toastSubtitle') }}</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.toast_notifications = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.toast_notifications
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('common.on') }}</span>
            </button>
            <button
              type="button"
              @click="form.toast_notifications = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.toast_notifications
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('common.off') }}</span>
            </button>
          </div>
        </div>

        <!-- Auto Check Update -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.autoCheckTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.autoCheckSubtitle') }}</div>
          </div>
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.auto_check_update = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.auto_check_update
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('common.on') }}</span>
            </button>
            <button
              type="button"
              @click="form.auto_check_update = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.auto_check_update
                  ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>{{ $t('common.off') }}</span>
            </button>
          </div>
        </div>

        <!-- Check Update Manually -->
        <div class="flex items-center justify-between py-2 border-b border-black/8 dark:border-white/8">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.checkUpdateTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.checkUpdateSubtitle') }}</div>
          </div>
          <button
            type="button"
            @click="openUpdate"
            class="px-2.5 py-1 rounded-lg bg-[#3b82f6]/10 hover:bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
          >
            <PackageOpen class="w-3.5 h-3.5" />
            <span>{{ $t('settings.checkUpdateTitle') }}</span>
          </button>
        </div>

        <!-- DSH 插件 GitHub 镜像 -->
        <div class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 space-y-2">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.mirrorTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">
              {{ $t('settings.mirrorSubtitle') }}
            </div>
          </div>
          <input
            v-model="form.gitHubMirror"
            type="text"
            placeholder="https://gh-proxy.com/"
            class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
          />
        </div>

        <!-- Sync Repo Config (Global) -->
        <div class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 space-y-3">
          <div>
            <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('settings.repoTitle') }}</div>
            <div class="text-[11px] text-slate-500 dark:text-white/50">
              {{ $t('settings.repoSubtitle') }}
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-xs text-slate-500 dark:text-white/50">{{ $t('settings.repoUrlLabel') }}</label>
            <input
              v-model="repoForm.remoteUrl"
              type="text"
              placeholder="https://github.com/you/agenthub-sync.git"
              class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-xs text-slate-500 dark:text-white/50">{{ $t('settings.branchLabel') }}</label>
            <input
              v-model="repoForm.branch"
              type="text"
              placeholder="main"
              class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
            />
          </div>

          <div
            v-if="repoValidationMessage"
            :class="[
              'px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors duration-200',
              repoValidationOk
                ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
                : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
            ]"
          >
            {{ repoValidationMessage }}
          </div>

          <button
            @click="saveRepo"
            :disabled="!canSaveRepo"
            class="w-full px-3 py-2 rounded-lg bg-[#3b82f6]/10 hover:bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw v-if="store.syncRepoValidating" class="w-3.5 h-3.5 animate-spin" />
            <Save v-else class="w-3.5 h-3.5" />
            <span>{{ store.syncRepoValidating ? $t('settings.validating') : $t('settings.saveRepo') }}</span>
          </button>

          <!-- 已绑定仓库：解绑入口 -->
          <div
            v-if="store.syncRepoConfigured"
            class="space-y-2 border-t border-black/8 dark:border-white/8 pt-3"
          >
            <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('settings.currentRepo') }}</div>
            <div class="font-mono text-[11px] text-slate-800 dark:text-white/90 break-all leading-relaxed">
              {{ store.syncRepo?.remoteUrl }}
            </div>
            <div class="font-mono text-[11px] text-slate-500 dark:text-white/50">
              {{ $t('settings.branch', { branch: store.syncRepo?.branch || 'main' }) }}
            </div>
            <button
              @click="unbindRepo"
              :disabled="store.syncRepoUnbinding"
              :class="[
                'w-full px-3 py-2 rounded-lg text-xs font-medium border transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
                confirmUnbind
                  ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                  : 'bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
              ]"
            >
              <RefreshCw v-if="store.syncRepoUnbinding" class="w-3.5 h-3.5 animate-spin" />
              <Unlink v-else class="w-3.5 h-3.5" />
              <span>{{ store.syncRepoUnbinding ? $t('settings.unbinding') : confirmUnbind ? $t('settings.confirmUnbind') : $t('settings.unbind') }}</span>
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
          {{ $t('common.close') }}
        </button>
        <button
          @click="save"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center gap-1.5"
        >
          <Save class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" />
          <span>{{ $t('settings.savePrefs') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { t, translateError } from '../i18n';
import { Settings, X, Save, Moon, Sun, Monitor, RefreshCw, Unlink, PackageOpen, FileText } from 'lucide-vue-next';

const store = useAppStore();

const form = reactive({
  auto_start: store.config.auto_start,
  theme: store.config.theme,
  locale: store.config.locale ?? 'zh',
  default_rule_mode: store.config.default_rule_mode,
  auto_capture_skills: store.config.auto_capture_skills,
  toast_notifications: store.config.toast_notifications,
  auto_check_update: store.config.auto_check_update ?? false,
  gitHubMirror: store.config.dsh_plugins?.gitHubMirror ?? '',
});

function parseValidatedKey(key: string): { remoteUrl: string; branch: string } {
  if (!key) return { remoteUrl: '', branch: 'main' };
  const idx = key.lastIndexOf('||');
  if (idx < 0) return { remoteUrl: key, branch: 'main' };
  return { remoteUrl: key.slice(0, idx), branch: key.slice(idx + 2) || 'main' };
}

const lastValidated = parseValidatedKey(store.syncRepoValidatedKey);
const repoForm = reactive({
  remoteUrl: store.syncRepo?.remoteUrl || lastValidated.remoteUrl,
  branch: store.syncRepo?.branch || lastValidated.branch || 'main',
});

watch(
  () => store.config,
  (cfg) => {
    form.auto_start = cfg.auto_start;
    form.theme = cfg.theme;
    form.locale = cfg.locale ?? 'zh';
    form.default_rule_mode = cfg.default_rule_mode;
    form.auto_capture_skills = cfg.auto_capture_skills;
    form.toast_notifications = cfg.toast_notifications;
    form.auto_check_update = cfg.auto_check_update ?? false;
    form.gitHubMirror = cfg.dsh_plugins?.gitHubMirror ?? '';
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
const repoKey = computed(() => `${repoForm.remoteUrl.trim()}||${repoForm.branch.trim() || 'main'}`);
const repoValidationMessage = computed(() => {
  const v = store.syncRepoValidation;
  if (!v) return '';
  // 只展示与当前输入匹配的校验结果，避免 HMR/组件重载后旧结果残留造成误导。
  if (store.syncRepoValidatedKey !== repoKey.value) return '';
  if (v.ok) {
    return t('settings.repoValidated', { branch: v.resolvedBranch || repoForm.branch });
  }
  if (v.error) return translateError(v.error);
  return t('settings.repoNotValidated');
});
const canSaveRepo = computed(() =>
  !!repoForm.remoteUrl.trim() && !store.syncRepoValidating
);

const confirmUnbind = ref(false);
let unbindConfirmTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => {
  if (unbindConfirmTimer) clearTimeout(unbindConfirmTimer);
});

function setTheme(theme: 'dark' | 'light' | 'system') {
  form.theme = theme;
  store.applyTheme(theme);
}

function setLocale(locale: 'zh' | 'en') {
  form.locale = locale;
  store.setLocale(locale);
}

function openUpdate() {
  store.openUpdateModal();
  if (!store.appUpdate && !store.appUpdateChecking) {
    store.checkAppUpdate(false);
  }
}

function openLogs() {
  store.openLogViewer();
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
    locale: form.locale,
    default_rule_mode: form.default_rule_mode,
    auto_capture_skills: form.auto_capture_skills,
    toast_notifications: form.toast_notifications,
    auto_check_update: form.auto_check_update,
    dsh_plugins: {
      ...(store.config.dsh_plugins ?? { dshCommand: '', pnpmCommand: '' }),
      gitHubMirror: form.gitHubMirror.trim(),
    },
  });
  close();
}

async function saveRepo() {
  const remoteUrl = repoForm.remoteUrl.trim();
  const branch = repoForm.branch.trim() || 'main';
  if (!remoteUrl) return;

  // 保存入口自带校验：当前输入若还未通过校验，就先执行一次校验；
  // 后端 save_sync_repo 仍会强制校验，失败不会写入配置。
  if (!repoValidationOk.value || store.syncRepoValidatedKey !== repoKey.value) {
    try {
      await store.validateSyncRepo(remoteUrl, branch);
    } catch (e: any) {
      store.showToast({ title: t('settings.repoValidateFailedTitle'), message: translateError(e, 'settings.repoValidateFailedMsg'), type: 'error' });
      return;
    }
    if (!store.syncRepoValidation?.ok) {
      store.showToast({
        title: t('settings.repoValidateRejectedTitle'),
        message: translateError(store.syncRepoValidation?.error, 'settings.repoValidateRejectedMsg'),
        type: 'error',
      });
      return;
    }
  }

  try {
    await store.saveSyncRepo(remoteUrl, branch);
    store.showToast({ title: t('settings.repoValidateSavedTitle'), message: t('settings.repoValidateSavedMsg'), type: 'success' });
  } catch (e: any) {
    store.syncRepoValidation = { ok: false, error: translateError(e, 'settings.repoValidateErrorMsg'), initialized: false, formatOk: false };
    store.syncRepoValidatedKey = repoKey.value;
    store.showToast({ title: t('settings.repoValidateSaveFailedTitle'), message: translateError(e, 'settings.repoValidateSaveFailedMsg'), type: 'error' });
  }
}

async function unbindRepo() {
  if (!confirmUnbind.value) {
    confirmUnbind.value = true;
    if (unbindConfirmTimer) clearTimeout(unbindConfirmTimer);
    unbindConfirmTimer = setTimeout(() => {
      confirmUnbind.value = false;
    }, 4000);
    return;
  }

  confirmUnbind.value = false;
  if (unbindConfirmTimer) clearTimeout(unbindConfirmTimer);
  try {
    await store.unbindSyncRepo();
    repoForm.remoteUrl = '';
    repoForm.branch = 'main';
  } catch {
    // 错误提示已在 store.unbindSyncRepo 中弹出
  }
}
</script>

