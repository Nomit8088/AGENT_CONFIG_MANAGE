import { createI18n } from 'vue-i18n';
import zh from '../locales/zh';
import en from '../locales/en';
import { isErrorCode, splitErrorCode } from '../shared/errorCodes';

export type AppLocale = 'zh' | 'en';

const LOCALE_STORAGE_KEY = 'agenthub_locale';

function readCachedLocale(): AppLocale {
  if (typeof localStorage === 'undefined') return 'zh';
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return v === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: readCachedLocale(),
  fallbackLocale: 'zh',
  messages: { zh, en },
});

/** 立即切换语言，并把偏好写入 localStorage 作为启动缓存（权威持久化走 config.json）。 */
export function applyLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 忽略存储失败（隐私模式等）
  }
}

/** 组件外取翻译（store / service 使用）。 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  return i18n.global.t(key, params);
}

/**
 * 把后端错误转为用户可见文案：
 * - 结构化错误码（`E_XXX` 或 `E_XXX::detail`）→ 查 `errors.E_XXX` 语言包，动态 detail 拼接其后；
 * - 其余字符串（git stderr / pnpm 日志等进程原始输出）→ 原样透传，不翻译；
 * - 空错误 → 使用 fallbackKey（或返回空串）。
 */
export function translateError(err: unknown, fallbackKey?: string): string {
  const raw =
    typeof err === 'string'
      ? err
      : (err as { message?: unknown; error?: unknown } | null | undefined)?.message ??
        (err as { error?: unknown } | null | undefined)?.error ??
        '';
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  if (text) {
    if (isErrorCode(text)) {
      const { code, detail } = splitErrorCode(text);
      const key = `errors.${code}`;
      const base = i18n.global.te(key) ? i18n.global.t(key) : code;
      return detail ? `${base}: ${detail}` : base;
    }
    return text;
  }
  return fallbackKey ? i18n.global.t(fallbackKey) : '';
}
