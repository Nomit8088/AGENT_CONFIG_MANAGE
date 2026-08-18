<template>
  <nav class="border-b border-slate-200 dark:border-dark-800 bg-white/60 dark:bg-dark-900/40 px-5 flex items-center justify-between transition-colors select-none">
    <div class="flex items-center gap-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="store.currentTab = tab.id as any"
        :class="[
          'px-4 py-2.5 text-xs font-medium flex items-center gap-2 border-b-2 transition relative',
          store.currentTab === tab.id
            ? 'border-brand-600 dark:border-brand-500 text-brand-600 dark:text-brand-400 font-semibold'
            : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
        ]"
      >
        <component :is="tab.icon" class="w-3.5 h-3.5" />
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.badge !== undefined && tab.badge > 0"
          :class="[
            'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
            tab.id === 'unmanaged'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
              : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-dark-700'
          ]"
        >
          {{ tab.badge }}
        </span>
      </button>
    </div>

    <!-- Quick Action for Current Tab -->
    <div class="flex items-center gap-2 py-1.5">
      <button
        v-if="store.currentTab === 'agents'"
        @click="store.addAgentModal.visible = true"
        class="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>添加自定义 Agent</span>
      </button>

      <button
        v-if="store.currentTab === 'skills'"
        @click="openNewSkillModal"
        class="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>新建中央 Skill</span>
      </button>

      <button
        v-if="store.currentTab === 'projects'"
        @click="store.addProjectModal.visible = true"
        class="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>纳管新项目</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Bot, Layers, FolderGit2, AlertTriangle, Plus } from 'lucide-vue-next';

const store = useAppStore();

const tabs = computed(() => [
  { id: 'agents', label: 'Agent Hub (大厅)', icon: Bot, badge: store.detectedAgentsCount },
  { id: 'skills', label: 'Skills Matrix (技能矩阵)', icon: Layers, badge: store.skills.length },
  { id: 'projects', label: 'Project Rules (规则中心)', icon: FolderGit2, badge: store.projects.length },
  ...(store.totalUnmanagedCount > 0
    ? [{ id: 'unmanaged', label: '待纳管存量', icon: AlertTriangle, badge: store.totalUnmanagedCount }]
    : []),
]);

function openNewSkillModal() {
  store.skillEditorModal = {
    visible: true,
    skillName: '',
    content: `---\nname: my-new-skill\ndescription: 自定义技能描述\nversion: 1.0.0\n---\n\n# 新技能文档\n在此编写技能详细指令与说明。`,
    isNew: true,
  };
}
</script>
