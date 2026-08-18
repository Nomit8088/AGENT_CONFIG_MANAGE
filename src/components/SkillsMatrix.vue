<template>
  <div class="h-full overflow-y-auto p-6 space-y-6 pb-24">
    <!-- Section 1: Agent-Grouped Unmanaged & Ignored Skills Detection -->
    <UnmanagedGroupSection />

    <!-- Section 2: Central Skills Library & Mounting Matrix -->
    <div class="glass-panel rounded-2xl border border-slate-200/80 dark:border-dark-800 overflow-hidden shadow-sm space-y-0">
      <!-- Top Title & View Switcher Bar -->
      <div class="p-4 border-b border-slate-200/80 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-transparent">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>中央技能库与分发矩阵 (Central Skills)</span>
              <span class="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 font-mono border border-slate-200/80 dark:border-dark-700">
                {{ displaySkills.length }} / {{ store.skills.length }} Skills
              </span>
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">通过标签与智能多选分发器，轻松将中央技能秒级软链分发至任意本地 Agent</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- View Switcher -->
          <div class="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800 text-xs">
            <button
              @click="setViewMode('table')"
              :class="[
                'px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1',
                viewMode === 'table' ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 font-semibold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              ]"
              title="表格紧凑视图"
            >
              <List class="w-3.5 h-3.5" />
              <span>表格</span>
            </button>
            <button
              @click="setViewMode('card')"
              :class="[
                'px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1',
                viewMode === 'card' ? 'bg-white dark:bg-dark-800 text-brand-600 dark:text-brand-400 font-semibold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              ]"
              title="卡片画廊视图"
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>卡片</span>
            </button>
          </div>

          <button
            @click="openNewModal"
            class="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-brand-500/20"
          >
            <Plus class="w-3.5 h-3.5 text-white" />
            <span>新建 Skill</span>
          </button>
        </div>
      </div>

      <!-- Filter & Search Toolbar (Requirement 5) -->
      <div class="p-3.5 bg-slate-50/80 dark:bg-dark-950/60 border-b border-slate-200/80 dark:border-dark-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <!-- Keyword Search -->
          <div class="relative flex-1 max-w-sm">
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索技能名称、描述、Tag、斜杠命令..."
              class="w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-sm"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X class="w-3 h-3" />
            </button>
          </div>

          <!-- Source Filter Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-500 dark:text-slate-400 text-[11px]">来源:</span>
            <select
              v-model="sourceFilter"
              class="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
            >
              <option value="all">全部来源</option>
              <option value="builtin">内置模板</option>
              <option value="central">中央自建</option>
              <option value="npx">NPX 捕获</option>
              <option value="imported">存量纳管</option>
            </select>
          </div>

          <!-- Distribution / Mounting Filter Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-500 dark:text-slate-400 text-[11px]">分发状态:</span>
            <select
              v-model="mountFilter"
              class="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
            >
              <option value="all">全部状态</option>
              <option value="all_active">已全部分发 (全活跃)</option>
              <option value="partial">部分 Agent 分发</option>
              <option value="unmounted">未分发 (0 挂载)</option>
            </select>
          </div>

          <!-- Sort Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-500 dark:text-slate-400 text-[11px]">排序:</span>
            <select
              v-model="sortKey"
              class="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 shadow-sm"
            >
              <option value="name_asc">名称 (A → Z)</option>
              <option value="name_desc">名称 (Z → A)</option>
              <option value="mounted_desc">挂载 Agent 数量 (从多到少)</option>
              <option value="version_desc">版本号 (从新到旧)</option>
            </select>
          </div>
        </div>

        <!-- Clear Filters Button (Visible when filters are applied) -->
        <div v-if="isFiltered" class="flex items-center gap-2">
          <span class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">已应用过滤</span>
          <button
            @click="resetFilters"
            class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 text-xs transition flex items-center gap-1"
          >
            <RotateCcw class="w-3 h-3" />
            <span>重置筛选</span>
          </button>
        </div>
      </div>

      <!-- VIEW 1: TABLE VIEW -->
      <div v-if="viewMode === 'table'" class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-200/80 dark:border-dark-800 bg-slate-50 dark:bg-dark-950/70 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              <th class="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  class="custom-checkbox"
                />
              </th>
              <th class="py-3 px-4 min-w-[220px]">Skill 技能名称 / 描述</th>
              <th class="py-3 px-3 text-center min-w-[100px]">版本 / 来源</th>
              <th class="py-3 px-3 text-center min-w-[80px]">总开关</th>
              <th class="py-3 px-4 min-w-[340px]">已挂载 Agent 目标 (NTFS 软链)</th>
              <th class="py-3 px-4 text-right min-w-[100px]">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-dark-800/60">
            <tr
              v-for="skill in displaySkills"
              :key="skill.id"
              :class="[
                'hover:bg-slate-50/80 dark:hover:bg-dark-800/40 transition group cursor-pointer',
                store.activeSkillId === skill.id ? 'bg-brand-50/50 dark:bg-dark-800/60' : ''
              ]"
              @click="store.activeSkillId = skill.id"
            >
              <!-- Checkbox for batch -->
              <td class="py-3.5 px-3 text-center" @click.stop>
                <input
                  type="checkbox"
                  :value="skill.id"
                  v-model="store.selectedSkillIds"
                  class="custom-checkbox"
                />
              </td>

              <!-- Name & Desc -->
              <td class="py-3.5 px-4">
                <div class="flex items-start gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:border-brand-500/50 transition flex-shrink-0 mt-0.5">
                    <FileCode class="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{{ skill.name }}</span>
                      <span v-if="skill.id === 'agenthub-sync'" class="text-[9px] px-1 py-0.2 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
                        内置
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5" :title="skill.description">
                      {{ skill.description }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Version & Source -->
              <td class="py-3 px-3 text-center" @click.stop>
                <div class="inline-flex flex-col items-center">
                  <span class="font-mono text-[11px] text-brand-600 dark:text-brand-400 font-medium">v{{ skill.version }}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-dark-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-800 mt-0.5">
                    {{ skill.source }}
                  </span>
                </div>
              </td>

              <!-- Global Toggle -->
              <td class="py-3 px-3 text-center" @click.stop>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="skill.enabled"
                    @change="(e) => handleGlobalToggle(skill.id, (e.target as HTMLInputElement).checked)"
                    class="sr-only peer"
                  />
                  <div class="w-8 h-4 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
                </label>
              </td>

              <!-- Mounted Agents Tag Pills & Picker -->
              <td class="py-3.5 px-4" @click.stop>
                <div class="flex flex-wrap items-center gap-1.5">
                  <!-- Tag pills for mounted agents with brand icons -->
                  <div
                    v-for="agentId in skill.mountedAgents.filter(id => store.isAgentEnabled(id))"
                    :key="agentId"
                    class="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 text-[11px] font-medium flex items-center gap-1.5 group/pill transition"
                  >
                    <AgentBrandIcon :agentId="agentId" size="sm" />
                    <span>{{ getAgentName(agentId) }}</span>
                    <button
                      @click="store.toggleSkillForAgent(skill.id, agentId, false)"
                      title="从该 Agent 解绑软链"
                      class="hover:text-red-500 dark:hover:text-red-400 transition"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  </div>

                  <!-- Agent Pill Picker Trigger -->
                  <AgentPillPicker :skill="skill" />
                </div>
              </td>

              <!-- Actions -->
              <td class="py-3 px-4 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    @click="openEditModal(skill)"
                    title="编辑技能文档"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
                  >
                    <Edit class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="skill.id !== 'agenthub-sync'"
                    @click="deleteSkill(skill)"
                    title="删除技能"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="displaySkills.length === 0">
              <td colspan="6" class="py-12 text-center text-slate-500">
                <div class="flex flex-col items-center justify-center gap-2">
                  <Layers class="w-8 h-8 text-slate-400 dark:text-slate-600" />
                  <p class="text-xs">未搜索到符合筛选条件的 Skill，可重置筛选条件或点击右上角「新建 Skill」</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- VIEW 2: CARD GALLERY VIEW -->
      <div v-else class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="skill in displaySkills"
          :key="skill.id"
          @click="store.activeSkillId = skill.id"
          class="glass-card rounded-xl p-4 border border-slate-200/80 dark:border-dark-800 hover:border-brand-500/40 transition flex flex-col justify-between cursor-pointer space-y-3 shadow-sm"
        >
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <FileCode class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="font-bold text-xs text-slate-900 dark:text-slate-100">{{ skill.name }}</h4>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">v{{ skill.version }} · {{ skill.source }}</span>
                </div>
              </div>

              <label class="relative inline-flex items-center cursor-pointer" @click.stop>
                <input
                  type="checkbox"
                  :checked="skill.enabled"
                  @change="(e) => handleGlobalToggle(skill.id, (e.target as HTMLInputElement).checked)"
                  class="sr-only peer"
                />
                <div class="w-8 h-4 bg-slate-200 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-600 dark:peer-checked:bg-brand-500"></div>
              </label>
            </div>

            <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
              {{ skill.description }}
            </p>
          </div>

          <!-- Mounted Agents on Card -->
          <div class="pt-2 border-t border-slate-100 dark:border-dark-800/80 space-y-1.5" @click.stop>
            <div class="text-[10px] text-slate-500 font-semibold uppercase">
              已分发 Agent ({{ skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }})
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <div
                v-for="agentId in skill.mountedAgents.filter(id => store.isAgentEnabled(id))"
                :key="agentId"
                class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 text-[10px] font-medium flex items-center gap-1"
              >
                <AgentBrandIcon :agentId="agentId" size="sm" />
                <span>{{ getAgentName(agentId) }}</span>
                <button @click="store.toggleSkillForAgent(skill.id, agentId, false)" class="hover:text-red-500 dark:hover:text-red-400">
                  <X class="w-2.5 h-2.5" />
                </button>
              </div>
              <AgentPillPicker :skill="skill" />
            </div>
          </div>
        </div>

        <div v-if="displaySkills.length === 0" class="col-span-full py-12 text-center text-slate-500">
          <p class="text-xs">未搜索到符合筛选条件的 Skill</p>
        </div>
      </div>
    </div>

    <!-- Floating Batch Action Bar (When 1+ skills selected) -->
    <transition name="fade">
      <div
        v-if="store.selectedSkillIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-dark-900/95 border border-brand-500/40 shadow-2xl backdrop-blur-xl flex items-center gap-4 text-xs animate-slide-up text-white"
      >
        <div class="flex items-center gap-2 font-semibold text-slate-100">
          <span class="w-2 h-2 rounded-full bg-brand-400 animate-ping"></span>
          <span>已选中 {{ store.selectedSkillIds.length }} 个技能</span>
        </div>

        <div class="h-4 w-[1px] bg-slate-700"></div>

        <div class="flex items-center gap-2">
          <button
            @click="batchMountToActive"
            class="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold flex items-center gap-1 shadow-md shadow-brand-500/20 transition active:scale-95"
          >
            <Zap class="w-3.5 h-3.5 text-amber-300" />
            <span>一键分发至全部活跃 Agent</span>
          </button>
          <button
            @click="batchUnmountAll"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition"
          >
            全部解绑
          </button>
          <button
            @click="store.selectedSkillIds = []"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition"
            title="取消选择"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </transition>

    <!-- Side-over Drawer & Modals -->
    <SkillDrawer />
    <AgentDetailModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { SkillItem } from '../types';
import UnmanagedGroupSection from './UnmanagedGroupSection.vue';
import SkillDrawer from './SkillDrawer.vue';
import AgentDetailModal from './AgentDetailModal.vue';
import AgentPillPicker from './AgentPillPicker.vue';
import AgentBrandIcon from './AgentBrandIcon.vue';
import {
  Layers,
  Plus,
  FileCode,
  Edit,
  Trash2,
  List,
  LayoutGrid,
  X,
  Zap,
  Search,
  RotateCcw,
} from 'lucide-vue-next';

const store = useAppStore();
const viewMode = ref<'table' | 'card'>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem('skills_view_mode') as 'table' | 'card')) || 'card'
);

