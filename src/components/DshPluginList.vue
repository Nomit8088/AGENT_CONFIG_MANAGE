<template>
  <div class="space-y-4">
    <!-- Empty state -->
    <div
      v-if="!store.dshPluginsScan || store.dshPluginsScan.profiles.length === 0"
      class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-8 text-center transition-colors duration-200"
    >
      <div class="mx-auto w-10 h-10 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-white/50">
        <Puzzle class="w-5 h-5" />
      </div>
      <p class="mt-3 font-serif text-sm text-slate-900 dark:text-white/90">未发现 DSH profile</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-white/50">
        请先在 <span class="font-mono">{{ store.dshPluginsScan?.homeDir || '~/.dsh' }}\profiles\</span> 下创建 profile
      </p>
    </div>

    <template v-else>
      <!-- Profile selector -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-slate-500 dark:text-white/50">Profile：</span>
        <button
          v-for="p in store.dshPluginsScan.profiles"
          :key="p.name"
          @click="selectedProfile = p.name"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors duration-200',
            selectedProfile === p.name
              ? 'bg-black/5 dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 border-black/15 dark:border-white/20 font-medium'
              : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-white/70 border-black/8 dark:border-white/8 hover:text-slate-900 dark:hover:text-white/95'
          ]"
        >
          {{ p.name }}
        </button>
      </div>

      <!-- Plugins of selected profile -->
      <div v-if="selected" class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <div class="text-slate-500 dark:text-white/50">
            共 <span class="font-mono text-slate-800 dark:text-white/90">{{ selected.plugins.length }}</span> 个插件条目
          </div>
          <div class="font-mono text-[11px] text-slate-400 dark:text-white/40 break-all">{{ selected.dir }}</div>
        </div>

        <div
          v-for="plugin in selected.plugins"
          :key="plugin.key"
          class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-3.5 flex items-center gap-3 transition-colors duration-200"
        >
          <!-- Kind icon -->
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80 shrink-0">
            <Package v-if="plugin.kind === 'bundle' || plugin.kind === 'inbox'" class="w-4 h-4" />
            <CircleDot v-else-if="plugin.kind === 'plain'" class="w-4 h-4" />
            <ListTree v-else class="w-4 h-4" />
          </div>

          <!-- Name & meta -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs text-slate-900 dark:text-white/90 break-all">{{ plugin.name }}</span>
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.5 rounded-md font-mono border',
                  kindBadgeClass(plugin.kind)
                ]"
              >
                {{ kindLabel(plugin.kind) }}
              </span>
              <span
                v-if="plugin.portability === 'unportable'"
                class="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-[#ff9f0a]/10 text-[#ff9f0a] border border-[#ff9f0a]/30"
              >
                不可移植
              </span>
            </div>
            <div class="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/50 font-mono">
              <span v-if="plugin.spec" class="truncate">spec: {{ plugin.spec }}</span>
              <span v-if="plugin.installedVersion">· v{{ plugin.installedVersion }}</span>
              <span v-if="plugin.disabledBy">· 已由 patch 停用</span>
            </div>
          </div>

          <!-- Toggle + Uninstall -->
          <div v-if="plugin.kind === 'inbox'" class="text-[11px] text-slate-400 dark:text-white/40 font-mono shrink-0">
            内置
          </div>
          <div v-else class="flex items-center gap-2 shrink-0">
            <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs">
              <button
                type="button"
                @click="toggle(plugin, true)"
                :class="[
                  'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                  plugin.enabled
                    ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                ]"
              >
                <span v-if="plugin.enabled" class="w-1.5 h-1.5 rounded-sm bg-[#30d158]"></span>
                <span>启用</span>
              </button>
              <button
                type="button"
                @click="toggle(plugin, false)"
                :class="[
                  'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                  !plugin.enabled
                    ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                    : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                ]"
              >
                <span>停用</span>
              </button>
            </div>
            <button
              type="button"
              @click="remove(plugin)"
              title="卸载（从 dependencies / bundles / patch 中彻底移除）"
              class="p-1.5 rounded-lg bg-transparent hover:bg-[#ff453a]/10 text-slate-400 hover:text-[#ff453a] dark:text-white/40 dark:hover:text-[#ff453a] border border-transparent hover:border-[#ff453a]/30 transition-colors duration-200"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Package, CircleDot, ListTree, Puzzle, Trash2 } from 'lucide-vue-next';
import type { DshPluginEntry, DshPluginKind } from '../types';

const store = useAppStore();

const selectedProfile = ref('');

watch(
  () => store.dshPluginsScan?.profiles,
  (profiles) => {
    if (profiles && profiles.length > 0 && !profiles.some(p => p.name === selectedProfile.value)) {
      selectedProfile.value = profiles[0].name;
    }
  },
  { immediate: true }
);

const selected = computed(() =>
  store.dshPluginsScan?.profiles.find(p => p.name === selectedProfile.value)
);

function kindLabel(kind: DshPluginKind): string {
  switch (kind) {
    case 'inbox': return '内置';
    case 'bundle': return 'bundle';
    case 'plain': return '依赖';
    case 'row': return 'patch 行';
  }
}

function kindBadgeClass(kind: DshPluginKind): string {
  switch (kind) {
    case 'inbox':
      return 'bg-[#0a84ff]/10 text-[#0a84ff] border-[#0a84ff]/30';
    case 'bundle':
      return 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30';
    case 'plain':
      return 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10';
    case 'row':
      return 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/30';
  }
}

async function toggle(plugin: DshPluginEntry, enabled: boolean) {
  if (plugin.enabled === enabled) return;
  try {
    await store.toggleDshPlugin(plugin.profileName, plugin.key, enabled);
  } catch (e: any) {
    store.showToast({
      title: '切换失败',
      message: e?.message || '无法切换插件状态',
      type: 'error',
    });
  }
}

async function remove(plugin: DshPluginEntry) {
  const ok = window.confirm(
    `确认卸载插件「${plugin.name}」？\n\n` +
    `将从 profile [${plugin.profileName}] 的 package.json（dependencies / bundles）或 cordis.patch.yml 中彻底移除，并尽力清理 node_modules。`
  );
  if (!ok) return;
  try {
    await store.removeDshPlugin(plugin.profileName, plugin.key);
  } catch (e: any) {
    store.showToast({
      title: '卸载失败',
      message: e?.message || '无法卸载插件',
      type: 'error',
    });
  }
}
</script>
