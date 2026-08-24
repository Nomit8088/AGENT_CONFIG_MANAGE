import {
  AgentInfo,
  AppConfig,
  AppUpdateCheck,
  AppUpdateDownload,
  DshConfigSnapshot,
  DshDiagnoseResult,
  DshInstallMode,
  DshInstallReport,
  DshPluginDiff,
  DshPluginInstallEntry,
  DshPluginScanResult,
  DshPluginUpdateCheck,
  DshRecoveryAction,
  DshSnapshotRollbackResult,
  DshAvailableVersions,
  DshLaunchResult,
  DshVersionCheck,
  DshVersionHistoryEntry,
  DshVersionInfo,
  DshVersionRollbackResult,
  DshVersionUpgradeResult,
  ProjectInfo,
  SkillItem,
  SkillsSyncStatus,
  SyncDiffEntry,
  SyncRepoConfig,
  SyncRepoValidation,
  UnmanagedSkill,
  ValidationResult,
} from '../types';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

async function requestApi<T>(endpoint: string, method: string = 'GET', data?: any): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const res = await fetch(endpoint, options);
  if (!res.ok) {
    let message = `API error: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string' && data.error) {
        message = data.error;
      } else if (data && typeof data.message === 'string' && data.message) {
        message = data.message;
      }
    } catch {
      // 响应体不是 JSON 时保留 statusText
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  async getConfig(): Promise<AppConfig> {
    if (isTauri()) {
      return invokeTauri<AppConfig>('get_config');
    }
    return requestApi<AppConfig>('/api/config');
  },

  async updateConfig(config: AppConfig): Promise<void> {
    if (isTauri()) {
      return invokeTauri('update_config', { config });
    }
    return requestApi<void>('/api/config', 'POST', config);
  },

  async getSyncRepoConfig(): Promise<SyncRepoConfig> {
    if (isTauri()) {
      return invokeTauri<SyncRepoConfig>('get_sync_repo_config');
    }
    return requestApi<SyncRepoConfig>('/api/sync/repo');
  },

  async validateSyncRepo(remoteUrl: string, branch?: string): Promise<SyncRepoValidation> {
    if (isTauri()) {
      return invokeTauri<SyncRepoValidation>('validate_sync_repo', { remoteUrl, branch });
    }
    return requestApi<SyncRepoValidation>('/api/sync/repo/validate', 'POST', { remoteUrl, branch });
  },

  async saveSyncRepo(remoteUrl: string, branch?: string): Promise<SyncRepoConfig> {
    if (isTauri()) {
      return invokeTauri<SyncRepoConfig>('save_sync_repo', { remoteUrl, branch });
    }
    return requestApi<SyncRepoConfig>('/api/sync/repo', 'POST', { remoteUrl, branch });
  },

  async unbindSyncRepo(): Promise<void> {
    if (isTauri()) {
      return invokeTauri('unbind_sync_repo');
    }
    return requestApi<void>('/api/sync/repo/unbind', 'POST');
  },

  async getAgents(): Promise<AgentInfo[]> {
    if (isTauri()) {
      return invokeTauri<AgentInfo[]>('get_agents');
    }
    return requestApi<AgentInfo[]>('/api/agents');
  },

  async scanAgents(): Promise<AgentInfo[]> {
    if (isTauri()) {
      return invokeTauri<AgentInfo[]>('scan_agents');
    }
    return requestApi<AgentInfo[]>('/api/agents');
  },

  async saveAgentsList(agents: AgentInfo[]): Promise<void> {
    if (isTauri()) {
      return invokeTauri('save_agents_list', { agents });
    }
    return requestApi<void>('/api/agents', 'POST', { agents });
  },

  async validateAgentPath(skillsDir: string, ruleFilename: string): Promise<ValidationResult> {
    if (isTauri()) {
      return invokeTauri<ValidationResult>('validate_agent_path', { skillsDir, ruleFilename });
    }
    if (!ruleFilename || ruleFilename.includes('/') || ruleFilename.includes('\\') || ruleFilename.includes('..')) {
      return {
        valid: false,
        message: '规则文件名不合法，不能包含路径分隔符或 ".."',
      };
    }
    return {
      valid: true,
      message: '路径有效且支持 Windows NTFS Junction 挂载',
    };
  },

  async getCentralSkills(): Promise<SkillItem[]> {
    if (isTauri()) {
      return invokeTauri<SkillItem[]>('get_central_skills');
    }
    return requestApi<SkillItem[]>('/api/skills');
  },

  async scanUnmanagedSkills(): Promise<UnmanagedSkill[]> {
    if (isTauri()) {
      return invokeTauri<UnmanagedSkill[]>('scan_unmanaged_skills');
    }
    return requestApi<UnmanagedSkill[]>('/api/skills/unmanaged');
  },

  async saveSkill(skillName: string, content: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('save_skill', { skillName, content });
    }
    return requestApi<void>('/api/skills/save', 'POST', { skillName, content });
  },

  async deleteSkill(skillName: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('delete_skill', { skillName });
    }
    return requestApi<void>('/api/skills/delete', 'POST', { skillName });
  },

  async toggleSkillForAgent(skillName: string, agentId: string, enable: boolean): Promise<void> {
    if (isTauri()) {
      return invokeTauri('toggle_skill_for_agent', { skillName, agentId, enable });
    }
    return requestApi<void>('/api/skills/toggle', 'POST', { skillName, agentId, enable });
  },

  async takeoverUnmanagedSkill(agentId: string, skillName: string, resolution: 'overwrite' | 'rename' | 'skip'): Promise<void> {
    if (isTauri()) {
      return invokeTauri('takeover_unmanaged_skill', { agentId, skillName, resolution });
    }
    return requestApi<void>('/api/skills/takeover', 'POST', { agentId, skillName, resolution });
  },

  async ignoreSkill(agentId: string, agentName: string, skillName: string, path: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('ignore_skill', { agentId, agentName, skillName, path });
    }
    return requestApi<void>('/api/skills/ignore', 'POST', { agentId, agentName, skillName, path });
  },

  async unignoreSkill(agentId: string, skillName: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('unignore_skill', { agentId, skillName });
    }
    return requestApi<void>('/api/skills/unignore', 'POST', { agentId, skillName });
  },

  async getProjects(): Promise<ProjectInfo[]> {
    if (isTauri()) {
      return invokeTauri<ProjectInfo[]>('get_projects');
    }
    return requestApi<ProjectInfo[]>('/api/projects');
  },

  async addProject(path: string, name: string): Promise<ProjectInfo> {
    if (isTauri()) {
      return invokeTauri<ProjectInfo>('add_project', { path, name });
    }
    return requestApi<ProjectInfo>('/api/projects/add', 'POST', { path, name });
  },

  async updateProjectRule(
    projectId: string,
    ruleMode: 'overwrite' | 'append',
    customContent: string,
    enabled: boolean,
    linkedAgents: string[],
    preCommitGuard?: boolean
  ): Promise<void> {
    if (isTauri()) {
      return invokeTauri('update_project_rule', {
        projectId,
        ruleMode,
        customContent,
        enabled,
        linkedAgents,
        preCommitGuard,
      });
    }
    return requestApi<void>('/api/projects/update', 'POST', {
      projectId,
      ruleMode,
      customContent,
      enabled,
      linkedAgents,
      preCommitGuard,
    });
  },

  async deleteProject(projectId: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('delete_project', { projectId });
    }
    return requestApi<void>('/api/projects/delete', 'POST', { projectId });
  },

  async repairGitHooks(projectId: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('repair_git_hooks', { projectId });
    }
    return requestApi<void>('/api/projects/repair-hooks', 'POST', { projectId });
  },

  async getSkillsSyncStatus(): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('get_skills_sync_status');
    }
    return requestApi<SkillsSyncStatus>('/api/skills/sync/status');
  },

  async initSkillsSync(remoteUrl: string, branch?: string): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('init_skills_sync', { remoteUrl, branch });
    }
    return requestApi<SkillsSyncStatus>('/api/skills/sync/init', 'POST', { remoteUrl, branch });
  },

  async pullSkillsSync(): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('pull_skills_sync');
    }
    return requestApi<SkillsSyncStatus>('/api/skills/sync/pull', 'POST');
  },

  async pushSkillsSync(message?: string): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('push_skills_sync', { message });
    }
    return requestApi<SkillsSyncStatus>('/api/skills/sync/push', 'POST', { message });
  },

  async setSkillsSyncAutoPull(enabled: boolean): Promise<void> {
    if (isTauri()) {
      return invokeTauri('set_skills_sync_auto_pull', { enabled });
    }
    return requestApi<void>('/api/skills/sync/auto-pull', 'POST', { enabled });
  },

  async testSkillsSyncConnection(): Promise<string> {
    if (isTauri()) {
      return invokeTauri<string>('test_skills_sync_connection');
    }
    return requestApi<string>('/api/skills/sync/test', 'POST');
  },

  async resetSkillsSyncToRemote(): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('reset_skills_sync_to_remote');
    }
    return requestApi<SkillsSyncStatus>('/api/skills/sync/reset', 'POST');
  },

  async getSkillsSyncDiff(): Promise<SyncDiffEntry[]> {
    if (isTauri()) {
      return invokeTauri<SyncDiffEntry[]>('get_skills_sync_diff');
    }
    return requestApi<SyncDiffEntry[]>('/api/skills/sync/diff');
  },

  // ==================== DSH 插件中心 ====================

  async scanDshPlugins(): Promise<DshPluginScanResult> {
    if (isTauri()) {
      return invokeTauri<DshPluginScanResult>('scan_dsh_plugins');
    }
    return requestApi<DshPluginScanResult>('/api/dsh/plugins/scan');
  },

  async diagnoseDshWeb(profile?: string): Promise<DshDiagnoseResult> {
    if (isTauri()) {
      return invokeTauri<DshDiagnoseResult>('diagnose_dsh_web', { profile });
    }
    return requestApi<DshDiagnoseResult>('/api/dsh/plugins/diagnose', 'POST', { profile });
  },

  async toggleDshPlugin(profile: string, key: string, enabled: boolean): Promise<void> {
    if (isTauri()) {
      return invokeTauri('toggle_dsh_plugin', { profile, key, enabled });
    }
    return requestApi<void>('/api/dsh/plugins/toggle', 'POST', { profile, key, enabled });
  },

  async removeDshPlugin(profile: string, key: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('remove_dsh_plugin', { profile, key });
    }
    return requestApi<void>('/api/dsh/plugins/remove', 'POST', { profile, key });
  },

  async adoptDshOrphan(profile: string, pkgName: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('adopt_dsh_orphan', { profile, pkgName });
    }
    return requestApi<void>('/api/dsh/plugins/adopt-orphan', 'POST', { profile, pkgName });
  },

  async applyDshRecovery(action: DshRecoveryAction): Promise<void> {
    if (isTauri()) {
      return invokeTauri('apply_dsh_recovery', { action });
    }
    return requestApi<void>('/api/dsh/plugins/recover', 'POST', { action });
  },

  async installDshPlugins(profile: string, mode: DshInstallMode = 'incremental'): Promise<DshInstallReport> {
    if (isTauri()) {
      return invokeTauri<DshInstallReport>('install_dsh_plugins_v2', { profile, mode });
    }
    return requestApi<DshInstallReport>('/api/dsh/plugins/install', 'POST', { profile, mode });
  },

  async installDshPluginsStreamed(
    profile: string,
    mode: DshInstallMode,
    onLine: (line: string) => void,
  ): Promise<DshInstallReport> {
    if (isTauri()) {
      const { Channel } = await import('@tauri-apps/api/core');
      const { invoke } = await import('@tauri-apps/api/core');
      const onEvent = new Channel<string>();
      onEvent.onmessage = (line: string) => {
        onLine(line);
      };
      return invoke<DshInstallReport>('install_dsh_plugins_streamed', { profile, mode, onEvent });
    }
    return new Promise<DshInstallReport>((resolve, reject) => {
      const params = new URLSearchParams({ profile, mode });
      const es = new EventSource(`/api/dsh/plugins/install/stream?${params.toString()}`);
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'line' && typeof msg.line === 'string') {
            onLine(msg.line);
          } else if (msg.type === 'done') {
            es.close();
            resolve(msg.report as DshInstallReport);
          }
        } catch (e) {
          es.close();
          reject(e);
        }
      };
      es.onerror = () => {
        es.close();
        reject(new Error('安装终端连接中断（SSE 流不可用）'));
      };
    });
  },

  async scanDshInstallEntries(profile: string): Promise<DshPluginInstallEntry[]> {
    if (isTauri()) {
      return invokeTauri<DshPluginInstallEntry[]>('reconcile_dsh_install', { profile });
    }
    return requestApi<DshPluginInstallEntry[]>(`/api/dsh/plugins/install-entries?profile=${encodeURIComponent(profile)}`);
  },

  async clearDshInstallState(profile: string, pkg?: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('clear_dsh_install_state', { profile, pkg });
    }
    return requestApi<void>('/api/dsh/plugins/install-state/clear', 'POST', { profile, pkg });
  },

  async checkDshPluginUpdate(profile: string, key: string): Promise<DshPluginUpdateCheck> {
    if (isTauri()) {
      return invokeTauri<DshPluginUpdateCheck>('check_dsh_plugin_update', { profile, key });
    }
    return requestApi<DshPluginUpdateCheck>('/api/dsh/plugins/check-update', 'POST', { profile, key });
  },

  async updateDshPlugin(profile: string, key: string): Promise<DshInstallReport> {
    if (isTauri()) {
      return invokeTauri<DshInstallReport>('update_dsh_plugin', { profile, key });
    }
    return requestApi<DshInstallReport>('/api/dsh/plugins/update', 'POST', { profile, key });
  },

  async getDshPluginsSyncStatus(): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('get_dsh_plugins_sync_status');
    }
    return requestApi<SkillsSyncStatus>('/api/dsh/plugins/sync/status');
  },

  async initDshPluginsSync(remoteUrl: string, branch?: string): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('init_dsh_plugins_sync', { remoteUrl, branch });
    }
    return requestApi<SkillsSyncStatus>('/api/dsh/plugins/sync/init', 'POST', { remoteUrl, branch });
  },

  async pullDshPluginsSync(): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('pull_dsh_plugins_sync');
    }
    return requestApi<SkillsSyncStatus>('/api/dsh/plugins/sync/pull', 'POST');
  },

  async pushDshPluginsSync(message?: string): Promise<SkillsSyncStatus> {
    if (isTauri()) {
      return invokeTauri<SkillsSyncStatus>('push_dsh_plugins_sync', { message });
    }
    return requestApi<SkillsSyncStatus>('/api/dsh/plugins/sync/push', 'POST', { message });
  },

  async setDshPluginsSyncAutoPull(enabled: boolean): Promise<void> {
    if (isTauri()) {
      return invokeTauri('set_dsh_plugins_sync_auto_pull', { enabled });
    }
    return requestApi<void>('/api/dsh/plugins/sync/auto-pull', 'POST', { enabled });
  },

  async getDshPluginsSyncDiff(): Promise<SyncDiffEntry[]> {
    if (isTauri()) {
      return invokeTauri<SyncDiffEntry[]>('get_dsh_plugins_sync_diff');
    }
    return requestApi<SyncDiffEntry[]>('/api/dsh/plugins/sync/diff');
  },

  async reconcileDshPlugins(): Promise<DshPluginDiff> {
    if (isTauri()) {
      return invokeTauri<DshPluginDiff>('reconcile_dsh_plugins');
    }
    return requestApi<DshPluginDiff>('/api/dsh/plugins/reconcile');
  },

  async alignDshPlugins(profile?: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('align_dsh_plugins', { profile });
    }
    return requestApi<void>('/api/dsh/plugins/align', 'POST', { profile });
  },

  // ==================== DSH 配置快照与回滚 (WI-006) ====================

  async createDshConfigSnapshot(profile: string, note?: string): Promise<DshConfigSnapshot> {
    if (isTauri()) {
      return invokeTauri<DshConfigSnapshot>('create_dsh_config_snapshot', { profile, trigger: 'manual', note });
    }
    return requestApi<DshConfigSnapshot>('/api/dsh/plugins/snapshots', 'POST', { profile, note });
  },

  async listDshConfigSnapshots(profile: string): Promise<DshConfigSnapshot[]> {
    if (isTauri()) {
      return invokeTauri<DshConfigSnapshot[]>('list_dsh_config_snapshots', { profile });
    }
    return requestApi<DshConfigSnapshot[]>(`/api/dsh/plugins/snapshots?profile=${encodeURIComponent(profile)}`);
  },

  async rollbackDshConfigSnapshot(snapshotId: string): Promise<DshSnapshotRollbackResult> {
    if (isTauri()) {
      return invokeTauri<DshSnapshotRollbackResult>('rollback_dsh_config_snapshot', { snapshotId });
    }
    return requestApi<DshSnapshotRollbackResult>('/api/dsh/plugins/snapshots/rollback', 'POST', { snapshotId });
  },

  async setDshConfigSnapshotPermanent(snapshotId: string, permanent: boolean): Promise<DshConfigSnapshot> {
    if (isTauri()) {
      return invokeTauri<DshConfigSnapshot>('set_dsh_config_snapshot_permanent', { snapshotId, permanent });
    }
    return requestApi<DshConfigSnapshot>('/api/dsh/plugins/snapshots/permanent', 'POST', { snapshotId, permanent });
  },

  async deleteDshConfigSnapshot(snapshotId: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('delete_dsh_config_snapshot', { snapshotId });
    }
    return requestApi<void>('/api/dsh/plugins/snapshots/delete', 'POST', { snapshotId });
  },

  // ==================== DSH 版本升级与版本管理 (WI-009) ====================

  async getDshVersionInfo(): Promise<DshVersionInfo> {
    if (isTauri()) {
      return invokeTauri<DshVersionInfo>('get_dsh_version_info');
    }
    return requestApi<DshVersionInfo>('/api/dsh/version');
  },

  async checkDshVersionUpdate(): Promise<DshVersionCheck> {
    if (isTauri()) {
      return invokeTauri<DshVersionCheck>('check_dsh_version_update');
    }
    return requestApi<DshVersionCheck>('/api/dsh/version/check');
  },

  async listDshVersions(): Promise<DshVersionHistoryEntry[]> {
    if (isTauri()) {
      return invokeTauri<DshVersionHistoryEntry[]>('list_dsh_versions');
    }
    return requestApi<DshVersionHistoryEntry[]>('/api/dsh/version/history');
  },

  async upgradeDsh(): Promise<DshVersionUpgradeResult> {
    if (isTauri()) {
      return invokeTauri<DshVersionUpgradeResult>('upgrade_dsh_version');
    }
    return requestApi<DshVersionUpgradeResult>('/api/dsh/version/upgrade', 'POST');
  },

  async installDshVersion(version: string): Promise<DshVersionUpgradeResult> {
    if (isTauri()) {
      return invokeTauri<DshVersionUpgradeResult>('install_dsh_version', { targetVersion: version });
    }
    return requestApi<DshVersionUpgradeResult>('/api/dsh/version/install', 'POST', { version });
  },

  async rollbackDsh(previousVersion: string, snapshotIds: string[]): Promise<DshVersionRollbackResult> {
    if (isTauri()) {
      return invokeTauri<DshVersionRollbackResult>('rollback_dsh_version', { previousVersion, snapshotIds });
    }
    return requestApi<DshVersionRollbackResult>('/api/dsh/version/rollback', 'POST', { previousVersion, snapshotIds });
  },

  async listDshAvailableVersions(): Promise<DshAvailableVersions> {
    if (isTauri()) {
      return invokeTauri<DshAvailableVersions>('list_dsh_available_versions');
    }
    return requestApi<DshAvailableVersions>('/api/dsh/version/available');
  },

  async launchDshWeb(profile?: string): Promise<DshLaunchResult> {
    if (isTauri()) {
      return invokeTauri<DshLaunchResult>('launch_dsh_web', { profile });
    }
    return requestApi<DshLaunchResult>('/api/dsh/launch', 'POST', { profile });
  },

  async upgradeDshStreamed(onLine: (line: string) => void): Promise<DshVersionUpgradeResult> {
    if (isTauri()) {
      const { Channel, invoke } = await import('@tauri-apps/api/core');
      const onEvent = new Channel<string>();
      onEvent.onmessage = (line: string) => onLine(line);
      return invoke<DshVersionUpgradeResult>('upgrade_dsh_version_streamed', { onEvent });
    }
    return new Promise<DshVersionUpgradeResult>((resolve, reject) => {
      const es = new EventSource('/api/dsh/version/upgrade/stream');
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'line' && typeof msg.line === 'string') {
            onLine(msg.line);
          } else if (msg.type === 'done') {
            es.close();
            resolve(msg.report as DshVersionUpgradeResult);
          } else if (msg.type === 'error') {
            es.close();
            reject(new Error(msg.error || '升级失败'));
          }
        } catch (e) {
          es.close();
          reject(e);
        }
      };
      es.onerror = () => {
        es.close();
        reject(new Error('版本变更终端连接中断（SSE 流不可用）'));
      };
    });
  },

  async installDshVersionStreamed(version: string, onLine: (line: string) => void): Promise<DshVersionUpgradeResult> {
    if (isTauri()) {
      const { Channel, invoke } = await import('@tauri-apps/api/core');
      const onEvent = new Channel<string>();
      onEvent.onmessage = (line: string) => onLine(line);
      return invoke<DshVersionUpgradeResult>('install_dsh_version_streamed', { targetVersion: version, onEvent });
    }
    return new Promise<DshVersionUpgradeResult>((resolve, reject) => {
      const es = new EventSource(`/api/dsh/version/install/stream?version=${encodeURIComponent(version)}`);
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'line' && typeof msg.line === 'string') {
            onLine(msg.line);
          } else if (msg.type === 'done') {
            es.close();
            resolve(msg.report as DshVersionUpgradeResult);
          } else if (msg.type === 'error') {
            es.close();
            reject(new Error(msg.error || '安装失败'));
          }
        } catch (e) {
          es.close();
          reject(e);
        }
      };
      es.onerror = () => {
        es.close();
        reject(new Error('版本变更终端连接中断（SSE 流不可用）'));
      };
    });
  },

  async rollbackDshStreamed(
    previousVersion: string,
    snapshotIds: string[],
    onLine: (line: string) => void,
  ): Promise<DshVersionRollbackResult> {
    if (isTauri()) {
      const { Channel, invoke } = await import('@tauri-apps/api/core');
      const onEvent = new Channel<string>();
      onEvent.onmessage = (line: string) => onLine(line);
      return invoke<DshVersionRollbackResult>('rollback_dsh_version_streamed', { previousVersion, snapshotIds, onEvent });
    }
    return new Promise<DshVersionRollbackResult>((resolve, reject) => {
      const es = new EventSource(
        `/api/dsh/version/rollback/stream?previousVersion=${encodeURIComponent(previousVersion)}&snapshotIds=${encodeURIComponent(JSON.stringify(snapshotIds))}`,
      );
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'line' && typeof msg.line === 'string') {
            onLine(msg.line);
          } else if (msg.type === 'done') {
            es.close();
            resolve(msg.report as DshVersionRollbackResult);
          } else if (msg.type === 'error') {
            es.close();
            reject(new Error(msg.error || '回滚失败'));
          }
        } catch (e) {
          es.close();
          reject(e);
        }
      };
      es.onerror = () => {
        es.close();
        reject(new Error('版本变更终端连接中断（SSE 流不可用）'));
      };
    });
  },

  // ==================== 应用本体在线更新 (cc-switch 风格) ====================

  async checkAppUpdate(): Promise<AppUpdateCheck> {
    if (isTauri()) {
      return invokeTauri<AppUpdateCheck>('check_app_update');
    }
    return requestApi<AppUpdateCheck>('/api/app/update/check');
  },

  async downloadAppUpdate(
    onProgress: (downloaded: number, total: number, percent: number) => void,
  ): Promise<AppUpdateDownload> {
    if (isTauri()) {
      const { Channel, invoke } = await import('@tauri-apps/api/core');
      const onEvent = new Channel<string>();
      onEvent.onmessage = (line: string) => {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'progress') {
            onProgress(msg.downloaded, msg.total, msg.percent);
          }
        } catch {
          // 忽略非 JSON 进度行
        }
      };
      return invoke<AppUpdateDownload>('download_app_update', { onEvent });
    }
    return new Promise<AppUpdateDownload>((resolve, reject) => {
      const es = new EventSource('/api/app/update/download/stream');
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'progress') {
            onProgress(msg.downloaded, msg.total, msg.percent);
          } else if (msg.type === 'done') {
            es.close();
            resolve(msg.report as AppUpdateDownload);
          } else if (msg.type === 'error') {
            es.close();
            reject(new Error(msg.error || '下载失败'));
          }
        } catch (e) {
          es.close();
          reject(e);
        }
      };
      es.onerror = () => {
        es.close();
        reject(new Error('下载连接中断（SSE 流不可用）'));
      };
    });
  },

  async installAppUpdate(installPath: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('install_app_update', { path: installPath });
    }
    return requestApi<void>('/api/app/update/install', 'POST', { path: installPath });
  },

  onExternalSkillCreated(callback: (path: string) => void): void {
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('external-skill-created', (event) => {
          callback(event.payload);
        });
      });
    }
  },
};