function setViewMode(mode: 'table' | 'card') {
  viewMode.value = mode;
  try {
    localStorage.setItem('skills_view_mode', mode);
  } catch (e) {}
}

// Filter & Sort state (Requirement 5)
const searchQuery = ref('');
const sourceFilter = ref<'all' | 'builtin' | 'central' | 'npx' | 'imported'>('all');
const mountFilter = ref<'all' | 'all_active' | 'partial' | 'unmounted'>('all');
const sortKey = ref<'name_asc' | 'name_desc' | 'mounted_desc' | 'version_desc'>('name_asc');

const isFiltered = computed(() => {
  return searchQuery.value.trim() !== '' ||
    sourceFilter.value !== 'all' ||
    mountFilter.value !== 'all' ||
    sortKey.value !== 'name_asc';
});

function resetFilters() {
  searchQuery.value = '';
  sourceFilter.value = 'all';
  mountFilter.value = 'all';
  sortKey.value = 'name_asc';
}

const displaySkills = computed(() => {
  let list = [...store.skills];

  // 1. Search Query
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.metadata?.tags && s.metadata.tags.some(t => t.toLowerCase().includes(q))) ||
      (s.metadata?.slash_commands && s.metadata.slash_commands.some(c => c.toLowerCase().includes(q)))
    );
  }

  // 2. Source Filter
  if (sourceFilter.value === 'builtin') {
    list = list.filter(s => s.id === 'agenthub-sync');
  } else if (sourceFilter.value !== 'all') {
    list = list.filter(s => s.source === sourceFilter.value && s.id !== 'agenthub-sync');
  }

  // 3. Mount Filter
  const activeEnabledAgents = store.agents.filter(a => a.detected && a.enabled);
  if (mountFilter.value === 'all_active') {
    list = list.filter(s =>
      activeEnabledAgents.length > 0 &&
      activeEnabledAgents.every(a => s.mountedAgents.includes(a.id))
    );
  } else if (mountFilter.value === 'partial') {
    list = list.filter(s => {
      const count = s.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
      return count > 0 && count < activeEnabledAgents.length;
    });
  } else if (mountFilter.value === 'unmounted') {
    list = list.filter(s => s.mountedAgents.filter(id => store.isAgentEnabled(id)).length === 0);
  }

  // 4. Sort
  list.sort((a, b) => {
    if (sortKey.value === 'name_asc') {
      return a.name.localeCompare(b.name);
    } else if (sortKey.value === 'name_desc') {
      return b.name.localeCompare(a.name);
    } else if (sortKey.value === 'mounted_desc') {
      const countA = a.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
      const countB = b.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    } else if (sortKey.value === 'version_desc') {
      return b.version.localeCompare(a.version);
    }
    return 0;
  });

  return list;
});

