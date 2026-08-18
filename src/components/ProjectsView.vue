<template>
  <div class="h-full flex flex-col md:flex-row overflow-hidden">
    <!-- Left Project List Sidebar -->
    <div class="w-full md:w-80 border-r border-slate-200 dark:border-dark-800 bg-white/70 dark:bg-dark-900/40 flex flex-col flex-shrink-0">
      <!-- List Header -->
      <div class="p-4 border-b border-slate-200/80 dark:border-dark-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FolderGit2 class="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span class="font-bold text-xs text-slate-800 dark:text-slate-200">纳管项目 ({{ filteredProjects.length }}/{{ store.projects.length }})</span>
        </div>
        <button
          @click="store.addProjectModal.visible = true"
          class="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-brand-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-brand-400 border border-slate-200 dark:border-dark-700 text-xs transition"
          title="纳管新项目"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quick Search Bar for Projects -->
      <div v-if="store.projects.length > 2" class="p-2 border-b border-slate-200/80 dark:border-dark-800/60">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索项目名称或路径..."
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 shadow-sm"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Project Items -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div
          v-for="p in filteredProjects"
          :key="p.id"
          @click="store.activeProjectId = p.id"
          :class="[
            'p-3 rounded-xl cursor-pointer transition border text-xs group relative',
            store.activeProjectId === p.id
              ? 'bg-white dark:bg-dark-800/90 border-brand-500/50 shadow-md'
              : 'bg-slate-50/70 dark:bg-dark-900/60 border-slate-200/80 dark:border-dark-800/80 hover:bg-white dark:hover:bg-dark-800/50 hover:border-slate-300 dark:hover:border-slate-700'
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  p.overrideEnabled ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-400 dark:bg-slate-600'
                ]"
              ></span>
              <span class="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{{ p.name }}</span>
            </div>
            <button
              @click.stop="handleDelete(p)"
              class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition"
              title="解除纳管"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-2 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
            <span class="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-dark-950 font-mono text-brand-700 dark:text-brand-400 font-medium">
              {{ p.ruleMode === 'overwrite' ? '覆盖模式' : '追加模式' }}
            </span>
            <span v-if="p.gitBranch" class="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-mono">
              <GitBranch class="w-2.5 h-2.5" />
              <span>{{ p.gitBranch }}</span>
            </span>
          </div>
        </div>

        <div v-if="filteredProjects.length === 0" class="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
          {{ searchQuery ? '未搜索到匹配的项目' : '暂无已纳管项目，点击上方加号纳管本地代码仓库。' }}
        </div>
      </div>
    </div>

    <!-- Right Main Workspace -->
    <div class="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-dark-950/50">
      <ProjectEditor
        v-if="store.activeProject"
        :project="store.activeProject"
      />
      <div v-else class="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs space-y-3">
        <FolderGit2 class="w-12 h-12 text-slate-300 dark:text-slate-700" />
        <p>请在左侧选择项目或纳管新项目以配置规则</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { ProjectInfo } from '../types';
import ProjectEditor from './ProjectEditor.vue';
import { FolderGit2, Plus, GitBranch, Trash2, Search, X } from 'lucide-vue-next';

const store = useAppStore();
const searchQuery = ref('');

const filteredProjects = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return store.projects;
  return store.projects.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.path.toLowerCase().includes(q) ||
    (p.gitBranch && p.gitBranch.toLowerCase().includes(q))
  );
});

function handleDelete(proj: ProjectInfo) {
  if (confirm(`确定要解除对项目 [${proj.name}] 的规则纳管吗？将还原原版文件并卸载 Git Hook。`)) {
    store.deleteProject(proj.id);
  }
}
</script>
