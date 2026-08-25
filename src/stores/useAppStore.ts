import { defineStore } from 'pinia';
import {
  AgentInfo,
  AppConfig,
  AppLogEntry,
  AppLogLevel,
  AppUpdateCheck,
  DshAlignDecision,
  DshConfigSnapshot,
  DshDiagnoseResult,
  DshInstallMode,
  DshInstallReport,
  DshPluginDiff,
  DshPluginInstallEntry,
  DshPluginScanResult,
  DshPluginUpdateCheck,
  DshRecoveryAction,
  DshAvailableVersions,
  DshLaunchResult,
  DshVersionCheck,
  DshVersionHistoryEntry,
  DshVersionInfo,
  DshVersionUpgradeResult,
  IgnoredSkill,
  ProjectInfo,
  SkillItem,
  SkillsSyncDecision,
  SkillsSyncStatus,
  SyncDiffEntry,
  SyncHistoryEntry,
  SyncRepoConfig,
  SyncRepoValidation,
  SyncSchedule,
  SyncTrigger,
  ToastMessage,
  UnmanagedSkill,
} from '../types';
import { api } from '../services/api';
import { t, translateError, applyLocale } from '../i18n';

export interface DiffModalState {
  visible: boolean;
  title: string;
  agentId?: string;
  skillName?: string;
  localContent: string;
  remoteContent: string;
  localLabel: string;
  remoteLabel: string;
  onResolve?: (action: 'overwrite' | 'rename' | 'skip') => void;
}

