<template>
  <div
    v-if="store.addProjectModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
  >
    <div class="bg-white dark:bg-[#121316] w-full max-w-lg rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none space-y-5 text-slate-900 dark:text-white transition-colors duration-200 max-h-[85vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-black/5 dark:bg-[#1c1d22] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white/80">
            <FolderGit2 class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('project.addTitle') }}</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">{{ $t('project.addSubtitle') }}</p>
          </div>
        </div>
        <button
          @click="close"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">{{ $t('project.pathLabel') }}</label>
          <input
            v-model="form.path"
            @input="autoExtractName"
            type="text"
            :placeholder="$t('project.pathPlaceholder')"
            class="w-full bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
        </div>

        <div>
          <label class="block text-slate-700 dark:text-white/70 font-medium mb-1">{{ $t('project.nameLabel') }}</label>
          <input
            v-model="form.name"
            type="text"
            :placeholder="$t('project.namePlaceholder')"
            class="w-full bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          />
        </div>

        <div class="p-3 rounded-lg bg-black/[0.02] dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 space-y-1.5">
          <div class="flex items-center gap-2 text-slate-900 dark:text-white/90 font-semibold">
            <ShieldCheck class="w-4 h-4 text-slate-700 dark:text-white/80" />
            <span>{{ $t('project.guardReady') }}</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-white/50 leading-relaxed">
            {{ $t('project.guardDesc') }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-black/8 dark:border-white/8">
        <button
          @click="close"
          class="px-4 py-2 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white/95 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="handleSubmit"
          :disabled="!form.path.trim()"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 disabled:opacity-50 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
        >
          {{ $t('project.confirmAdopt') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { FolderGit2, X, ShieldCheck } from 'lucide-vue-next';

const store = useAppStore();

const form = reactive({
  path: '',
  name: '',
});

function autoExtractName() {
  if (!form.name && form.path) {
    const parts = form.path.split(/[\/\\]/).filter(Boolean);
    if (parts.length > 0) {
      form.name = parts[parts.length - 1];
    }
  }
}

function close() {
  store.addProjectModal.visible = false;
}

async function handleSubmit() {
  if (!form.path.trim()) return;
  await store.addProject(form.path.trim(), form.name.trim());
  close();
}
</script>

