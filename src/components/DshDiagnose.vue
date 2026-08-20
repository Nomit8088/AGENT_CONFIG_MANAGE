<template>
  <div class="space-y-4">
    <!-- Diagnose controls -->
    <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-4 space-y-3 transition-colors duration-200">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-black/5 dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/80">
          <Stethoscope class="w-3.5 h-3.5" />
        </div>
        <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">启动失败诊断</h3>
      </div>

      <div class="flex items-end gap-3">
        <div class="space-y-1 flex-1">
          <label class="block text-xs text-slate-500 dark:text-white/50">Profile</label>
          <input
            v-model="profile"
            type="text"
            placeholder="web"
            class="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-slate-800 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors duration-200"
          />
        </div>
        <button
          @click="handleDiagnose"
          :disabled="store.dshDiagnosing"
          class="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': store.dshDiagnosing }" />
          <span>{{ store.dshDiagnosing ? '诊断中…' : '开始诊断' }}</span>
        </button>
      </div>

      <p class="text-[11px] text-slate-400 dark:text-white/50">
        将拉起 <span class="font-mono">dsh web</span> 并捕获崩溃输出；15 秒内未退出则判定健康并自动结束诊断实例。
      </p>
    </div>

    <!-- Result -->
    <template v-if="store.dshDiagnose">
      <!-- Healthy -->
      <div
        v-if="store.dshDiagnose.ok"
        class="rounded-xl bg-[#30d158]/5 border border-[#30d158]/20 p-3 flex items-center gap-2 text-xs text-[#30d158] transition-colors duration-200"
      >
        <CheckCircle class="w-4 h-4 shrink-0" />
        <span>诊断通过：DSH 在 15 秒内稳定运行，未发现插件启动失败。</span>
      </div>

      <template v-else>
        <!-- Hint (non-plugin failure) -->
        <div
          v-if="store.dshDiagnose.hint"
          class="rounded-xl bg-[#ff9f0a]/5 border border-[#ff9f0a]/20 p-3 flex items-start gap-2 text-xs text-[#ff9f0a] transition-colors duration-200"
        >
          <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{{ store.dshDiagnose.hint }}</span>
        </div>

        <!-- Failed plugins + actions -->
        <div
          v-if="store.dshDiagnose.suggestedActions.length > 0"
          class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 p-4 space-y-3 transition-colors duration-200"
        >
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[#ff453a]/10 border border-[#ff453a]/20 flex items-center justify-center text-[#ff453a]">
              <Bug class="w-3.5 h-3.5" />
            </div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/90">建议修复动作</h3>
          </div>

          <div
            v-for="(action, i) in store.dshDiagnose.suggestedActions"
            :key="`${action.kind}-${action.target}-${i}`"
            class="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#1c1c1e] border border-black/8 dark:border-white/8"
          >
            <div class="min-w-0">
              <div class="text-xs text-slate-900 dark:text-white/90">{{ action.description }}</div>
              <div class="text-[11px] font-mono text-slate-400 dark:text-white/50">{{ action.kind }} · {{ action.target }}</div>
            </div>
            <button
              @click="applyAction(action)"
              class="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#3a3a3c] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200 shrink-0"
            >
              关闭并重试
            </button>
          </div>
        </div>

        <!-- Raw stderr -->
        <div class="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/8 dark:border-white/8 overflow-hidden transition-colors duration-200">
          <div class="px-3 py-2 border-b border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-[#1c1c1e] flex items-center justify-between">
            <span class="text-xs font-serif font-semibold text-slate-900 dark:text-white/90">崩溃输出</span>
            <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">exit {{ store.dshDiagnose.exitCode ?? '?' }}</span>
          </div>
          <pre class="p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-700 dark:text-white/70 whitespace-pre-wrap select-text">{{ store.dshDiagnose.rawStderr || '(无输出)' }}</pre>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Stethoscope, RefreshCw, AlertTriangle, Bug, CheckCircle } from 'lucide-vue-next';
import type { DshRecoveryAction } from '../types';

const store = useAppStore();
const profile = ref('web');

async function handleDiagnose() {
  try {
    await store.diagnoseDshWeb(profile.value.trim() || 'web');
  } catch (e: any) {
    store.showToast({
      title: '诊断失败',
      message: e?.message || '无法执行诊断',
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
      title: '修复失败',
      message: e?.message || '无法应用恢复动作',
      type: 'error',
    });
  }
}
</script>
