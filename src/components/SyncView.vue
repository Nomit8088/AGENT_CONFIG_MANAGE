<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 transition-colors duration-200">
    <!-- 未配置 / 不可用：允许进入，并给出同步指引 -->
    <div
      v-if="!store.syncRepoConfigured"
      class="h-full flex flex-col items-center justify-center gap-4 text-center"
    >
      <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
        <UploadCloud class="w-6 h-6" />
      </div>
      <div class="space-y-1">
        <div class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('sync.repoUnconfiguredTitle') }}</div>
        <p class="text-xs text-slate-500 dark:text-white/50 max-w-md leading-relaxed">
          {{ $t('sync.repoUnconfiguredDesc') }}
        </p>
      </div>

      <!-- 仓库格式规范指引 -->
      <div class="w-full max-w-lg rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 p-4 text-left space-y-2 text-xs transition-colors duration-200">
        <div class="font-serif font-semibold text-xs text-slate-900 dark:text-white/95">{{ $t('sync.formatTitle') }}</div>
        <ul class="space-y-1.5 text-[11px] text-slate-500 dark:text-white/60 leading-relaxed">
          <li>{{ $t('sync.formatLi1') }}</li>
          <li>{{ $t('sync.formatLi2') }}</li>
          <li>{{ $t('sync.formatLi3') }}</li>
          <li>{{ $t('sync.formatLi4') }}</li>
          <li>{{ $t('sync.formatLi5') }}</li>
        </ul>
      </div>

      <button
        @click="store.settingsModal.visible = true"
        class="px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium transition-colors duration-200"
      >
        {{ $t('sync.openSettings') }}
      </button>
    </div>

    <template v-else>
      <!-- 共享仓库主视觉卡（视觉中心）：技能/DSH 插件共用同一 Git 仓库 -->
      <div class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 border-t-[#3b82f6]/60 overflow-hidden shadow-xs transition-colors duration-200">
        <div class="flex items-center justify-between gap-3 px-4 py-3 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
              <GitBranch class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('sync.repoTitle') }}</h2>
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border transition-colors duration-200',
                    repoStatus.initialized
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                  ]"
                >
                  {{ repoStatus.initialized ? $t('sync.ready') : $t('sync.notInit') }}
                </span>
              </div>
              <p class="text-[11px] font-mono text-slate-400 dark:text-white/40 truncate" :title="repoStatus.remoteUrl || ''">
                {{ repoStatus.remoteUrl || $t('sync.noRemote') }}
              </p>
            </div>
          </div>
          <button
            @click="handleTestConnection"
            :disabled="skillsLoading"
            class="px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border border-black/8 dark:border-white/8 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Wifi class="w-3.5 h-3.5 text-sky-500" />
            <span>{{ skillsLoading ? $t('sync.testing') : $t('sync.testConn') }}</span>
          </button>
        </div>

        <div class="grid grid-cols-3 divide-x divide-black/6 dark:divide-white/6">
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-slate-400 dark:text-white/40">{{ $t('sync.currentBranch') }}</div>
            <div class="mt-0.5 font-mono text-sm text-slate-900 dark:text-white/95 font-medium">{{ repoStatus.branch || '—' }}</div>
          </div>
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-slate-400 dark:text-white/40">{{ $t('sync.ahead') }}</div>
            <div class="mt-0.5 font-mono text-sm font-medium" :class="repoStatus.ahead > 0 ? 'text-[#3b82f6] font-bold' : 'text-slate-900 dark:text-white/95'">{{ repoStatus.ahead }}</div>
          </div>
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-slate-400 dark:text-white/40">{{ $t('sync.behind') }}</div>
            <div class="mt-0.5 font-mono text-sm font-medium" :class="repoStatus.behind > 0 ? 'text-[#f59e0b] font-bold' : 'text-slate-900 dark:text-white/95'">{{ repoStatus.behind }}</div>
          </div>
        </div>

        <div
          v-if="!repoStatus.initialized"
          class="px-4 py-3 bg-amber-500/5 border-t border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2"
        >
          <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{{ $t('sync.notInitHint') }}</span>
        </div>
      </div>

      <!-- 双功能卡片：技能同步 / DSH 插件同步（布局对称，各自内聚） -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <!-- 技能同步（蓝色标识） -->
        <div class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 border-t-[#3b82f6]/60 overflow-hidden shadow-xs transition-colors duration-200">
          <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen class="w-3.5 h-3.5" />
              </div>
              <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('sync.skillsSyncTitle') }}</h3>
              <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">skills/</span>
            </div>
            <span
              :class="[
                'px-1.5 py-0.5 rounded-md text-[10px] font-mono border transition-colors duration-200',
                skillsStatus.lastSyncStatus === 'success'
                  ? 'bg-black/5 dark:bg-white/6 text-slate-700 dark:text-white/80 border-black/8 dark:border-white/8'
                  : skillsStatus.lastSyncStatus === 'error'
                    ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                    : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10'
              ]"
            >
              {{ skillsStatusLabel }}
            </span>
          </div>

          <div class="p-4 space-y-3">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8">
                <div class="text-slate-500 dark:text-white/50">{{ $t('sync.dirty') }}</div>
                <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ skillsStatus.dirtyCount }}</div>
              </div>
              <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8">
                <div class="text-slate-500 dark:text-white/50">{{ $t('sync.lastSync') }}</div>
                <div class="mt-0.5 font-mono text-[11px] text-slate-800 dark:text-white/90">{{ skillsLastSyncLabel }}</div>
              </div>
            </div>

            <!-- 本地 ↔ 远端 文件差异 -->
            <div class="rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8 p-2.5 space-y-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-white/70">
                  <GitCompare class="w-3.5 h-3.5" />
                  <span>{{ $t('sync.diffTitle') }}</span>
                </div>
                <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">{{ $t('sync.diffFiles', { count: skillsDiff.length }) }}</span>
              </div>
              <p v-if="skillsDiff.length === 0" class="text-[11px] text-slate-400 dark:text-white/50">
                {{ $t('sync.noDiff') }}
              </p>
              <ul v-else class="max-h-28 overflow-y-auto space-y-1 pr-1">
                <li v-for="e in skillsDiff" :key="`${e.side}:${e.status}:${e.path}`" class="flex items-center gap-1.5 text-[11px]">
                  <span :class="['w-1.5 h-1.5 rounded-full shrink-0', statusDot(e.status)]"></span>
                  <span :class="['font-mono text-[10px] shrink-0', sideColor(e.side)]" :title="sideTitle(e.side)">{{ sideArrow(e.side) }}</span>
                  <span class="font-mono text-slate-600 dark:text-white/70 truncate" :title="e.path">{{ e.path }}</span>
                </li>
              </ul>
            </div>

            <template v-if="repoStatus.initialized">
              <div class="flex gap-2">
                <button
                  @click="handleSkillsApplyFromRepo"
                  :disabled="skillsLoading"
                  class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DownloadCloud class="w-3.5 h-3.5" />
                  <span>{{ $t('sync.applyFromRepo') }}</span>
                </button>
                <button
                  @click="handleSkillsPush"
                  :disabled="skillsLoading"
                  class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloud class="w-3.5 h-3.5" />
                  <span>{{ $t('sync.uploadToRepo') }}</span>
                </button>
              </div>

              <p class="text-[10px] leading-relaxed text-slate-400 dark:text-white/50">
                {{ $t('sync.applyDesc') }}
                {{ $t('sync.uploadDesc') }}
              </p>

              <div class="flex items-center justify-between py-2 border-t border-black/8 dark:border-white/8">
                <div>
                  <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('sync.autoPullTitle') }}</div>
                  <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('sync.autoPullDesc') }}</div>
                </div>
                <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
                  <button
                    type="button"
                    @click="toggleAutoPull(true)"
                    :class="[
                      'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                      skillsAutoPull
                        ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                    ]"
                  >
                    <span>{{ $t('common.on') }}</span>
                  </button>
                  <button
                    type="button"
                    @click="toggleAutoPull(false)"
                    :class="[
                      'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                      !skillsAutoPull
                        ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                        : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                    ]"
                  >
                    <span>{{ $t('common.off') }}</span>
                  </button>
                </div>
              </div>
            </template>

            <!-- 分叉恢复 -->
            <div
              v-if="diverged"
              class="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-2 transition-colors duration-200"
            >
              <div class="flex items-start gap-2">
                <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div class="space-y-1">
                  <div class="font-serif font-semibold text-xs text-slate-900 dark:text-white/90">{{ $t('sync.forkedTitle') }}</div>
                  <p class="text-[11px] leading-relaxed text-slate-500 dark:text-white/50">
                    {{ $t('sync.forkedDesc') }}
                  </p>
                </div>
              </div>
              <button
                @click="handleResetRemote"
                :disabled="skillsLoading"
                :class="[
                  'w-full px-3 py-2 rounded-lg text-xs font-medium border transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
                  confirmReset
                    ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                    : 'bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 border-black/8 dark:border-white/8'
                ]"
              >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>{{ confirmReset ? $t('sync.resetConfirm') : $t('sync.resetAction') }}</span>
              </button>
            </div>

            <!-- 错误横幅 -->
            <div
              v-if="skillsStatus.lastError"
              class="rounded-lg bg-red-500/5 border border-red-500/20 p-3 space-y-2 text-xs text-red-600 dark:text-red-400 transition-colors duration-200"
            >
              <div class="flex items-start gap-2">
                <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span class="font-mono break-all whitespace-pre-wrap leading-relaxed">{{ skillsStatus.lastError }}</span>
              </div>
              <div v-if="errorHint" class="pl-6 text-[11px] leading-relaxed text-red-500/90 dark:text-red-400/90">
                💡 {{ errorHint }}
              </div>
            </div>
          </div>
        </div>

        <!-- DSH 插件同步（紫色标识）+ 配置对账 -->
        <div class="space-y-4 min-w-0">
          <div class="rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 border-t-[#8b5cf6]/60 overflow-hidden transition-colors duration-200">
            <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/8 dark:border-white/8">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] flex items-center justify-center shrink-0">
                  <Puzzle class="w-3.5 h-3.5" />
                </div>
                <h3 class="font-serif font-semibold text-sm text-slate-900 dark:text-white/95">{{ $t('sync.dshSyncTitle') }}</h3>
                <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">dsh/</span>
              </div>
              <span
                :class="[
                  'px-1.5 py-0.5 rounded-md text-[10px] font-mono border transition-colors duration-200',
                  dshStatus.lastSyncStatus === 'success'
                    ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
                    : dshStatus.lastSyncStatus === 'error'
                      ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                      : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/70 border-black/8 dark:border-white/10'
                ]"
              >
                {{ dshStatusLabel }}
              </span>
            </div>

            <div class="p-4 space-y-3">
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8">
                  <div class="text-slate-500 dark:text-white/50">{{ $t('sync.dirty') }}</div>
                  <div class="mt-0.5 font-mono text-slate-800 dark:text-white/90">{{ dshStatus.dirtyCount }}</div>
                </div>
                <div class="p-2.5 rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8">
                  <div class="text-slate-500 dark:text-white/50">{{ $t('sync.lastSync') }}</div>
                  <div class="mt-0.5 font-mono text-[11px] text-slate-800 dark:text-white/90">{{ dshLastSyncLabel }}</div>
                </div>
              </div>

              <!-- 本地 ↔ 远端 文件差异 -->
              <div class="rounded-lg bg-black/[0.02] dark:bg-[#121316] border border-black/8 dark:border-white/8 p-2.5 space-y-1.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-white/70">
                    <GitCompare class="w-3.5 h-3.5" />
                    <span>{{ $t('sync.diffTitle') }}</span>
                  </div>
                  <span class="text-[10px] font-mono text-slate-400 dark:text-white/40">{{ $t('sync.diffFiles', { count: dshDiff.length }) }}</span>
                </div>
                <p v-if="dshDiff.length === 0" class="text-[11px] text-slate-400 dark:text-white/50">
                  {{ $t('sync.noDiff') }}
                </p>
                <ul v-else class="max-h-28 overflow-y-auto space-y-1 pr-1">
                  <li v-for="e in dshDiff" :key="`${e.side}:${e.status}:${e.path}`" class="flex items-center gap-1.5 text-[11px]">
                    <span :class="['w-1.5 h-1.5 rounded-full shrink-0', statusDot(e.status)]"></span>
                    <span :class="['font-mono text-[10px] shrink-0', sideColor(e.side)]" :title="sideTitle(e.side)">{{ sideArrow(e.side) }}</span>
                    <span class="font-mono text-slate-600 dark:text-white/70 truncate" :title="e.path">{{ e.path }}</span>
                  </li>
                </ul>
              </div>

              <template v-if="repoStatus.initialized">
                <div class="flex gap-2">
                  <button
                    @click="handleDshApplyFromRepo"
                    :disabled="dshLoading"
                    class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <DownloadCloud class="w-3.5 h-3.5" />
                    <span>{{ $t('sync.applyFromRepo') }}</span>
                  </button>
                  <button
                    @click="handleDshPush"
                    :disabled="dshLoading"
                    class="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-[#282a32] dark:hover:bg-white/10 text-slate-800 dark:text-white/90 text-xs font-medium border border-black/8 dark:border-white/8 transition-colors duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UploadCloud class="w-3.5 h-3.5" />
                    <span>{{ $t('sync.uploadToRepo') }}</span>
                  </button>
                </div>

                <p class="text-[10px] leading-relaxed text-slate-400 dark:text-white/50">
                  {{ $t('sync.applyDescDsh') }}
                  {{ $t('sync.uploadDescDsh') }}
                </p>

                <div class="flex items-center justify-between py-2 border-t border-black/8 dark:border-white/8">
                  <div>
                    <div class="font-serif font-semibold text-slate-900 dark:text-white/90">{{ $t('sync.autoPullTitle') }}</div>
                    <div class="text-[11px] text-slate-500 dark:text-white/50">{{ $t('sync.autoPullDescDsh') }}</div>
                  </div>
                  <div class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs">
                    <button
                      type="button"
                      @click="toggleDshAutoPull(true)"
                      :class="[
                        'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                        dshAutoPull
                          ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                          : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                      ]"
                    >
                      <span>{{ $t('common.on') }}</span>
                    </button>
                    <button
                      type="button"
                      @click="toggleDshAutoPull(false)"
                      :class="[
                        'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                        !dshAutoPull
                          ? 'bg-white dark:bg-[#282a32] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                          : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
                      ]"
                    >
                      <span>{{ $t('common.off') }}</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- 错误横幅 -->
              <div
                v-if="dshStatus.lastError"
                class="rounded-lg bg-red-500/5 border border-red-500/20 p-3 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 transition-colors duration-200"
              >
                <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span class="font-mono break-all whitespace-pre-wrap leading-relaxed">{{ dshStatus.lastError }}</span>
              </div>
            </div>
          </div>

          <!-- DSH 插件配置对账（本地 ~/.dsh ↔ 同步镜像 dsh/） -->
          <DshPluginSync />
        </div>
      </div>

      <DshPluginDiffModal />
      <SkillsDiffModal />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { t } from '../i18n';
