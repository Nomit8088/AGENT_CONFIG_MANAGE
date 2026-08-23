import { defineStore } from 'pinia';
import {
  AgentInfo,
  AppConfig,
  AppUpdateCheck,
  DshConfigSnapshot,
  DshDiagnoseResult,
  DshInstallMode,
  DshInstallReport,
  DshPluginDiff,
  DshPluginInstallEntry,
  DshPluginScanResult,
  DshPluginUpdateCheck,
  DshRecoveryAction,
  DshVersionCheck,
  DshVersionHistoryEntry,
  DshVersionInfo,
  DshVersionUpgradeResult,
  IgnoredSkill,
  ProjectInfo,
  SkillItem,
  SkillsSyncStatus,
  SyncDiffEntry,
  SyncRepoConfig,
  SyncRepoValidation,
  ToastMessage,
  UnmanagedSkill,
} from '../types';
import { api } from '../services/api';

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
      title: '版本差异与冲突决策',
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
        if (
          this.config.skills_sync?.autoPullOnStartup &&
          (this.syncRepo?.remoteUrl || this.config.skills_sync.remoteUrl)
        ) {
          this.pullSkillsSync(false).catch(() => {});
        }

        // DSH 插件中心：静默加载扫描与同步状态（失败不阻塞主流程）
        this.loadDshPlugins().catch(() => {});
        this.loadDshPluginsSyncStatus().catch(() => {});
        if (
          this.config.dsh_plugins?.sync?.autoPullOnStartup &&
          (this.syncRepo?.remoteUrl || this.config.dsh_plugins?.sync?.remoteUrl)
        ) {
          this.pullDshPluginsSync(false).catch(() => {});
        }

        api.onExternalSkillCreated((path) => {
          this.showToast({
            title: '⚡ 自动捕获到外部新 Skill',
            message: `检测到新安装的技能: ${path.split(/[\/\\]/).pop()}，已自动就绪！`,
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
        title: '设置已更新',
        message: '客户端全局配置已成功保存',
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
          title: 'Agent 扫描完成',
          message: `已自动探测到 ${this.detectedAgentsCount} 个本地 Agent 环境`,
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
          title: enabled ? '已启用 Agent' : '已停用 Agent',
          message: `${agent.name} 已${enabled ? '启用（将在矩阵与规则中展示）' : '停用（已从其他页面隐藏）'}`,
          type: 'info',
        });
      }
    },

    async addCustomAgent(agent: AgentInfo) {
      this.agents.push(agent);
      await api.saveAgentsList(this.agents);
      this.showToast({
        title: '添加成功',
        message: `自定义 Agent [${agent.name}] 已注册并启用`,
        type: 'success',
      });
    },

    async deleteCustomAgent(agentId: string) {
      const target = this.agents.find(a => a.id === agentId);
      this.agents = this.agents.filter(a => a.id !== agentId);
      await api.saveAgentsList(this.agents);
      this.showToast({
        title: '已移除 Agent',
        message: `已移除自定义 Agent [${target?.name || agentId}]`,
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
          title: '仓库已解绑',
          message: '同步中心已锁定；本地数据与 Git 历史均已保留',
          type: 'info',
        });
      } catch (e: any) {
        this.showToast({
          title: '解绑失败',
          message: e?.message || '无法解绑仓库',
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
          title: '同步仓库已连接',
          message: `中央技能库已初始化，远端: ${remoteUrl}`,
          type: 'success',
        });
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async pullSkillsSync(showToast = true) {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.pullSkillsSync();
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        if (showToast) {
          this.showToast({
            title: '拉取完成',
            message: '中央技能库已与远端同步',
            type: 'success',
          });
        }
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        if (showToast) {
          this.showToast({
            title: '拉取失败',
            message: e?.message || '无法拉取远端技能库',
            type: 'error',
          });
        }
        throw e;
      } finally {
        this.skillsSyncLoading = false;
      }
    },

    async pushSkillsSync(message?: string) {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.pushSkillsSync(message);
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        this.showToast({
          title: '推送完成',
          message: '中央技能库已提交并推送到远端',
          type: 'success',
        });
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        this.showToast({
          title: '推送失败',
          message: e?.message || '无法推送中央技能库',
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
        title: enabled ? '启动自动拉取已开启' : '启动自动拉取已关闭',
        message: enabled ? '每次启动 AgentHub 会静默拉取最新中央技能库' : 'AgentHub 启动时将不再自动联网拉取',
        type: 'info',
      });
    },

    async testSkillsSyncConnection() {
      try {
        const message = await api.testSkillsSyncConnection();
        this.showToast({
          title: '连接测试成功',
          message,
          type: 'success',
        });
      } catch (e: any) {
        this.showToast({
          title: '连接测试失败',
          message: e?.message || '无法连接远端仓库',
          type: 'error',
        });
        throw e;
      }
    },

    async resetSkillsSyncToRemote() {
      this.skillsSyncLoading = true;
      try {
        this.skillsSyncStatus = await api.resetSkillsSyncToRemote();
        await this.loadSkills();
        this.loadSkillsSyncDiff().catch(() => {});
        this.showToast({
          title: '已重置为远端',
          message: '本地中央技能库已与远端完全一致',
          type: 'success',
        });
      } catch (e: any) {
        this.skillsSyncStatus = await api.getSkillsSyncStatus().catch(() => this.skillsSyncStatus);
        this.showToast({
          title: '重置失败',
          message: e?.message || '无法重置本地中央技能库',
          type: 'error',
        });
        throw e;
      } finally {
        this.skillsSyncLoading = false;
      }
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
        title: '已应用恢复动作',
        message: action.description,
        type: 'success',
      });
    },

    async toggleDshPlugin(profile: string, key: string, enabled: boolean) {
      await api.toggleDshPlugin(profile, key, enabled);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: enabled ? '插件已启用' : '插件已停用',
        message: `profile [${profile}] 的 ${key} 已${enabled ? '启用' : '停用'}`,
        type: 'info',
      });
    },

    async removeDshPlugin(profile: string, key: string) {
      await api.removeDshPlugin(profile, key);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: '插件已卸载',
        message: `profile [${profile}] 的 ${key} 已从配置中移除（并已尽力清理 node_modules）`,
        type: 'warning',
      });
    },

    async adoptDshOrphan(profile: string, pkgName: string) {
      await api.adoptDshOrphan(profile, pkgName);
      await this.loadDshPlugins();
      await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: '已纳入配置',
        message: `${pkgName} 已写入 profile [${profile}] 的 dependencies + bundles`,
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
            title: '安装完成',
            message: `profile [${profile}] 已执行 ${mode}：${this.dshInstallReport.installed.length} 个包校验通过`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: '安装未完全成功',
            message: `${this.dshInstallReport.failed.length} 个包失败：${this.dshInstallReport.failed.map(f => f.name).join(', ')}`,
            type: 'error',
          });
        }
        return this.dshInstallReport;
      } catch (e: any) {
        await this.loadDshInstallEntries(profile).catch(() => {});
        this.showToast({
          title: '安装失败',
          message: e?.message || '无法执行 pnpm 安装',
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
            title: '安装完成',
            message: `profile [${profile}] 已完成 ${mode}：${this.dshInstallReport.installed.length} 个包校验通过`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: '安装未完全成功',
            message: `${this.dshInstallReport.failed.length} 个包失败：${this.dshInstallReport.failed.map(f => f.name).join(', ')}`,
            type: 'error',
          });
        }
        return this.dshInstallReport;
      } catch (e: any) {
        this.installTerminal.running = false;
        await this.loadDshInstallEntries(profile).catch(() => {});
        this.showToast({
          title: '安装失败',
          message: e?.message || '无法执行 pnpm 安装',
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
        title: '安装状态已清除',
        message: pkg ? `已清除 ${pkg} 的失败状态` : `已清除 profile [${profile}] 的全部安装状态`,
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
            title: '插件更新完成',
            message: `profile [${profile}] 的 ${key} 已更新到最新`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: '插件更新失败',
            message: report.failed.map(f => `${f.name}: ${f.reason}`).join('\n'),
            type: 'error',
          });
        }
        return report;
      } catch (e: any) {
        await this.loadDshInstallEntries(profile).catch(() => {});
        this.showToast({
          title: '插件更新失败',
          message: e?.message || '无法更新插件',
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
              title: '检查更新失败',
              message: this.appUpdate.error,
              type: 'error',
            });
          }
        } else if (this.appUpdate.updateAvailable) {
          if (showToast) {
            this.showToast({
              title: '发现新版本',
              message: `AgentHub ${this.appUpdate.latestVersion} 已发布`,
              type: 'info',
            });
          }
        } else if (showToast) {
          this.showToast({
            title: '已是最新版本',
            message: `当前版本 ${this.appUpdate.currentVersion} 已是最新`,
            type: 'success',
          });
        }
        return this.appUpdate;
      } catch (e: any) {
        if (showToast) {
          this.showToast({
            title: '检查更新失败',
            message: e?.message || '无法连接更新服务器',
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
        this.appUpdateError = e?.message || '下载更新失败';
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
        title: '正在安装更新',
        message: '安装程序已启动，AgentHub 即将退出以完成更新',
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
          title: '插件同步仓库已连接',
          message: `DSH 插件配置同步已初始化，远端: ${remoteUrl}`,
          type: 'success',
        });
      } finally {
        this.dshPluginsSyncLoading = false;
      }
    },

    async pullDshPluginsSync(showToast = true) {
      this.dshPluginsSyncLoading = true;
      try {
        this.dshPluginsSyncStatus = await api.pullDshPluginsSync();
        this.loadDshPluginsSyncDiff().catch(() => {});
        if (showToast) {
          this.showToast({
            title: '拉取完成',
            message: 'DSH 插件配置已与远端同步（拉取后请对账并一键对齐）',
            type: 'success',
          });
        }
      } catch (e: any) {
        this.dshPluginsSyncStatus = await api.getDshPluginsSyncStatus().catch(() => this.dshPluginsSyncStatus);
        if (showToast) {
          this.showToast({
            title: '拉取失败',
            message: e?.message || '无法拉取远端插件配置',
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
        this.dshPluginsSyncStatus = await api.pushDshPluginsSync(message);
        await this.reconcileDshPlugins();
        this.loadDshPluginsSyncDiff().catch(() => {});
        this.showToast({
          title: '推送完成',
          message: 'DSH 插件配置已镜像并推送到远端',
          type: 'success',
        });
      } catch (e: any) {
        this.dshPluginsSyncStatus = await api.getDshPluginsSyncStatus().catch(() => this.dshPluginsSyncStatus);
        this.showToast({
          title: '推送失败',
          message: e?.message || '无法推送插件配置',
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
        title: enabled ? '插件启动自动拉取已开启' : '插件启动自动拉取已关闭',
        message: enabled ? '每次启动会静默拉取最新插件配置' : 'AgentHub 启动时将不再自动联网拉取插件配置',
        type: 'info',
      });
    },

    async reconcileDshPlugins() {
      this.dshPluginDiff = await api.reconcileDshPlugins();
      return this.dshPluginDiff;
    },

    async alignDshPlugins(profile?: string) {
      await api.alignDshPlugins(profile);
      await this.loadDshPlugins();
      await this.reconcileDshPlugins();
      if (profile) await this.loadDshInstallEntries(profile).catch(() => {});
      this.showToast({
        title: '一键对齐完成',
        message: '本地插件配置已对齐镜像并执行 pnpm install',
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
        title: '快照已创建',
        message: `已为 profile [${profile}] 创建配置快照${note ? `：${note}` : ''}`,
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
        title: '配置已回滚',
        message: `已回滚 profile [${result.profile}] 的配置文件（${result.restored.join(', ')}）。node_modules 未覆盖，若插件安装状态不一致请执行 pnpm install 对齐。`,
        type: 'warning',
      });
      return result;
    },

    async setDshConfigSnapshotPermanent(snapshotId: string, permanent: boolean) {
      const snap = await api.setDshConfigSnapshotPermanent(snapshotId, permanent);
      await this.loadDshSnapshots(snap.profileName);
      this.showToast({
        title: permanent ? '已标记永久保留' : '已取消永久保留',
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
        title: '快照已删除',
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
      try {
        const result = await api.upgradeDsh();
        this.dshVersionResult = result;
        await this.loadDshVersion();
        await this.loadDshPlugins().catch(() => {});
        if (result.massFailure) {
          this.showToast({
            title: '升级后疑似插件大面积失效',
            message: `失败插件数 ${result.diagnosisBefore} → ${result.diagnosisAfter}，建议一键回滚版本 + 配置`,
            type: 'error',
          });
        } else if (result.ok) {
          this.showToast({
            title: 'DSH 已升级',
            message: `${result.beforeVersion || '未知'} → ${result.afterVersion || result.targetVersion}`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: 'DSH 升级未完成',
            message: result.error || result.warnings.join('\n') || result.output,
            type: 'error',
          });
        }
        return result;
      } finally {
        this.dshVersionUpgrading = false;
      }
    },

    async installDshVersion(version: string) {
      this.dshVersionUpgrading = true;
      try {
        const result = await api.installDshVersion(version);
        this.dshVersionResult = result;
        await this.loadDshVersion();
        await this.loadDshPlugins().catch(() => {});
        if (result.massFailure) {
          this.showToast({
            title: '版本切换后疑似插件大面积失效',
            message: `失败插件数 ${result.diagnosisBefore} → ${result.diagnosisAfter}，建议一键回滚`,
            type: 'error',
          });
        } else if (result.ok) {
          this.showToast({
            title: 'DSH 版本已切换',
            message: `${result.beforeVersion || '未知'} → ${result.afterVersion || result.targetVersion}`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: 'DSH 版本切换未完成',
            message: result.error || result.warnings.join('\n') || result.output,
            type: 'error',
          });
        }
        return result;
      } finally {
        this.dshVersionUpgrading = false;
      }
    },

    async rollbackDsh(previousVersion: string, snapshotIds: string[]) {
      this.dshVersionRollingBack = true;
      try {
        const result = await api.rollbackDsh(previousVersion, snapshotIds);
        await this.loadDshVersion();
        await this.loadDshPlugins().catch(() => {});
        if (result.ok) {
          this.showToast({
            title: 'DSH 已回滚',
            message: `已装回 ${result.version || previousVersion}${result.restoredSnapshots.length ? `，并回滚 ${result.restoredSnapshots.length} 份配置快照` : ''}`,
            type: 'success',
          });
        } else {
          this.showToast({
            title: 'DSH 回滚失败',
            message: result.error || result.output,
            type: 'error',
          });
        }
        return result;
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
      const action = enable ? '挂载 (Junction)' : '解绑';
      this.showToast({
        title: `Skill ${action}成功`,
        message: `已为 ${agentId} ${action} ${skillName}`,
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
        title: enable ? '全局已启用' : '全局已停用',
        message: `技能 [${skillName}] 已${enable ? '挂载至' : '移出'}所有活跃 Agent`,
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
        title: '已分发至全部活跃 Agent',
        message: `已为 ${activeAgents.length} 个 Agent 创建 NTFS 软链`,
        type: 'success',
      });
    },

    async unmountSkillFromAll(skillName: string) {
      for (const a of this.agents) {
        await api.toggleSkillForAgent(skillName, a.id, false);
      }
      await this.loadSkills();
      this.showToast({
        title: '已全部解绑',
        message: `已从所有 Agent 中移除软链`,
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
        title: '批量操作完成',
        message: `已将选中的 ${skillNames.length} 个技能批量${enable ? '分发' : '解绑'}`,
        type: 'success',
      });
    },

    async saveSkill(skillName: string, content: string) {
      await api.saveSkill(skillName, content);
      await this.loadSkills();
      this.showToast({
        title: 'Skill 保存成功',
        message: `技能 [${skillName}] 已写入中央库并实时同步`,
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
        title: '已删除 Skill',
        message: `已从中央库和所有 Agent 中安全移除 ${skillName}`,
        type: 'warning',
      });
    },

    async takeoverSkill(agentId: string, skillName: string, resolution: 'overwrite' | 'rename' | 'skip') {
      await api.takeoverUnmanagedSkill(agentId, skillName, resolution);
      await this.loadSkills();
      await this.scanUnmanaged();
      this.showToast({
        title: '纳管成功',
        message: `已成功纳管 ${agentId} 下的实体 Skill [${skillName}] 并替换为 Junction 软链`,
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
        title: '批量纳管完成',
        message: `已纳管 ${agentId} 下的 ${list.length} 个实体技能并替换为中央受控链接`,
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
        title: '全量纳管完成',
        message: `已将所有 Agent 的 ${list.length} 个存量物理技能全部替换为中央受控链接`,
        type: 'success',
      });
    },

    async ignoreSkill(item: UnmanagedSkill) {
      await api.ignoreSkill(item.agentId, item.agentName, item.skillName, item.path);
      await this.loadConfig();
      await this.scanUnmanaged();
      this.showToast({
        title: '已忽略技能',
        message: `已将 ${item.agentName} 下的 [${item.skillName}] 加入忽略名单，后续不再提示纳管`,
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
        title: '全部忽略',
        message: `已将 ${agentId} 下的所有未纳管技能加入忽略名单`,
        type: 'info',
      });
    },

    async unignoreSkill(agentId: string, skillName: string) {
      await api.unignoreSkill(agentId, skillName);
      await this.loadConfig();
      await this.scanUnmanaged();
      this.showToast({
        title: '已恢复纳管提示',
        message: `已将 [${skillName}] 移出忽略名单`,
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
        title: '已全部恢复',
        message: `已清空 ${agentId} 的忽略列表`,
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
        title: '项目已纳管',
        message: `成功添加项目 [${newProj.name}]`,
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
        title: '规则与守卫已生效',
        message: `项目规则已应用 (${ruleMode === 'overwrite' ? '覆盖模式 + Git Hook 守卫' : '追加模式 + Git Exclude'})`,
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
        title: '项目已移除',
        message: '已解除纳管并还原规则文件',
        type: 'info',
      });
    },

    async repairGitHooks(projectId: string) {
      try {
        await api.repairGitHooks(projectId);
        await this.loadProjects();
        this.showToast({
          title: 'Git Hook 守卫就绪',
          message: '已成功安装并修复 pre-checkout / post-checkout / pre-commit 守卫防护',
          type: 'success',
        });
      } catch (err: any) {
        this.showToast({
          title: '修复失败',
          message: err?.message || '安装 Git Hook 时发生异常',
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
        localLabel: params.localLabel || '本地实体版本 (Local)',
        remoteLabel: params.remoteLabel || '中央库版本 (Central)',
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
  },
});
