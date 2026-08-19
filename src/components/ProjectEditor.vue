<template>
  <div v-if="project" class="h-full flex flex-col space-y-4">
    <!-- Top Control Bar -->
    <div class="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none space-y-3 transition-colors duration-200">
      <!-- Row 1: Project Identity & Actions -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80 flex-shrink-0">
            <FolderGit2 class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95 truncate">{{ project.name }}</h3>
              <span
                v-if="project.isGit"
                class="text-[11px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8 font-mono flex items-center gap-1"
              >
                <GitBranch class="w-3 h-3 text-slate-500 dark:text-white/50" />
                <span>{{ project.gitBranch || 'git' }}</span>
              </span>
            </div>
            <div class="flex items-center gap-1.5 mt-0.5 text-slate-400 dark:text-white/40 text-[11px] font-mono">
              <span class="truncate max-w-md" :title="project.path">{{ project.path }}</span>
              <button
                @click="copyPath"
                class="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5 transition-colors duration-200"
                title="复制绝对路径"
              >
                <Check v-if="copied" class="w-3 h-3 text-[#30d158]" />
                <Copy v-else class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Right Master Switch & Save Action -->
        <div class="flex items-center gap-2.5 flex-wrap flex-shrink-0 self-end sm:self-auto">
          <!-- Master Switch Segmented Slider -->
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
            <button
              type="button"
              @click="form.enabled = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.enabled
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span v-if="form.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
              <span>启用定制</span>
            </button>
            <button
              type="button"
              @click="form.enabled = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.enabled
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>停用定制</span>
            </button>
          </div>

          <!-- Save Button -->
          <button
            @click="saveChanges"
            :disabled="isSaving"
            class="px-4 py-1.5 rounded-lg bg-[#3a3a3c] dark:bg-[#3a3a3c] hover:bg-black/80 dark:hover:bg-white/10 disabled:opacity-50 text-white border border-black/10 dark:border-white/8 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5 shadow-sm dark:shadow-none"
          >
            <Save class="w-3.5 h-3.5" />
            <span>{{ isSaving ? '保存中...' : '保存并应用' }}</span>
          </button>
        </div>
      </div>

      <!-- Row 2: Status & Guard Badges Bar -->
      <div class="pt-2 border-t border-black/8 dark:border-white/8 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Mode Badge -->
          <span class="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-700 dark:text-white/80 font-medium border border-black/8 dark:border-white/8">
            模式：{{ form.ruleMode === 'overwrite' ? '覆盖模式 (接管 AGENTS.md)' : '追加模式 (专属私有文件)' }}
          </span>

          <!-- Guard Status Indicator -->
          <span
            v-if="form.ruleMode === 'append'"
            class="px-2.5 py-0.5 rounded-md bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/30 flex items-center gap-1 font-medium text-[11px]"
          >
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>.git/info/exclude 私有隔离生效中 · 免 Hook</span>
          </span>

          <span
            v-else-if="form.ruleMode === 'overwrite' && project.hookInstalled"
            class="px-2.5 py-0.5 rounded-md bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/30 flex items-center gap-1 font-medium text-[11px]"
          >
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>Git Hook 守卫生效中 {{ form.preCommitGuard ? '(pre-checkout & pre-commit 防护)' : '(已放行 commit)' }}</span>
          </span>

          <span
            v-else-if="form.ruleMode === 'overwrite' && !project.hookInstalled"
            class="px-2.5 py-0.5 rounded-md bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30 flex items-center gap-1 font-medium text-[11px]"
          >
            <AlertTriangle class="w-3.5 h-3.5" />
            <span>Git Hook 缺失或异常</span>
          </span>

          <!-- Repair Hook button when overwrite mode is active -->
          <button
            v-if="form.ruleMode === 'overwrite' && project.isGit"
            @click="handleRepairHooks"
            :disabled="isRepairing"
            class="px-2.5 py-0.5 rounded-md bg-[#0a84ff]/10 hover:bg-[#0a84ff]/20 text-[#0a84ff] border border-[#0a84ff]/30 text-[11px] font-semibold flex items-center gap-1 transition-colors duration-200"
            title="一键安装或修复 pre-checkout, post-checkout 及 pre-commit 守卫防护"
          >
            <Zap class="w-3 h-3" />
            <span>{{ isRepairing ? '修复中...' : '⚡ 一键安装/修复 Git Hook' }}</span>
          </button>
        </div>

        <div class="text-[11px] text-slate-400 dark:text-white/40">
          已关联 {{ form.linkedAgents.length }} 个 Agent
        </div>
      </div>
    </div>

    <!-- Segmented Navigation Tabs -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center p-1 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 shadow-xs text-xs">
        <button
          type="button"
          @click="activeTab = 'editor'"
          :class="[
            'px-3.5 py-1.5 rounded-lg transition-colors duration-200 font-medium flex items-center gap-1.5',
            activeTab === 'editor'
              ? 'bg-black/5 dark:bg-[#2c2c2e] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <Edit3 class="w-3.5 h-3.5" />
          <span>规则内容编辑 (Markdown)</span>
        </button>

        <button
          type="button"
          @click="activeTab = 'settings'"
          :class="[
            'px-3.5 py-1.5 rounded-lg transition-colors duration-200 font-medium flex items-center gap-1.5',
            activeTab === 'settings'
              ? 'bg-black/5 dark:bg-[#2c2c2e] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
              : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
          ]"
        >
          <SlidersHorizontal class="w-3.5 h-3.5" />
          <span>分发模式与防护设置</span>
        </button>
      </div>

      <!-- Quick Template & Baseline Toggle (when in Editor tab) -->
      <div v-if="activeTab === 'editor'" class="flex items-center gap-2 text-xs">
        <button
          type="button"
          @click="showBaseline = !showBaseline"
          :class="[
            'px-3 py-1.5 rounded-lg border transition-colors duration-200 font-medium flex items-center gap-1.5',
            showBaseline
              ? 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30'
              : 'bg-white dark:bg-[#1c1c1e] text-slate-600 dark:text-white/70 border-black/8 dark:border-white/8 hover:text-slate-900 dark:hover:text-white'
          ]"
          title="展开/收起原版 AGENTS.md 基准参考抽屉"
        >
          <FileText class="w-3.5 h-3.5" />
          <span>{{ showBaseline ? '收起基准参考' : '📖 查看原版 AGENTS.md' }}</span>
        </button>

        <button
          type="button"
          @click="insertTemplate"
          class="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white font-medium flex items-center gap-1.5 transition-colors duration-200"
        >
          <Sparkles class="w-3.5 h-3.5 text-[#ff9f0a]" />
          <span>插入模板</span>
        </button>
      </div>
    </div>

    <!-- Main Tab 1: Editor View -->
    <div v-if="activeTab === 'editor'" class="flex-1 min-h-[420px] flex gap-4 overflow-hidden relative">
      <!-- Full-Width Custom Markdown Editor -->
      <div class="flex-1 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none flex flex-col overflow-hidden transition-colors duration-200">
        <div class="px-4 py-2.5 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1c1e] flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="font-serif font-semibold text-slate-900 dark:text-white/90">本机个性化规则编辑器 (Markdown)</span>
            <span class="text-[10px] text-slate-400 dark:text-white/40 font-mono">({{ lineCount }} 行 · {{ charCount }} 字)</span>
          </div>
          <div class="text-[11px] text-slate-400 dark:text-white/40">
            保存后自动分发至已勾选的 {{ form.linkedAgents.length }} 个 Agent
          </div>
        </div>
        <textarea
          v-model="form.customRuleContent"
          placeholder="# 本机开发规则&#10;- 所有对话使用中文&#10;- 严格遵循模块化分层"
          class="flex-1 p-4 bg-transparent font-mono text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none leading-relaxed resize-none"
        ></textarea>
      </div>

      <!-- Slide-over Baseline Drawer (On Demand) -->
      <div
        v-if="showBaseline"
        class="w-80 md:w-96 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/8 dark:border-white/8 shadow-xl dark:shadow-none flex flex-col overflow-hidden transition-colors duration-200 animate-in slide-in-from-right duration-200"
      >
        <div class="px-4 py-2.5 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1c1e] flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <FileText class="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
            <span class="font-serif font-semibold text-slate-800 dark:text-white/80">原版 AGENTS.md (团队基准)</span>
          </div>
          <button
            @click="showBaseline = false"
            class="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5 rounded-lg"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="flex-1 p-3.5 bg-black/[0.01] dark:bg-[#1c1c1e] overflow-y-auto font-mono text-xs text-slate-600 dark:text-white/60 whitespace-pre-wrap leading-relaxed select-text">
          {{ project.originalRuleContent || '（当前工作区暂无原版 AGENTS.md，将以纯自定义模式生效）' }}
        </div>
      </div>
    </div>

    <!-- Main Tab 2: Settings & Distribution View -->
    <div v-else-if="activeTab === 'settings'" class="flex-1 overflow-y-auto space-y-4 pb-4">
      <!-- Section 1: Rule Mode Selector Cards -->
      <div class="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none space-y-3 transition-colors duration-200">
        <h4 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 flex items-center gap-2">
          <SlidersHorizontal class="w-4 h-4 text-slate-700 dark:text-white/80" />
          <span>规则生效模式策略</span>
        </h4>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <!-- Append Mode Card -->
          <div
            @click="form.ruleMode = 'append'"
            :class="[
              'p-3.5 rounded-xl border cursor-pointer transition-colors duration-200 space-y-2 relative',
              form.ruleMode === 'append'
                ? 'bg-black/[0.03] dark:bg-[#2c2c2e] border-black/20 dark:border-white/25 shadow-xs'
                : 'bg-transparent border-black/8 dark:border-white/8 hover:bg-black/[0.01] dark:hover:bg-white/5 opacity-70 hover:opacity-100'
            ]"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 font-serif font-semibold text-slate-900 dark:text-white/95">
                <span :class="['w-2 h-2 rounded-sm', form.ruleMode === 'append' ? 'bg-[#30d158]' : 'bg-slate-300 dark:bg-white/30']"></span>
                <span>追加模式 (Append / 推荐)</span>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-[#30d158]/10 text-[#30d158] font-medium border border-[#30d158]/30">
                0 Git 冲突
              </span>
            </div>
            <p class="text-slate-500 dark:text-white/60 text-[11px] leading-relaxed">
              原版团队 AGENTS.md 保持 0 修改。规则精准写入各 Agent 私有文件（CLAUDE.local.md、ZCODE.local.md 等），并自动加入 .git/info/exclude，零 Git 污染、免 Hook。
            </p>
          </div>

          <!-- Overwrite Mode Card -->
          <div
            @click="form.ruleMode = 'overwrite'"
            :class="[
              'p-3.5 rounded-xl border cursor-pointer transition-colors duration-200 space-y-2 relative',
              form.ruleMode === 'overwrite'
                ? 'bg-black/[0.03] dark:bg-[#2c2c2e] border-black/20 dark:border-white/25 shadow-xs'
                : 'bg-transparent border-black/8 dark:border-white/8 hover:bg-black/[0.01] dark:hover:bg-white/5 opacity-70 hover:opacity-100'
            ]"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 font-serif font-semibold text-slate-900 dark:text-white/95">
                <span :class="['w-2 h-2 rounded-sm', form.ruleMode === 'overwrite' ? 'bg-[#0a84ff]' : 'bg-slate-300 dark:bg-white/30']"></span>
                <span>覆盖模式 (Overwrite / 接管)</span>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-[#0a84ff]/10 text-[#0a84ff] font-medium border border-[#0a84ff]/30">
                Hook 守卫守护
              </span>
            </div>
            <p class="text-slate-500 dark:text-white/60 text-[11px] leading-relaxed">
              工作区 AGENTS.md 置换为个性化规则（原版备份至 .git/info/AGENTS.orig）。Git Hook 守卫在切分支、pull 与 commit 时自动防护，防冲突与防误提交。
            </p>
          </div>
        </div>
      </div>

      <!-- Section 2: Git Hook & Pre-Commit Protection (For Git Projects) -->
      <div v-if="project.isGit" class="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none space-y-3 transition-colors duration-200">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 flex items-center gap-2">
              <ShieldCheck class="w-4 h-4 text-slate-700 dark:text-white/80" />
              <span>Git Commit 误提交拦截保护 (pre-commit 守卫)</span>
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-white/50 mt-0.5">
              在覆盖模式下，自动阻止将本地个性化 AGENTS.md 误 commit 到远程仓库；如确实需要向团队仓库提交规则，可切换为放行。
            </p>
          </div>

          <!-- Pre-commit Switch Segmented Slider -->
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 text-xs flex-shrink-0 self-start sm:self-auto">
            <button
              type="button"
              @click="form.preCommitGuard = true"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                form.preCommitGuard
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
              title="开启拦截：git commit 时自动拦截提交本地 AGENTS.md"
            >
              <span v-if="form.preCommitGuard" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
              <span>开启拦截 (防误提)</span>
            </button>
            <button
              type="button"
              @click="form.preCommitGuard = false"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !form.preCommitGuard
                  ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
              title="允许提交：放行 git commit AGENTS.md"
            >
              <span>允许提交 (放行)</span>
            </button>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-black/[0.02] dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-sm', project.hookInstalled ? 'bg-[#30d158]' : 'bg-[#ff9f0a]']"></span>
            <span class="text-slate-700 dark:text-white/80 font-mono text-[11px]">
              Hook 状态: {{ project.hookInstalled ? 'pre-checkout & post-checkout 已安装' : '未检测到 Hook 文件' }}
              {{ form.preCommitGuard ? ' (pre-commit 拦截保护中)' : ' (pre-commit 守卫已放行)' }}
            </span>
          </div>

          <button
            @click="handleRepairHooks"
            :disabled="isRepairing"
            class="px-3 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-semibold flex items-center gap-1 transition-colors duration-200"
          >
            <Zap class="w-3 h-3 text-[#ff9f0a]" />
            <span>{{ isRepairing ? '修复中...' : '⚡ 一键安装/修复 Git Hook' }}</span>
          </button>
        </div>
      </div>

      <!-- Section 3: Linked Agents Grid -->
      <div class="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none space-y-3 transition-colors duration-200">
        <div class="flex items-center justify-between">
          <h4 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 flex items-center gap-2">
            <Layers class="w-4 h-4 text-slate-700 dark:text-white/80" />
            <span>目标分发 Agent (已选 {{ form.linkedAgents.length }} / {{ store.enabledAgents.length }})</span>
          </h4>
          <div class="flex items-center gap-2 text-xs">
            <button
              type="button"
              @click="selectAllAgents"
              class="text-[11px] text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white transition-colors duration-200"
            >
              全选
            </button>
            <span class="text-slate-300 dark:text-white/20">|</span>
            <button
              type="button"
              @click="form.linkedAgents = []"
              class="text-[11px] text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white transition-colors duration-200"
            >
              清空
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <label
            v-for="agent in store.enabledAgents"
            :key="agent.id"
            :class="[
              'p-2.5 rounded-xl border cursor-pointer transition-colors duration-200 flex items-center gap-2.5',
              form.linkedAgents.includes(agent.id)
                ? 'bg-black/[0.03] dark:bg-[#2c2c2e] border-black/15 dark:border-white/20'
                : 'bg-transparent border-black/8 dark:border-white/8 opacity-60 hover:opacity-100 hover:bg-black/[0.01] dark:hover:bg-white/5'
            ]"
          >
            <input
              type="checkbox"
              :value="agent.id"
              v-model="form.linkedAgents"
              class="custom-checkbox flex-shrink-0"
            />
            <div class="w-6 h-6 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 flex items-center justify-center flex-shrink-0">
              <AgentBrandIcon :agentId="agent.id" size="sm" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium text-slate-900 dark:text-white/90 truncate">{{ agent.name }}</div>
              <div class="text-[10px] text-slate-400 dark:text-white/40 font-mono truncate">{{ agent.localRuleFilename }}</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref, computed } from 'vue';
