<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 pb-24">
    <!-- Central Skills Library (技能页签只保留中央技能库) -->
    <div class="bg-white dark:bg-[#1c1d22] rounded-xl border border-black/8 dark:border-white/8 border-t-[#3b82f6]/60 shadow-sm dark:shadow-none overflow-hidden space-y-0 transition-colors duration-200">
      <!-- Top Title & View Switcher Bar -->
      <div class="p-4 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#121316]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6]">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95 flex items-center gap-2">
              <span>{{ $t('skill.libraryTitle') }}</span>
              <span class="text-xs px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/70 font-mono border border-black/8 dark:border-white/8">
                {{ displaySkills.length }} / {{ store.skills.length }} Skills
              </span>
            </h3>
            <p class="text-xs text-slate-500 dark:text-white/50">{{ $t('skill.librarySubtitle') }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- View Switcher -->
          <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
            <button
              @click="setViewMode('table')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                viewMode === 'table' ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs' : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
              :title="$t('skill.tableViewTitle')"
            >
              <List class="w-3.5 h-3.5" />
              <span>{{ $t('skill.table') }}</span>
            </button>
            <button
              @click="setViewMode('card')"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                viewMode === 'card' ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs' : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
              :title="$t('skill.cardViewTitle')"
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>{{ $t('skill.card') }}</span>
            </button>
          </div>

          <button
            @click="openNewModal"
            class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-all duration-200"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ $t('skill.newSkill') }}</span>
          </button>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="p-3 bg-black/[0.01] dark:bg-[#121316]/60 border-b border-black/8 dark:border-white/8 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <!-- Keyword Search -->
          <div class="relative flex-1 max-w-sm">
            <Search class="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('skill.searchPlaceholder')"
              class="w-full bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-[#3b82f6]/40 dark:focus:border-[#3b82f6]/40 transition-colors duration-200"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5"
            >
              <X class="w-3 h-3" />
            </button>
          </div>

          <!-- Source Filter Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-400 dark:text-white/40 text-[11px]">{{ $t('skill.source') }}</span>
            <select
              v-model="sourceFilter"
              class="bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 font-sans focus:outline-none focus:border-[#3b82f6]/40 dark:focus:border-[#3b82f6]/40 transition-colors duration-200"
            >
              <option value="all">{{ $t('skill.sourceAll') }}</option>
              <option value="builtin">{{ $t('skill.sourceBuiltin') }}</option>
              <option value="central">{{ $t('skill.sourceCentral') }}</option>
              <option value="npx">{{ $t('skill.sourceNpx') }}</option>
              <option value="imported">{{ $t('skill.sourceImported') }}</option>
            </select>
          </div>

          <!-- Distribution / Mounting Filter Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-400 dark:text-white/40 text-[11px]">{{ $t('skill.status') }}</span>
            <select
              v-model="mountFilter"
              class="bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 font-sans focus:outline-none focus:border-[#3b82f6]/40 dark:focus:border-[#3b82f6]/40 transition-colors duration-200"
            >
              <option value="all">{{ $t('skill.statusAll') }}</option>
              <option value="all_active">{{ $t('skill.statusAllActive') }}</option>
              <option value="partial">{{ $t('skill.statusPartial') }}</option>
              <option value="unmounted">{{ $t('skill.statusUnmounted') }}</option>
            </select>
          </div>

          <!-- Sort Dropdown -->
          <div class="flex items-center gap-1">
            <span class="text-slate-400 dark:text-white/40 text-[11px]">{{ $t('skill.sort') }}</span>
            <select
              v-model="sortKey"
              class="bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 font-sans focus:outline-none focus:border-[#3b82f6]/40 dark:focus:border-[#3b82f6]/40 transition-colors duration-200"
            >
              <option value="name_asc">{{ $t('skill.sortNameAsc') }}</option>
              <option value="name_desc">{{ $t('skill.sortNameDesc') }}</option>
              <option value="mounted_desc">{{ $t('skill.sortMountedDesc') }}</option>
              <option value="version_desc">{{ $t('skill.sortVersionDesc') }}</option>
            </select>
          </div>
        </div>

        <!-- Clear Filters Button -->
        <div v-if="isFiltered" class="flex items-center gap-2">
          <span class="text-[11px] text-[#f59e0b] font-medium">{{ $t('skill.filterApplied') }}</span>
          <button
            @click="resetFilters"
            class="px-2 py-1 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white/95 border border-black/10 dark:border-white/12 text-xs transition-colors duration-200 flex items-center gap-1"
          >
            <RotateCcw class="w-3 h-3" />
            <span>{{ $t('skill.resetFilter') }}</span>
          </button>
        </div>
      </div>

      <!-- VIEW 1: TABLE VIEW -->
      <div v-if="viewMode === 'table'" class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-black/8 dark:border-white/8 bg-black/5 dark:bg-[#121316] text-slate-600 dark:text-white/60 uppercase tracking-wider font-semibold">
              <th class="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  class="custom-checkbox"
                />
              </th>
              <th class="py-2.5 px-3 min-w-[180px]">{{ $t('skill.colSkill') }}</th>
              <th class="py-2.5 px-2 text-center min-w-[72px]">{{ $t('skill.colVersion') }}</th>
              <th class="py-2.5 px-2 text-center min-w-[120px]">{{ $t('skill.colStatus') }}</th>
              <th class="py-2.5 px-3 text-right min-w-[72px]">{{ $t('skill.colActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-black/6 dark:divide-white/6">
            <tr
              v-for="skill in displaySkills"
              :key="skill.id"
              :class="[
                'hover:bg-black/[0.02] dark:hover:bg-white/5 transition-colors duration-200 cursor-pointer',
                store.activeSkillId === skill.id
                  ? 'bg-[#3b82f6]/5 dark:bg-[#3b82f6]/10 border-l-2 border-l-[#3b82f6]'
                  : 'border-l-2 border-l-transparent'
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
                  <div class="min-w-0">
                    <div class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95 flex items-center gap-1.5">
                      <span>{{ skill.name }}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-white/50 line-clamp-1 mt-0.5" :title="skill.description">
                      {{ skill.description }}
                    </p>
                    <!-- Slash commands & tags micro chips -->
                    <div v-if="skill.metadata?.slash_commands?.length || skill.metadata?.tags?.length" class="flex flex-wrap items-center gap-1 mt-1">
                      <span
                        v-for="cmd in skill.metadata?.slash_commands"
                        :key="cmd"
                        class="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/6 font-mono text-[10px] text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8"
                      >
                        {{ cmd }}
                      </span>
                      <span
                        v-for="tag in skill.metadata?.tags"
                        :key="tag"
                        class="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/6 font-mono text-[10px] text-slate-500 dark:text-white/50 border border-black/8 dark:border-white/8"
                      >
                        #{{ tag }}
                      </span>
                    </div>
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
                <div class="inline-flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
                  <button
                    type="button"
                    @click="handleGlobalToggle(skill.id, true)"
                    :class="[
                      'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                      skill.enabled
                        ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                    ]"
                    :title="$t('skill.distributeAllTitle')"
                  >
                    <span v-if="skill.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#22c55e]"></span>
                    <span>{{ $t('skill.enableCount', { count: skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }) }}</span>
                  </button>
                  <button
                    type="button"
                    @click="handleGlobalToggle(skill.id, false)"
                    :class="[
                      'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                      !skill.enabled
                        ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                    ]"
                    :title="$t('skill.unmountAllTitle')"
                  >
                    <span>{{ $t('common.disable') }}</span>
                  </button>
                </div>
                <div class="mt-1 text-[10px] font-mono" :class="mountCountClass(skill)">
                  {{ $t('skill.distributedCount', { count: skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }) }}
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
                    :title="$t('skill.editTitle')"
                    class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white/90 hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
                  >
                    <Edit class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="skill.id !== 'agenthub-sync'"
                    @click="deleteSkill(skill)"
                    :title="$t('skill.deleteTitle')"
                    class="p-1.5 rounded-lg text-slate-500 hover:text-[#ef4444] dark:text-white/50 dark:hover:text-[#ef4444] hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
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
                  <p class="text-xs">{{ $t('skill.emptySearch') }}</p>
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
          class="bg-white dark:bg-[#1c1d22] rounded-xl p-4 border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/14 shadow-sm dark:shadow-none transition-colors duration-200 flex flex-col justify-between cursor-pointer space-y-3 relative overflow-hidden macos-vibrancy-card"
          :class="cardAccentBorder(skill)"
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
              <div class="inline-flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-[11px] flex-shrink-0">
                <button
                  type="button"
                  @click.stop="handleGlobalToggle(skill.id, true)"
                  :class="[
                    'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                    skill.enabled
                      ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                  ]"
                  :title="$t('skill.distributeAllTitle')"
                >
                  <span v-if="skill.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#22c55e]"></span>
                  <span>{{ $t('common.enable') }}</span>
                </button>
                <button
                  type="button"
                  @click.stop="handleGlobalToggle(skill.id, false)"
                  :class="[
                    'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                    !skill.enabled
                      ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                  ]"
                  :title="$t('skill.unmountAllTitle')"
                >
                  <span>{{ $t('common.disable') }}</span>
                </button>
              </div>
            </div>

            <p class="text-[11px] text-slate-500 dark:text-white/50 line-clamp-2 mt-2 leading-relaxed">
              {{ skill.description }}
            </p>

            <!-- Slash commands & tags in card view -->
            <div v-if="skill.metadata?.slash_commands?.length || skill.metadata?.tags?.length" class="flex flex-wrap items-center gap-1 mt-2">
              <span
                v-for="cmd in skill.metadata?.slash_commands"
                :key="cmd"
                class="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/6 font-mono text-[10px] text-slate-600 dark:text-white/70 border border-black/8 dark:border-white/8"
              >
                {{ cmd }}
              </span>
              <span
                v-for="tag in skill.metadata?.tags"
                :key="tag"
                class="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/6 font-mono text-[10px] text-slate-500 dark:text-white/50 border border-black/8 dark:border-white/8"
              >
                #{{ tag }}
              </span>
            </div>
          </div>

          <!-- 分 Agent 管理入口（重新开放 Agent 多选分发器） -->
          <div class="pt-2 border-t border-black/8 dark:border-white/8 flex items-center justify-between gap-2" @click.stop>
            <span class="text-[10px] text-slate-400 dark:text-white/40 shrink-0">
              {{ $t('skill.distributedCount', { count: skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length }) }}
            </span>
            <AgentPillPicker :skill="skill" />
          </div>
        </div>

        <div v-if="displaySkills.length === 0" class="col-span-full py-12 text-center text-slate-400 dark:text-white/40">
          <p class="text-xs">{{ $t('skill.empty') }}</p>
        </div>
      </div>
    </div>

    <!-- Floating Batch Action Bar -->
    <transition name="fade">
      <div
        v-if="store.selectedSkillIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-xl bg-white/95 dark:bg-[#121316]/90 border border-black/10 dark:border-white/12 backdrop-blur-xl flex items-center gap-4 text-xs text-slate-900 dark:text-white shadow-xl dark:shadow-none"
      >
        <div class="flex items-center gap-2 font-medium text-slate-900 dark:text-white/90">
          <span class="w-2 h-2 rounded-sm bg-[#3b82f6]"></span>
          <span>{{ $t('skill.selectedCount', { count: store.selectedSkillIds.length }) }}</span>
        </div>

        <div class="h-4 w-[1px] bg-black/10 dark:bg-white/10"></div>

        <div class="flex items-center gap-2">
          <button
            @click="batchMountToActive"
            class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 font-medium flex items-center gap-1 transition-colors duration-200"
          >
            <Zap class="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>{{ $t('skill.distributeAll') }}</span>
          </button>
          <button
            @click="batchUnmountAll"
            class="px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 border border-black/10 dark:border-white/12 font-medium transition-colors duration-200"
          >
            {{ $t('skill.unmountAll') }}
          </button>
          <button
            @click="store.selectedSkillIds = []"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
            :title="$t('skill.cancelSelectTitle')"
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
import { t } from '../i18n';
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
  blue: 'bg-[#3b82f6]/10 border-[#3b82f6]/20 text-[#3b82f6]',
  green: 'bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]',
  amber: 'bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b]',
  purple: 'bg-[#8b5cf6]/10 border-[#8b5cf6]/20 text-[#8b5cf6]',
  gray: 'bg-black/5 dark:bg-[#121316] border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80',
};
const SOURCE_BADGE: Record<string, string> = {
  blue: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30',
  green: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30',
  amber: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
  purple: 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30',
  gray: 'bg-black/5 dark:bg-white/6 text-slate-500 dark:text-white/60 border-black/8 dark:border-white/8',
};
const SOURCE_TEXT: Record<string, string> = {
  blue: 'text-[#3b82f6]',
  green: 'text-[#22c55e]',
  amber: 'text-[#f59e0b]',
  purple: 'text-[#8b5cf6]',
  gray: 'text-slate-400 dark:text-white/50',
};

