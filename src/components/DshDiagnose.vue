<template>
  <div class="space-y-4">
    <!-- Diagnose controls -->
    <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 border-t-[#8b5cf6]/60 p-4 space-y-3 transition-colors duration-200">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6]">
          <Stethoscope class="w-3.5 h-3.5" />
        </div>
        <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">{{ $t('dshPlugin.diagnoseTitle') }}</h3>
      </div>

      <div class="flex items-end gap-3">
        <div class="space-y-1 flex-1">
          <label class="block text-xs text-slate-500 dark:text-white/50">Profile</label>
          <input
            v-model="profile"
            type="text"
            placeholder="web"
            class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-[#8b5cf6]/40 dark:focus:border-[#8b5cf6]/40 transition-colors duration-200"
          />
        </div>
        <button
          @click="handleDiagnose"
          :disabled="store.dshDiagnosing"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.dshDiagnosing }" />
          <span>{{ store.dshDiagnosing ? $t('dshPlugin.diagnoseDiagnosing') : $t('dshPlugin.diagnoseStart') }}</span>
        </button>
      </div>

      <p class="text-[11px] text-slate-400 dark:text-white/50">
        {{ $t('dshPlugin.diagnoseDesc') }}
      </p>
    </div>

    <!-- Result -->
    <template v-if="store.dshDiagnose">
      <!-- Healthy -->
      <div
        v-if="store.dshDiagnose.ok"
        class="rounded-xl bg-[#22c55e]/5 border border-[#22c55e]/20 p-3 flex items-center gap-2 text-xs text-[#22c55e] transition-colors duration-200"
      >
        <CheckCircle class="w-4 h-4 shrink-0" />
        <span>{{ $t('dshPlugin.diagnosePassed') }}</span>
      </div>

      <template v-else>
        <!-- Hint (non-plugin failure) -->
        <div
          v-if="store.dshDiagnose.hint"
          class="rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/20 p-3 flex items-start gap-2 text-xs text-[#f59e0b] transition-colors duration-200"
        >
          <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{{ store.dshDiagnose.hint }}</span>
        </div>

        <!-- Failed plugins + actions -->
        <div
          v-if="store.dshDiagnose.suggestedActions.length > 0"
          class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 p-4 space-y-3 transition-colors duration-200"
        >
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
              <Bug class="w-3.5 h-3.5" />
            </div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">{{ $t('dshPlugin.diagnoseSuggestTitle') }}</h3>
          </div>

          <div
            v-for="(action, i) in store.dshDiagnose.suggestedActions"
            :key="`${action.kind}-${action.target}-${i}`"
            class="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8"
          >
            <div class="min-w-0">
              <div class="text-xs text-slate-900 dark:text-white/90">{{ action.description }}</div>
              <div class="text-[11px] font-mono text-slate-400 dark:text-white/50">{{ action.kind }} · {{ action.target }}</div>
            </div>
            <button
              @click="applyAction(action)"
              class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200 shrink-0"
            >
              {{ $t('dshPlugin.diagnoseCloseRetry') }}
            </button>
          </div>
        </div>

        <!-- Raw stderr -->
        <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 overflow-hidden transition-colors duration-200">
          <div class="px-3 py-2 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#121316] flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('dshPlugin.diagnoseCrashOutput') }}</span>
              <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">exit {{ store.dshDiagnose.exitCode ?? '?' }}</span>
            </div>
            <button
              v-if="store.dshDiagnose.rawStderr"
              @click="copyStderr"
              class="px-2 py-0.5 rounded-md bg-black/5 hover:bg-black/10 dark:bg-white/6 dark:hover:bg-white/10 text-[11px] font-medium text-slate-600 dark:text-white/70 flex items-center gap-1 transition-colors duration-200"
              :title="$t('dshPlugin.diagnoseCopyOutput')"
            >
              <Copy class="w-3 h-3" />
              <span>{{ copiedStderr ? $t('common.copied') : $t('dshPlugin.diagnoseCopyLog') }}</span>
            </button>
          </div>
          <pre class="p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-700 dark:text-white/70 whitespace-pre-wrap select-text max-h-64">{{ store.dshDiagnose.rawStderr || $t('dshPlugin.diagnoseNoOutput') }}</pre>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { t, translateError } from '../i18n';
import { Stethoscope, RefreshCw, AlertTriangle, Bug, CheckCircle, Copy } from 'lucide-vue-next';
import type { DshRecoveryAction } from '../types';

const store = useAppStore();
const profile = ref('web');
const copiedStderr = ref(false);

async function handleDiagnose() {
  try {
    await store.diagnoseDshWeb(profile.value.trim() || 'web');
  } catch (e: any) {
    store.showToast({
      title: t('dshPlugin.diagnoseToastFailed'),
      message: translateError(e, 'dshPlugin.diagnoseToastFailedMsg'),
      type: 'error',
    });
  }
}

async function applyAction(action: DshRecoveryAction) {
  try {
    await store.applyDshRecovery(action);
    // 应用后自动重试诊断
    await store.diagnoseDshWeb(profile.value.trim() || 'web');
  } catch (e: any) {
    store.showToast({
      title: t('dshPlugin.diagnoseToastFixFailed'),
      message: translateError(e, 'dshPlugin.diagnoseToastFixFailedMsg'),
      type: 'error',
    });
  }
}

async function copyStderr() {
  if (!store.dshDiagnose?.rawStderr) return;
  try {
    await navigator.clipboard.writeText(store.dshDiagnose.rawStderr);
    copiedStderr.value = true;
    setTimeout(() => { copiedStderr.value = false; }, 2000);
  } catch (e) {}
}
</script>
