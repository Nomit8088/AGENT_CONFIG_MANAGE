<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 pb-24">
    <!-- Central Skills Library (技能页签只保留中央技能库) -->
    <div class="bg-white dark:bg-[#2c2c2e] rounded-xl border border-black/8 dark:border-white/8 border-t-[#0a84ff]/60 shadow-sm dark:shadow-none overflow-hidden space-y-0 transition-colors duration-200">
      <!-- Top Title & View Switcher Bar -->
      <div class="p-4 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1c1e]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#0a84ff]/10 border border-[#0a84ff]/20 flex items-center justify-center text-[#0a84ff]">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95 flex items-center gap-2">
              <span>中央技能库与分发矩阵 (Central Skills)</span>
              <span class="text-xs px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 font-mono border border-black/8 dark:border-white/8">
                {{ displaySkills.length }} / {{ store.skills.length }} Skills
              </span>
            </h3>
            <p class="text-xs text-slate-500 dark:text-white/50">通过标签与智能多选分发器，轻松将中央技能秒级软链分发至任意本地 Agent</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- View Switcher -->
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
            <button
              @click="setViewMode('table')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                viewMode === 'table' ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs' : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
              title="表格紧凑视图"
            >
              <List class="w-3.5 h-3.5" />
              <span>表格</span>
            </button>
            <button
              @click="setViewMode('card')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                viewMode === 'card' ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs' : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
              title="卡片画廊视图"
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>卡片</span>
            </button>
          </div>

          <button
            @click="openNewModal"
            class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200"
          >
            <Plus class="w-3.5 h-3.5 text-slate-700 dark:text-white/90" />
            <span>新建 Skill</span>
          </button>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="p-3 bg-black/[0.01] dark:bg-[#1c1c1e]/60 border-b border-black/8 dark:border-white/8 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <!-- Keyword Search -->
          <div class="relative flex-1 max-w-sm">
            <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索技能名称、描述、Tag、斜杠命令..."
              class="w-full bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80"
            >
              <X class="w-3 h-3" />
            </button>
          </div>

          <!-- Source Filter Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-400 dark:text-white/40 text-[11px]">来源:</span>
            <select
              v-model="sourceFilter"
              class="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
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
            <span class="text-slate-400 dark:text-white/40 text-[11px]">分发状态:</span>
            <select
              v-model="mountFilter"
              class="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
            >
              <option value="all">全部状态</option>
              <option value="all_active">已全部分发 (全活跃)</option>
              <option value="partial">部分 Agent 分发</option>
              <option value="unmounted">未分发 (0 挂载)</option>
            </select>
          </div>

          <!-- Sort Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-400 dark:text-white/40 text-[11px]">排序:</span>
            <select
              v-model="sortKey"
              class="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
            >
              <option value="name_asc">名称 (A → Z)</option>
              <option value="name_desc">名称 (Z → A)</option>
              <option value="mounted_desc">挂载 Agent 数量 (从多到少)</option>
              <option value="version_desc">版本号 (从新到旧)</option>
            </select>
          </div>
        </div>

        <!-- Clear Filters Button -->
        <div v-if="isFiltered" class="flex items-center gap-2">
          <span class="text-[11px] text-[#ff9f0a] font-medium">已应用过滤</span>
          <button
            @click="resetFilters"
            class="px-2 py-1 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white/95 border border-black/10 dark:border-white/12 text-xs transition-colors duration-200 flex items-center gap-1"
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
            <tr class="border-b border-black/8 dark:border-white/8 bg-black/5 dark:bg-[#1c1c1e] text-slate-600 dark:text-white/60 uppercase tracking-wider font-semibold">
              <th class="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  class="custom-checkbox"
                />
              </th>
              <th class="py-2.5 px-3 min-w-[160px]">Skill 技能名称 / 描述</th>
              <th class="py-2.5 px-2 text-center min-w-[72px]">版本 / 来源</th>
              <th class="py-2.5 px-2 text-center min-w-[110px]">全局分发状态</th>
              <th class="py-2.5 px-3 text-right min-w-[72px]">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-black/6 dark:divide-white/6">
            <tr
              v-for="skill in displaySkills"
              :key="skill.id"
              :class="[
                'hover:bg-black/[0.02] dark:hover:bg-white/5 transition-colors duration-200 cursor-pointer',
                store.activeSkillId === skill.id ? 'bg-black/[0.03] dark:bg-white/8' : ''
              ]"
              @click="store.activeSkillId = skill.id"
            >
              <!-- Checkbox for batch -->
              <td class="py-2.5 px-3 text-center" @click.stop>
                <input
                  type="checkbox"
                  :value="skill.id"
                  v-model="store.selectedSkillIds"
                  class="custom-checkbox"
                />
              </td>

              <!-- Name & Desc -->
              <td class="py-2.5 px-3">
                <div class="flex items-start gap-2.5">
                  <div class="w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5" :class="SOURCE_TILE[sourceMeta(skill).tone]">
                    <FileCode class="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95 flex items-center gap-1.5">
                      <span>{{ skill.name }}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-white/50 line-clamp-1 mt-0.5" :title="skill.description">
                      {{ skill.description }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Version & Source -->
              <td class="py-2.5 px-2 text-center" @click.stop>
                <div class="inline-flex flex-col items-center">
                  <span class="font-mono text-[11px] text-slate-800 dark:text-white/90 font-medium">v{{ skill.version }}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded-md border mt-0.5 font-mono" :class="SOURCE_BADGE[sourceMeta(skill).tone]">
                    {{ sourceMeta(skill).label }}
                  </span>
                </div>
              </td>

              <!-- Global Toggle Segmented Control -->
              <td class="py-2.5 px-2 text-center" @click.stop>
                <div class="inline-flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
                  <button
                    type="button"
                    @click="handleGlobalToggle(skill.id, true)"
                    :class="[
                      'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                      skill.enabled
                        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                    ]"
                    title="一键分发至全部活跃 Agent"
                  >
                    <span v-if="skill.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
                    <span>启用 ({{ skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }})</span>
                  </button>
                  <button
                    type="button"
                    @click="handleGlobalToggle(skill.id, false)"
                    :class="[
                      'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                      !skill.enabled
                        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                    ]"
                    title="从所有 Agent 一键解绑"
                  >
                    <span>停用</span>
                  </button>
                </div>
                <div class="mt-1 text-[10px] font-mono" :class="mountCountClass(skill)">
                  已分发 {{ skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }} 个 Agent
                </div>
                <div class="mt-1.5 flex justify-center">
                  <AgentPillPicker :skill="skill" />
                </div>
              </td>

              <!-- Actions -->
              <td class="py-2.5 px-3 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <button
                    @click="openEditModal(skill)"
                    title="编辑技能文档"
                    class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white/90 hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
                  >
                    <Edit class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="skill.id !== 'agenthub-sync'"
                    @click="deleteSkill(skill)"
                    title="删除技能"
                    class="p-1.5 rounded-lg text-slate-500 hover:text-[#ff453a] dark:text-white/50 dark:hover:text-[#ff453a] hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="displaySkills.length === 0">
              <td colspan="5" class="py-12 text-center text-slate-400 dark:text-white/40">
                <div class="flex flex-col items-center justify-center gap-2">
                  <Layers class="w-8 h-8 text-slate-300 dark:text-white/30" />
                  <p class="text-xs">未搜索到符合筛选条件的 Skill，可重置筛选条件或点击右上角「新建 Skill」</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- VIEW 2: CARD GALLERY VIEW -->
      <div v-else class="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div
          v-for="skill in displaySkills"
          :key="skill.id"
          @click="store.activeSkillId = skill.id"
          class="bg-white dark:bg-[#2c2c2e] rounded-xl p-4 border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/12 shadow-sm dark:shadow-none transition-colors duration-200 flex flex-col justify-between cursor-pointer space-y-3"
        >
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg border flex items-center justify-center" :class="SOURCE_TILE[sourceMeta(skill).tone]">
                  <FileCode class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">{{ skill.name }}</h4>
                  <span class="text-[10px] text-slate-400 dark:text-white/50 font-mono">v{{ skill.version }} · <span :class="SOURCE_TEXT[sourceMeta(skill).tone]">{{ sourceMeta(skill).label }}</span></span>
                </div>
              </div>

              <!-- Segmented Slider in Card View -->
              <div class="inline-flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[11px] flex-shrink-0">
                <button
                  type="button"
                  @click.stop="handleGlobalToggle(skill.id, true)"
                  :class="[
                    'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                    skill.enabled
                      ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                  ]"
                  title="一键分发至全部活跃 Agent"
                >
                  <span v-if="skill.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
                  <span>启用</span>
                </button>
                <button
                  type="button"
                  @click.stop="handleGlobalToggle(skill.id, false)"
                  :class="[
                    'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                    !skill.enabled
                      ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                  ]"
                  title="从所有 Agent 一键解绑"
                >
                  <span>停用</span>
                </button>
              </div>
            </div>

            <p class="text-[11px] text-slate-500 dark:text-white/50 line-clamp-2 mt-2 leading-relaxed">
              {{ skill.description }}
            </p>
          </div>

          <!-- 分 Agent 管理入口（重新开放 Agent 多选分发器） -->
          <div class="pt-2 border-t border-black/8 dark:border-white/8 flex items-center justify-between gap-2" @click.stop>
            <span class="text-[10px] text-slate-400 dark:text-white/40 shrink-0">
              已分发 <span class="font-mono font-medium" :class="mountCountClass(skill)">{{ skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }}</span> 个 Agent
            </span>
            <AgentPillPicker :skill="skill" />
          </div>
        </div>

        <div v-if="displaySkills.length === 0" class="col-span-full py-12 text-center text-slate-400 dark:text-white/40">
          <p class="text-xs">未搜索到符合筛选条件的 Skill</p>
        </div>
      </div>
    </div>

    <!-- Floating Batch Action Bar -->
    <transition name="fade">
      <div
        v-if="store.selectedSkillIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-xl bg-white/95 dark:bg-[#1c1c1e]/90 border border-black/10 dark:border-white/12 backdrop-blur-xl flex items-center gap-4 text-xs text-slate-900 dark:text-white shadow-xl dark:shadow-none"
      >
        <div class="flex items-center gap-2 font-medium text-slate-900 dark:text-white/90">
          <span class="w-2 h-2 rounded-sm bg-[#0a84ff]"></span>
          <span>已选中 {{ store.selectedSkillIds.length }} 个技能</span>
        </div>

        <div class="h-4 w-[1px] bg-black/10 dark:bg-white/10"></div>

        <div class="flex items-center gap-2">
          <button
            @click="batchMountToActive"
            class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 font-medium flex items-center gap-1 transition-colors duration-200"
          >
            <Zap class="w-3.5 h-3.5 text-[#ff9f0a]" />
            <span>一键分发至全部活跃 Agent</span>
          </button>
          <button
            @click="batchUnmountAll"
            class="px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 border border-black/10 dark:border-white/12 font-medium transition-colors duration-200"
          >
            全部解绑
          </button>
          <button
            @click="store.selectedSkillIds = []"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
            title="取消选择"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </transition>

    <!-- Side-over Drawer -->
    <SkillDrawer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { SkillItem } from '../types';
