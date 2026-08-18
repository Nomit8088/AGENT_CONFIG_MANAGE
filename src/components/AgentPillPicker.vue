<template>
  <div class="relative inline-block text-left" ref="containerRef">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      @click.stop="toggleOpen"
      type="button"
      :class="[
        'px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition',
        isOpen
          ? 'bg-brand-50 text-brand-700 border-brand-300 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-500/40 shadow-sm'
          : 'bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-dark-700 hover:border-slate-300 dark:hover:border-slate-600'
      ]"
    >
      <Plus class="w-3 h-3 text-brand-600 dark:text-brand-400" />
      <span>分发至 Agent...</span>
      <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-dark-950 font-mono text-brand-700 dark:text-brand-400 font-bold">
        {{ mountedEnabledCount }}/{{ store.enabledAgents.length }}
      </span>
    </button>

    <!-- Teleported Floating Popover Dropdown (Escapes all parent overflow/clipping) -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="popoverRef"
        @click.stop
        :style="popoverStyle"
        class="fixed w-72 rounded-2xl bg-white/98 dark:bg-dark-900/98 border border-slate-200 dark:border-dark-700 shadow-2xl z-[9999] p-3 space-y-2.5 backdrop-blur-2xl animate-fade select-none text-xs"
      >
        <!-- Popover Top Header: Quick Actions -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-2">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-xs text-slate-900 dark:text-slate-100">挂载 Agent 目标</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 font-mono">
              {{ skill.name }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="selectAllActive"
              class="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 dark:bg-brand-500/15 dark:hover:bg-brand-500/25 dark:text-brand-400 dark:border-brand-500/30 font-medium transition active:scale-95"
            >
              ⚡ 全选活跃
            </button>
            <button
              @click="unmountAll"
              class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-dark-800 dark:hover:bg-dark-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
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
            class="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-brand-500 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>

        <!-- Agent List (Checkboxes) -->
        <div class="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
          <label
            v-for="agent in filteredAgents"
            :key="agent.id"
            :class="[
              'flex items-center justify-between p-2 rounded-xl cursor-pointer transition border',
              skill.mountedAgents.includes(agent.id)
                ? 'bg-emerald-50 border-emerald-300 text-slate-900 dark:bg-emerald-500/10 dark:border-emerald-500/35 dark:text-slate-100'
                : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60 text-slate-700 dark:bg-dark-950/60 dark:border-dark-800/80 dark:hover:bg-dark-800/60 dark:text-slate-300'
            ]"
          >
            <div class="flex items-center gap-2 truncate">
              <input
                type="checkbox"
                :checked="skill.mountedAgents.includes(agent.id)"
                @change="(e) => handleToggle(agent.id, (e.target as HTMLInputElement).checked)"
                class="custom-checkbox flex-shrink-0"
              />
              <div class="w-5 h-5 rounded-md bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 flex items-center justify-center flex-shrink-0">
                <AgentBrandIcon :agentId="agent.id" size="sm" />
              </div>
              <div class="truncate">
                <div class="font-medium flex items-center gap-1.5">
                  <span class="truncate">{{ agent.name }}</span>
                  <span
                    :class="[
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      agent.detected ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-400 dark:bg-slate-600'
                    ]"
                  ></span>
                </div>
                <div class="text-[10px] text-slate-500 font-mono truncate max-w-[140px]" :title="agent.skillsDir">
                  {{ agent.skillsDir }}
                </div>
              </div>
            </div>

            <span
              :class="[
                'text-[10px] font-mono px-1.5 py-0.2 rounded flex-shrink-0',
                skill.mountedAgents.includes(agent.id)
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold'
                  : 'text-slate-400 dark:text-slate-500'
              ]"
            >
              {{ skill.mountedAgents.includes(agent.id) ? '已软链' : '未挂载' }}
            </span>
          </label>

          <div v-if="filteredAgents.length === 0" class="py-4 text-center text-slate-400 dark:text-slate-500 text-xs">
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

const filteredAgents = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = store.enabledAgents;
  if (!q) return list;
  return list.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
});

const mountedEnabledCount = computed(() => {
  return props.skill.mountedAgents.filter(id => store.isAgentEnabled(id)).length;
});

function calculatePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const popoverWidth = 288; // w-72 = 18rem = 288px
  const popoverHeight = 280; // approximate height with max-h-56 list

  // Check vertical space
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  let top = rect.bottom + 8; // default downwards
  if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
    // Flip upwards if not enough space below
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

function handleToggle(agentId: string, enable: boolean) {
  store.toggleSkillForAgent(props.skill.id, agentId, enable);
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
