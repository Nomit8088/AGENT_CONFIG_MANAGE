export interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  detected: boolean;
  enabled: boolean;
  skillsDir: string;
  ruleType: string;
  localRuleFilename: string;
  isCustom?: boolean;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  overrideEnabled: boolean;
  ruleMode: 'overwrite' | 'append';
  customRuleContent: string;
  originalRuleContent?: string;
  linkedAgents: string[];
  gitBranch?: string;
  hookInstalled?: boolean;
  preCommitGuard?: boolean;
}

export interface SkillMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  slash_commands?: string[];
}

export interface SkillItem {
  id: string;
  name: string;
  path: string;
  description: string;
  version: string;
  source: 'central' | 'npx' | 'manual' | 'imported';
  enabled: boolean;
  content: string;
  metadata?: SkillMetadata;
  mountedAgents: string[];
  isSymlinkMap: Record<string, boolean>; // agentId -> isSymlink
}

export interface UnmanagedSkill {
  agentId: string;
  agentName: string;
  skillName: string;
  path: string;
  hasConflict: boolean;
  centralContent?: string;
  localContent?: string;
}

export interface IgnoredSkill {
  agentId: string;
  agentName: string;
  skillName: string;
  path: string;
  ignoredAt: number;
}

export interface AppConfig {
  auto_start: boolean;
  theme: 'dark' | 'light' | 'system';
  default_rule_mode: 'append' | 'overwrite';
  auto_capture_skills: boolean;
  toast_notifications: boolean;
  ignored_skills?: IgnoredSkill[];
  system_theme?: 'dark' | 'light';
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  supportsJunction: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}
