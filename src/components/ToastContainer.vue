<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
    <transition-group name="fade">
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md flex items-start gap-3 transition-all duration-300',
          toast.type === 'success' ? 'bg-white dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-500/40 text-slate-800 dark:text-emerald-100' :
          toast.type === 'warning' ? 'bg-white dark:bg-amber-950/90 border-amber-300 dark:border-amber-500/40 text-slate-800 dark:text-amber-100' :
          toast.type === 'error' ? 'bg-white dark:bg-red-950/90 border-red-300 dark:border-red-500/40 text-slate-800 dark:text-red-100' :
          'bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'
        ]"
      >
        <div class="flex-shrink-0 mt-0.5">
          <CheckCircle2 v-if="toast.type === 'success'" class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTriangle v-else-if="toast.type === 'warning'" class="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <AlertCircle v-else-if="toast.type === 'error'" class="w-4 h-4 text-red-600 dark:text-red-400" />
          <Info v-else class="w-4 h-4 text-sky-600 dark:text-sky-400" />
        </div>

        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-xs">{{ toast.title }}</h4>
          <p class="text-[11px] text-slate-600 dark:text-slate-300 dark:opacity-90 leading-tight mt-0.5">{{ toast.message }}</p>
        </div>

        <button
          @click="store.removeToast(toast.id)"
          class="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded transition flex-shrink-0"
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