import SkillDrawer from './SkillDrawer.vue';
import AgentPillPicker from './AgentPillPicker.vue';
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

// 来源语义色：内置=蓝 / 中央自建=绿 / NPX 捕获=琥珀 / 存量纳管=紫 / 其他=灰
const SOURCE_TILE: Record<string, string> = {
  blue: 'bg-[#0a84ff]/10 border-[#0a84ff]/20 text-[#0a84ff]',
  green: 'bg-[#30d158]/10 border-[#30d158]/20 text-[#30d158]',
  amber: 'bg-[#ff9f0a]/10 border-[#ff9f0a]/20 text-[#ff9f0a]',
  purple: 'bg-[#bf5af2]/10 border-[#bf5af2]/20 text-[#bf5af2]',
  gray: 'bg-black/5 dark:bg-[#1c1c1e] border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80',
};
const SOURCE_BADGE: Record<string, string> = {
  blue: 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30',
  green: 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30',
  amber: 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30',
  purple: 'bg-[#bf5af2]/10 text-[#bf5af2] border-[#bf5af2]/30',
  gray: 'bg-black/5 dark:bg-white/6 text-slate-500 dark:text-white/60 border-black/8 dark:border-white/8',
};
const SOURCE_TEXT: Record<string, string> = {
  blue: 'text-[#0a84ff]',
  green: 'text-[#30d158]',
  amber: 'text-[#ff9f0a]',
  purple: 'text-[#bf5af2]',
  gray: 'text-slate-400 dark:text-white/50',
};

function sourceMeta(skill: SkillItem): { tone: string; label: string } {
  if (skill.id === 'agenthub-sync') return { tone: 'blue', label: '内置' };
  switch (skill.source) {
    case 'central': return { tone: 'green', label: '中央自建' };
    case 'npx': return { tone: 'amber', label: 'NPX 捕获' };
    case 'imported': return { tone: 'purple', label: '存量纳管' };
    default: return { tone: 'gray', label: skill.source || '手动' };
  }
}

// 分发状态着色：全部分发=绿 / 部分分发=琥珀 / 未分发=灰
function mountCountClass(skill: SkillItem): string {
  const count = skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
  const active = store.agents.filter(a => a.detected && a.enabled).length;
  if (active > 0 && count === active) return 'text-[#30d158]';
  if (count > 0) return 'text-[#ff9f0a]';
  return 'text-slate-400 dark:text-white/40';
}

const viewMode = ref<'table' | 'card'>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem('skills_view_mode') as 'table' | 'card')) || 'card'
);

function setViewMode(mode: 'table' | 'card') {
  viewMode.value = mode;
  try {
    localStorage.setItem('skills_view_mode', mode);
  } catch (e) {}
}

// Filter & Sort state
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

