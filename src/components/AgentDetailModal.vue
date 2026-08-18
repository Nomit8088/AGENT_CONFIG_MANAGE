<template>
  <div
    v-if="store.agentDetailModal.visible && store.activeDetailAgent"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fade"
  >
    <div class="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-dark-700 bg-white/98 dark:bg-dark-900/98 flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-3 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 flex items-center justify-center">
            <AgentBrandIcon :agentId="store.activeDetailAgent.id" size="lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100">{{ store.activeDetailAgent.name }}</h3>
              <span class="text-xs px-2 py-0.2 rounded-full font-mono bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-700">
                {{ store.activeDetailAgent.skillsDir }}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">本地存量实体 Skill 纳管与忽略状态管理</p>
          </div>
        </div>

        <button
          @click="store.closeAgentDetailModal()"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tab Switcher & Search Row -->
      <div class="border-b border-slate-100 dark:border-dark-800 pt-3 pb-2 flex-shrink-0 space-y-2 text-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <button
              @click="store.agentDetailModal.activeTab = 'unmanaged'"
              :class="[
                'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5',
                store.agentDetailModal.activeTab === 'unmanaged'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              ]"
            >
              <AlertTriangle class="w-3.5 h-3.5" />
              <span>待纳管技能</span>
              <span class="px-1.5 py-0.2 rounded-full bg-white dark:bg-dark-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-800 text-[10px] font-mono font-bold">
                {{ rawUnmanaged.length }}
              </span>
            </button>

            <button
              @click="store.agentDetailModal.activeTab = 'ignored'"
              :class="[
                'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5',
                store.agentDetailModal.activeTab === 'ignored'
                  ? 'bg-slate-100 text-slate-800 border border-slate-300 dark:bg-dark-800 dark:text-slate-200 dark:border-slate-700 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              ]"
            >
              <EyeOff class="w-3.5 h-3.5" />
              <span>已忽略私有技能</span>
              <span class="px-1.5 py-0.2 rounded-full bg-white dark:bg-dark-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-800 text-[10px] font-mono font-bold">
                {{ rawIgnored.length }}
              </span>
            </button>
          </div>

          <!-- Tab Batch Actions -->
          <div class="flex items-center gap-2">
            <template v-if="store.agentDetailModal.activeTab === 'unmanaged' && filteredUnmanaged.length > 0">
              <button
                @click="store.ignoreAllForAgent(store.activeDetailAgent.id)"
                class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 text-[11px] transition"
              >
                全部忽略
              </button>
              <button
                @click="store.takeoverAllForAgent(store.activeDetailAgent.id)"
                class="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-300 dark:border-amber-500/30 text-[11px] font-semibold transition flex items-center gap-1"
              >
                <PackageCheck class="w-3 h-3" />
                <span>一键全部纳管</span>
              </button>
            </template>

            <template v-if="store.agentDetailModal.activeTab === 'ignored' && filteredIgnored.length > 0">
              <button
                @click="store.unignoreAllForAgent(store.activeDetailAgent.id)"
                class="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 dark:text-brand-300 dark:border-brand-500/30 text-[11px] font-semibold transition"
              >
                全部恢复提示
              </button>
            </template>
          </div>
        </div>

        <!-- In-Modal Search Input -->
        <div class="relative w-full">
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="modalSearch"
            type="text"
            placeholder="在当前列表中快速检索技能名称..."
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
          <button
            v-if="modalSearch"
            @click="modalSearch = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
        <!-- Unmanaged List -->
        <template v-if="store.agentDetailModal.activeTab === 'unmanaged'">
          <div
            v-for="item in filteredUnmanaged"
            :key="item.skillName"
            class="p-3 rounded-xl bg-slate-50/70 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 hover:border-amber-400/50 dark:hover:border-amber-500/30 flex items-center justify-between gap-3 transition shadow-sm"
          >
            <div class="truncate">
              <div class="flex items-center gap-2">
                <span class="font-mono text-amber-700 dark:text-amber-400 font-bold text-xs">{{ item.skillName }}</span>
                <span v-if="item.hasConflict" class="px-1.5 py-0.2 rounded bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-[10px]">
                  同名冲突
                </span>
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5" :title="item.path">
                {{ item.path }}
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                @click="store.ignoreSkill(item)"
                class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-dark-700 text-xs transition flex items-center gap-1"
              >
                <EyeOff class="w-3 h-3" />
                <span>忽略</span>
              </button>
              <button
                @click="handleSingleTakeover(item)"
                class="px-3 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 dark:text-brand-300 dark:border-brand-500/30 text-xs font-semibold transition flex items-center gap-1 shadow-sm"
              >
                <PackageCheck class="w-3 h-3" />
                <span>纳管至中央库</span>
              </button>
            </div>
          </div>

          <div v-if="filteredUnmanaged.length === 0" class="py-12 text-center text-slate-500">
            <CheckCircle2 v-if="!modalSearch" class="w-8 h-8 mx-auto text-emerald-500 dark:text-emerald-500/50 mb-2" />
            <p class="text-xs">
              {{ modalSearch ? '未搜索到匹配的待纳管技能' : '该 Agent 下所有技能已全部由中央库软链受控纳管！' }}
            </p>
          </div>
        </template>

        <!-- Ignored List -->
        <template v-else>
          <div
            v-for="item in filteredIgnored"
            :key="item.skillName"
            class="p-3 rounded-xl bg-slate-50/70 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 flex items-center justify-between gap-3 transition shadow-sm"
          >
            <div class="truncate">
              <div class="font-mono text-slate-800 dark:text-slate-300 font-bold text-xs">{{ item.skillName }}</div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5" :title="item.path">
                {{ item.path }}
              </div>
            </div>

            <button
              @click="store.unignoreSkill(item.agentId, item.skillName)"
              class="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-brand-700 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-brand-400 border border-slate-200 dark:border-dark-700 text-xs font-medium transition"
            >
              恢复纳管提示
            </button>
          </div>

          <div v-if="filteredIgnored.length === 0" class="py-12 text-center text-slate-500">
            <EyeOff v-if="!modalSearch" class="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
            <p class="text-xs">
              {{ modalSearch ? '未搜索到匹配的忽略技能' : '暂无被忽略的私有技能' }}
            </p>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="pt-3 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between flex-shrink-0 text-xs">
        <span class="text-slate-500 dark:text-slate-400">
          纳管后原目录将瞬间替换为 Windows NTFS Junction 软链
        </span>
        <button
          @click="store.closeAgentDetailModal()"
          class="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-medium transition border border-slate-200 dark:border-dark-700"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { UnmanagedSkill } from '../types';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  X,
  AlertTriangle,
  EyeOff,
  PackageCheck,
  CheckCircle2,
  Search,
} from 'lucide-vue-next';

