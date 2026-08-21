<template>
  <div
    v-if="store.addAgentModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none space-y-5 text-slate-900 dark:text-white transition-colors duration-200 max-h-[85vh] overflow-y-auto">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <Plus class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">添加自定义 Agent</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">配置新 Agent 的技能软链目录与私有规则映射</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Inputs -->
      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">Agent 名称</label>
          <input
            v-model="form.name"
            @input="autoGenerateId"
            type="text"
            placeholder="例如: Windsurf / Kimi / LocalBot"
            class="w-full bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">唯一标识 (ID)</label>
            <input
              v-model="form.id"
              type="text"
              placeholder="例如: windsurf"
              class="w-full bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
            />
          </div>
          <div>
            <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">图标</label>
            <select
              v-model="form.icon"
              class="w-full bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
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
          <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">Skills 挂载目录 (支持 ~ 相对主目录)</label>
          <input
            v-model="form.skillsDir"
            type="text"
            placeholder="例如: ~/.windsurf/skills 或 D:\tools\skills"
            class="w-full bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
        </div>

        <div>
          <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">私有本地规则文件名 (项目根目录下)</label>
          <input
            v-model="form.localRuleFilename"
            type="text"
            placeholder="例如: WINDSURF.local.md 或 .agents/rules/local.md"
            class="w-full bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
        </div>

        <!-- Path Verification Status Box -->
        <div class="p-3 rounded-lg bg-black/[0.02] dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ShieldCheck class="w-4 h-4 text-slate-700 dark:text-white/80" />
            <span class="text-slate-600 dark:text-white/60 text-xs">
              {{ validationStatus.message || '系统将自动校验 NTFS Junction 软链权限' }}
            </span>
          </div>
          <button
            @click="verifyPath"
            type="button"
            class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
          >
            即时校验
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-black/8 dark:border-white/8">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="!isValid"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 disabled:opacity-50 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
        >
          确认注册
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
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

