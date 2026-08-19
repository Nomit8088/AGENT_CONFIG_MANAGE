import { defineStore } from 'pinia';
import { AgentInfo, AppConfig, IgnoredSkill, ProjectInfo, SkillItem, ToastMessage, UnmanagedSkill } from '../types';
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
    currentTab: 'agents' as 'agents' | 'skills' | 'projects' | 'settings',
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

    // Agent Unmanaged Details Modal/Drawer
    agentDetailModal: {
      visible: false,
      agentId: '',
      activeTab: 'unmanaged' as 'unmanaged' | 'ignored',
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

        api.onExternalSkillCreated((path) => {
          this.showToast({
            title: '⚡ 自动捕获到外部新 Skill',
            message: `检测到新安装的技能: ${path.split(/[\/\\]/).pop()}，已自动就绪！`,
            type: 'info',
          });
          this.loadSkills();
          this.scanUnmanaged();
        });
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
        if (!item.hasConflict) {
          await api.takeoverUnmanagedSkill(item.agentId, item.skillName, 'overwrite');
        }
      }
      await this.loadSkills();
      await this.scanUnmanaged();
      this.showToast({
        title: '批量纳管完成',
        message: `已纳管 ${agentId} 下的所有无冲突实体技能`,
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

    openAgentDetailModal(agentId: string, tab: 'unmanaged' | 'ignored' = 'unmanaged') {
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
