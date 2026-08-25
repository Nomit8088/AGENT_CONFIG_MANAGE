<template>
  <div :class="rootClass">
    <div
      ref="el"
      :class="[
        textClass,
        collapsed ? clampClass : 'line-clamp-none',
        'break-words leading-snug',
        overflow ? 'cursor-pointer' : '',
      ]"
      :title="collapsed ? text : undefined"
      role="button"
      :tabindex="overflow ? 0 : undefined"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >{{ text }}</div>
    <button
      v-if="overflow"
      type="button"
      @click.stop="toggle"
      class="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors duration-200"
    >
      <ChevronDown v-if="collapsed" class="w-3 h-3" />
      <ChevronUp v-else class="w-3 h-3" />
      <span>{{ collapsed ? t('plugins.expand') : t('plugins.collapse') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';

const props = defineProps<{
  text: string;
  lines?: number;
  textClass?: string;
  rootClass?: string;
}>();

const { t } = useI18n();

const el = ref<HTMLElement | null>(null);
const collapsed = ref(true);
const overflow = ref(false);

// Tailwind JIT 需要静态类名，用字面量映射避免动态拼接被摇树。
const CLAMP: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
};
const clampClass = computed(() => CLAMP[props.lines ?? 2] || 'line-clamp-2');

// 仅在「折叠」态测量真实溢出（折叠时 scrollHeight 会反映被截断前的内容高度）。
function measure() {
  const node = el.value;
  if (!node) {
    overflow.value = false;
    return;
  }
  overflow.value = node.scrollHeight > node.clientHeight + 1;
}

function toggle() {
  if (!overflow.value) return;
  collapsed.value = !collapsed.value;
}

watch(
  () => props.text,
  () => {
    collapsed.value = true;
    nextTick(measure);
  }
);

let ro: ResizeObserver | undefined;
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && el.value) {
    ro = new ResizeObserver(() => {
      if (collapsed.value && el.value) {
        overflow.value = el.value.scrollHeight > el.value.clientHeight + 1;
      }
    });
    ro.observe(el.value);
  }
});

onBeforeUnmount(() => {
  ro?.disconnect();
});
</script>