export const useAppStore = defineStore('app', {
  state: () => ({
    currentTab: 'agents' as 'agents' | 'skills' | 'sync' | 'projects' | 'settings' | 'plugins',
    agents: [] as AgentInfo[],
    skills: [] as SkillItem[],
    unmanagedSkills: [] as UnmanagedSkill[],
    projects: [] as ProjectInfo[],
    config: {
      auto_start: false,
      theme: 'system' as const,
      locale: 'zh' as 'zh' | 'en',
      default_rule_mode: 'append' as const,
      auto_capture_skills: true,
      toast_notifications: true,
      auto_check_update: false,
      ignored_skills: [] as IgnoredSkill[],
    } as AppConfig,
    activeSkillId: null as string | null,
    activeProjectId: null as string | null,
    searchQuery: '',
    isLoading: false,
    toasts: [] as ToastMessage[],

    // Selected skills for batch actions
    selectedSkillIds: [] as string[],

    // Modals
    diffModal: {
      visible: false,
      title: t('diff.title'),
      localContent: '',
      remoteContent: '',
      localLabel: '本地文件 (Local)',
      remoteLabel: '中央库版本 (Central)',
    } as DiffModalState,

    skillEditorModal: {
      visible: false,
      skillName: '',
      content: '',
      isNew: false,
    },

    addAgentModal: {
      visible: false,
    },

    addProjectModal: {
      visible: false,
    },

    settingsModal: {
      visible: false,
    },

    // Skills Sync (中央库多端同步)
    skillsSyncStatus: {
      initialized: false,
      remoteUrl: undefined,
      branch: undefined,
      ahead: 0,
      behind: 0,
      dirtyCount: 0,
      lastSyncAt: undefined,
      lastSyncStatus: 'idle',
      lastError: undefined,
    } as SkillsSyncStatus,
    skillsSyncLoading: false,
    skillsSyncDiff: [] as SyncDiffEntry[],

    // 全局同步仓库配置（技能与 DSH 插件共用）
    syncRepo: null as SyncRepoConfig | null,
    syncRepoValidating: false,
    syncRepoValidation: null as SyncRepoValidation | null,
    syncRepoValidatedKey: '',
    syncRepoUnbinding: false,

    // 定时同步 + 同步历史 (WI-008)
    syncSchedule: {
      enabled: false,
      mode: 'interval' as const,
      intervalMinutes: 30,
      scopes: ['skills', 'dsh'] as ('skills' | 'dsh')[],
    } as SyncSchedule,
    syncScheduleSaving: false,
    syncHistory: [] as SyncHistoryEntry[],
    syncHistoryLoading: false,
    syncHistoryClearing: false,

    // DSH 插件中心
    dshPluginsScan: null as DshPluginScanResult | null,
    dshDiagnose: null as DshDiagnoseResult | null,
    dshDiagnosing: false,
    dshPluginsSyncStatus: {
      initialized: false,
      remoteUrl: undefined,
      branch: undefined,
      ahead: 0,
      behind: 0,
      dirtyCount: 0,
      lastSyncAt: undefined,
      lastSyncStatus: 'idle',
      lastError: undefined,
    } as SkillsSyncStatus,
    dshPluginsSyncLoading: false,
    dshPluginsSyncDiff: [] as SyncDiffEntry[],
    dshPluginDiff: null as DshPluginDiff | null,
    dshPluginsScanLoading: false,
    dshPluginDiffModal: {
      visible: false,
      mode: 'preview' as 'preview' | 'apply',
    },
    skillsDiffModal: {
      visible: false,
      mode: 'apply' as 'apply' | 'push',
    },

    // DSH 配置快照与回滚 (WI-006)
    dshSnapshots: [] as DshConfigSnapshot[],
    dshSnapshotsLoading: false,

    // DSH 版本升级与版本管理 (WI-009)
    dshVersionInfo: null as DshVersionInfo | null,
    dshVersionChecking: false,
    dshVersionCheck: null as DshVersionCheck | null,
    dshVersions: [] as DshVersionHistoryEntry[],
    dshVersionUpgrading: false,
    dshVersionResult: null as DshVersionUpgradeResult | null,
    dshVersionRollingBack: false,
    dshAvailableVersions: null as DshAvailableVersions | null,
    dshAvailableVersionsLoading: false,
    dshLaunching: false,
    dshLaunchError: null as string | null,
    dshLaunchStderr: null as string | null,
    dshVersionTerminal: {
      visible: false,
      lines: [] as string[],
      running: false,
    },

    // DSH 插件面板 V2：安装状态对账 + 安装器 + 实时终端
    dshInstallEntries: [] as DshPluginInstallEntry[],
    dshInstallEntriesLoading: false,
    dshPluginUpdates: {} as Record<string, DshPluginUpdateCheck>,
    dshInstallReport: null as DshInstallReport | null,
    dshInstalling: false,
    installTerminal: {
      visible: false,
      lines: [] as string[],
      running: false,
    },

    // 应用本体在线更新 (cc-switch 风格)
    appUpdate: null as AppUpdateCheck | null,
    appUpdateChecking: false,
    appUpdateDownloading: false,
    appUpdateProgress: 0,
    appUpdateDownloadedPath: null as string | null,
    appUpdateError: null as string | null,
    updateModal: {
      visible: false,
    },

    // Agent Unmanaged Details Modal/Drawer
    agentDetailModal: {
      visible: false,
      agentId: '',
      activeTab: 'unmanaged' as 'unmanaged' | 'ignored' | 'skills',
    },

    // 应用日志系统 (WI-007)
    appLogs: [] as AppLogEntry[],
    appLogPath: '' as string,
    appLogsLoading: false,
    appLogLevel: '' as '' | AppLogLevel,
    logViewerModal: {
      visible: false,
    },
  }),

  getters: {
    activeSkill(state): SkillItem | undefined {
      return state.skills.find(s => s.id === state.activeSkillId);
    },
    activeProject(state): ProjectInfo | undefined {
      return state.projects.find(p => p.id === state.activeProjectId) || state.projects[0];
    },
    filteredSkills(state): SkillItem[] {
      const q = state.searchQuery.trim().toLowerCase();
      if (!q) return state.skills;
      return state.skills.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    },
    detectedAgentsCount(state): number {
      return state.agents.filter(a => a.detected && a.enabled).length;
    },
    enabledAgents(state): AgentInfo[] {
      return state.agents.filter(a => a.enabled);
    },
    isAgentEnabled(state) {
      return (agentId: string) => state.agents.some(a => a.id === agentId && a.enabled);
    },
    activeSkillsCount(state): number {
      return state.skills.filter(s => s.enabled).length;
    },
    activeProjectsCount(state): number {
      return state.projects.filter(p => p.overrideEnabled).length;
    },
    totalUnmanagedCount(state): number {
      return state.unmanagedSkills.filter(u => state.agents.some(a => a.id === u.agentId && a.enabled)).length;
    },
    totalIgnoredCount(state): number {
      return (state.config.ignored_skills || []).filter(i => state.agents.some(a => a.id === i.agentId && a.enabled)).length;
    },
    unmanagedByAgent(state) {
      return (agentId: string) => state.unmanagedSkills.filter(u => u.agentId === agentId);
    },
    ignoredByAgent(state) {
      return (agentId: string) => (state.config.ignored_skills || []).filter(i => i.agentId === agentId);
    },
    activeDetailAgent(state): AgentInfo | undefined {
      return state.agents.find(a => a.id === state.agentDetailModal.agentId);
    },
    dshPluginDiffCount(state): number {
      return state.dshPluginDiff?.items.length ?? 0;
    },
    syncRepoConfigured(state): boolean {
      return !!state.syncRepo?.remoteUrl;
    },
    dshProfileCount(state): number {
      return state.dshPluginsScan?.profiles.length ?? 0;
    },
  },

  actions: {
    async init() {
      this.isLoading = true;
      try {
        await Promise.all([
          this.loadConfig(),
          this.loadAgents(),
          this.loadSkills(),
          this.loadProjects(),
          this.scanUnmanaged(),
        ]);

        this.applyTheme(this.config.theme);

        if (window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          mediaQuery.addEventListener('change', () => {
            if (this.config.theme === 'system') {
              this.applyTheme('system');
            }
          });
        }

        if (this.projects.length > 0 && !this.activeProjectId) {
          this.activeProjectId = this.projects[0].id;
        }

        // Skills Sync: load status, and if enabled, try a silent fast-forward pull on startup
        await this.loadSyncRepo().catch(() => {});
        this.loadSkillsSyncStatus().catch(() => {});
        this.loadSyncSchedule().catch(() => {});
        if (
          this.config.skills_sync?.autoPullOnStartup &&
          (this.syncRepo?.remoteUrl || this.config.skills_sync.remoteUrl)
        ) {
          this.pullSkillsSync(false, 'startup').catch(() => {});
        }

        // DSH 插件中心：静默加载扫描与同步状态（失败不阻塞主流程）
        this.loadDshPlugins().catch(() => {});
        this.loadDshPluginsSyncStatus().catch(() => {});
        if (
          this.config.dsh_plugins?.sync?.autoPullOnStartup &&
          (this.syncRepo?.remoteUrl || this.config.dsh_plugins?.sync?.remoteUrl)
        ) {
          this.pullDshPluginsSync(false, 'startup').catch(() => {});
        }

        api.onExternalSkillCreated((path) => {
          this.showToast({
            title: t('toast.externalSkillTitle'),
            message: t('toast.externalSkillMsg', { name: path.split(/[\/\\]/).pop() }),
            type: 'info',
          });
          this.loadSkills();
          this.scanUnmanaged();
        });

        // 应用本体在线更新：启动时静默检查（可在全局设置中开启）
        if (this.config.auto_check_update) {
          this.checkAppUpdate(false).catch(() => {});
        }
      } finally {
        this.isLoading = false;
      }
    },

    applyLocale(locale?: 'zh' | 'en') {
      const target = locale || this.config.locale || 'zh';
      this.config.locale = target;
      applyLocale(target);
    },

    async setLocale(locale: 'zh' | 'en') {
      this.applyLocale(locale);
      await api.updateConfig(this.config);
      this.showToast({
        title: t('toast.settingsUpdatedTitle'),
        message: t('toast.settingsUpdatedMsg'),
        type: 'success',
      });
    },

    applyTheme(theme?: 'dark' | 'light' | 'system') {
      const currentTheme = theme || this.config.theme || 'system';
      let isDark = false;
      if (currentTheme === 'dark') {
        isDark = true;
      } else if (currentTheme === 'light') {
        isDark = false;
      } else if (currentTheme === 'system') {
        // Priority 1: Check true OS system_theme returned from Windows registry
        if (this.config.system_theme) {
          isDark = this.config.system_theme === 'dark';
        } else if (typeof window !== 'undefined' && window.matchMedia) {
          // Priority 2: Fallback to matchMedia
          isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
          isDark = false;
        }
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('agenthub_theme', currentTheme);
        } catch (e) {}
      }

      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (isDark) {
          root.classList.add('dark');
          root.classList.remove('light');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
          root.style.colorScheme = 'light';
        }
      }
    },

    async loadConfig() {
      this.config = await api.getConfig();
      if (!this.config.ignored_skills) {
        this.config.ignored_skills = [];
      }
      this.applyTheme(this.config.theme);
      this.applyLocale(this.config.locale);
    },

    async saveConfig(newConfig: AppConfig) {
      this.config = {
        ...this.config,
        ...newConfig,
        ignored_skills: newConfig.ignored_skills ?? this.config.ignored_skills ?? [],
        // 全局同步仓库由 saveSyncRepo 专用入口维护，偏好设置保存时不得将其从 config.json 中抹掉。
        sync_repo: this.syncRepo ?? this.config.sync_repo ?? newConfig.sync_repo,
      };
      this.applyTheme(this.config.theme);
      await api.updateConfig(this.config);
      this.showToast({
        title: t('toast.settingsUpdatedTitle'),
        message: t('toast.settingsUpdatedMsg'),
        type: 'success',
      });
    },

    async loadAgents() {
      this.agents = await api.getAgents();
    },

    async scanAgents() {
      this.isLoading = true;
      try {
        this.agents = await api.scanAgents();
        this.showToast({
          title: t('toast.agentScanTitle'),
          message: t('toast.agentScanMsg', { count: this.detectedAgentsCount }),
          type: 'success',
        });
      } finally {
        this.isLoading = false;
      }
    },

    async toggleAgentEnable(agentId: string, enabled: boolean) {
      const agent = this.agents.find(a => a.id === agentId);
      if (agent) {
        agent.enabled = enabled;
        await api.saveAgentsList(this.agents);
        this.showToast({
          title: t(enabled ? 'toast.agentEnabledTitle' : 'toast.agentDisabledTitle'),
          message: t(enabled ? 'toast.agentEnabledMsg' : 'toast.agentDisabledMsg', { name: agent.name }),
          type: 'info',
        });
      }
    },

    async addCustomAgent(agent: AgentInfo) {
      this.agents.push(agent);
      await api.saveAgentsList(this.agents);
      this.showToast({
        title: t('toast.agentAddTitle'),
        message: t('toast.agentAddMsg', { name: agent.name }),
        type: 'success',
      });
    },

    async deleteCustomAgent(agentId: string) {
      const target = this.agents.find(a => a.id === agentId);
      this.agents = this.agents.filter(a => a.id !== agentId);
      await api.saveAgentsList(this.agents);
      this.showToast({
        title: t('toast.agentRemoveTitle'),
        message: t('toast.agentRemoveMsg', { name: target?.name || agentId }),
        type: 'info',
      });
    },

    async loadSkills() {
      this.skills = await api.getCentralSkills();
    },

    async scanUnmanaged() {
      this.unmanagedSkills = await api.scanUnmanagedSkills();
    },

    async loadSkillsSyncStatus() {
      this.skillsSyncStatus = await api.getSkillsSyncStatus();
    },

    async loadSkillsSyncDiff() {
      this.skillsSyncDiff = await api.getSkillsSyncDiff();
    },

    async loadSyncRepo() {
      this.syncRepo = await api.getSyncRepoConfig();
      return this.syncRepo;
    },

    async loadSyncSchedule() {
      this.syncSchedule = await api.getSyncSchedule();
      return this.syncSchedule;
    },

    async saveSyncSchedule(schedule: SyncSchedule) {
      this.syncScheduleSaving = true;
      try {
        this.syncSchedule = await api.setSyncSchedule(schedule);
        this.config.sync_schedule = this.syncSchedule;
        return this.syncSchedule;
      } finally {
        this.syncScheduleSaving = false;
      }
    },

    async loadSyncHistory(limit?: number) {
      this.syncHistoryLoading = true;
      try {
        this.syncHistory = await api.getSyncHistory(limit);
        return this.syncHistory;
      } finally {
        this.syncHistoryLoading = false;
      }
    },

    async clearSyncHistory() {
      this.syncHistoryClearing = true;
      try {
        await api.clearSyncHistory();
        this.syncHistory = [];
      } finally {
        this.syncHistoryClearing = false;
      }
    },

    async validateSyncRepo(remoteUrl: string, branch?: string) {
      const key = `${remoteUrl.trim()}||${branch?.trim() || 'main'}`;
      this.syncRepoValidating = true;
      this.syncRepoValidation = null;
      this.syncRepoValidatedKey = '';
      try {
        this.syncRepoValidation = await api.validateSyncRepo(remoteUrl, branch);
        this.syncRepoValidatedKey = key;
        return this.syncRepoValidation;
      } finally {
        this.syncRepoValidating = false;
      }
    },

    async saveSyncRepo(remoteUrl: string, branch?: string) {
      this.syncRepoValidating = true;
      try {
        this.syncRepo = await api.saveSyncRepo(remoteUrl, branch);
        this.syncRepoValidation = null;
        this.syncRepoValidatedKey = '';
        if (this.syncRepo) {
          this.config.sync_repo = this.syncRepo;
        }
        await Promise.all([
          this.loadSkillsSyncStatus().catch(() => {}),
          this.loadDshPluginsSyncStatus().catch(() => {}),
        ]);
        return this.syncRepo;
      } finally {
        this.syncRepoValidating = false;
      }
    },

    async unbindSyncRepo() {
      this.syncRepoUnbinding = true;
      try {
        await api.unbindSyncRepo();
        this.syncRepo = null;
        this.syncRepoValidation = null;
        this.syncRepoValidatedKey = '';
        if (this.config) {
          this.config.sync_repo = undefined;
          if (this.config.skills_sync) {
            this.config.skills_sync.remoteUrl = '';
            this.config.skills_sync.branch = 'main';
          }
          if (this.config.dsh_plugins?.sync) {
            this.config.dsh_plugins.sync.remoteUrl = '';
            this.config.dsh_plugins.sync.branch = 'main';
          }
        }
        await Promise.all([
          this.loadSkillsSyncStatus().catch(() => {}),
          this.loadDshPluginsSyncStatus().catch(() => {}),
        ]);
        this.showToast({
          title: t('toast.unbindTitle'),
          message: t('toast.unbindMsg'),
          type: 'info',
        });
      } catch (e: any) {
        this.showToast({
          title: t('toast.unbindFailedTitle'),
          message: translateError(e, 'toast.unbindFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.syncRepoUnbinding = false;
      }
    },

    async initSkillsSync(remoteUrl: string, branch?: string) {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.initSkillsSync(remoteUrl, branch);
        await this.loadConfig();
        this.showToast({
          title: t('toast.syncInitTitle'),
          message: t('toast.syncInitMsg', { url: remoteUrl }),
          type: 'success',
        });
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async pullSkillsSync(showToast = true, trigger: SyncTrigger = 'manual') {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.pullSkillsSync(trigger);
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        if (showToast) {
          this.showToast({
            title: t('toast.pullDoneTitle'),
            message: t('toast.pullDoneMsg'),
            type: 'success',
          });
        }
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        if (showToast) {
          this.showToast({
            title: t('toast.pullFailedTitle'),
            message: translateError(e, 'toast.pullFailedMsg'),
            type: 'error',
          });
        }
        throw e;
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async pushSkillsSync(message?: string, paths?: string[]) {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.pushSkillsSync(message, paths, 'manual');
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        this.showToast({
          title: t('toast.pushDoneTitle'),
          message: paths && paths.length
            ? t('toast.pushDoneFilesMsg', { count: paths.length })
            : t('toast.pushDoneMsg'),
          type: 'success',
        });
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        this.showToast({
          title: t('toast.pushFailedTitle'),
          message: translateError(e, 'toast.pushFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async setSkillsSyncAutoPull(enabled: boolean) {
      await api.setSkillsSyncAutoPull(enabled);
      this.config.skills_sync = {
        remoteUrl: '',
        branch: 'main',
        lastSyncAt: 0,
        lastSyncStatus: 'idle',
        ...(this.config.skills_sync || {}),
        autoPullOnStartup: enabled,
      };
      await this.loadConfig();
      this.showToast({
        title: t(enabled ? 'toast.autoPullOnTitle' : 'toast.autoPullOffTitle'),
        message: t(enabled ? 'toast.autoPullOnMsg' : 'toast.autoPullOffMsg'),
        type: 'info',
      });
    },

    async testSkillsSyncConnection() {
      try {
        const message = await api.testSkillsSyncConnection();
        this.showToast({
          title: t('toast.testOkTitle'),
          message,
          type: 'success',
        });
      } catch (e: any) {
        this.showToast({
          title: t('toast.testFailedTitle'),
          message: translateError(e, 'toast.testFailedMsg'),
          type: 'error',
        });
        throw e;
      }
    },

    async resetSkillsSyncToRemote() {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.resetSkillsSyncToRemote('manual');
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        this.showToast({
          title: t('toast.resetDoneTitle'),
          message: t('toast.resetDoneMsg'),
          type: 'success',
        });
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        this.showToast({
          title: t('toast.resetFailedTitle'),
          message: translateError(e, 'toast.resetFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async applySkillsFromRemote(decisions: SkillsSyncDecision[]) {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.applySkillsFromRemote(decisions, 'manual');
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        this.showToast({
          title: t('toast.applyDoneTitle'),
          message: t('toast.applyDoneMsg'),
          type: 'success',
        });
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        this.showToast({
          title: t('toast.applyFailedTitle'),
          message: translateError(e, 'toast.applyFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async previewSkillsApply() {
      try {
        await api.fetchSkillsSync();
      } catch {}
      await this.loadSkillsSyncDiff().catch(() => {});
      this.skillsDiffModal = { visible: true, mode: 'apply' };
    },

    async previewSkillsPush() {
      try {
        await api.fetchSkillsSync();
      } catch {}
      await this.loadSkillsSyncDiff().catch(() => {});
      this.skillsDiffModal = { visible: true, mode: 'push' };
    },

    // ==================== DSH 插件中心 ====================

    async loadDshPlugins() {
      this.dshPluginsScanLoading = true;
      try {
        this.dshPluginsScan = await api.scanDshPlugins();
      } finally {
        this.dshPluginsScanLoading = false;
      }
    },

    async diagnoseDshWeb(profile?: string) {
      this.dshDiagnosing = true;
      try {
        this.dshDiagnose = await api.diagnoseDshWeb(profile);
        return this.dshDiagnose;
      } finally {
        this.dshDiagnosing = false;
      }
    },

    async applyDshRecovery(action: DshRecoveryAction) {
      await api.applyDshRecovery(action);
      await this.loadDshPlugins();
      this.showToast({
        title: t('toast.recoveryDoneTitle'),
        message: action.description,
        type: 'success',
      });
    },

    async toggleDshPlugin(profile: string, key: string, enabled: boolean) {
      await api.toggleDshPlugin(profile, key, enabled);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: t(enabled ? 'toast.pluginEnabledTitle' : 'toast.pluginDisabledTitle'),
        message: t('toast.pluginToggleMsg', {
          profile,
          key,
          action: t(enabled ? 'toast.pluginEnableAction' : 'toast.pluginDisableAction'),
        }),
        type: 'info',
      });
    },

    async removeDshPlugin(profile: string, key: string) {
      await api.removeDshPlugin(profile, key);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: t('toast.pluginUninstalledTitle'),
        message: t('toast.pluginUninstalledMsg', { profile, key }),
        type: 'warning',
      });
    },

    async adoptDshOrphan(profile: string, pkgName: string) {
      await api.adoptDshOrphan(profile, pkgName);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: t('toast.pluginAdoptedTitle'),
        message: t('toast.pluginAdoptedMsg', { name: pkgName, profile }),
        type: 'success',
      });
    },

    async loadDshInstallEntries(profile?: string) {
      const target = (profile || '').trim() || this.dshPluginsScan?.profiles[0]?.name || 'web';
      this.dshInstallEntriesLoading = true;
      try {
        this.dshInstallEntries = await api.scanDshInstallEntries(target);
      } finally {
        this.dshInstallEntriesLoading = false;
      }
    },

    async installDshPlugins(profile: string, mode: DshInstallMode = 'incremental') {
      this.dshInstalling = true;
      try {
        this.dshInstallReport = await api.installDshPlugins(profile, mode);
        await this.loadDshPlugins();
        await this.loadDshInstallEntries(profile);
        if (this.dshInstallReport.ok) {
          this.showToast({
            title: t('toast.installDoneTitle'),
            message: t('toast.installDoneMsg', {
              profile,
              mode,
              count: this.dshInstallReport.installed.length,
            }),
            type: 'success',
          });
        } else {
          this.showToast({
            title: t('toast.installPartialTitle'),
            message: t('toast.installPartialMsg', {
              count: this.dshInstallReport.failed.length,
              names: this.dshInstallReport.failed.map(f => f.name).join(', '),
            }),
            type: 'error',
          });
        }
        return this.dshInstallReport;
      } catch (e: any) {
        await this.loadDshInstallEntries(profile).catch(() => {});
        this.showToast({
          title: t('toast.installFailedTitle'),
          message: translateError(e, 'toast.installFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.dshInstalling = false;
      }
    },

    async installDshPluginsStreamed(profile: string, mode: DshInstallMode) {
      this.dshInstalling = true;
      this.installTerminal = { visible: true, lines: [], running: true };
      try {
        this.dshInstallReport = await api.installDshPluginsStreamed(profile, mode, line => {
          this.installTerminal.lines.push(line);
        });
        this.installTerminal.running = false;
        await this.loadDshPlugins();
        await this.loadDshInstallEntries(profile);
        if (this.dshInstallReport.ok) {
          this.showToast({
            title: t('toast.installDoneTitle'),
            message: t('toast.installDoneMsg', {
              profile,
              mode,
              count: this.dshInstallReport.installed.length,
            }),
            type: 'success',
          });
        } else {
          this.showToast({
            title: t('toast.installPartialTitle'),
            message: t('toast.installPartialMsg', {
              count: this.dshInstallReport.failed.length,
              names: this.dshInstallReport.failed.map(f => f.name).join(', '),
            }),
            type: 'error',
          });
        }
        return this.dshInstallReport;
      } catch (e: any) {
        this.installTerminal.running = false;
        await this.loadDshInstallEntries(profile).catch(() => {});
        this.showToast({
          title: t('toast.installFailedTitle'),
          message: translateError(e, 'toast.installFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.dshInstalling = false;
      }
    },

    toggleInstallTerminal(visible: boolean) {
      this.installTerminal.visible = visible;
      if (!visible) this.installTerminal.running = false;
    },

    async clearDshInstallState(profile: string, pkg?: string) {
      await api.clearDshInstallState(profile, pkg);
      await this.loadDshInstallEntries(profile);
      this.showToast({
        title: t('toast.installStateClearedTitle'),
        message: pkg
          ? t('toast.installStateClearedPkgMsg', { pkg })
          : t('toast.installStateClearedAllMsg', { profile }),
        type: 'info',
      });
    },

    async checkDshPluginUpdate(profile: string, key: string) {
      const result = await api.checkDshPluginUpdate(profile, key);
      this.dshPluginUpdates = {
        ...this.dshPluginUpdates,
        [key]: result,
      };
      return result;
    },

    async updateDshPlugin(profile: string, key: string) {
      this.dshInstalling = true;
      try {
        const report = await api.updateDshPlugin(profile, key);
        await this.loadDshPlugins();
        await this.loadDshInstallEntries(profile);
        // 更新完成后清除该包的更新检查缓存
        const updates = { ...this.dshPluginUpdates };
        delete updates[key];
        this.dshPluginUpdates = updates;
        if (report.ok) {
          this.showToast({
            title: t('toast.pluginUpdateDoneTitle'),
            message: t('toast.pluginUpdateDoneMsg', { profile, key }),
            type: 'success',
          });
        } else {
          this.showToast({
            title: t('toast.pluginUpdateFailedTitle'),
            message: report.failed.map(f => `${f.name}: ${f.reason}`).join('\n'),
            type: 'error',
          });
        }
        return report;
      } catch (e: any) {
        await this.loadDshInstallEntries(profile).catch(() => {});
        this.showToast({
          title: t('toast.pluginUpdateFailedTitle'),
          message: translateError(e, 'toast.pluginUpdateFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.dshInstalling = false;
      }
    },

    async loadDshPluginsSyncStatus() {
      this.dshPluginsSyncStatus = await api.getDshPluginsSyncStatus();
    },

    // ==================== 应用本体在线更新 (cc-switch 风格) ====================

    openUpdateModal() {
      this.updateModal.visible = true;
    },

    closeUpdateModal() {
      this.updateModal.visible = false;
      if (!this.appUpdateDownloading) {
        this.appUpdateError = null;
      }
    },

    async checkAppUpdate(showToast = true) {
      this.appUpdateChecking = true;
      try {
        this.appUpdate = await api.checkAppUpdate();
        if (this.appUpdate.error) {
          if (showToast) {
            this.showToast({
              title: t('toast.checkUpdateFailedTitle'),
              message: translateError(this.appUpdate.error, 'toast.checkUpdateFailedMsg'),
              type: 'error',
            });
          }
        } else if (this.appUpdate.updateAvailable) {
          if (showToast) {
            this.showToast({
              title: t('toast.foundNewVersionTitle'),
              message: t('toast.foundNewVersionMsg', { version: this.appUpdate.latestVersion }),
              type: 'info',
            });
          }
        } else if (showToast) {
          this.showToast({
            title: t('toast.latestVersionTitle'),
            message: t('toast.latestVersionMsg', { version: this.appUpdate.currentVersion }),
            type: 'success',
          });
        }
        return this.appUpdate;
      } catch (e: any) {
        if (showToast) {
          this.showToast({
            title: t('toast.checkUpdateFailedTitle'),
            message: translateError(e, 'toast.checkUpdateFailedMsg'),
            type: 'error',
          });
        }
        throw e;
      } finally {
        this.appUpdateChecking = false;
      }
    },

    async downloadAppUpdate() {
      if (this.appUpdateDownloading) return;
      this.appUpdateDownloading = true;
      this.appUpdateProgress = 0;
      this.appUpdateError = null;
      this.appUpdateDownloadedPath = null;
      try {
        const report = await api.downloadAppUpdate((_downloaded, _total, percent) => {
          this.appUpdateProgress = percent;
        });
        this.appUpdateProgress = 100;
        this.appUpdateDownloadedPath = report.path || null;
        return report;
      } catch (e: any) {
        this.appUpdateError = translateError(e, 'toast.downloadFailedMsg');
        throw e;
      } finally {
        this.appUpdateDownloading = false;
      }
    },

    async installAppUpdate() {
      if (!this.appUpdateDownloadedPath) {
        throw new Error('尚未下载更新安装包');
      }
      await api.installAppUpdate(this.appUpdateDownloadedPath);
      this.showToast({
        title: t('toast.installingUpdateTitle'),
        message: t('toast.installingUpdateMsg'),
        type: 'info',
      });
    },

    async loadDshPluginsSyncDiff() {
      this.dshPluginsSyncDiff = await api.getDshPluginsSyncDiff();
    },

    async initDshPluginsSync(remoteUrl: string, branch?: string) {
      this.dshPluginsSyncLoading = true;
      try {
        this.dshPluginsSyncStatus = await api.initDshPluginsSync(remoteUrl, branch);
        await this.loadConfig();
        this.showToast({
          title: t('toast.pluginSyncInitTitle'),
          message: t('toast.pluginSyncInitMsg', { url: remoteUrl }),
          type: 'success',
        });
      } finally {
        this.dshPluginsSyncLoading = false;
      }
    },

    async pullDshPluginsSync(showToast = true, trigger: SyncTrigger = 'manual') {
      this.dshPluginsSyncLoading = true;
      try {
        this.dshPluginsSyncStatus = await api.pullDshPluginsSync(trigger);
        this.loadDshPluginsSyncDiff().catch(() => {});
        if (showToast) {
          this.showToast({
            title: t('toast.pluginMirrorPulledTitle'),
            message: t('toast.pluginMirrorPulledMsg'),
            type: 'success',
          });
        }
      } catch (e: any) {
        this.dshPluginsSyncStatus = await api.getDshPluginsSyncStatus().catch(() => this.dshPluginsSyncStatus);
        if (showToast) {
          this.showToast({
            title: t('toast.pullFailedTitle'),
            message: translateError(e, 'toast.pluginPullFailedMsg'),
            type: 'error',
          });
        }
        throw e;
      } finally {
        this.dshPluginsSyncLoading = false;
      }
    },

    async pushDshPluginsSync(message?: string) {
      this.dshPluginsSyncLoading = true;
      try {
        this.dshPluginsSyncStatus = await api.pushDshPluginsSync(message, 'manual');
        await this.reconcileDshPlugins();
        this.loadDshPluginsSyncDiff().catch(() => {});
        this.showToast({
          title: t('toast.pushDoneTitle'),
          message: t('toast.pluginPushDoneMsg'),
          type: 'success',
        });
      } catch (e: any) {
        this.dshPluginsSyncStatus = await api.getDshPluginsSyncStatus().catch(() => this.dshPluginsSyncStatus);
        this.showToast({
          title: t('toast.pluginPushFailedTitle'),
          message: translateError(e, 'toast.pluginPushFailedMsg'),
          type: 'error',
        });
        throw e;
      } finally {
        this.dshPluginsSyncLoading = false;
      }
    },

    async setDshPluginsSyncAutoPull(enabled: boolean) {
      await api.setDshPluginsSyncAutoPull(enabled);
      await this.loadConfig();
      this.showToast({
        title: t(enabled ? 'toast.pluginAutoPullOnTitle' : 'toast.pluginAutoPullOffTitle'),
        message: t(enabled ? 'toast.pluginAutoPullOnMsg' : 'toast.pluginAutoPullOffMsg'),
        type: 'info',
      });
    },

    async reconcileDshPlugins() {
      this.dshPluginDiff = await api.reconcileDshPlugins();
      return this.dshPluginDiff;
    },

    /** 「从仓库应用」：拉取镜像 → 对账 → 弹差异预览，用户确认后才写回本地（对齐）。 */
    async applyDshFromRepo() {
      try {
        await this.pullDshPluginsSync(false);
      } catch (e: any) {
        this.showToast({
          title: t('toast.pluginPullRepoFailedTitle'),
          message: translateError(e, 'toast.pluginPullFailedMsg'),
          type: 'error',
        });
        return;
      }
      await this.reconcileDshPlugins();
      this.dshPluginDiffModal = { visible: true, mode: 'apply' };
    },

    async alignDshPlugins(profile?: string, decisions?: DshAlignDecision[]) {
      await api.alignDshPlugins(profile, decisions);
      await this.loadDshPlugins();
      await this.reconcileDshPlugins();
      if (profile) await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: t('toast.pluginAlignDoneTitle'),
        message: t('toast.pluginAlignDoneMsg'),
        type: 'success',
      });
    },

    // ==================== DSH 配置快照与回滚 (WI-006) ====================

    async loadDshSnapshots(profile?: string) {
      const target = (profile || '').trim() || this.dshPluginsScan?.profiles[0]?.name || 'web';
      this.dshSnapshotsLoading = true;
      try {
        this.dshSnapshots = await api.listDshConfigSnapshots(target);
      } finally {
        this.dshSnapshotsLoading = false;
      }
    },

    async createDshConfigSnapshot(profile: string, note?: string) {
      const snap = await api.createDshConfigSnapshot(profile, note);
      await this.loadDshSnapshots(profile);
      this.showToast({
        title: t('toast.snapshotCreatedTitle'),
        message: t('toast.snapshotCreatedMsg', { profile, note: note ? `：${note}` : '' }),
        type: 'success',
      });
      return snap;
    },

    async rollbackDshConfigSnapshot(snapshotId: string) {
      const result = await api.rollbackDshConfigSnapshot(snapshotId);
      await this.loadDshSnapshots(result.profile);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(result.profile).catch(() => {});
      this.showToast({
        title: t('toast.snapshotRolledBackTitle'),
        message: t('toast.snapshotRolledBackMsg', {
          profile: result.profile,
          files: result.restored.join(', '),
        }),
        type: 'warning',
      });
      return result;
    },

    async setDshConfigSnapshotPermanent(snapshotId: string, permanent: boolean) {
      const snap = await api.setDshConfigSnapshotPermanent(snapshotId, permanent);
      await this.loadDshSnapshots(snap.profileName);
      this.showToast({
        title: t(permanent ? 'toast.snapshotMarkedTitle' : 'toast.snapshotUnmarkedTitle'),
        message: snap.id,
        type: 'info',
      });
      return snap;
    },

    async deleteDshConfigSnapshot(snapshotId: string) {
      const snap = this.dshSnapshots.find(s => s.id === snapshotId);
      await api.deleteDshConfigSnapshot(snapshotId);
      await this.loadDshSnapshots(snap?.profileName || this.dshPluginsScan?.profiles[0]?.name || 'web');
      this.showToast({
        title: t('toast.snapshotDeletedTitle'),
        message: snapshotId,
        type: 'info',
      });
    },

    // ==================== DSH 版本升级与版本管理 (WI-009) ====================

    async loadDshVersion() {
      try {
        this.dshVersionInfo = await api.getDshVersionInfo();
      } catch (e: any) {
        this.dshVersionInfo = null;
      }
      await this.loadDshVersions();
    },

    async loadDshVersions() {
      try {
        this.dshVersions = await api.listDshVersions();
      } catch {
        this.dshVersions = [];
      }
    },

    async loadDshAvailableVersions() {
      this.dshAvailableVersionsLoading = true;
      try {
        this.dshAvailableVersions = await api.listDshAvailableVersions();
      } catch (e: any) {
        this.dshAvailableVersions = null;
        this.showToast({
          title: t('toast.versionListFailedTitle'),
          message: translateError(e, 'toast.versionListFailedMsg'),
          type: 'error',
        });
      } finally {
        this.dshAvailableVersionsLoading = false;
      }
      return this.dshAvailableVersions;
    },

    async launchDsh(profile?: string) {
      this.dshLaunching = true;
      this.dshLaunchError = null;
      this.dshLaunchStderr = null;
      try {
        const result: DshLaunchResult = await api.launchDshWeb(profile);
        if (result.ok) {
          this.showToast({ title: t('toast.launchDoneTitle'), message: result.message || t('toast.launchDoneMsg'), type: 'success' });
        } else {
          const raw = result.stderr || result.error || '';
          const isPortBusy = /EADDRINUSE|端口占用|端口已被占用/i.test(raw);
          if (isPortBusy) {
            this.showToast({
              title: t('toast.portBusyTitle'),
              message: t('toast.portBusyMsg'),
              type: 'warning',
            });
          } else {
            this.dshLaunchError = result.error || t('toast.launchFailedMsg');
            this.dshLaunchStderr = result.stderr || result.error || '';
            this.showToast({ title: t('toast.launchFailedTitle'), message: this.dshLaunchError ?? t('toast.launchFailedMsg'), type: 'error' });
          }
        }
        return result;
      } catch (e: any) {
        this.dshLaunchError = translateError(e, 'toast.launchFailedMsg');
        this.dshLaunchStderr = typeof e === 'string' ? e : (e?.message || '');
        this.showToast({ title: t('toast.launchFailedTitle'), message: this.dshLaunchError ?? t('toast.launchFailedMsg'), type: 'error' });
        throw e;
      } finally {
        this.dshLaunching = false;
      }
    },

    async checkDshVersionUpdate() {
      this.dshVersionChecking = true;
      try {
        this.dshVersionCheck = await api.checkDshVersionUpdate();
      } finally {
        this.dshVersionChecking = false;
      }
      return this.dshVersionCheck;
    },

    async upgradeDsh() {
      this.dshVersionUpgrading = true;
      this.dshVersionTerminal = { visible: true, lines: [], running: true };
      try {
        const result = await api.upgradeDshStreamed(line => {
          this.dshVersionTerminal.lines.push(line);
        });
        this.dshVersionTerminal.running = false;
        this.dshVersionResult = result;
        await this.loadDshVersion();
        await this.loadDshPlugins().catch(() => {});
        if (result.massFailure) {
          this.showToast({
            title: t('toast.upgradeMassFailTitle'),
            message: t('toast.upgradeMassFailMsg', {
              before: result.diagnosisBefore,
              after: result.diagnosisAfter,
            }),
            type: 'error',
          });
        } else if (result.ok) {
          this.showToast({
            title: t('toast.upgradeDoneTitle'),
            message: `${result.beforeVersion || t('common.unknown')} → ${result.afterVersion || result.targetVersion}`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: t('toast.upgradePartialTitle'),
            message: result.error || result.warnings.join('\n') || result.output,
            type: 'error',
          });
        }
        return result;
      } catch (e: any) {
        this.dshVersionTerminal.running = false;
        throw e;
      } finally {
        this.dshVersionUpgrading = false;
      }
    },

    async installDshVersion(version: string) {
      this.dshVersionUpgrading = true;
      this.dshVersionTerminal = { visible: true, lines: [], running: true };
      try {
        const result = await api.installDshVersionStreamed(version, line => {
          this.dshVersionTerminal.lines.push(line);
        });
        this.dshVersionTerminal.running = false;
        this.dshVersionResult = result;
        await this.loadDshVersion();
        await this.loadDshPlugins().catch(() => {});
        if (result.massFailure) {
          this.showToast({
            title: t('toast.installVersionMassFailTitle'),
            message: t('toast.installVersionMassFailMsg', {
              before: result.diagnosisBefore,
              after: result.diagnosisAfter,
            }),
            type: 'error',
          });
        } else if (result.ok) {
          this.showToast({
            title: t('toast.installVersionDoneTitle'),
            message: `${result.beforeVersion || t('common.unknown')} → ${result.afterVersion || result.targetVersion}`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: t('toast.installVersionPartialTitle'),
            message: result.error || result.warnings.join('\n') || result.output,
            type: 'error',
          });
        }
        return result;
      } catch (e: any) {
        this.dshVersionTerminal.running = false;
        throw e;
      } finally {
        this.dshVersionUpgrading = false;
      }
    },

    async rollbackDsh(previousVersion: string, snapshotIds: string[]) {
      this.dshVersionRollingBack = true;
      this.dshVersionTerminal = { visible: true, lines: [], running: true };
      try {
        const result = await api.rollbackDshStreamed(previousVersion, snapshotIds, line => {
          this.dshVersionTerminal.lines.push(line);
        });
        this.dshVersionTerminal.running = false;
        await this.loadDshVersion();
        await this.loadDshPlugins().catch(() => {});
        if (result.ok) {
          this.showToast({
            title: t('toast.rollbackDoneTitle'),
            message: t('toast.rollbackDoneMsg', {
              version: result.version || previousVersion,
              snapshots: result.restoredSnapshots.length
                ? t('toast.rollbackSnapshots', { count: result.restoredSnapshots.length })
                : '',
            }),
            type: 'success',
          });
        } else {
          this.showToast({
            title: t('toast.rollbackFailedTitle'),
            message: result.error || result.output,
            type: 'error',
          });
        }
        return result;
      } catch (e: any) {
        this.dshVersionTerminal.running = false;
        throw e;
      } finally {
        this.dshVersionRollingBack = false;
      }
    },

    async toggleSkillForAgent(skillName: string, agentId: string, enable: boolean) {
      const skill = this.skills.find(s => s.id === skillName);
      if (skill) {
        if (enable && !skill.mountedAgents.includes(agentId)) {
          skill.mountedAgents.push(agentId);
        } else if (!enable) {
          skill.mountedAgents = skill.mountedAgents.filter(id => id !== agentId);
        }
        skill.enabled = skill.mountedAgents.length > 0;
      }

      try {
        await api.toggleSkillForAgent(skillName, agentId, enable);
      } catch (e) {
        console.error('toggleSkillForAgent error:', e);
      }
      await this.loadSkills();
      const action = t(enable ? 'toast.skillMountAction' : 'toast.skillUnmountAction');
      this.showToast({
        title: t('toast.skillToggleTitle', { action }),
        message: t('toast.skillToggleMsg', { agent: agentId, action, skill: skillName }),
        type: 'info',
      });
    },

    async toggleGlobalSkill(skillName: string, enable: boolean) {
      const skill = this.skills.find(s => s.id === skillName);
      const targetAgents = this.agents.filter(a => a.detected && a.enabled);
      if (skill) {
        if (enable) {
          skill.mountedAgents = targetAgents.map(a => a.id);
        } else {
          skill.mountedAgents = [];
        }
        skill.enabled = enable;
      }

      for (const a of targetAgents) {
        try {
          await api.toggleSkillForAgent(skillName, a.id, enable);
        } catch (e) {
          console.error(`Failed to toggle ${skillName} for ${a.id}:`, e);
        }
      }
      await this.loadSkills();
      this.showToast({
        title: t(enable ? 'toast.globalEnabledTitle' : 'toast.globalDisabledTitle'),
        message: t('toast.globalToggleMsg', {
          skill: skillName,
          action: t(enable ? 'toast.globalMountAction' : 'toast.globalUnmountAction'),
        }),
        type: 'success',
      });
    },

    async mountSkillToAllActive(skillName: string) {
      const activeAgents = this.agents.filter(a => a.detected && a.enabled);
      for (const a of activeAgents) {
        await api.toggleSkillForAgent(skillName, a.id, true);
      }
      await this.loadSkills();
      this.showToast({
        title: t('toast.distributeDoneTitle'),
        message: t('toast.distributeDoneMsg', { count: activeAgents.length }),
        type: 'success',
      });
    },

    async unmountSkillFromAll(skillName: string) {
      for (const a of this.agents) {
        await api.toggleSkillForAgent(skillName, a.id, false);
      }
      await this.loadSkills();
      this.showToast({
        title: t('toast.unmountAllDoneTitle'),
        message: t('toast.unmountAllDoneMsg'),
        type: 'info',
      });
    },

    async batchMountSkills(skillNames: string[], agentIds: string[], enable: boolean) {
      for (const sName of skillNames) {
        for (const aId of agentIds) {
          await api.toggleSkillForAgent(sName, aId, enable);
        }
      }
      await this.loadSkills();
      this.selectedSkillIds = [];
      this.showToast({
        title: t('toast.batchDoneTitle'),
        message: t('toast.batchDoneMsg', {
          count: skillNames.length,
          action: t(enable ? 'toast.batchDistributeAction' : 'toast.batchUnmountAction'),
        }),
        type: 'success',
      });
    },

    async saveSkill(skillName: string, content: string) {
      await api.saveSkill(skillName, content);
      await this.loadSkills();
      this.showToast({
        title: t('toast.skillSavedTitle'),
        message: t('toast.skillSavedMsg', { skill: skillName }),
        type: 'success',
      });
    },

    async deleteSkill(skillName: string) {
      await api.deleteSkill(skillName);
      await this.loadSkills();
      if (this.activeSkillId === skillName) {
        this.activeSkillId = null;
      }
      this.showToast({
        title: t('toast.skillDeletedTitle'),
        message: t('toast.skillDeletedMsg', { skill: skillName }),
        type: 'warning',
      });
    },

    async takeoverSkill(agentId: string, skillName: string, resolution: 'overwrite' | 'rename' | 'skip') {
      await api.takeoverUnmanagedSkill(agentId, skillName, resolution);
      await this.loadSkills();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.takeoverDoneTitle'),
        message: t('toast.takeoverDoneMsg', { agent: agentId, skill: skillName }),
        type: 'success',
      });
    },

    async takeoverAllForAgent(agentId: string) {
      const list = this.unmanagedSkills.filter(u => u.agentId === agentId);
      for (const item of list) {
        await api.takeoverUnmanagedSkill(item.agentId, item.skillName, 'overwrite');
      }
      await this.loadSkills();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.takeoverAllDoneTitle'),
        message: t('toast.takeoverAllDoneMsg', { agent: agentId, count: list.length }),
        type: 'success',
      });
    },

    async takeoverAllUnmanagedSkills() {
      const list = [...this.unmanagedSkills];
      for (const item of list) {
        await api.takeoverUnmanagedSkill(item.agentId, item.skillName, 'overwrite');
      }
      await this.loadSkills();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.takeoverAllUnmanagedTitle'),
        message: t('toast.takeoverAllUnmanagedMsg', { count: list.length }),
        type: 'success',
      });
    },

    async ignoreSkill(item: UnmanagedSkill) {
      await api.ignoreSkill(item.agentId, item.agentName, item.skillName, item.path);
      await this.loadConfig();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.ignoreDoneTitle'),
        message: t('toast.ignoreDoneMsg', { agent: item.agentName, skill: item.skillName }),
        type: 'info',
      });
    },

    async ignoreAllForAgent(agentId: string) {
      const list = this.unmanagedSkills.filter(u => u.agentId === agentId);
      for (const item of list) {
        await api.ignoreSkill(item.agentId, item.agentName, item.skillName, item.path);
      }
      await this.loadConfig();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.ignoreAllDoneTitle'),
        message: t('toast.ignoreAllDoneMsg', { agent: agentId }),
        type: 'info',
      });
    },

    async unignoreSkill(agentId: string, skillName: string) {
      await api.unignoreSkill(agentId, skillName);
      await this.loadConfig();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.unignoreDoneTitle'),
        message: t('toast.unignoreDoneMsg', { skill: skillName }),
        type: 'success',
      });
    },

    async unignoreAllForAgent(agentId: string) {
      const list = (this.config.ignored_skills || []).filter(i => i.agentId === agentId);
      for (const item of list) {
        await api.unignoreSkill(item.agentId, item.skillName);
      }
      await this.loadConfig();
      await this.scanUnmanaged();
      this.showToast({
        title: t('toast.unignoreAllDoneTitle'),
        message: t('toast.unignoreAllDoneMsg', { agent: agentId }),
        type: 'success',
      });
    },

    openAgentDetailModal(agentId: string, tab: 'unmanaged' | 'ignored' | 'skills' = 'unmanaged') {
      this.agentDetailModal = {
        visible: true,
        agentId,
        activeTab: tab,
      };
    },

    closeAgentDetailModal() {
      this.agentDetailModal.visible = false;
    },

    async loadProjects() {
      this.projects = await api.getProjects();
      if (this.projects.length > 0 && !this.activeProjectId) {
        this.activeProjectId = this.projects[0].id;
      }
    },

    async addProject(path: string, name: string) {
      const newProj = await api.addProject(path, name);
      await this.loadProjects();
      this.activeProjectId = newProj.id;
      this.showToast({
        title: t('toast.projectAddedTitle'),
        message: t('toast.projectAddedMsg', { name: newProj.name }),
        type: 'success',
      });
    },

    async updateProjectRule(
      projectId: string,
      ruleMode: 'overwrite' | 'append',
      customContent: string,
      enabled: boolean,
      linkedAgents: string[],
      preCommitGuard?: boolean
    ) {
      await api.updateProjectRule(projectId, ruleMode, customContent, enabled, linkedAgents, preCommitGuard);
      await this.loadProjects();
      this.showToast({
        title: t('toast.ruleAppliedTitle'),
        message: t(ruleMode === 'overwrite' ? 'toast.ruleAppliedOverwriteMsg' : 'toast.ruleAppliedAppendMsg'),
        type: 'success',
      });
    },

    async deleteProject(projectId: string) {
      await api.deleteProject(projectId);
      await this.loadProjects();
      if (this.activeProjectId === projectId) {
        this.activeProjectId = this.projects.length > 0 ? this.projects[0].id : null;
      }
      this.showToast({
        title: t('toast.projectRemovedTitle'),
        message: t('toast.projectRemovedMsg'),
        type: 'info',
      });
    },

    async repairGitHooks(projectId: string) {
      try {
        await api.repairGitHooks(projectId);
        await this.loadProjects();
        this.showToast({
          title: t('toast.hookReadyTitle'),
          message: t('toast.hookReadyMsg'),
          type: 'success',
        });
      } catch (err: any) {
        this.showToast({
          title: t('toast.hookRepairFailedTitle'),
          message: translateError(err, 'toast.hookRepairFailedMsg'),
          type: 'error',
        });
      }
    },

    openDiffModal(params: {
      title: string;
      agentId?: string;
      skillName?: string;
      localContent: string;
      remoteContent: string;
      localLabel?: string;
      remoteLabel?: string;
      onResolve?: (action: 'overwrite' | 'rename' | 'skip') => void;
    }) {
      this.diffModal = {
        visible: true,
        title: params.title,
        agentId: params.agentId,
        skillName: params.skillName,
        localContent: params.localContent,
        remoteContent: params.remoteContent,
        localLabel: params.localLabel || t('diff.localLabel'),
        remoteLabel: params.remoteLabel || t('diff.centralLabel'),
        onResolve: params.onResolve,
      };
    },

    closeDiffModal() {
      this.diffModal.visible = false;
    },

    showToast(toast: Omit<ToastMessage, 'id' | 'timestamp'>) {
      if (!this.config.toast_notifications) return;
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastMessage = {
        ...toast,
        id,
        timestamp: Date.now(),
      };
      this.toasts.push(newToast);

      setTimeout(() => {
        this.removeToast(id);
      }, 4000);
    },

    removeToast(id: string) {
      this.toasts = this.toasts.filter(t => t.id !== id);
    },

    // ==================== 应用日志系统 (WI-007) ====================

    openLogViewer() {
      this.logViewerModal.visible = true;
      this.loadAppLogs(undefined, this.appLogLevel || undefined).catch(() => {});
    },

    closeLogViewer() {
      this.logViewerModal.visible = false;
    },

    async loadAppLogs(limit?: number, level?: string) {
      this.appLogsLoading = true;
      try {
        const result = await api.getAppLogs(limit ?? 500, level);
        this.appLogs = result.entries;
        this.appLogPath = result.logPath;
        return result;
      } finally {
        this.appLogsLoading = false;
      }
    },

    async exportAppLogs() {
      const result = await api.exportAppLogs();
      this.showToast({
        title: t('toast.logExportDoneTitle'),
        message: result.exportPath,
        type: 'success',
      });
      return result;
    },

    async refreshAppLogPath() {
      const result = await api.getAppLogPath();
      this.appLogPath = result.logPath;
      return result;
    },
  },
});