import {
  DownloadCloud,
  UploadCloud,
  GitBranch,
  AlertTriangle,
  Wifi,
  RotateCcw,
  BookOpen,
  Puzzle,
  GitCompare,
} from 'lucide-vue-next';
import DshPluginSync from './DshPluginSync.vue';
import DshPluginDiffModal from './DshPluginDiffModal.vue';
import SkillsDiffModal from './SkillsDiffModal.vue';

const store = useAppStore();
const confirmReset = ref(false);

onMounted(async () => {
  await store.loadSyncRepo().catch(() => {});
  await Promise.all([
    store.loadSkillsSyncStatus().catch(() => {}),
    store.loadSkillsSyncDiff().catch(() => {}),
    store.loadDshPluginsSyncStatus().catch(() => {}),
    store.loadDshPluginsSyncDiff().catch(() => {}),
    store.reconcileDshPlugins().catch(() => {}),
  ]);
});

// 共享仓库信息复用技能同步状态（同一 Git 仓库，initialized/branch/ahead/behind/remoteUrl 一致）
const repoStatus = computed(() => store.skillsSyncStatus);
const skillsStatus = computed(() => store.skillsSyncStatus);
const dshStatus = computed(() => store.dshPluginsSyncStatus);
const skillsDiff = computed(() => store.skillsSyncDiff);
const dshDiff = computed(() => store.dshPluginsSyncDiff);
const skillsLoading = computed(() => store.skillsSyncLoading);
const dshLoading = computed(() => store.dshPluginsSyncLoading);
const skillsAutoPull = computed(() => store.config.skills_sync?.autoPullOnStartup ?? false);
const dshAutoPull = computed(() => store.config.dsh_plugins?.sync?.autoPullOnStartup ?? false);

