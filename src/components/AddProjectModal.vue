<template>
  <div
    v-if="store.addProjectModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-fade"
  >
    <div class="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-dark-700 bg-white/98 dark:bg-dark-900/95 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-transparent">
            <FolderGit2 class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">纳管新项目</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">导入代码仓库以实现零 Git 冲突规则管理</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">项目物理绝对路径</label>
          <input
            v-model="form.path"
            @input="autoExtractName"
            type="text"
            placeholder="请输入或粘贴项目物理绝对路径..."
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div>
          <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">项目显示名称</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="项目名称（留空将自动从路径提取）"
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div class="p-3 rounded-lg bg-slate-50 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 space-y-1.5 shadow-sm">
          <div class="flex items-center gap-2 text-slate-800 dark:text-slate-300 font-semibold">
            <ShieldCheck class="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>智能 Git 冲突防护就绪</span>
          </div>
          <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            纳管后支持一键在「覆盖模式」与「追加模式」间无缝切换，彻底解决团队全局 AGENTS.md 冲突与 Token 浪费。
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-800">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-dark-700 transition"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="!form.path.trim()"
          class="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95"
        >
          确认纳管
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { FolderGit2, X, ShieldCheck } from 'lucide-vue-next';

const store = useAppStore();

const form = reactive({
  path: '',
  name: '',
});

function autoExtractName() {
  if (!form.name && form.path) {
    const parts = form.path.split(/[\/\\]/).filter(Boolean);
    if (parts.length > 0) {
      form.name = parts[parts.length - 1];
    }
  }
}

function close() {
  store.addProjectModal.visible = false;
}

async function handleSubmit() {
  if (!form.path.trim()) return;
  await store.addProject(form.path.trim(), form.name.trim());
  close();
}
</script>
