<template>
  <div v-if="project" class="h-full flex flex-col space-y-4">
    <!-- Top Control Bar -->
    <div class="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-dark-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
      <!-- Project Meta -->
      <div class="space-y-1">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-dark-900 border border-sky-200/80 dark:border-dark-700 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <FolderGit2 class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">{{ project.name }}</h3>
              <span
                v-if="project.isGit"
                class="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 font-mono flex items-center gap-1 font-medium"
              >
                <GitBranch class="w-3 h-3" />
                <span>{{ project.gitBranch || 'git' }}</span>
                <span v-if="project.hookInstalled" class="text-emerald-600 dark:text-emerald-400 font-bold ml-1">(Git Hook 守卫生效中)</span>
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate max-w-xl" :title="project.path">
              {{ project.path }}
            </p>
          </div>
        </div>
      </div>

      <!-- Core Master Switch & Mode Selector -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Master Switch -->
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800">
          <span class="text-xs text-slate-700 dark:text-slate-300 font-medium">规则定制开关:</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="form.enabled"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
          </label>
        </div>

        <!-- Mode Radio Group -->
        <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs">
          <button
            type="button"
            @click="form.ruleMode = 'append'"
            :class="[
              'px-3 py-1 rounded-lg transition font-medium flex items-center gap-1',
              form.ruleMode === 'append'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20 font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            ]"
          >
            <span>追加模式 (推荐)</span>
          </button>
          <button
            type="button"
            @click="form.ruleMode = 'overwrite'"
            :class="[
              'px-3 py-1 rounded-lg transition font-medium',
              form.ruleMode === 'overwrite'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            ]"
          >
            覆盖模式 (备选)
          </button>
        </div>

        <!-- Save Button -->
        <button
          @click="saveChanges"
          :disabled="isSaving"
          class="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center gap-1.5"
        >
          <Save class="w-3.5 h-3.5 text-white" />
          <span>保存并应用</span>
        </button>
      </div>
    </div>

    <!-- Mode Explanation Alert -->
    <div
      :class="[
        'px-4 py-2.5 rounded-xl text-xs border flex items-start gap-2.5 transition',
        form.ruleMode === 'overwrite'
          ? 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200'
          : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-200'
      ]"
    >
      <ShieldCheck class="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-600 dark:text-brand-400" />
      <div>
        <span class="font-bold">
          {{ form.ruleMode === 'overwrite' ? '【覆盖模式 (接管团队 AGENTS.md)】' : '【追加模式 (主流推荐 · 专属私有文件分发)】' }}
        </span>
        <span class="ml-1 text-slate-700 dark:text-slate-300">
          {{
            form.ruleMode === 'overwrite'
              ? '工作区 AGENTS.md 置换为个性化规则（原版备份至 .git/info/AGENTS.orig）。Git Hook 守卫在切分支与 pull 时瞬间自动还原，零 Git 冲突。'
              : '原版团队 AGENTS.md 保持 0 修改。个性化内容精准分发至各 Agent 专属私有文件（CLAUDE.local.md、ZCODE.local.md、.agents/rules 等），并自动加入 .git/info/exclude，零 Git 污染、无需 Hook。'
          }}
        </span>
      </div>
    </div>

    <!-- Linked Agents Checklist with Brand Icons -->
    <div class="glass-card rounded-xl p-3.5 border border-slate-200/80 dark:border-dark-800 flex flex-wrap items-center gap-3 text-xs shadow-sm">
      <span class="text-slate-600 dark:text-slate-400 font-medium">应用至关联 Agent:</span>
      <label
        v-for="agent in store.enabledAgents"
        :key="agent.id"
        class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition shadow-sm"
      >
        <input
          type="checkbox"
          :value="agent.id"
          v-model="form.linkedAgents"
          class="custom-checkbox"
        />
        <div class="w-4 h-4 rounded bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-transparent flex items-center justify-center flex-shrink-0">
          <AgentBrandIcon :agentId="agent.id" size="sm" />
        </div>
        <span class="text-slate-800 dark:text-slate-300 font-medium">{{ agent.name }}</span>
        <span class="text-[10px] text-slate-500 font-mono">({{ agent.localRuleFilename }})</span>
      </label>
    </div>

    <!-- Dual-Pane Editor -->
    <div class="flex-1 min-h-[380px] grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Left Pane: Baseline Reference (Read-only) -->
      <div class="glass-panel rounded-2xl border border-slate-200/80 dark:border-dark-800 flex flex-col overflow-hidden shadow-sm">
        <div class="px-4 py-2.5 border-b border-slate-200/80 dark:border-dark-800 bg-slate-50 dark:bg-dark-950/70 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <FileText class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span class="font-bold text-xs text-slate-700 dark:text-slate-300">原版 AGENTS.md (只读参考)</span>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-800 font-mono font-medium">
            团队基准
          </span>
        </div>
        <div class="flex-1 p-3.5 bg-slate-100/70 dark:bg-dark-950/40 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-400 whitespace-pre-wrap leading-relaxed select-text shadow-inner">
          {{ project.originalRuleContent || '（当前工作区暂无原版 AGENTS.md，将以纯自定义模式生效）' }}
        </div>
      </div>

      <!-- Right Pane: Custom Local Rule Editor -->
      <div class="glass-panel rounded-2xl border border-slate-200/80 dark:border-dark-800 flex flex-col overflow-hidden shadow-sm">
        <div class="px-4 py-2.5 border-b border-slate-200/80 dark:border-dark-800 bg-slate-50 dark:bg-dark-950/70 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Edit class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span class="font-bold text-xs text-slate-900 dark:text-slate-200">本地个性化规则编辑器 (Markdown)</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="insertTemplate"
              class="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Sparkles class="w-3 h-3" />
              <span>插入标准模板</span>
            </button>
          </div>
        </div>
        <textarea
          v-model="form.customRuleContent"
          placeholder="# 本机开发规则&#10;- 所有对话使用中文&#10;- 严格遵循模块化分层"
          class="flex-1 p-3.5 bg-white dark:bg-dark-950/90 font-mono text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500/40 leading-relaxed resize-none shadow-inner"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref } from 'vue';
import { ProjectInfo } from '../types';
import { useAppStore } from '../stores/useAppStore';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  FolderGit2,
  GitBranch,
  ShieldCheck,
  Save,
  FileText,
  Edit,
  Sparkles,
} from 'lucide-vue-next';

const props = defineProps<{
  project: ProjectInfo;
}>();

const store = useAppStore();
const isSaving = ref(false);

const form = reactive({
  enabled: props.project.overrideEnabled,
  ruleMode: props.project.ruleMode,
  customRuleContent: props.project.customRuleContent,
  linkedAgents: [...props.project.linkedAgents],
});

watch(
  () => props.project,
  (newVal) => {
    form.enabled = newVal.overrideEnabled;
    form.ruleMode = newVal.ruleMode;
    form.customRuleContent = newVal.customRuleContent;
    form.linkedAgents = [...newVal.linkedAgents];
  },
  { deep: true }
);

function insertTemplate() {
  form.customRuleContent = `# 本机通用规则指南
- 始终以中文输出所有回复、注释与汇报
- 保持极简设计风格，杜绝多余抽象与冗余文件
- 在进行跨文件变更前，严格核查模块依赖关系
- 保持零 Git 冲突与本地私有调试规范
`;
}

async function saveChanges() {
  isSaving.value = true;
  try {
    await store.updateProjectRule(
      props.project.id,
      form.ruleMode,
      form.customRuleContent,
      form.enabled,
      form.linkedAgents
    );
  } finally {
    isSaving.value = false;
  }
}
</script>
