<template>
  <div class="relative inline-block text-left" ref="containerRef">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      @click.stop="toggleOpen"
      type="button"
      :class="[
        'px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors duration-200',
        isOpen
          ? 'bg-black/10 dark:bg-[#282a32] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20'
          : 'bg-black/5 dark:bg-[#1c1d22] hover:bg-black/10 dark:hover:bg-[#343437] text-slate-700 dark:text-white/80 border-black/8 dark:border-white/10'
      ]"
    >
      <Plus class="w-3 h-3 text-slate-600 dark:text-white/80" />
      <span>分发至 Agent...</span>
      <span class="text-[10px] px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/6 font-mono text-slate-600 dark:text-white/70 font-semibold">
        {{ mountedEnabledCount }}/{{ store.enabledAgents.length }}
      </span>
    </button>

    <!-- Teleported Floating Popover Dropdown -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="popoverRef"
        @click.stop
        :style="popoverStyle"
        class="fixed w-72 rounded-xl bg-white/95 dark:bg-[#121316]/95 border border-black/10 dark:border-white/12 z-[9999] p-3 space-y-2.5 backdrop-blur-xl select-none text-xs text-slate-900 dark:text-white/90 shadow-lg dark:shadow-none"
      >
        <!-- Popover Top Header: Quick Actions -->
        <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-2">
          <div class="flex items-center gap-1.5">
            <span class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">挂载 Agent 目标</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/6 text-slate-600 dark:text-white/60 font-mono">
              {{ skill.name }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="selectAllActive"
              class="text-[10px] px-1.5 py-0.5 rounded-md bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-700 dark:text-white/80 border border-black/10 dark:border-white/12 font-medium transition-colors duration-200"
            >
              ⚡ 全选活跃
            </button>
            <button
              @click="unmountAll"
              class="text-[10px] px-1.5 py-0.5 rounded-md bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-400 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/80 border border-black/8 dark:border-white/8 transition-colors duration-200"
            >
              清空
            </button>
          </div>
        </div>

        <!-- Search Filter if many agents -->
        <div v-if="store.agents.length > 4" class="relative">
          <input
            v-model="search"
            type="text"
            placeholder="搜索/过滤 Agent..."
            class="w-full bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white/90 focus:outline-none focus:border-black/25 dark:focus:border-white/25 placeholder-slate-400 dark:placeholder-white/30 transition-colors duration-200"
          />
        </div>

        <!-- Agent List (Checkboxes) -->
        <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
          <div
            v-for="agent in filteredAgents"
            :key="agent.id"
            @click="handleRowClick(agent.id)"
            :class="[
              'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-200 border',
              isMounted(agent.id)
                ? 'bg-black/5 dark:bg-white/8 border-black/10 dark:border-white/15 text-slate-900 dark:text-white/95 font-medium'
                : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white/80'
            ]"
          >
            <div class="flex items-center gap-2 truncate">
              <input
                type="checkbox"
                :checked="isMounted(agent.id)"
                @click.stop
                @change="handleRowClick(agent.id)"
                class="custom-checkbox flex-shrink-0"
              />
              <div class="w-5 h-5 rounded-md bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                <AgentBrandIcon :agentId="agent.id" size="sm" />
              </div>
              <div class="truncate">
                <div class="font-medium flex items-center gap-1.5">
                  <span class="truncate">{{ agent.name }}</span>
                  <span
                    :class="[
                      'w-1.5 h-1.5 rounded-sm flex-shrink-0',
                      agent.detected ? 'bg-[#22c55e]' : 'bg-slate-300 dark:bg-white/30'
                    ]"
                  ></span>
                </div>
                <div class="text-[10px] text-slate-400 dark:text-white/40 font-mono truncate max-w-[140px]" :title="agent.skillsDir">
                  {{ agent.skillsDir }}
                </div>
              </div>
            </div>

            <span
              :class="[
                'text-[10px] font-mono px-1.5 py-0.2 rounded-md flex-shrink-0 border',
                isMounted(agent.id)
                  ? 'bg-black/5 dark:bg-white/10 text-slate-800 dark:text-white/90 border-black/8 dark:border-white/12 font-medium'
                  : 'text-slate-400 dark:text-white/30 border-transparent'
              ]"
            >
              {{ isMounted(agent.id) ? '已软链' : '未挂载' }}
            </span>
          </div>

          <div v-if="filteredAgents.length === 0" class="py-4 text-center text-slate-400 dark:text-white/40 text-xs">
            未找到匹配的 Agent
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { SkillItem } from '../types';
import AgentBrandIcon from './AgentBrandIcon.vue';
import { Plus } from 'lucide-vue-next';

const props = defineProps<{
  skill: SkillItem;
}>();

const store = useAppStore();
const isOpen = ref(false);
const search = ref('');
const containerRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);

// Position coordinates for the floating popover
const popoverCoords = ref({ top: 0, left: 0 });

const popoverStyle = computed(() => {
  return {
    top: `${popoverCoords.value.top}px`,
    left: `${popoverCoords.value.left}px`,
  };
});

const currentSkill = computed(() => {
  return store.skills.find(s => s.id === props.skill.id) || props.skill;
});

const filteredAgents = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = store.enabledAgents;
  if (!q) return list;
  return list.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
});

const mountedEnabledCount = computed(() => {
  return currentSkill.value.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
});

function isMounted(agentId: string): boolean {
  return currentSkill.value.mountedAgents.includes(agentId);
}

function handleRowClick(agentId: string) {
  const willEnable = !isMounted(agentId);
  store.toggleSkillForAgent(props.skill.id, agentId, willEnable);
}

function calculatePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const popoverWidth = 288;
  const popoverHeight = 280;

  // Check vertical space
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  let top = rect.bottom + 8;
  if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
    top = Math.max(10, rect.top - popoverHeight - 8);
  }

  // Horizontal position: align to right of trigger button, or clamp within screen bounds
  let left = rect.right - popoverWidth;
  if (left < 16) {
    left = Math.max(16, rect.left);
  }
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }

  popoverCoords.value = { top, left };
}

function toggleOpen() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    calculatePosition();
    nextTick(() => {
      calculatePosition();
    });
  }
}

function close() {
  isOpen.value = false;
}

function selectAllActive() {
  store.mountSkillToAllActive(props.skill.id);
}

function unmountAll() {
  store.unmountSkillFromAll(props.skill.id);
}

function handleClickOutside(e: MouseEvent) {
  if (
    isOpen.value &&
    containerRef.value &&
    !containerRef.value.contains(e.target as Node) &&
    popoverRef.value &&
    !popoverRef.value.contains(e.target as Node)
  ) {
    close();
  }
}

function handleWindowChange() {
  if (isOpen.value) {
    calculatePosition();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleWindowChange);
  window.addEventListener('scroll', handleWindowChange, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleWindowChange);
  window.removeEventListener('scroll', handleWindowChange, true);
});
</script>

