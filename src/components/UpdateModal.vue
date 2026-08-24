<template>
  <div
    v-if="store.updateModal.visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-colors duration-200"
    @click.self="store.closeUpdateModal()"
  >
    <div class="bg-white dark:bg-[#121316] w-full max-w-md rounded-xl p-6 border border-black/10 dark:border-white/12 shadow-2xl dark:shadow-none space-y-5 text-slate-900 dark:text-white transition-colors duration-200 max-h-[85vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-black/8 dark:border-white/8 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6]">
            <PackageOpen class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('update.title') }}</h3>
            <p class="text-xs text-slate-500 dark:text-white/50">{{ $t('update.subtitle') }}</p>
          </div>
        </div>
        <button
          @click="store.closeUpdateModal()"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors duration-200"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 检查中 -->
      <div v-if="store.appUpdateChecking" class="flex items-center justify-center gap-2 py-6 text-slate-500 dark:text-white/60 text-xs">
        <RefreshCw class="w-4 h-4 animate-spin" />
        <span>{{ $t('update.checking') }}</span>
      </div>

      <!-- 检查失败 / 无数据 -->
      <div v-else-if="!store.appUpdate" class="space-y-3">
        <div class="text-xs text-slate-500 dark:text-white/60 text-center py-4">
          {{ $t('update.notChecked') }}
        </div>
        <button
          @click="store.checkAppUpdate()"
          class="w-full px-3 py-2 rounded-lg bg-[#3b82f6]/10 hover:bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>{{ $t('update.check') }}</span>
        </button>
      </div>

      <!-- 已是最新 -->
      <div v-else-if="!store.appUpdate.updateAvailable" class="space-y-4">
        <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] text-xs">
          <CheckCircle2 class="w-4 h-4 flex-shrink-0" />
          <span>{{ $t('update.latest') }}</span>
        </div>
        <div class="font-mono text-[11px] text-slate-500 dark:text-white/60 px-1">
          v{{ store.appUpdate.currentVersion }}
        </div>
        <div v-if="store.appUpdate.error" class="px-3 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-[11px] font-mono whitespace-pre-wrap">
          {{ store.appUpdate.error }}
        </div>
        <button
          @click="store.checkAppUpdate()"
          class="w-full px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#1c1d22] dark:hover:bg-white/10 text-slate-700 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>{{ $t('update.recheck') }}</span>
        </button>
      </div>

      <!-- 有更新 -->
      <div v-else class="space-y-4">
        <!-- 版本对比 -->
        <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20">
          <div class="flex items-center gap-2 text-xs">
            <span class="font-mono text-slate-500 dark:text-white/60 line-through">v{{ store.appUpdate.currentVersion }}</span>
            <ArrowRight class="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
            <span class="font-mono font-semibold text-[#3b82f6]">v{{ store.appUpdate.latestVersion }}</span>
          </div>
          <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 font-medium">
            {{ $t('update.available') }}
          </span>
        </div>

        <!-- 更新日志 -->
        <div v-if="store.appUpdate.releaseNotes" class="space-y-1.5">
          <div class="text-[11px] text-slate-500 dark:text-white/50 font-medium">{{ $t('update.notes') }}</div>
          <div class="max-h-40 overflow-y-auto p-3 rounded-lg bg-black/[0.03] dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-white/70 whitespace-pre-wrap">
            {{ store.appUpdate.releaseNotes }}
          </div>
        </div>

        <!-- 下载进度 -->
        <div v-if="store.appUpdateDownloading" class="space-y-2">
          <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
            <span>{{ $t('update.downloading') }}</span>
            <span class="font-mono">{{ store.appUpdateProgress }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
            <div
              class="h-full rounded-full bg-[#3b82f6] transition-all duration-200 ease-out"
              :style="{ width: store.appUpdateProgress + '%' }"
            />
          </div>
        </div>

        <!-- 下载错误 -->
        <div v-if="store.appUpdateError" class="px-3 py-2 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-[11px] font-mono whitespace-pre-wrap">
          {{ store.appUpdateError }}
        </div>

        <!-- 操作按钮 -->
        <div v-if="!store.appUpdateDownloading" class="space-y-2 pt-1">
          <button
            v-if="!store.appUpdateDownloadedPath"
            @click="onDownload"
            class="w-full px-3 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5"
          >
            <Download class="w-3.5 h-3.5" />
            <span>{{ $t('update.download') }}</span>
          </button>
          <button
            v-else
            @click="onInstall"
            class="w-full px-3 py-2 rounded-lg bg-[#22c55e] hover:bg-[#22c55e]/90 text-white text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5"
          >
            <Rocket class="w-3.5 h-3.5" />
            <span>{{ $t('update.installRestart') }}</span>
          </button>
          <button
            @click="store.closeUpdateModal()"
            class="w-full px-3 py-2 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/8 text-slate-600 dark:text-white/70 text-xs font-medium border border-black/10 dark:border-white/12 transition-colors duration-200"
          >
            {{ $t('update.later') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/useAppStore';
import { t, translateError } from '../i18n';
import {
  PackageOpen,
  X,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Download,
  Rocket,
} from 'lucide-vue-next';

const store = useAppStore();

async function onDownload() {
  try {
    await store.downloadAppUpdate();
  } catch {
    // 错误已写入 store.appUpdateError，无需重复提示
  }
}

async function onInstall() {
  try {
    await store.installAppUpdate();
  } catch (e: any) {
    store.showToast({
      title: t('update.toastInstallFailed'),
      message: translateError(e, 'update.toastInstallFailedMsg'),
      type: 'error',
    });
  }
}
</script>
