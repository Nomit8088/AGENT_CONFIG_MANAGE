<template>
  <div
    v-if="store.settingsModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-fade"
  >
    <div class="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-dark-700 bg-white/98 dark:bg-dark-900/98 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-transparent">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">全局偏好设置</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">管理 AgentHub 客户端与数据存储策略</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Settings Items -->
      <div class="space-y-4 text-xs">
        <!-- Storage Path info -->
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 space-y-1">
          <div class="text-slate-600 dark:text-slate-400 font-medium">数据存储路径 (Single Source of Truth)</div>
          <div class="font-mono text-brand-700 dark:text-brand-300 text-[11px] truncate">
            %APPDATA%\AgentHub\skills\
          </div>
        </div>

        <!-- Theme Switcher (Dark / Light / System) -->
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-800/80">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-200">外观主题设置</div>
            <div class="text-[11px] text-slate-500">切换深色模式、浅色模式或跟随系统设置</div>
          </div>
          <div class="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs">
            <button
              type="button"
              @click="setTheme('dark')"
              :class="[
                'px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5',
                form.theme === 'dark'
                  ? 'bg-brand-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              ]"
            >
              <Moon class="w-3.5 h-3.5" />
              <span>深色</span>
            </button>
            <button
              type="button"
              @click="setTheme('light')"
              :class="[
                'px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5',
                form.theme === 'light'
                  ? 'bg-brand-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              ]"
            >
              <Sun class="w-3.5 h-3.5" />
              <span>浅色</span>
            </button>
            <button
              type="button"
              @click="setTheme('system')"
              :class="[
                'px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5',
                form.theme === 'system'
                  ? 'bg-brand-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              ]"
            >
              <Monitor class="w-3.5 h-3.5" />
              <span>跟随系统</span>
            </button>
          </div>
        </div>

        <!-- Default Rule Mode -->
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-800/80">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-200">默认项目规则模式</div>
            <div class="text-[11px] text-slate-500">新建纳管项目时的默认规则应用策略</div>
          </div>
          <select
            v-model="form.default_rule_mode"
            class="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          >
            <option value="append">追加模式 (Append / 推荐)</option>
            <option value="overwrite">覆盖模式 (Overwrite)</option>
          </select>
        </div>

        <!-- Auto capture skills -->
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-800/80">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-200">自动捕获外部安装 (File Watcher)</div>
            <div class="text-[11px] text-slate-500">检测 npx skills add -g 或外部技能创建并自动同步</div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="form.auto_capture_skills"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
          </label>
        </div>

        <!-- Toast Notifications -->
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-800/80">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-200">桌面操作 Toast 提示</div>
            <div class="text-[11px] text-slate-500">挂载/解绑及冲突处理完成时展示通知</div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="form.toast_notifications"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
          </label>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-800">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-dark-700 transition"
        >
          关闭
        </button>
        <button
          @click="save"
          class="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center gap-1.5"
        >
          <Save class="w-3.5 h-3.5 text-white" />
          <span>保存配置</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Settings, X, Save, Moon, Sun, Monitor } from 'lucide-vue-next';

const store = useAppStore();

const form = reactive({
  auto_start: store.config.auto_start,
  theme: store.config.theme,
  default_rule_mode: store.config.default_rule_mode,
  auto_capture_skills: store.config.auto_capture_skills,
  toast_notifications: store.config.toast_notifications,
});

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
</script>
