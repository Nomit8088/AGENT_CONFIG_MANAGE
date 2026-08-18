<template>
  <div
    v-if="store.skillEditorModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-fade"
  >
    <div class="glass-panel w-full max-w-3xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-dark-700 bg-white/98 dark:bg-dark-900/95 flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-transparent">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">
              {{ store.skillEditorModal.isNew ? '新建中央 Skill' : `编辑 Skill: ${store.skillEditorModal.skillName}` }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">编写 SKILL.md 文档与 YAML Frontmatter 元数据</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
        <div v-if="store.skillEditorModal.isNew">
          <label class="block text-slate-700 dark:text-slate-300 font-medium mb-1">技能唯一标识 (目录名)</label>
          <input
            v-model="store.skillEditorModal.skillName"
            type="text"
            placeholder="例如: archify / obsidian-sync"
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-slate-700 dark:text-slate-300 font-medium">SKILL.md 内容</label>
            <span class="text-[11px] text-slate-500 font-mono">支持 YAML Frontmatter (---)</span>
          </div>
          <textarea
            v-model="store.skillEditorModal.content"
            rows="16"
            placeholder="---&#10;name: skill-name&#10;description: 技能说明&#10;version: 1.0.0&#10;---&#10;&#10;# 技能内容"
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg p-3 font-mono text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 leading-relaxed resize-none shadow-inner"
          ></textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-800 flex-shrink-0">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-dark-700 transition"
        >
          取消
        </button>
        <button
          @click="handleSave"
          :disabled="!store.skillEditorModal.skillName.trim()"
          class="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center gap-1.5"
        >
          <Save class="w-3.5 h-3.5 text-white" />
          <span>保存至中央库</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/useAppStore';
import { Layers, X, Save } from 'lucide-vue-next';

const store = useAppStore();

function close() {
  store.skillEditorModal.visible = false;
}

async function handleSave() {
  const { skillName, content } = store.skillEditorModal;
  if (!skillName.trim()) return;

  await store.saveSkill(skillName.trim(), content);
  close();
}
</script>
