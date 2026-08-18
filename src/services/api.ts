import { AgentInfo, AppConfig, ProjectInfo, SkillItem, UnmanagedSkill, ValidationResult } from '../types';

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
    throw new Error(`API error: ${res.statusText}`);
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
    linkedAgents: string[]
  ): Promise<void> {
    if (isTauri()) {
      return invokeTauri('update_project_rule', {
        projectId,
        ruleMode,
        customContent,
        enabled,
        linkedAgents,
      });
    }
    return requestApi<void>('/api/projects/update', 'POST', {
      projectId,
      ruleMode,
      customContent,
      enabled,
      linkedAgents,
    });
  },

  async deleteProject(projectId: string): Promise<void> {
    if (isTauri()) {
      return invokeTauri('delete_project', { projectId });
    }
    return requestApi<void>('/api/projects/delete', 'POST', { projectId });
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