const isAllSelected = computed(() => {
  return displaySkills.value.length > 0 &&
    displaySkills.value.every(s => store.selectedSkillIds.includes(s.id));
});

function toggleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    store.selectedSkillIds = displaySkills.value.map(s => s.id);
  } else {
    store.selectedSkillIds = [];
  }
}

function getAgentName(agentId: string): string {
  const agent = store.agents.find(a => a.id === agentId);
  return agent ? agent.name : agentId;
}

function handleGlobalToggle(skillName: string, enable: boolean) {
  store.toggleGlobalSkill(skillName, enable);
}

function openNewModal() {
  store.skillEditorModal = {
    visible: true,
    skillName: '',
    content: `---\nname: my-new-skill\ndescription: 自定义技能描述\nversion: 1.0.0\n---\n\n# 技能详细说明`,
    isNew: true,
  };
}

function openEditModal(skill: SkillItem) {
  store.skillEditorModal = {
    visible: true,
    skillName: skill.id,
    content: skill.content,
    isNew: false,
  };
}

function deleteSkill(skill: SkillItem) {
  if (confirm(`确定要彻底删除技能 [${skill.name}] 吗？将自动解除所有 Agent 的挂载软链。`)) {
    store.deleteSkill(skill.id);
  }
}

async function batchMountToActive() {
  const activeAgentIds = store.agents.filter(a => a.detected && a.enabled).map(a => a.id);
  await store.batchMountSkills(store.selectedSkillIds, activeAgentIds, true);
}

async function batchUnmountAll() {
  const allAgentIds = store.agents.map(a => a.id);
  await store.batchMountSkills(store.selectedSkillIds, allAgentIds, false);
}
</script>
