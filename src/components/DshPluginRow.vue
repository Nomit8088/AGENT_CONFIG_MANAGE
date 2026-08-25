<template>
  <!-- 列表行形态 -->
  <div
    v-if="layout === 'list'"
    class="px-4 py-3 transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] flex items-center justify-between gap-3 group"
  >
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <div
        class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
        :class="protocolInfo.iconCls"
      >
        <component :is="iconFor(entry.kind)" class="w-4 h-4" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span
            class="font-mono text-xs md:text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[240px]"
            :title="entry.name"
          >{{ entry.name }}</span>

          <span
            class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border tracking-wider uppercase shrink-0"
            :class="protocolInfo.cls"
          >{{ protocolInfo.label }}</span>

          <span
            v-if="statusPill"
            class="text-[10px] px-2 py-0.2 rounded-full font-mono border flex items-center gap-1 shrink-0"
            :class="statusPill.cls"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="statusPill.dot"></span>
            <span>{{ statusPill.label }}</span>
          </span>
        </div>

        <div class="mt-1 flex items-center gap-2 text-[11px] font-mono flex-wrap">
          <template v-if="isInbox">
            <span class="text-slate-400 dark:text-white/40">Harness 运行时解析 · 只读</span>
          </template>
          <template v-else-if="isOrphan">
            <span class="text-slate-500 dark:text-white/50">
              installed: {{ entry.installedVersion ? `v${entry.installedVersion}` : '?' }}
            </span>
          </template>
          <template v-else-if="entry.kind === 'row'">
            <span class="text-slate-400 dark:text-white/40">cordis.patch.yml</span>
          </template>
          <template v-else>
            <span
              class="px-1.5 py-0.2 rounded bg-black/5 dark:bg-black/30 text-slate-500 dark:text-white/50 text-[10px] truncate max-w-[240px]"
              :title="`spec: ${entry.spec || '—'}`"
            >{{ entry.spec || '—' }}</span>
            <span class="text-slate-300 dark:text-white/20">·</span>
            <span
              :class="entry.installed && entry.status !== 'version-mismatch' ? 'text-slate-800 dark:text-white/90 font-medium' : 'text-slate-500 dark:text-white/50'"
            >installed: {{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}</span>
            <span v-if="entry.requiredVersion" class="text-slate-300 dark:text-white/20">·</span>
            <span
              v-if="entry.requiredVersion"
              :class="entry.status === 'version-mismatch' ? 'text-red-500 font-semibold' : 'text-slate-400 dark:text-white/40'"
            >req: v{{ entry.requiredVersion }}</span>
          </template>
        </div>

        <div v-if="metaLine" class="mt-1 space-y-1">
          <ClampText
            v-if="entry.description"
            :text="entry.description"
            mode="truncate"
            max-width-class="max-w-[50%]"
            text-class="text-[11px] leading-relaxed text-slate-500 dark:text-white/60"
          />
          <div v-if="entry.tags.length" class="flex items-center gap-1.5 flex-wrap">
            <button
              v-for="tag in visibleTags"
              :key="tag"
              type="button"
              :title="t('plugins.filterByTag', { tag })"
              class="text-[11px] px-2 py-0.5 rounded-md font-mono border bg-slate-500/10 text-slate-700 dark:text-white/80 border-black/10 dark:border-white/10 hover:bg-slate-500/20 dark:hover:bg-white/15 transition-colors duration-200"
              @click.stop="emit('filter-tag', tag)"
            >{{ tag }}</button>
            <button
              v-if="hiddenTagCount > 0"
              type="button"
              :title="tagsExpanded ? t('plugins.collapse') : t('plugins.moreTags', { n: hiddenTagCount })"
              class="text-[11px] px-2 py-0.5 rounded-md font-mono border border-dashed border-black/10 dark:border-white/10 text-slate-500 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/8 hover:text-slate-700 dark:hover:text-white/80 transition-colors duration-200"
              @click.stop="tagsExpanded = !tagsExpanded"
            >{{ tagsExpanded ? t('plugins.collapse') : `+${hiddenTagCount}` }}</button>
          </div>
          <div v-if="entry.note" class="flex items-start gap-1 text-[11px] text-slate-600 dark:text-white/70">
            <StickyNote class="w-3.5 h-3.5 shrink-0 mt-px text-amber-500/80" />
            <ClampText
              :text="entry.note"
              :lines="2"
              root-class="flex-1 min-w-0"
              text-class="text-[11px] text-slate-600 dark:text-white/70"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0" @click.stop>
      <div v-if="showToggle">
        <div
          class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-xs"
        >
          <button
            type="button"
            @click="emit('toggle', entry, true)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1.5',
              entry.enabled
                ? 'bg-white dark:bg-[#1d202d] text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span v-if="entry.enabled" class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>启用</span>
          </button>
          <button
            type="button"
            @click="emit('toggle', entry, false)"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
              !entry.enabled
                ? 'bg-white dark:bg-[#1d202d] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
            ]"
          >
            <span>停用</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1">
        <button
          v-if="canEditMeta"
          type="button"
          :title="t('plugins.metaEdit')"
          class="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-[11px] font-medium text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 flex items-center gap-1 transition-colors duration-200"
          @click="openMetaEditor"
        >
          <Pencil class="w-3 h-3" />
          <span>{{ t('plugins.metaEditShort') }}</span>
        </button>
        <button
          v-if="isOrphan"
          type="button"
          :title="'纳入配置（写入 dependencies(link:/git+) + bundles）'"
          :class="actionCls('primary')"
          @click="emit('adopt', entry)"
        >
          <Link2 class="w-3.5 h-3.5" />
        </button>
        <button
          v-else-if="entry.installError"
          type="button"
          :title="'查看失败堆栈'"
          :class="actionCls('danger')"
          @click="emit('show-error', entry.installError || '')"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="canCheckUpdate"
          type="button"
          :title="'检查更新'"
          :class="actionCls()"
          @click="emit('check-update', entry)"
        >
          <RefreshCw class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="updateAvailable"
          type="button"
          :title="`更新到 ${updateCheck?.latest || '最新'}`"
          :class="actionCls('warning')"
          @click="emit('update', entry)"
        >
          <Download class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="!isInbox"
          type="button"
          :title="removeTitle"
          :class="actionCls('danger')"
          @click="emit('remove', entry)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- 卡片形态 -->
  <div
    v-else
    class="rounded-xl bg-white dark:bg-[#14161f] border border-black/8 dark:border-white/8 hover:border-indigo-500/30 dark:hover:border-indigo-400/40 p-4 flex flex-col gap-3 transition-colors duration-200 group"
    :class="cardAccentClass"
  >
    <div>
      <div class="flex items-start justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
            :class="protocolInfo.iconCls"
          >
            <component :is="iconFor(entry.kind)" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h4
              class="font-mono text-xs md:text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[170px]"
              :title="entry.name"
            >{{ entry.name }}</h4>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span
                class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border tracking-wider uppercase"
                :class="protocolInfo.cls"
              >{{ protocolInfo.label }}</span>
              <span
                v-if="statusPill"
                class="text-[9px] px-1.5 py-0.2 rounded-full font-mono border flex items-center gap-1"
                :class="statusPill.cls"
              >
                <span class="w-1 h-1 rounded-full" :class="statusPill.dot"></span>
                <span>{{ statusPill.label }}</span>
              </span>
            </div>
          </div>
        </div>

        <div v-if="showToggle" class="shrink-0" @click.stop>
          <div
            class="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-[#121316] border border-black/10 dark:border-white/10 text-[11px]"
          >
            <button
              type="button"
              @click="emit('toggle', entry, true)"
              :class="[
                'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                entry.enabled
                  ? 'bg-white dark:bg-[#1d202d] text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span v-if="entry.enabled" class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              <span>启用</span>
            </button>
            <button
              type="button"
              @click="emit('toggle', entry, false)"
              :class="[
                'px-2 py-0.5 rounded-md transition-colors duration-200 font-medium flex items-center gap-1',
                !entry.enabled
                  ? 'bg-white dark:bg-[#1d202d] text-slate-900 dark:text-white/95 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80'
              ]"
            >
              <span>停用</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Spec & Version Inset Box -->
      <div class="mt-3 p-2.5 rounded-lg bg-black/[0.03] dark:bg-black/30 border border-black/5 dark:border-white/5 font-mono text-[11px] space-y-1">
        <div class="text-slate-500 dark:text-white/50 truncate flex items-center gap-1.5" :title="entry.spec || '—'">
          <Link2 class="w-3 h-3 shrink-0 opacity-60" />
          <span class="truncate">{{ entry.spec || '—' }}</span>
        </div>
        <div class="flex items-center justify-between text-[10px] pt-0.5 text-slate-600 dark:text-white/60">
          <span>installed: <strong class="text-slate-900 dark:text-white font-mono">{{ entry.installed ? `v${entry.installedVersion || '?'}` : '未安装' }}</strong></span>
          <span v-if="entry.requiredVersion" class="opacity-60 font-mono">req: v{{ entry.requiredVersion }}</span>
        </div>
      </div>

      <div v-if="metaLine" class="mt-2 space-y-1.5">
        <ClampText
          v-if="entry.description"
          :text="entry.description"
          :lines="2"
          text-class="text-[11px] leading-relaxed text-slate-500 dark:text-white/60"
        />
        <div v-if="entry.tags.length" class="flex items-center gap-1.5 flex-wrap">
          <button
            v-for="tag in visibleTags"
            :key="tag"
            type="button"
            :title="t('plugins.filterByTag', { tag })"
            class="text-[11px] px-2 py-0.5 rounded-md font-mono border bg-slate-500/10 text-slate-700 dark:text-white/80 border-black/10 dark:border-white/10 hover:bg-slate-500/20 dark:hover:bg-white/15 transition-colors duration-200"
            @click.stop="emit('filter-tag', tag)"
          >{{ tag }}</button>
          <button
            v-if="hiddenTagCount > 0"
            type="button"
            :title="tagsExpanded ? t('plugins.collapse') : t('plugins.moreTags', { n: hiddenTagCount })"
            class="text-[11px] px-2 py-0.5 rounded-md font-mono border border-dashed border-black/10 dark:border-white/10 text-slate-500 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/8 hover:text-slate-700 dark:hover:text-white/80 transition-colors duration-200"
            @click.stop="tagsExpanded = !tagsExpanded"
          >{{ tagsExpanded ? t('plugins.collapse') : `+${hiddenTagCount}` }}</button>
        </div>
        <div v-if="entry.note" class="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-white/70">
          <StickyNote class="w-3.5 h-3.5 shrink-0 mt-px text-amber-500/80" />
          <ClampText
            :text="entry.note"
            :lines="2"
            root-class="flex-1 min-w-0"
            text-class="text-[11px] text-slate-600 dark:text-white/70"
          />
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-1 pt-2 border-t border-black/5 dark:border-white/5 text-[11px]" @click.stop>
      <span class="text-slate-400 dark:text-white/40 font-mono text-[10px] flex items-center gap-1">
        <i data-lucide="check-circle" class="w-3 h-3 text-indigo-400"></i>
        <span>就绪</span>
      </span>
      <div class="flex items-center gap-1">
        <button
          v-if="canEditMeta"
          type="button"
          :title="t('plugins.metaEdit')"
          class="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-[11px] font-medium text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 flex items-center gap-1 transition-colors duration-200"
          @click="openMetaEditor"
        >
          <Pencil class="w-3 h-3" />
          <span>{{ t('plugins.metaEditShort') }}</span>
        </button>
        <button
          v-if="isOrphan"
          type="button"
          :title="'纳入配置（写入 dependencies(link:/git+) + bundles）'"
          :class="actionCls('primary')"
          @click="emit('adopt', entry)"
        >
          <Link2 class="w-3.5 h-3.5" />
        </button>
        <button
          v-else-if="entry.installError"
          type="button"
          :title="'查看失败堆栈'"
          :class="actionCls('danger')"
          @click="emit('show-error', entry.installError || '')"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="canCheckUpdate"
          type="button"
          :title="'检查更新'"
          :class="actionCls()"
          @click="emit('check-update', entry)"
        >
          <RefreshCw class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="updateAvailable"
          type="button"
          :title="`更新到 ${updateCheck?.latest || '最新'}`"
          :class="actionCls('warning')"
          @click="emit('update', entry)"
        >
          <Download class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="!isInbox"
          type="button"
          :title="removeTitle"
          :class="actionCls('danger')"
          @click="emit('remove', entry)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- tag / 备注编辑弹窗（Teleport 到 body，避免卡片 grid 截断） -->
  <Teleport to="body">
    <div
      v-if="metaEditing"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-colors duration-200"
      @click.self="metaEditing = false"
    >
      <div class="w-[min(560px,92vw)] max-h-[80vh] overflow-auto rounded-xl bg-white dark:bg-[#1c1d22] border border-black/8 dark:border-white/8 shadow-sm dark:shadow-none p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-serif text-sm text-slate-900 dark:text-white/95">{{ t('plugins.metaTitle') }}</h3>
          <button
            type="button"
            @click="metaEditing = false"
            class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-[#282a32] text-slate-500 dark:text-white/50 transition-colors duration-200"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="entry.description" class="mt-3 text-xs text-slate-500 dark:text-white/60">
          <span class="text-slate-400 dark:text-white/40">{{ t('plugins.metaDescription') }}</span>
          <p class="mt-1 text-slate-600 dark:text-white/70">{{ entry.description }}</p>
        </div>

        <div class="mt-4">
          <label class="text-xs font-medium text-slate-600 dark:text-white/70">{{ t('plugins.metaTags') }}</label>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              v-for="tag in draftTags"
              :key="tag"
              class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono border bg-slate-500/10 text-slate-700 dark:text-white/80 border-black/10 dark:border-white/10"
            >
              {{ tag }}
              <button type="button" @click="removeTag(tag)" class="text-slate-400 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400 transition-colors duration-200">
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
          <div class="mt-2 flex items-center gap-1.5">
            <input
              v-model="draftTagInput"
              type="text"
              :maxlength="MAX_PLUGIN_TAG_LEN"
              :placeholder="t('plugins.metaTagPlaceholder')"
              class="flex-1 bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
              @keyup.enter.prevent="addTag"
            />
            <button
              type="button"
              :disabled="draftTags.length >= MAX_PLUGIN_TAGS"
              @click="addTag"
              class="p-1.5 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/15 transition-colors duration-200 disabled:opacity-40"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>
          <p class="mt-1 text-[10px] text-slate-400 dark:text-white/40">{{ t('plugins.metaTagHint', { max: MAX_PLUGIN_TAGS, len: MAX_PLUGIN_TAG_LEN }) }}</p>
        </div>

        <div class="mt-3">
          <label class="text-xs font-medium text-slate-600 dark:text-white/70">{{ t('plugins.metaNote') }}</label>
          <textarea
            v-model="draftNote"
            rows="3"
            :maxlength="MAX_PLUGIN_NOTE_LEN"
            :placeholder="t('plugins.metaNotePlaceholder')"
            class="mt-1.5 w-full resize-none bg-white dark:bg-[#121316] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-black/25 dark:focus:border-white/25 transition-colors duration-200"
          ></textarea>
          <p class="mt-1 text-[10px] text-slate-400 dark:text-white/40">{{ t('plugins.metaNoteHint', { max: MAX_PLUGIN_NOTE_LEN }) }}</p>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            @click="metaEditing = false"
            class="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/8 transition-colors duration-200"
          >{{ t('common.cancel') }}</button>
          <button
            type="button"
            :disabled="metaSaving"
            @click="saveMeta"
            class="px-3 py-1.5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium transition-colors duration-200 disabled:opacity-50"
          >{{ t('common.save') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Package,
  CircleDot,
  ListTree,
  Layers,
  Link2,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  Pencil,
  StickyNote,
  Plus,
  X,
} from 'lucide-vue-next';
import type {
  DshPluginInstallEntry,
  DshPluginInstallStatus,
  DshPluginKind,
  DshPluginUpdateCheck,
} from '../types';
import ClampText from './ClampText.vue';

const props = defineProps<{
  entry: DshPluginInstallEntry;
  updateCheck?: DshPluginUpdateCheck;
  view: 'source' | 'status';
  layout: 'list' | 'card';
}>();

const emit = defineEmits<{
  (e: 'toggle', entry: DshPluginInstallEntry, enabled: boolean): void;
  (e: 'remove', entry: DshPluginInstallEntry): void;
  (e: 'adopt', entry: DshPluginInstallEntry): void;
  (e: 'show-error', stack: string): void;
  (e: 'check-update', entry: DshPluginInstallEntry): void;
  (e: 'update', entry: DshPluginInstallEntry): void;
  (e: 'save-meta', entry: DshPluginInstallEntry, tags: string[], note: string): void;
  (e: 'filter-tag', tag: string): void;
}>();

const { t } = useI18n();

const MAX_PLUGIN_TAGS = 10;
const MAX_PLUGIN_TAG_LEN = 32;
const MAX_PLUGIN_NOTE_LEN = 500;

const metaEditing = ref(false);
const metaSaving = ref(false);
const draftTags = ref<string[]>([]);
const draftTagInput = ref('');
const draftNote = ref('');

const entry = computed(() => props.entry);
const isInbox = computed(() => entry.value.kind === 'inbox');
const isOrphan = computed(() => entry.value.status === 'orphan');
const showToggle = computed(() => !isInbox.value && !isOrphan.value);
const canEditMeta = computed(() => !isInbox.value);
const metaLine = computed(
  () => Boolean(entry.value.description || (entry.value.tags?.length ?? 0) > 0 || entry.value.note)
);

// 标签超量折叠：默认只显示前 MAX_VISIBLE_TAGS 个，其余收进「+N」可点击展开
const MAX_VISIBLE_TAGS = 3;
const tagsExpanded = ref(false);
const visibleTags = computed(() =>
  tagsExpanded.value ? (entry.value.tags || []) : (entry.value.tags || []).slice(0, MAX_VISIBLE_TAGS)
);
const hiddenTagCount = computed(() => Math.max(0, (entry.value.tags?.length ?? 0) - MAX_VISIBLE_TAGS));

function openMetaEditor() {
  draftTags.value = [...(entry.value.tags || [])];
  draftNote.value = entry.value.note || '';
  draftTagInput.value = '';
  metaEditing.value = true;
}

function addTag() {
  const t2 = draftTagInput.value.trim().slice(0, MAX_PLUGIN_TAG_LEN);
  if (!t2) return;
  if (draftTags.value.includes(t2)) {
    draftTagInput.value = '';
    return;
  }
  if (draftTags.value.length >= MAX_PLUGIN_TAGS) return;
  draftTags.value.push(t2);
  draftTagInput.value = '';
}

function removeTag(tag: string) {
  draftTags.value = draftTags.value.filter(x => x !== tag);
}

function saveMeta() {
  if (metaSaving.value) return;
  metaSaving.value = true;
  try {
    emit('save-meta', props.entry, draftTags.value, draftNote.value.trim());
  } finally {
    metaSaving.value = false;
    metaEditing.value = false;
  }
}
const updateAvailable = computed(() => Boolean(props.updateCheck?.updateAvailable));
const canCheckUpdate = computed(
  () =>
    !isInbox.value &&
    !isOrphan.value &&
    entry.value.kind !== 'row' &&
    entry.value.portability === 'portable' &&
    !updateAvailable.value
);

const removeTitle = computed(() => {
  if (isOrphan.value) return '从 node_modules 移除';
  if (entry.value.kind === 'row') return '删除此 patch 行';
  return entry.value.declaredInConfig ? '卸载（移出 dependencies / bundles / patch）' : '从 node_modules 移除';
});

const protocolInfo = computed(() => {
  if (isInbox.value) {
    return {
      label: 'OFFICIAL',
      cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      iconCls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    };
  }
  if (entry.value.kind === 'row') {
    return {
      label: 'PATCH',
      cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      iconCls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  }
  if (entry.value.portability === 'unportable' || entry.value.spec?.startsWith('link:') || entry.value.spec?.startsWith('file:')) {
    return {
      label: 'LOCAL',
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      iconCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  const spec = entry.value.spec || '';
  if (spec.startsWith('github:')) {
    return {
      label: 'GITHUB',
      cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      iconCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
  }
  if (spec.startsWith('git+') || spec.startsWith('https:')) {
    return {
      label: 'GIT+',
      cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      iconCls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    };
  }
  return {
    label: 'NPM',
    cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconCls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  };
});

const statusPill = computed(() => {
  switch (entry.value.status) {
    case 'ok':
      return {
        label: '正常',
        cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500',
      };
    case 'pending':
      return {
        label: '待装',
        cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500',
      };
    case 'version-mismatch':
      return {
        label: '版本冲突',
        cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        dot: 'bg-red-500',
      };
    case 'failed':
      return {
        label: '失败',
        cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        dot: 'bg-red-500',
      };
    case 'orphan':
      return {
        label: '孤儿',
        cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500',
      };
  }
});

function iconFor(kind: DshPluginKind) {
  switch (kind) {
    case 'inbox': return Layers;
    case 'bundle': return Package;
    case 'row': return ListTree;
    case 'plain': return CircleDot;
  }
}

// 卡片形态顶部语义色强调线（仅在异常/警告时显示，正常状态保持素雅一致）
const cardAccentClass = computed(() => {
  switch (entry.value.status) {
    case 'version-mismatch': return 'border-t-[#f59e0b]/60';
    case 'failed': return 'border-t-[#ef4444]/60';
    default: return '';
  }
});

function actionCls(variant: 'default' | 'danger' | 'primary' | 'warning' = 'default'): string {
  const base = 'p-1.5 rounded-lg bg-transparent border transition-colors duration-200';
  switch (variant) {
    case 'danger':
      return `${base} border-transparent text-slate-400 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30`;
    case 'primary':
      return `${base} border-transparent text-slate-400 hover:text-indigo-500 dark:text-white/40 dark:hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30`;
    case 'warning':
      return `${base} border-amber-500/30 text-amber-500 hover:bg-amber-500/10`;
    default:
      return `${base} border-transparent text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/8`;
  }
}
</script>
