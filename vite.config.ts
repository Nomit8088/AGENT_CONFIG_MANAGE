import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import {
  initStorage,
  getAppDataDir,
  getCentralSkillsDir,
  expandTilde,
  isJunctionOrSymlink,
  createJunction,
  removeJunction,
  createHardlinkDirRecursive,
  removeSkillMount,
  mountSkillForAgent,
  getAgentSkillDirs,
  findAgentSkillDir,
  copyDirRecursive,
  parseSkillMd,
  checkGitStatus,
  applyProjectRules,
  uninstallGitHooks,
  getSkillsSyncStatus,
  initSkillsSync,
  pullSkillsSync,
  pushSkillsSync,
  setSkillsSyncAutoPull,
  testSkillsSyncConnection,
  resetSkillsSyncToRemote,
  applySkillsFromRemote,
  fetchSkillsSync,
  getSkillsSyncDiff,
  getSyncRepoConfig,
  validateSyncRepo,
  saveSyncRepo,
  unbindSyncRepo,
  scanDshPlugins,
  diagnoseDshWeb,
  toggleDshPlugin,
  removeDshPlugin,
  adoptDshOrphan,
  applyDshRecovery,
  installDshPluginsV2,
  reconcileDshInstall,
  clearDshInstallState,
  checkDshPluginUpdate,
  updateDshPlugin,
  getDshPluginsSyncStatus,
  initDshPluginsSync,
  pullDshPluginsSync,
  pushDshPluginsSync,
  setDshPluginsSyncAutoPull,
  reconcileDshPlugins,
  alignDshPlugins,
  getDshPluginsSyncDiff,
  createDshConfigSnapshot,
  listDshConfigSnapshots,
  rollbackDshConfigSnapshot,
  setDshConfigSnapshotPermanent,
  deleteDshConfigSnapshot,
  getDshVersionInfo,
  checkDshVersionUpdate,
  listDshVersions,
  listDshAvailableVersions,
  launchDshWeb,
  upgradeDshVersion,
  installDshVersion,
  rollbackDshVersion,
  DEFAULT_PRESET_AGENTS,
  detectAgentInstalled,
  detectSystemTheme,
  linkStrategyFor,
} from './src/server/localApi';
import {
  checkAppUpdate,
  downloadAppUpdate,
  installAppUpdate,
} from './src/server/appUpdate';
import {
  initLogger,
  getAppLogs,
  exportAppLogs,
  getAppLogPath,
} from './src/server/logger';
import {
  getSyncSchedule,
  setSyncSchedule,
  startSyncScheduler,
} from './src/server/syncSchedule';
import {
  getSyncHistory,
  clearSyncHistory,
} from './src/server/syncHistory';

