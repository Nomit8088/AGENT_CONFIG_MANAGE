<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
    <transition-group name="fade">
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        class="pointer-events-auto p-3.5 rounded-xl border border-black/10 dark:border-white/12 bg-white/95 dark:bg-[#121316]/95 backdrop-blur-xl shadow-lg dark:shadow-none flex items-start gap-3 transition-colors duration-200 text-slate-900 dark:text-white/90"
      >
        <div class="flex-shrink-0 mt-0.5">
          <CheckCircle2 v-if="toast.type === 'success'" class="w-4 h-4 text-[#22c55e]" />
          <AlertTriangle v-else-if="toast.type === 'warning'" class="w-4 h-4 text-[#f59e0b]" />
          <AlertCircle v-else-if="toast.type === 'error'" class="w-4 h-4 text-[#ef4444]" />
          <Info v-else class="w-4 h-4 text-[#3b82f6]" />
        </div>

        <div class="flex-1 min-w-0">
          <h4 class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">{{ toast.title }}</h4>
          <p class="text-[11px] text-slate-600 dark:text-white/60 leading-tight mt-0.5">{{ toast.message }}</p>
        </div>

        <button
          @click="store.removeToast(toast.id)"
          class="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 p-0.5 rounded-lg transition-colors duration-200 flex-shrink-0"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/useAppStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-vue-next';

const store = useAppStore();
</script>

