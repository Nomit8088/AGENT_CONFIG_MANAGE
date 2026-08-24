<template>
  <nav class="border-b border-black/8 dark:border-white/8 bg-white/60 dark:bg-[#121316]/60 px-3 py-1.5 flex items-center justify-between gap-2 transition-colors duration-200 select-none">
    <!-- Tab list (小窗允许横向滚动，避免换行) -->
    <div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="tab.disabled ? undefined : (store.currentTab = tab.id as any)"
        :disabled="tab.disabled"
        :title="tab.disabled ? tab.disabledReason : ''"
        :class="[
          'px-2.5 py-1 text-xs flex items-center gap-1.5 rounded-lg transition-colors duration-200 flex-shrink-0',
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
            tab.badgeTone === 'warn'
              ? 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 font-semibold'
              : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/10'
          ]"
        >
          {{ tab.badge }}
        </span>
      </button>
    </div>

    <!-- Quick Action for Current Tab (小窗仅图标，title 提示) -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button
        v-if="store.currentTab === 'agents'"
        @click="store.addAgentModal.visible = true"
        :title="$t('nav.addAgentTitle')"
        class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
      >
        <Plus class="w-3.5 h-3.5" />
        <span class="hidden xl:inline">{{ $t('nav.addAgent') }}</span>
      </button>

      <button
        v-if="store.currentTab === 'skills'"
        @click="openNewSkillModal"
        :title="$t('nav.newSkillTitle')"
        class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
      >
        <Plus class="w-3.5 h-3.5" />
        <span class="hidden xl:inline">{{ $t('nav.newSkill') }}</span>
      </button>

      <button
        v-if="store.currentTab === 'projects'"
        @click="store.addProjectModal.visible = true"
        :title="$t('nav.addProjectTitle')"
        class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
      >
        <Plus class="w-3.5 h-3.5" />
        <span class="hidden xl:inline">{{ $t('nav.addProject') }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { t } from '../i18n';
import { Bot, Layers, FolderGit2, UploadCloud, Plus, Puzzle } from 'lucide-vue-next';

const store = useAppStore();

type TabItem = {
  id: string;
  label: string;
  icon: any;
  badge: number;
  badgeTone?: 'warn';
  disabled: boolean;
  disabledReason: string;
};

const tabs = computed<TabItem[]>(() => [
  {
    id: 'agents',
    label: t('nav.agents'),
    icon: Bot,
    badge: store.totalUnmanagedCount > 0 ? store.totalUnmanagedCount : store.detectedAgentsCount,
    badgeTone: store.totalUnmanagedCount > 0 ? 'warn' : undefined,
    disabled: false,
    disabledReason: '',
  },
  { id: 'skills', label: t('nav.skills'), icon: Layers, badge: store.skills.length, disabled: false, disabledReason: '' },
  { id: 'plugins', label: t('nav.plugins'), icon: Puzzle, badge: store.dshPluginDiffCount, disabled: false, disabledReason: '' },
  { id: 'projects', label: t('nav.projects'), icon: FolderGit2, badge: store.projects.length, disabled: false, disabledReason: '' },
  {
    id: 'sync',
    label: t('nav.sync'),
    icon: UploadCloud,
    badge: store.skillsSyncStatus.dirtyCount,
    disabled: false,
    disabledReason: '',
  },
]);

function openNewSkillModal() {
  store.skillEditorModal = {
    visible: true,
    skillName: '',
    content: t('nav.newSkillTemplate'),
    isNew: true,
  };
}
</script>