function localApiPlugin(): Plugin {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      initStorage();
      initLogger();
      startSyncScheduler();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          let jsonBody: any = {};
          try {
            if (body) jsonBody = JSON.parse(body);
          } catch {}

          try {
            // GET /api/config
            if (pathname === '/api/config' && req.method === 'GET') {
              const configFile = path.join(getAppDataDir(), 'config.json');
              const cfg = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf-8')) : {};
              cfg.system_theme = detectSystemTheme();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(cfg));
            }

            // POST /api/config
            if (pathname === '/api/config' && req.method === 'POST') {
              const configFile = path.join(getAppDataDir(), 'config.json');
              fs.writeFileSync(configFile, JSON.stringify(jsonBody, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // Helper to get agents list
            const getAgentsList = () => {
              const agentsFile = path.join(getAppDataDir(), 'agents.json');
              let agents = [...DEFAULT_PRESET_AGENTS];
              if (fs.existsSync(agentsFile)) {
                try {
                  const saved = JSON.parse(fs.readFileSync(agentsFile, 'utf-8'));
                  if (Array.isArray(saved) && saved.length > 0) {
                    const updated = saved.map((sa: any) => {
                      const defA = DEFAULT_PRESET_AGENTS.find(d => d.id === sa.id);
                      if (defA && !sa.isCustom) {
                        return {
                          ...defA,
                          enabled: sa.enabled ?? defA.enabled,
                        };
                      }
                      return sa;
                    });
                    for (const defA of DEFAULT_PRESET_AGENTS) {
                      if (!updated.some((ua: any) => ua.id === defA.id)) {
                        updated.push(defA);
                      }
                    }
                    agents = updated;
                  }
                } catch {}
              }
              return agents.map(a => ({
                ...a,
                detected: detectAgentInstalled(a.id, a.skillsDir),
              }));
            };

            // GET /api/agents
            if (pathname === '/api/agents' && req.method === 'GET') {
              const agents = getAgentsList();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(agents));
            }

            // POST /api/agents
            if (pathname === '/api/agents' && req.method === 'POST') {
              const agentsFile = path.join(getAppDataDir(), 'agents.json');
              fs.writeFileSync(agentsFile, JSON.stringify(jsonBody.agents, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/skills
            if (pathname === '/api/skills' && req.method === 'GET') {
              const central = getCentralSkillsDir();
              const skills: any[] = [];
              const allAgents = getAgentsList();

              if (fs.existsSync(central)) {
                const entries = fs.readdirSync(central, { withFileTypes: true });
                for (const ent of entries) {
                  if (ent.isDirectory() && !ent.name.startsWith('.')) {
                    const skillFolder = path.join(central, ent.name);
                    const smd = path.join(skillFolder, 'SKILL.md');
                    const content = fs.existsSync(smd) ? fs.readFileSync(smd, 'utf-8') : '';
                    const parsed = parseSkillMd(content, ent.name);

                    const mountedAgents: string[] = [];
                    const isSymlinkMap: Record<string, boolean> = {};

                    for (const a of allAgents) {
                      const skillDirs = getAgentSkillDirs(a);
                      const mounted = skillDirs.some(dir => {
                        const target = path.join(dir, ent.name);
                        return isJunctionOrSymlink(target) || fs.existsSync(target);
                      });
                      const isLink = skillDirs.some(dir => isJunctionOrSymlink(path.join(dir, ent.name)));
                      isSymlinkMap[a.id] = isLink;
                      if (mounted) {
                        mountedAgents.push(a.id);
                      }
                    }

                    skills.push({
                      id: ent.name,
                      name: parsed.name,
                      path: skillFolder,
                      description: parsed.description,
                      version: parsed.version,
                      source: ent.name === 'agenthub-sync' ? 'builtin' : 'central',
                      enabled: mountedAgents.length > 0,
                      content,
                      metadata: parsed.metadata,
                      mountedAgents,
                      isSymlinkMap,
                    });
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(skills));
            }

            // POST /api/skills/toggle
            if (pathname === '/api/skills/toggle' && req.method === 'POST') {
              const { skillName, agentId, enable } = jsonBody;
              const centralSkill = path.join(getCentralSkillsDir(), skillName);
              const allAgents = getAgentsList();
              const targetAgent = allAgents.find(a => a.id === agentId);
              const skillDirs = targetAgent ? getAgentSkillDirs(targetAgent) : [expandTilde(`~/.${agentId}/skills`)];

              const linkPath = path.join(skillDirs[0], skillName);
              if (enable) {
                // 启用只挂载主目录，不清理其他根目录，避免误删公共/共享技能。
                mountSkillForAgent(agentId, linkPath, centralSkill);
              } else {
                // 停用必须清理该 Agent 所有 skill 根目录，否则 DSH 仍会从其他根读到同名技能。
                for (const dir of skillDirs) {
                  removeSkillMount(path.join(dir, skillName));
                }
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/skills/save
            if (pathname === '/api/skills/save' && req.method === 'POST') {
              const { skillName, content } = jsonBody;
              const skillDir = path.join(getCentralSkillsDir(), skillName);
              fs.mkdirSync(skillDir, { recursive: true });
              fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');

              // 对 hardlink-tree 策略的 Agent（antigravity），若技能已挂载为物理目录，则同步 SKILL.md
              for (const a of getAgentsList()) {
                if (linkStrategyFor(a.id) !== 'hardlinkTree') continue;
                const hardlinkSkillDir = path.join(expandTilde(a.skillsDir), skillName);
                if (fs.existsSync(hardlinkSkillDir) && !isJunctionOrSymlink(hardlinkSkillDir)) {
                  const targetSkillMd = path.join(hardlinkSkillDir, 'SKILL.md');
                  try {
                    if (fs.existsSync(targetSkillMd)) {
                      fs.unlinkSync(targetSkillMd);
                    }
                    fs.linkSync(path.join(skillDir, 'SKILL.md'), targetSkillMd);
                  } catch {
                    fs.copyFileSync(path.join(skillDir, 'SKILL.md'), targetSkillMd);
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/skills/delete
            if (pathname === '/api/skills/delete' && req.method === 'POST') {
              const { skillName } = jsonBody;
              const skillDir = path.join(getCentralSkillsDir(), skillName);
              if (fs.existsSync(skillDir)) {
                fs.rmSync(skillDir, { recursive: true, force: true });
              }
              // Unlink from all agents (DSH 需要清理所有 skill 根目录)
              const allAgents = getAgentsList();
              for (const a of allAgents) {
                for (const dir of getAgentSkillDirs(a)) {
                  removeSkillMount(path.join(dir, skillName));
                }
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/skills/unmanaged
            if (pathname === '/api/skills/unmanaged' && req.method === 'GET') {
              const unmanaged: any[] = [];
              const central = getCentralSkillsDir();
              const configFile = path.join(getAppDataDir(), 'config.json');
              let ignoredList: any[] = [];
              if (fs.existsSync(configFile)) {
                try {
                  const cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                  ignoredList = cfg.ignored_skills || [];
                } catch {}
              }

              const allAgents = getAgentsList();

              // 存量“待纳管”只扫描各 Agent 的主 skillsDir（DSH 的主目录即 ~/.dsh/skills）。
              // ~/.agents/skills 是通用共享根，不把它当待纳管噪音展示；
              // 但停用/删除时仍会清理所有根目录，确保开关生效。
              for (const a of allAgents) {
                const agentDir = expandTilde(a.skillsDir);
                if (fs.existsSync(agentDir)) {
                  const entries = fs.readdirSync(agentDir, { withFileTypes: true });
                  for (const ent of entries) {
                    if (ent.isDirectory()) {
                      // Check if ignored
                      if (ignoredList.some((ig: any) => ig.agentId === a.id && ig.skillName === ent.name)) {
                        continue;
                      }

                      const p = path.join(agentDir, ent.name);
                      if (!isJunctionOrSymlink(p)) {
                        // hardlink-tree 策略的 Agent：若已被 AgentHub 托管（中央库存在同名），跳过待纳管
                        if (linkStrategyFor(a.id) === 'hardlinkTree' && fs.existsSync(path.join(central, ent.name))) {
                          continue;
                        }

                        const targetCentral = path.join(central, ent.name);
                        const hasConflict = fs.existsSync(targetCentral);
                        const smd = path.join(p, 'SKILL.md');
                        const localContent = fs.existsSync(smd) ? fs.readFileSync(smd, 'utf-8') : '';
                        const centralSmd = path.join(targetCentral, 'SKILL.md');
                        const centralContent = fs.existsSync(centralSmd) ? fs.readFileSync(centralSmd, 'utf-8') : '';

                        unmanaged.push({
                          agentId: a.id,
                          agentName: a.name,
                          skillName: ent.name,
                          path: p,
                          hasConflict,
                          localContent,
                          centralContent,
                        });
                      }
                    }
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(unmanaged));
            }

            // POST /api/skills/ignore
            if (pathname === '/api/skills/ignore' && req.method === 'POST') {
              const { agentId, agentName, skillName, path: skillPath } = jsonBody;
              const configFile = path.join(getAppDataDir(), 'config.json');
              let cfg: any = { ignored_skills: [] };
              if (fs.existsSync(configFile)) {
                try {
                  cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                } catch {}
              }
              if (!Array.isArray(cfg.ignored_skills)) {
                cfg.ignored_skills = [];
              }
              if (!cfg.ignored_skills.some((i: any) => i.agentId === agentId && i.skillName === skillName)) {
                cfg.ignored_skills.push({
                  agentId,
                  agentName: agentName || agentId,
                  skillName,
                  path: skillPath,
                  ignoredAt: Date.now(),
                });
              }
              fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, ignored_skills: cfg.ignored_skills }));
            }

            // POST /api/skills/unignore
            if (pathname === '/api/skills/unignore' && req.method === 'POST') {
              const { agentId, skillName } = jsonBody;
              const configFile = path.join(getAppDataDir(), 'config.json');
              let cfg: any = { ignored_skills: [] };
              if (fs.existsSync(configFile)) {
                try {
                  cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
                } catch {}
              }
              if (Array.isArray(cfg.ignored_skills)) {
                cfg.ignored_skills = cfg.ignored_skills.filter((i: any) => !(i.agentId === agentId && i.skillName === skillName));
              }
              fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, ignored_skills: cfg.ignored_skills }));
            }

            // POST /api/skills/takeover
            if (pathname === '/api/skills/takeover' && req.method === 'POST') {
              const { agentId, skillName, resolution } = jsonBody;
              const central = getCentralSkillsDir();
              const allAgents = getAgentsList();
              const targetAgent = allAgents.find(a => a.id === agentId);
              const localDir = targetAgent
                ? findAgentSkillDir(targetAgent, skillName)
                : path.join(expandTilde(`~/.${agentId}/skills`), skillName);
              const targetName = resolution === 'rename' ? `${skillName}-${agentId}` : skillName;
              const targetCentral = path.join(central, targetName);

              if (resolution !== 'skip') {
                if (!localDir || !fs.existsSync(localDir) || isJunctionOrSymlink(localDir)) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ error: '物理目录不存在或已被 AgentHub 托管，不能重复纳管' }));
                }
                if (fs.existsSync(targetCentral)) {
                  fs.rmSync(targetCentral, { recursive: true, force: true });
                }
                copyDirRecursive(localDir, targetCentral);
                // 使用安全移除：若 localDir 是 Junction/Symlink 只会移除链接本身，
                // 绝不会递归清空其指向的中央库目录。
                removeSkillMount(localDir);
                if (fs.existsSync(localDir)) {
                  fs.rmSync(localDir, { recursive: true, force: true });
                }
                mountSkillForAgent(agentId, localDir, targetCentral);
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/projects
            if (pathname === '/api/projects' && req.method === 'GET') {
              const projectsFile = path.join(getAppDataDir(), 'projects.json');
              let projects: any[] = [];
              if (fs.existsSync(projectsFile)) {
                try {
                  projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
                } catch {}
              }
              // Dynamically refresh git status and original rules for each project
              const updatedProjects = projects.map(p => {
                const pPath = p.path;
                const gitSt = checkGitStatus(pPath);
                let origRule = p.originalRuleContent;
                if (fs.existsSync(pPath)) {
                  const origBackup = path.join(pPath, '.git', 'info', 'AGENTS.orig');
                  const agentsMd = path.join(pPath, 'AGENTS.md');
                  if (fs.existsSync(origBackup)) {
                    origRule = fs.readFileSync(origBackup, 'utf-8');
                  } else if (fs.existsSync(agentsMd) && !p.overrideEnabled) {
                    origRule = fs.readFileSync(agentsMd, 'utf-8');
                  }
                }
                return {
                  ...p,
                  isGit: gitSt.isGit,
                  gitBranch: gitSt.branch,
                  hookInstalled: gitSt.hooksActive,
                  originalRuleContent: origRule,
                };
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(updatedProjects));
            }

            // POST /api/projects/update
            if (pathname === '/api/projects/update' && req.method === 'POST') {
              const projectsFile = path.join(getAppDataDir(), 'projects.json');
              const { projectId, ruleMode, customContent, enabled, linkedAgents, preCommitGuard } = jsonBody;
              let projects: any[] = [];
              if (fs.existsSync(projectsFile)) {
                try {
                  projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
                } catch {}
              }
              const proj = projects.find(p => p.id === projectId);
              if (proj) {
                proj.ruleMode = ruleMode;
                proj.customRuleContent = customContent;
                proj.overrideEnabled = enabled;
                proj.linkedAgents = linkedAgents;
                if (preCommitGuard !== undefined) {
                  proj.preCommitGuard = preCommitGuard;
                }
                fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf-8');

                // Apply physical rules & Git hooks to the project directory
                const allAgents = getAgentsList();
                applyProjectRules(proj, allAgents);
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/projects/repair-hooks
            if (pathname === '/api/projects/repair-hooks' && req.method === 'POST') {
              const projectsFile = path.join(getAppDataDir(), 'projects.json');
              const { projectId } = jsonBody;
              let projects: any[] = [];
              if (fs.existsSync(projectsFile)) {
                try {
                  projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
                } catch {}
              }
              const proj = projects.find(p => p.id === projectId);
              if (proj) {
                const allAgents = getAgentsList();
                applyProjectRules(proj, allAgents);
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/projects/add
            if (pathname === '/api/projects/add' && req.method === 'POST') {
              const projectsFile = path.join(getAppDataDir(), 'projects.json');
              const { path: pPath, name } = jsonBody;
              let projects: any[] = [];
              if (fs.existsSync(projectsFile)) {
                try {
                  projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
                } catch {}
              }
              const id = `proj-${Date.now().toString(36)}`;
              const gitSt = checkGitStatus(pPath);
              let origRule = null;
              const agentsMd = path.join(pPath, 'AGENTS.md');
              if (fs.existsSync(agentsMd)) {
                try {
                  origRule = fs.readFileSync(agentsMd, 'utf-8');
                } catch {}
              }

              const newProj = {
                id,
                name: name || path.basename(pPath),
                path: pPath,
                isGit: gitSt.isGit,
                overrideEnabled: false,
                ruleMode: 'append',
                customRuleContent: '# 本机定制规则\n- 所有输出与回复使用中文\n',
                originalRuleContent: origRule,
                linkedAgents: ['claude-code', 'antigravity', 'codex', 'zcode'],
                gitBranch: gitSt.branch,
                hookInstalled: gitSt.hooksActive,
              };
              projects.unshift(newProj);
              fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf-8');

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(newProj));
            }

            // POST /api/projects/delete
            if (pathname === '/api/projects/delete' && req.method === 'POST') {
              const projectsFile = path.join(getAppDataDir(), 'projects.json');
              const { projectId } = jsonBody;
              let projects: any[] = [];
              if (fs.existsSync(projectsFile)) {
                try {
                  projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
                } catch {}
              }
              const target = projects.find(p => p.id === projectId);
              if (target) {
                // Rollback rules & hooks
                uninstallGitHooks(target.path);
                const allAgents = getAgentsList();
                for (const a of allAgents) {
                  if (a.localRuleFilename) {
                    const lrf = path.join(target.path, a.localRuleFilename);
                    if (fs.existsSync(lrf)) {
                      try { fs.unlinkSync(lrf); } catch {}
                    }
                  }
                }
                projects = projects.filter(p => p.id !== projectId);
                fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf-8');
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/skills/sync/status
            if (pathname === '/api/skills/sync/status' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getSkillsSyncStatus()));
            }

            // POST /api/skills/sync/init
            if (pathname === '/api/skills/sync/init' && req.method === 'POST') {
              const { remoteUrl, branch } = jsonBody;
              if (!remoteUrl) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'remoteUrl 不能为空' }));
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(initSkillsSync(remoteUrl, branch)));
            }

            // POST /api/skills/sync/pull
            if (pathname === '/api/skills/sync/pull' && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(pullSkillsSync()));
            }

            // POST /api/skills/sync/push
            if (pathname === '/api/skills/sync/push' && req.method === 'POST') {
              const { message, paths } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(pushSkillsSync(message, paths)));
            }

            // POST /api/skills/sync/auto-pull
            if (pathname === '/api/skills/sync/auto-pull' && req.method === 'POST') {
              const { enabled } = jsonBody;
              setSkillsSyncAutoPull(!!enabled);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/skills/sync/test
            if (pathname === '/api/skills/sync/test' && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(testSkillsSyncConnection()));
            }

            // POST /api/skills/sync/reset
            if (pathname === '/api/skills/sync/reset' && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(resetSkillsSyncToRemote()));
            }

            // POST /api/skills/sync/fetch
            if (pathname === '/api/skills/sync/fetch' && req.method === 'POST') {
              fetchSkillsSync();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/skills/sync/apply
            if (pathname === '/api/skills/sync/apply' && req.method === 'POST') {
              const { decisions } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(applySkillsFromRemote(decisions)));
            }

            // GET /api/skills/sync/diff
            if (pathname === '/api/skills/sync/diff' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getSkillsSyncDiff()));
            }

            // GET /api/sync/repo
            if (pathname === '/api/sync/repo' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getSyncRepoConfig()));
            }

            // POST /api/sync/repo/validate
            if (pathname === '/api/sync/repo/validate' && req.method === 'POST') {
              const { remoteUrl, branch } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(await validateSyncRepo(remoteUrl || '', branch || undefined)));
            }

            // POST /api/sync/repo
            if (pathname === '/api/sync/repo' && req.method === 'POST') {
              const { remoteUrl, branch } = jsonBody;
              if (!remoteUrl) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'remoteUrl 不能为空' }));
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(await saveSyncRepo(remoteUrl, branch || undefined)));
            }

            // POST /api/sync/repo/unbind
            if (pathname === '/api/sync/repo/unbind' && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(unbindSyncRepo()));
            }

            // GET /api/sync/schedule (定时同步配置)
            if (pathname === '/api/sync/schedule' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getSyncSchedule()));
            }

            // POST /api/sync/schedule (保存定时同步配置并热重排调度器)
            if (pathname === '/api/sync/schedule' && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(setSyncSchedule(jsonBody)));
            }

            // GET /api/sync/history (同步历史，默认最近 50 条)
            if (pathname === '/api/sync/history' && req.method === 'GET') {
              const limit = url.searchParams.get('limit');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getSyncHistory(limit ? parseInt(limit, 10) : undefined)));
            }

            // DELETE /api/sync/history (清空同步历史)
            if (pathname === '/api/sync/history' && req.method === 'DELETE') {
              clearSyncHistory();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/dsh/plugins/scan
            if (pathname === '/api/dsh/plugins/scan' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(scanDshPlugins()));
            }

            // POST /api/dsh/plugins/diagnose
            if (pathname === '/api/dsh/plugins/diagnose' && req.method === 'POST') {
              const { profile } = jsonBody;
              const result = await diagnoseDshWeb(profile);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(result));
            }

            // POST /api/dsh/plugins/toggle
            if (pathname === '/api/dsh/plugins/toggle' && req.method === 'POST') {
              const { profile, key, enabled } = jsonBody;
              toggleDshPlugin(profile, key, !!enabled);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/dsh/plugins/remove
            if (pathname === '/api/dsh/plugins/remove' && req.method === 'POST') {
              const { profile, key } = jsonBody;
              await removeDshPlugin(profile, key);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/dsh/plugins/adopt-orphan
            if (pathname === '/api/dsh/plugins/adopt-orphan' && req.method === 'POST') {
              const { profile, pkgName } = jsonBody;
              adoptDshOrphan(profile || 'web', pkgName);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/dsh/plugins/recover
            if (pathname === '/api/dsh/plugins/recover' && req.method === 'POST') {
              const { action } = jsonBody;
              applyDshRecovery(action);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/dsh/plugins/install
            if (pathname === '/api/dsh/plugins/install' && req.method === 'POST') {
              const { profile, mode } = jsonBody;
              const report = await installDshPluginsV2(profile || 'web', mode || 'incremental');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(report));
            }

            // GET /api/dsh/plugins/install-entries
            if (pathname === '/api/dsh/plugins/install-entries' && req.method === 'GET') {
              const profile = url.searchParams.get('profile') || 'web';
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(reconcileDshInstall(profile)));
            }

            // GET /api/dsh/plugins/install/stream (SSE)
            if (pathname === '/api/dsh/plugins/install/stream' && req.method === 'GET') {
              const profile = url.searchParams.get('profile') || 'web';
              const mode = url.searchParams.get('mode') || 'incremental';
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');
              res.write(`data: ${JSON.stringify({ type: 'start', profile, mode })}\n\n`);
              const report = await installDshPluginsV2(profile, mode as any, line => {
                res.write(`data: ${JSON.stringify({ type: 'line', line })}\n\n`);
              });
              res.write(`data: ${JSON.stringify({ type: 'done', report })}\n\n`);
              return res.end();
            }

            // POST /api/dsh/plugins/install-state/clear
            if (pathname === '/api/dsh/plugins/install-state/clear' && req.method === 'POST') {
              const { profile, pkg } = jsonBody;
              clearDshInstallState(profile || 'web', pkg || undefined);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/dsh/plugins/check-update
            if (pathname === '/api/dsh/plugins/check-update' && req.method === 'POST') {
              const { profile, key } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(checkDshPluginUpdate(profile || 'web', key)));
            }

            // POST /api/dsh/plugins/update
            if (pathname === '/api/dsh/plugins/update' && req.method === 'POST') {
              const { profile, key } = jsonBody;
              const report = await updateDshPlugin(profile || 'web', key);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(report));
            }

            // GET /api/dsh/plugins/sync/status
            if (pathname === '/api/dsh/plugins/sync/status' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getDshPluginsSyncStatus()));
            }

            // POST /api/dsh/plugins/sync/init
            if (pathname === '/api/dsh/plugins/sync/init' && req.method === 'POST') {
              const { remoteUrl, branch } = jsonBody;
              if (!remoteUrl) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'remoteUrl 不能为空' }));
              }
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(initDshPluginsSync(remoteUrl, branch)));
            }

            // POST /api/dsh/plugins/sync/pull
            if (pathname === '/api/dsh/plugins/sync/pull' && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(pullDshPluginsSync()));
            }

            // POST /api/dsh/plugins/sync/push
            if (pathname === '/api/dsh/plugins/sync/push' && req.method === 'POST') {
              const { message } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(pushDshPluginsSync(message)));
            }

            // POST /api/dsh/plugins/sync/auto-pull
            if (pathname === '/api/dsh/plugins/sync/auto-pull' && req.method === 'POST') {
              const { enabled } = jsonBody;
              setDshPluginsSyncAutoPull(!!enabled);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/dsh/plugins/sync/diff
            if (pathname === '/api/dsh/plugins/sync/diff' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getDshPluginsSyncDiff()));
            }

            // GET /api/dsh/plugins/reconcile
            if (pathname === '/api/dsh/plugins/reconcile' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(reconcileDshPlugins()));
            }

            // POST /api/dsh/plugins/align
            if (pathname === '/api/dsh/plugins/align' && req.method === 'POST') {
              const { profile, decisions } = jsonBody;
              await alignDshPlugins(profile, decisions);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // POST /api/dsh/plugins/snapshots (手动创建快照)
            if (pathname === '/api/dsh/plugins/snapshots' && req.method === 'POST') {
              const { profile, note } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(createDshConfigSnapshot(profile || 'web', 'manual', note)));
            }

            // GET /api/dsh/plugins/snapshots (快照时间线)
            if (pathname === '/api/dsh/plugins/snapshots' && req.method === 'GET') {
              const profile = url.searchParams.get('profile') || 'web';
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(listDshConfigSnapshots(profile)));
            }

            // POST /api/dsh/plugins/snapshots/rollback (一键回滚)
            if (pathname === '/api/dsh/plugins/snapshots/rollback' && req.method === 'POST') {
              const { snapshotId } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(rollbackDshConfigSnapshot(snapshotId)));
            }

            // POST /api/dsh/plugins/snapshots/permanent (标记永久保留)
            if (pathname === '/api/dsh/plugins/snapshots/permanent' && req.method === 'POST') {
              const { snapshotId, permanent } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(setDshConfigSnapshotPermanent(snapshotId, !!permanent)));
            }

            // POST /api/dsh/plugins/snapshots/delete (删除快照)
            if (pathname === '/api/dsh/plugins/snapshots/delete' && req.method === 'POST') {
              const { snapshotId } = jsonBody;
              deleteDshConfigSnapshot(snapshotId);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/dsh/version (当前 DSH 版本信息)
            if (pathname === '/api/dsh/version' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getDshVersionInfo()));
            }

            // GET /api/dsh/version/check (检测远端最新版本)
            if (pathname === '/api/dsh/version/check' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(checkDshVersionUpdate()));
            }

            // GET /api/dsh/version/history (本地版本历史)
            if (pathname === '/api/dsh/version/history' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(listDshVersions()));
            }

            // POST /api/dsh/version/upgrade (升级：自动快照 → npm install -g → 诊断对比)
            if (pathname === '/api/dsh/version/upgrade' && req.method === 'POST') {
              const report = await upgradeDshVersion();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(report));
            }

            // POST /api/dsh/version/install (指定版本安装 / 降级 / 切换)
            if (pathname === '/api/dsh/version/install' && req.method === 'POST') {
              const { version } = jsonBody;
              if (!version || !String(version).trim()) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'version 不能为空' }));
              }
              const report = await installDshVersion(String(version));
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(report));
            }

            // POST /api/dsh/version/rollback (一键回滚：版本 + 配置快照)
            if (pathname === '/api/dsh/version/rollback' && req.method === 'POST') {
              const { previousVersion, snapshotIds } = jsonBody;
              const report = await rollbackDshVersion(previousVersion || '', Array.isArray(snapshotIds) ? snapshotIds : []);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(report));
            }

            // GET /api/dsh/version/available (npm registry 已发布版本列表)
            if (pathname === '/api/dsh/version/available' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(listDshAvailableVersions()));
            }

            // POST /api/dsh/launch (一键启动 dsh web)
            if (pathname === '/api/dsh/launch' && req.method === 'POST') {
              const { profile } = jsonBody;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(await launchDshWeb(profile)));
            }

            // GET /api/dsh/version/upgrade/stream (SSE 实时回显升级日志)
            if (pathname === '/api/dsh/version/upgrade/stream' && req.method === 'GET') {
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');
              res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
              try {
                const report = await upgradeDshVersion(line => {
                  res.write(`data: ${JSON.stringify({ type: 'line', line })}\n\n`);
                });
                res.write(`data: ${JSON.stringify({ type: 'done', report })}\n\n`);
              } catch (e: any) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: e?.message || String(e) })}\n\n`);
              }
              return res.end();
            }

            // GET /api/dsh/version/install/stream (SSE 实时回显指定版本安装日志)
            if (pathname === '/api/dsh/version/install/stream' && req.method === 'GET') {
              const version = url.searchParams.get('version') || '';
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');
              res.write(`data: ${JSON.stringify({ type: 'start', version })}\n\n`);
              try {
                const report = await installDshVersion(version, line => {
                  res.write(`data: ${JSON.stringify({ type: 'line', line })}\n\n`);
                });
                res.write(`data: ${JSON.stringify({ type: 'done', report })}\n\n`);
              } catch (e: any) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: e?.message || String(e) })}\n\n`);
              }
              return res.end();
            }

            // GET /api/dsh/version/rollback/stream (SSE 实时回显回滚日志)
            if (pathname === '/api/dsh/version/rollback/stream' && req.method === 'GET') {
              const previousVersion = url.searchParams.get('previousVersion') || '';
              const rawIds = url.searchParams.get('snapshotIds') || '[]';
              let snapshotIds: string[] = [];
              try {
                const parsed = JSON.parse(rawIds);
                if (Array.isArray(parsed)) snapshotIds = parsed.filter((v): v is string => typeof v === 'string');
              } catch {}
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');
              res.write(`data: ${JSON.stringify({ type: 'start', previousVersion })}\n\n`);
              try {
                const report = await rollbackDshVersion(previousVersion, snapshotIds, line => {
                  res.write(`data: ${JSON.stringify({ type: 'line', line })}\n\n`);
                });
                res.write(`data: ${JSON.stringify({ type: 'done', report })}\n\n`);
              } catch (e: any) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: e?.message || String(e) })}\n\n`);
              }
              return res.end();
            }

            // GET /api/app/update/check
            if (pathname === '/api/app/update/check' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(await checkAppUpdate()));
            }

            // GET /api/app/update/download/stream (SSE)
            if (pathname === '/api/app/update/download/stream' && req.method === 'GET') {
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');
              res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
              try {
                const report = await downloadAppUpdate((downloaded, total) => {
                  const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
                  res.write(`data: ${JSON.stringify({ type: 'progress', downloaded, total, percent })}\n\n`);
                });
                res.write(`data: ${JSON.stringify({ type: 'done', report })}\n\n`);
              } catch (err: any) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: err?.message || '下载失败' })}\n\n`);
              }
              return res.end();
            }

            // POST /api/app/update/install
            if (pathname === '/api/app/update/install' && req.method === 'POST') {
              const { path: installPath } = jsonBody;
              installAppUpdate(installPath);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            }

            // GET /api/app/logs (读取最近日志，支持 limit / level 过滤)
            if (pathname === '/api/app/logs' && req.method === 'GET') {
              const limit = url.searchParams.get('limit');
              const level = url.searchParams.get('level');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getAppLogs(
                limit ? parseInt(limit, 10) : undefined,
                level || undefined,
              )));
            }

            // GET /api/app/logs/export (导出日志，返回导出文件路径)
            if (pathname === '/api/app/logs/export' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(exportAppLogs()));
            }

            // GET /api/app/logs/path (返回日志文件路径，UI 一键复制)
            if (pathname === '/api/app/logs/path' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(getAppLogPath()));
            }

            // 404 fallback
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Endpoint not found' }));
          } catch (err: any) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), localApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      // Rust 构建产物（含运行中被 Windows 锁定的 build_script_build-*.exe）不属于
      // 前端热更新范围，排除以规避 fs.watch 的 EBUSY 崩溃。
      ignored: ['**/src-tauri/target/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
