<template>
  <div class="bg-white dark:bg-[#1c1d22] rounded-xl p-4 border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none space-y-4 transition-colors duration-200">
    <!-- Header & Action Row -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#121316] text-slate-700 dark:text-white/80 flex items-center justify-center border border-black/10 dark:border-white/10">
          <FolderSearch class="w-4 h-4" />
        </div>
        <div>
          <h3 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 flex items-center gap-2">
            <span>{{ $t('unmanaged.title') }}</span>
            <span
              v-if="store.totalUnmanagedCount > 0"
              class="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-[#f59e0b] border border-black/8 dark:border-white/8 font-mono font-semibold"
            >
              {{ $t('unmanaged.count', { count: store.totalUnmanagedCount }) }}
            </span>
            <span v-else class="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-[#22c55e] border border-black/8 dark:border-white/8 font-mono">
              {{ $t('unmanaged.allManaged') }}
            </span>
          </h3>
          <p class="text-[11px] text-slate-500 dark:text-white/50">
            {{ $t('unmanaged.subtitle') }}
          </p>
        </div>
      </div>

      <!-- Controls: Filter, Sort & Scan -->
      <div class="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
        <!-- Search Input -->
        <div class="relative flex-1 md:w-48">
          <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('unmanaged.searchPlaceholder')"
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

        <!-- Filter Dropdown -->
        <select
          v-model="statusFilter"
          class="bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
        >
          <option value="all">{{ $t('unmanaged.agentAll', { count: store.enabledAgents.length }) }}</option>
          <option value="unmanaged">{{ $t('unmanaged.onlyUnmanaged') }}</option>
          <option value="clean">{{ $t('unmanaged.onlyClean') }}</option>
        </select>

        <!-- Sort Dropdown -->
        <select
          v-model="sortKey"
          class="bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
        >
          <option value="unmanaged_desc">{{ $t('unmanaged.sortDesc') }}</option>
          <option value="name_asc">{{ $t('unmanaged.nameAsc') }}</option>
        </select>

        <!-- Rescan Button -->
        <button
          @click="store.scanUnmanaged()"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center gap-1"
          :title="$t('unmanaged.rescanTitle')"
        >
          <RefreshCw class="w-3 h-3" />
          <span>{{ $t('unmanaged.redetect') }}</span>
        </button>

        <!-- Batch Takeover All Across Agents Button -->
        <button
          v-if="store.totalUnmanagedCount > 0"
          @click="store.takeoverAllUnmanagedSkills()"
          class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center gap-1 font-medium"
          :title="$t('agent.adoptAllTitle')"
        >
          <PackageCheck class="w-3 h-3 text-[#22c55e]" />
          <span>{{ $t('agent.adoptAll', { count: store.totalUnmanagedCount }) }}</span>
        </button>
      </div>
    </div>

    <!-- Agent Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="agent in displayAgents"
        :key="agent.id"
        @click="store.openAgentDetailModal(agent.id, 'unmanaged')"
        :class="[
          'p-3.5 rounded-xl border transition-colors duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden',
          getAgentUnmanagedCount(agent.id) > 0
            ? 'bg-white dark:bg-[#1c1d22] border-black/12 dark:border-white/12 hover:border-black/20 dark:hover:bg-[#343437]'
            : 'bg-black/[0.02] dark:bg-[#121316] border-black/6 dark:border-white/8 hover:bg-black/[0.04] dark:hover:bg-[#1c1d22]'
        ]"
      >
        <div>
          <!-- Card Header -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 flex items-center justify-center">
                <AgentBrandIcon :agentId="agent.id" size="sm" />
              </div>
              <span class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95 truncate max-w-[120px]">
                {{ agent.name }}
              </span>
            </div>

            <span
              :class="[
                'w-2 h-2 rounded-sm',
                agent.detected ? 'bg-[#22c55e]' : 'bg-slate-300 dark:bg-white/30'
              ]"
            ></span>
          </div>

          <!-- Path -->
          <div class="text-[10px] text-slate-400 dark:text-white/40 font-mono truncate mb-3" :title="agent.skillsDir">
            {{ agent.skillsDir }}
          </div>
        </div>

        <!-- Badges & Action -->
        <div class="pt-2 border-t border-black/8 dark:border-white/8 flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-2">
            <span
              v-if="getAgentUnmanagedCount(agent.id) > 0"
              class="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-[#f59e0b] border border-black/8 dark:border-white/8 font-mono"
            >
              {{ $t('unmanaged.countBadge', { count: getAgentUnmanagedCount(agent.id) }) }}
            </span>
            <span v-else class="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-[#22c55e] border border-black/8 dark:border-white/8 font-mono">
              {{ $t('unmanaged.zero') }}
            </span>

            <span
              v-if="getAgentIgnoredCount(agent.id) > 0"
              class="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-500 dark:text-white/50 border border-black/8 dark:border-white/8 font-mono"
              :title="$t('agent.ignoredTitle')"
            >
              {{ $t('unmanaged.ignoredBadge', { count: getAgentIgnoredCount(agent.id) }) }}
            </span>
          </div>

          <div class="flex items-center text-slate-400 dark:text-white/40 group-hover:text-slate-900 dark:group-hover:text-white/90 text-xs transition-colors duration-200">
            <span>{{ $t('common.manage') }}</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="displayAgents.length === 0" class="py-6 text-center text-slate-400 dark:text-white/40 text-xs">
      {{ $t('unmanaged.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  FolderSearch,
  RefreshCw,
  ChevronRight,
  Search,
  X,
  PackageCheck,
} from 'lucide-vue-next';

const store = useAppStore();
const searchQuery = ref('');
const statusFilter = ref<'all' | 'unmanaged' | 'clean'>('all');
const sortKey = ref<'unmanaged_desc' | 'name_asc'>('unmanaged_desc');

function getAgentUnmanagedCount(agentId: string) {
  return store.unmanagedByAgent(agentId).length;
}

function getAgentIgnoredCount(agentId: string) {
  return store.ignoredByAgent(agentId).length;
}

const displayAgents = computed(() => {
  let list = [...store.enabledAgents];

  // 1. Search Query
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.skillsDir.toLowerCase().includes(q)
    );
  }

  // 2. Status Filter
  if (statusFilter.value === 'unmanaged') {
    list = list.filter(a => getAgentUnmanagedCount(a.id) > 0);
  } else if (statusFilter.value === 'clean') {
    list = list.filter(a => getAgentUnmanagedCount(a.id) === 0);
  }

  // 3. Sort
  list.sort((a, b) => {
    if (sortKey.value === 'unmanaged_desc') {
      const diff = getAgentUnmanagedCount(b.id) - getAgentUnmanagedCount(a.id);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  return list;
});
</script>
