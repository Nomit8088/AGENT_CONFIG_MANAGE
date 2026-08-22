<template>
  <div
    v-if="store.skillEditorModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#121316] w-full max-w-3xl rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">
              {{ store.skillEditorModal.isNew ? '新建中央 Skill' : `编辑 Skill: ${store.skillEditorModal.skillName}` }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-white/50">编写 SKILL.md 文档与 YAML Frontmatter 元数据</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
        <div v-if="store.skillEditorModal.isNew">
          <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">技能唯一标识 (目录名)</label>
          <input
            v-model="store.skillEditorModal.skillName"
            type="text"
            placeholder="例如: archify / obsidian-sync"
            class="w-full bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-[#3b82f6]/40 dark:focus:border-[#3b82f6]/40 transition-colors duration-200"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-slate-700 dark:text-white/70 font-medium">SKILL.md 内容</label>
            <span class="text-[11px] text-slate-400 dark:text-white/40 font-mono">支持 YAML Frontmatter (---)</span>
          </div>
          <textarea
            v-model="store.skillEditorModal.content"
            rows="16"
            placeholder="---&#10;name: skill-name&#10;description: 技能说明&#10;version: 1.0.0&#10;---&#10;&#10;# 技能内容"
            class="w-full bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg p-3 font-mono text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-[#3b82f6]/40 dark:focus:border-[#3b82f6]/40 leading-relaxed resize-none transition-colors duration-200"
          ></textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-black/8 dark:border-white/8 flex-shrink-0">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
        >
          取消
        </button>
        <button
          @click="handleSave"
          :disabled="!store.skillEditorModal.skillName.trim()"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 disabled:opacity-50 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
        >
          <Save class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" />
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

