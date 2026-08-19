<template>
  <div
    v-if="store.agentDetailModal.visible && store.activeDetailAgent"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#1c1c1e] w-full max-w-2xl rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none flex flex-col max-h-[85vh] text-slate-900 dark:text-white transition-colors duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-black/5 dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 flex items-center justify-center">
            <AgentBrandIcon :agentId="store.activeDetailAgent.id" size="lg" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ store.activeDetailAgent.name }}</h3>
              <span class="text-xs px-2 py-0.5 rounded-md font-mono bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/60 border border-black/8 dark:border-white/8">
                {{ store.activeDetailAgent.skillsDir }}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-white/50 mt-0.5">本地存量实体 Skill 纳管与忽略状态管理</p>
          </div>
        </div>

        <button
          @click="store.closeAgentDetailModal()"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/90 hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tab Switcher & Search Row -->
      <div class="border-b border-black/8 dark:border-white/8 pt-3 pb-2 flex-shrink-0 space-y-2 text-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <button
              @click="store.agentDetailModal.activeTab = 'unmanaged'"
              :class="[
                'px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 flex items-center gap-1.5',
                store.agentDetailModal.activeTab === 'unmanaged'
                  ? 'bg-black/10 dark:bg-white/10 text-slate-900 dark:text-white/95 font-semibold'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <AlertTriangle class="w-3.5 h-3.5 text-[#ff9f0a]" />
              <span>待纳管技能</span>
              <span class="px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/10 text-slate-700 dark:text-white/80 border border-black/10 dark:border-white/10 text-[10px] font-mono">
                {{ rawUnmanaged.length }}
              </span>
            </button>

            <button
              @click="store.agentDetailModal.activeTab = 'ignored'"
              :class="[
                'px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 flex items-center gap-1.5',
                store.agentDetailModal.activeTab === 'ignored'
                  ? 'bg-black/10 dark:bg-white/10 text-slate-900 dark:text-white/95 font-semibold'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <EyeOff class="w-3.5 h-3.5" />
              <span>已忽略私有技能</span>
              <span class="px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/10 text-slate-700 dark:text-white/80 border border-black/10 dark:border-white/10 text-[10px] font-mono">
                {{ rawIgnored.length }}
              </span>
            </button>
          </div>

          <!-- Tab Batch Actions -->
          <div class="flex items-center gap-2">
            <template v-if="store.agentDetailModal.activeTab === 'unmanaged' && filteredUnmanaged.length > 0">
              <button
                @click="store.ignoreAllForAgent(store.activeDetailAgent.id)"
                class="px-2.5 py-1 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 border border-black/10 dark:border-white/12 text-[11px] transition-colors duration-200"
              >
                全部忽略
              </button>
              <button
                @click="store.takeoverAllForAgent(store.activeDetailAgent.id)"
                class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-[11px] font-medium transition-colors duration-200 flex items-center gap-1"
              >
                <PackageCheck class="w-3 h-3 text-[#30d158]" />
                <span>一键全部纳管</span>
              </button>
            </template>

            <template v-if="store.agentDetailModal.activeTab === 'ignored' && filteredIgnored.length > 0">
              <button
                @click="store.unignoreAllForAgent(store.activeDetailAgent.id)"
                class="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-[11px] font-medium transition-colors duration-200"
              >
                全部恢复提示
              </button>
            </template>
          </div>
        </div>

        <!-- In-Modal Search Input -->
        <div class="relative w-full">
          <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="modalSearch"
            type="text"
            placeholder="在当前列表中快速检索技能名称..."
            class="w-full bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
          <button
            v-if="modalSearch"
            @click="modalSearch = ''"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80"
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
            class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/12 flex items-center justify-between gap-3 transition-colors duration-200"
          >
            <div class="truncate">
              <div class="flex items-center gap-2">
                <span class="font-mono text-slate-900 dark:text-white/90 font-bold text-xs">{{ item.skillName }}</span>
                <span v-if="item.hasConflict" class="px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/6 text-[#ff453a] border border-black/8 dark:border-white/8 text-[10px] font-mono">
                  同名冲突
                </span>
              </div>
              <div class="text-[10px] text-slate-400 dark:text-white/40 font-mono truncate mt-0.5" :title="item.path">
                {{ item.path }}
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                @click="store.ignoreSkill(item)"
                class="px-2.5 py-1 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white/90 border border-black/10 dark:border-white/12 text-xs transition-colors duration-200 flex items-center gap-1"
              >
                <EyeOff class="w-3 h-3" />
                <span>忽略</span>
              </button>
              <button
                @click="handleSingleTakeover(item)"
                class="px-3 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200 flex items-center gap-1"
              >
                <PackageCheck class="w-3 h-3 text-[#30d158]" />
                <span>纳管至中央库</span>
              </button>
            </div>
          </div>

          <div v-if="filteredUnmanaged.length === 0" class="py-12 text-center text-slate-400 dark:text-white/40">
            <CheckCircle2 v-if="!modalSearch" class="w-8 h-8 mx-auto text-[#30d158] mb-2" />
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
            class="p-3 rounded-xl bg-black/[0.02] dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 flex items-center justify-between gap-3 transition-colors duration-200"
          >
            <div class="truncate">
              <div class="font-mono text-slate-900 dark:text-white/90 font-bold text-xs">{{ item.skillName }}</div>
              <div class="text-[10px] text-slate-400 dark:text-white/40 font-mono truncate mt-0.5" :title="item.path">
                {{ item.path }}
              </div>
            </div>

            <button
              @click="store.unignoreSkill(item.agentId, item.skillName)"
              class="px-3 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
            >
              恢复纳管提示
            </button>
          </div>

          <div v-if="filteredIgnored.length === 0" class="py-12 text-center text-slate-400 dark:text-white/40">
            <EyeOff v-if="!modalSearch" class="w-8 h-8 mx-auto text-slate-300 dark:text-white/30 mb-2" />
            <p class="text-xs">
              {{ modalSearch ? '未搜索到匹配的忽略技能' : '暂无被忽略的私有技能' }}
            </p>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="pt-3 border-t border-black/8 dark:border-white/8 flex items-center justify-between flex-shrink-0 text-xs">
        <span class="text-slate-400 dark:text-white/40">
          纳管后原目录将瞬间替换为 Windows NTFS Junction 软链
        </span>
        <button
          @click="store.closeAgentDetailModal()"
          class="px-4 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 font-medium transition-colors duration-200 border border-black/8 dark:border-white/8"
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

