import {
  AgentInfo,
  AppConfig,
  DshDiagnoseResult,
  DshPluginDiff,
  DshPluginScanResult,
  DshRecoveryAction,
  ProjectInfo,
  SkillItem,
  SkillsSyncStatus,
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
        supportsJunction: false,
      };
    }
    return {
      valid: true,
      message: '路径有效且支持 Windows NTFS Junction 挂载',
      supportsJunction: true,
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

  async applyDshRecovery(action: DshRecoveryAction): Promise<void> {
    if (isTauri()) {
      return invokeTauri('apply_dsh_recovery', { action });
    }
    return requestApi<void>('/api/dsh/plugins/recover', 'POST', { action });
  },

  async installDshPlugins(profile: string): Promise<string> {
    if (isTauri()) {
      return invokeTauri<string>('install_dsh_plugins', { profile });
    }
    const res = await requestApi<{ success: boolean; output?: string }>('/api/dsh/plugins/install', 'POST', { profile });
    return res.output || '';
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