import { ProjectInfo } from '../types';
import { useAppStore } from '../stores/useAppStore';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  FolderGit2,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  Save,
  FileText,
  Edit3,
  Sparkles,
  Zap,
  Copy,
  Check,
  SlidersHorizontal,
  Layers,
  X,
} from 'lucide-vue-next';

const props = defineProps<{
  project: ProjectInfo;
}>();

const store = useAppStore();
const isSaving = ref(false);
const isRepairing = ref(false);
const copied = ref(false);
const activeTab = ref<'editor' | 'settings'>('editor');
const showBaseline = ref(false);

const form = reactive({
  enabled: props.project.overrideEnabled,
  ruleMode: props.project.ruleMode,
  customRuleContent: props.project.customRuleContent,
  linkedAgents: [...props.project.linkedAgents],
  preCommitGuard: props.project.preCommitGuard ?? true,
});

const lineCount = computed(() => {
  if (!form.customRuleContent) return 0;
  return form.customRuleContent.split('\n').length;
});

const charCount = computed(() => {
  return form.customRuleContent ? form.customRuleContent.length : 0;
});

watch(
  () => props.project,
  (newVal) => {
    form.enabled = newVal.overrideEnabled;
    form.ruleMode = newVal.ruleMode;
    form.customRuleContent = newVal.customRuleContent;
    form.linkedAgents = [...newVal.linkedAgents];
    form.preCommitGuard = newVal.preCommitGuard ?? true;
  },
  { deep: true }
);

function copyPath() {
  if (!props.project.path) return;
  navigator.clipboard.writeText(props.project.path);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

function selectAllAgents() {
  form.linkedAgents = store.enabledAgents.map(a => a.id);
}

function insertTemplate() {
  form.customRuleContent = `# 本机通用规则指南
- 始终以中文输出所有回复、注释与汇报
- 保持极简设计风格，杜绝多余抽象与冗余文件
- 在进行跨文件变更前，严格核查模块依赖关系
- 保持零 Git 冲突与本地私有调试规范
`;
}

async function handleRepairHooks() {
  isRepairing.value = true;
  try {
    await store.repairGitHooks(props.project.id);
  } finally {
    isRepairing.value = false;
  }
}

async function saveChanges() {
  isSaving.value = true;
  try {
    await store.updateProjectRule(
      props.project.id,
      form.ruleMode,
      form.customRuleContent,
      form.enabled,
      form.linkedAgents,
      form.preCommitGuard
    );
  } finally {
    isSaving.value = false;
  }
}
</script>

