<template>
  <div class="h-full flex flex-col md:flex-row overflow-hidden transition-colors duration-200">
    <!-- Left Project List Sidebar -->
    <div class="w-full md:w-72 border-r border-black/8 dark:border-white/8 bg-white/80 dark:bg-[#121316]/80 backdrop-blur-xl flex flex-col flex-shrink-0">
      <!-- List Header -->
      <div class="p-3 border-b border-black/8 dark:border-white/8 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FolderGit2 class="w-4 h-4 text-slate-700 dark:text-white/80" />
          <span class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">纳管项目 ({{ filteredProjects.length }}/{{ store.projects.length }})</span>
        </div>
        <button
          @click="store.addProjectModal.visible = true"
          class="p-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs transition-colors duration-200"
          title="纳管新项目"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quick Search Bar for Projects -->
      <div v-if="store.projects.length > 2" class="p-2 border-b border-black/8 dark:border-white/8">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索项目名称或路径..."
            class="w-full bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Project Items -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div
          v-for="p in filteredProjects"
          :key="p.id"
          @click="store.activeProjectId = p.id"
          :class="[
            'p-2.5 rounded-lg cursor-pointer transition-colors duration-200 border text-xs group relative',
            store.activeProjectId === p.id
              ? 'bg-black/5 dark:bg-[#1c1d22] border-black/10 dark:border-white/15'
              : 'bg-transparent border-transparent hover:bg-black/[0.03] dark:hover:bg-white/5 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/90'
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'w-2 h-2 rounded-sm',
                  p.overrideEnabled ? 'bg-[#22c55e]' : 'bg-slate-300 dark:bg-white/30'
                ]"
              ></span>
              <span class="font-serif font-semibold text-slate-900 dark:text-white/95 truncate max-w-[150px]">{{ p.name }}</span>
            </div>
            <button
              @click.stop="handleDelete(p)"
              class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#ef4444] dark:text-white/40 dark:hover:text-[#ef4444] p-1 transition-colors duration-200"
              title="解除纳管"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-2 mt-2 text-[10px] text-slate-400 dark:text-white/40">
            <span class="px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/6 font-mono text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8">
              {{ p.ruleMode === 'overwrite' ? '覆盖模式' : '追加模式' }}
            </span>
            <span v-if="p.gitBranch" class="flex items-center gap-0.5 text-slate-500 dark:text-white/50 font-mono">
              <GitBranch class="w-2.5 h-2.5" />
              <span>{{ p.gitBranch }}</span>
            </span>
          </div>
        </div>

        <div v-if="filteredProjects.length === 0" class="p-6 text-center text-slate-400 dark:text-white/40 text-xs">
          {{ searchQuery ? '未搜索到匹配的项目' : '暂无已纳管项目，点击上方加号纳管本地代码仓库。' }}
        </div>
      </div>
    </div>

    <!-- Right Main Workspace -->
    <div class="flex-1 overflow-y-auto p-4 bg-[#f4f4f5] dark:bg-[#1c1d22]">
      <ProjectEditor
        v-if="store.activeProject"
        :project="store.activeProject"
      />
      <div v-else class="h-full flex flex-col items-center justify-center text-slate-400 dark:text-white/40 text-xs space-y-3">
        <FolderGit2 class="w-12 h-12 text-slate-300 dark:text-white/20" />
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