const skillsStatusLabel = computed(() => {
  switch (skillsStatus.value.lastSyncStatus) {
    case 'success': return t('sync.statusSynced');
    case 'error': return t('sync.statusError');
    case 'syncing': return t('sync.statusSyncing');
    default: return t('sync.statusIdle');
  }
});

const dshStatusLabel = computed(() => {
  switch (dshStatus.value.lastSyncStatus) {
    case 'success': return t('sync.statusSynced');
    case 'error': return t('sync.statusError');
    case 'syncing': return t('sync.statusSyncing');
    default: return t('sync.statusIdle');
  }
});

const skillsLastSyncLabel = computed(() => {
  if (!skillsStatus.value.lastSyncAt) return t('sync.neverSynced');
  return new Date(skillsStatus.value.lastSyncAt).toLocaleString();
});

const dshLastSyncLabel = computed(() => {
  if (!dshStatus.value.lastSyncAt) return t('sync.neverSynced');
  return new Date(dshStatus.value.lastSyncAt).toLocaleString();
});

// 差异列表渲染辅助
function statusDot(status: string): string {
  if (status === 'added') return 'bg-[#22c55e] ring-2 ring-[#22c55e]/20';
  if (status === 'deleted') return 'bg-[#ef4444] ring-2 ring-[#ef4444]/20';
  return 'bg-[#f59e0b] ring-2 ring-[#f59e0b]/20';
}

