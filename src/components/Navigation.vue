<template>
  <nav class="border-b border-black/8 dark:border-white/8 bg-white/60 dark:bg-[#1c1c1e]/60 px-5 py-2 flex items-center justify-between transition-colors duration-200 select-none">
    <!-- Tab list -->
    <div class="flex items-center gap-1.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="tab.disabled ? undefined : (store.currentTab = tab.id as any)"
        :disabled="tab.disabled"
        :title="tab.disabled ? tab.disabledReason : ''"
        :class="[
          'px-3 py-1.5 text-xs flex items-center gap-2 rounded-lg transition-colors duration-200',
          tab.disabled
            ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-white/40'
            : store.currentTab === tab.id
              ? 'bg-black/8 dark:bg-white/10 text-slate-900 dark:text-white/95 font-medium'
              : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 hover:bg-black/5 dark:hover:bg-white/5'
        ]"
      >
        <component :is="tab.icon" class="w-3.5 h-3.5" />
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.badge !== undefined && tab.badge > 0"
          :class="[
            'text-[10px] px-1.5 py-0.5 rounded-md font-mono',
            tab.id === 'unmanaged'
              ? 'bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30 font-semibold'
              : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/10'
          ]"
        >
          {{ tab.badge }}
        </span>
      </button>
    </div>

    <!-- Quick Action for Current Tab -->
    <div class="flex items-center gap-2">
      <button
        v-if="store.currentTab === 'agents'"
        @click="store.addAgentModal.visible = true"
        class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>添加自定义 Agent</span>
      </button>

      <button
        v-if="store.currentTab === 'skills'"
        @click="openNewSkillModal"
        class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>新建中央 Skill</span>
      </button>

      <button
        v-if="store.currentTab === 'projects'"
        @click="store.addProjectModal.visible = true"
        class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
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
import { Bot, Layers, FolderGit2, UploadCloud, AlertTriangle, Plus, Puzzle } from 'lucide-vue-next';

const store = useAppStore();

const tabs = computed(() => [
  { id: 'agents', label: 'Agent Hub (大厅)', icon: Bot, badge: store.detectedAgentsCount, disabled: false, disabledReason: '' },
  { id: 'skills', label: 'Skills Matrix (技能矩阵)', icon: Layers, badge: store.skills.length, disabled: false, disabledReason: '' },
  {
    id: 'sync',
    label: '同步中心',
    icon: UploadCloud,
    badge: store.skillsSyncStatus.dirtyCount,
    disabled: !store.syncRepoConfigured,
    disabledReason: '请先在全局设置中配置并校验同步仓库',
  },
  { id: 'plugins', label: 'DSH 插件中心', icon: Puzzle, badge: store.dshPluginDiffCount, disabled: false, disabledReason: '' },
  { id: 'projects', label: 'Project Rules (规则中心)', icon: FolderGit2, badge: store.projects.length, disabled: false, disabledReason: '' },
  ...(store.totalUnmanagedCount > 0
    ? [{ id: 'unmanaged', label: '待纳管存量', icon: AlertTriangle, badge: store.totalUnmanagedCount, disabled: false, disabledReason: '' }]
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