const store = useAppStore();
const modalSearch = ref('');

const rawUnmanaged = computed(() => {
  if (!store.activeDetailAgent) return [];
  return store.unmanagedByAgent(store.activeDetailAgent.id);
});

const filteredUnmanaged = computed(() => {
  const q = modalSearch.value.trim().toLowerCase();
  if (!q) return rawUnmanaged.value;
  return rawUnmanaged.value.filter(u => u.skillName.toLowerCase().includes(q) || u.path.toLowerCase().includes(q));
});

const rawIgnored = computed(() => {
  if (!store.activeDetailAgent) return [];
  return store.ignoredByAgent(store.activeDetailAgent.id);
});

const filteredIgnored = computed(() => {
  const q = modalSearch.value.trim().toLowerCase();
  if (!q) return rawIgnored.value;
  return rawIgnored.value.filter(i => i.skillName.toLowerCase().includes(q) || i.path.toLowerCase().includes(q));
});

async function handleSingleTakeover(item: UnmanagedSkill) {
  if (item.hasConflict) {
    store.openDiffModal({
      title: `纳管冲突决策: ${item.skillName}`,
      agentId: item.agentId,
      skillName: item.skillName,
      localContent: item.localContent || '（本地文件为空）',
      remoteContent: item.centralContent || '（中央库文件为空）',
      localLabel: `${item.agentName} 本地实体`,
      remoteLabel: '中央库现有版本',
      onResolve: async (action) => {
        await store.takeoverSkill(item.agentId, item.skillName, action);
        store.closeDiffModal();
      },
    });
  } else {
    await store.takeoverSkill(item.agentId, item.skillName, 'overwrite');
  }
}
</script>