function sourceMeta(skill: SkillItem): { tone: string; label: string } {
  if (skill.id === 'agenthub-sync') return { tone: 'blue', label: t('skill.sourceBuiltinLabel') };
  switch (skill.source) {
    case 'central': return { tone: 'blue', label: t('skill.sourceCentralLabel') };
    case 'npx': return { tone: 'amber', label: t('skill.sourceNpxLabel') };
    case 'imported': return { tone: 'purple', label: t('skill.sourceImportedLabel') };
    default: return { tone: 'gray', label: skill.source || t('skill.sourceManual') };
  }
}

// 分发状态着色：全部分发=蓝 / 部分分发=琥珀 / 未分发=灰
function mountCountClass(skill: SkillItem): string {
  const count = skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
  const active = store.agents.filter(a => a.detected && a.enabled).length;
  if (active > 0 && count === active) return 'text-[#3b82f6]';
  if (count > 0) return 'text-[#f59e0b]';
  return 'text-slate-400 dark:text-white/40';
}

// 卡片顶部发丝强调线（保持素雅统一）
function cardAccentBorder(skill: SkillItem): string {
  const count = skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
  if (count === 0) return 'border-t-black/10 dark:border-t-white/10';
  return '';
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
    content: t('skill.template'),
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
  if (confirm(t('skill.deleteConfirm', { name: skill.name }))) {
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

