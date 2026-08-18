<template>
  <div
    v-if="store.addAgentModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-fade"
  >
    <div class="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-dark-700 bg-white/98 dark:bg-dark-900/95 space-y-5">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-transparent">
            <Plus class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">添加自定义 Agent</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">配置新 Agent 的技能软链目录与私有规则映射</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Inputs -->
      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">Agent 名称</label>
          <input
            v-model="form.name"
            @input="autoGenerateId"
            type="text"
            placeholder="例如: Windsurf / Kimi / LocalBot"
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">唯一标识 (ID)</label>
            <input
              v-model="form.id"
              type="text"
              placeholder="例如: windsurf"
              class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
            />
          </div>
          <div>
            <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">图标</label>
            <select
              v-model="form.icon"
              class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
            >
              <option value="bot">Bot (通用机器人)</option>
              <option value="sparkles">Sparkles (智能增强)</option>
              <option value="terminal">Terminal (终端命令行)</option>
              <option value="code">Code (编辑器)</option>
              <option value="cpu">CPU (核心驱动)</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">Skills 挂载目录 (支持 ~ 相对主目录)</label>
          <input
            v-model="form.skillsDir"
            type="text"
            placeholder="例如: ~/.windsurf/skills 或 D:\tools\skills"
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div>
          <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">私有本地规则文件名 (项目根目录下)</label>
          <input
            v-model="form.localRuleFilename"
            type="text"
            placeholder="例如: WINDSURF.local.md 或 .agents/rules/local.md"
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <!-- Path Verification Status Box -->
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 flex items-center justify-between shadow-sm">
          <div class="flex items-center gap-2">
            <ShieldCheck class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span class="text-slate-600 dark:text-slate-400 text-xs">
              {{ validationStatus.message || '系统将自动校验 NTFS Junction 软链权限' }}
            </span>
          </div>
          <button
            @click="verifyPath"
            type="button"
            class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 text-xs font-medium transition"
          >
            即时校验
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-800">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-dark-700 transition"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="!isValid"
          class="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95"
        >
          确认注册
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { AgentInfo } from '../types';
import { Plus, X, ShieldCheck } from 'lucide-vue-next';

const store = useAppStore();

const form = reactive({
  id: '',
  name: '',
  icon: 'bot',
  skillsDir: '~/.custom-agent/skills',
  localRuleFilename: 'AGENT.local.md',
});

const validationStatus = reactive({
  checked: false,
  valid: true,
  message: '',
});

const isValid = computed(() => {
  return form.id.trim() && form.name.trim() && form.skillsDir.trim() && form.localRuleFilename.trim();
});

function autoGenerateId() {
  if (!form.id || form.id === form.name.slice(0, -1).toLowerCase()) {
    form.id = form.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }
}

async function verifyPath() {
  const res = await api.validateAgentPath(form.skillsDir, form.localRuleFilename);
  validationStatus.checked = true;
  validationStatus.valid = res.valid;
  validationStatus.message = res.message;
}

function close() {
  store.addAgentModal.visible = false;
}

async function handleSubmit() {
  if (!isValid.value) return;

  const newAgent: AgentInfo = {
    id: form.id,
    name: form.name,
    icon: form.icon,
    detected: true,
    enabled: true,
    skillsDir: form.skillsDir,
    ruleType: 'local_file',
    localRuleFilename: form.localRuleFilename,
    isCustom: true,
  };

  await store.addCustomAgent(newAgent);
  close();
}
</script>