function sideArrow(side: string): string {
  if (side === 'local') return '↑';
  if (side === 'remote') return '↓';
  return '⇅';
}

function sideTitle(side: string): string {
  if (side === 'local') return t('sync.sideLocal');
  if (side === 'remote') return t('sync.sideRemote');
  return t('sync.sideBoth');
}

function sideColor(side: string): string {
  if (side === 'local') return 'text-[#22c55e]';
  if (side === 'remote') return 'text-[#3b82f6]';
  return 'text-[#f59e0b]';
}

const errorHint = computed(() => {
  const e = skillsStatus.value.lastError || '';
  if (/unable to access|connection was reset|failed to connect|could not connect|schannel|recv failure|timed out/i.test(e)) {
    return t('sync.hintNetwork');
  }
  if (/authentication|credential|permission|403|404|repository not found|not found|access denied/i.test(e)) {
    return t('sync.hintRemote');
  }
  if (/diverging|fast-forward|not possible to fast-forward|non-fast-forward|rejected|fetch first/i.test(e)) {
    return t('sync.hintFork');
  }
  return '';
});

const diverged = computed(() => {
  const e = skillsStatus.value.lastError || '';
  return /diverging|fast-forward|not possible to fast-forward|non-fast-forward|rejected|fetch first/i.test(e);
});

async function handleSkillsApplyFromRepo() {
  try {
    await store.previewSkillsApply();
  } catch {}
}

async function handleSkillsPush() {
  try {
    await store.previewSkillsPush();
  } catch {}
}

async function handleTestConnection() {
  try {
    await store.testSkillsSyncConnection();
  } catch {}
}

async function handleResetRemote() {
  if (!confirmReset.value) {
    confirmReset.value = true;
    return;
  }
  confirmReset.value = false;
  try {
    await store.resetSkillsSyncToRemote();
  } catch {}
}

async function toggleAutoPull(enabled: boolean) {
  try {
    await store.setSkillsSyncAutoPull(enabled);
  } catch {}
}

async function handleDshApplyFromRepo() {
  try {
    await store.applyDshFromRepo();
  } catch {}
}

async function handleDshPush() {
  try {
    await store.pushDshPluginsSync();
  } catch {}
}

async function toggleDshAutoPull(enabled: boolean) {
  try {
    await store.setDshPluginsSyncAutoPull(enabled);
  } catch {}
}
</script>
