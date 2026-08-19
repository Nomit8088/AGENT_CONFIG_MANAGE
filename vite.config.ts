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
  copyDirRecursive,
  parseSkillMd,
  checkGitStatus,
  applyProjectRules,
  uninstallGitHooks,
  DEFAULT_PRESET_AGENTS,
  detectAgentInstalled,
  detectSystemTheme,
} from './src/server/localApi';

function localApiPlugin(): Plugin {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      initStorage();

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
                  if (ent.isDirectory()) {
                    const skillFolder = path.join(central, ent.name);
                    const smd = path.join(skillFolder, 'SKILL.md');
                    const content = fs.existsSync(smd) ? fs.readFileSync(smd, 'utf-8') : '';
                    const parsed = parseSkillMd(content, ent.name);

                    const mountedAgents: string[] = [];
                    const isSymlinkMap: Record<string, boolean> = {};

                    for (const a of allAgents) {
                      const target = path.join(expandTilde(a.skillsDir), ent.name);
                      const isLink = isJunctionOrSymlink(target);
                      isSymlinkMap[a.id] = isLink;
                      if (isLink || fs.existsSync(target)) {
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
              const targetDir = targetAgent ? expandTilde(targetAgent.skillsDir) : expandTilde(`~/.${agentId}/skills`);
              const linkPath = path.join(targetDir, skillName);

              if (enable) {
                mountSkillForAgent(agentId, linkPath, centralSkill);
              } else {
                removeSkillMount(linkPath);
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

              // If Antigravity has this skill mounted as physical/hardlink dir, keep SKILL.md in sync
              const antigravitySkillDir = path.join(expandTilde('~/.gemini/config/skills'), skillName);
              if (fs.existsSync(antigravitySkillDir) && !isJunctionOrSymlink(antigravitySkillDir)) {
                const targetSkillMd = path.join(antigravitySkillDir, 'SKILL.md');
                try {
                  if (fs.existsSync(targetSkillMd)) {
                    fs.unlinkSync(targetSkillMd);
                  }
                  fs.linkSync(path.join(skillDir, 'SKILL.md'), targetSkillMd);
                } catch {
                  fs.copyFileSync(path.join(skillDir, 'SKILL.md'), targetSkillMd);
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
              // Unlink from all agents
              const allAgents = getAgentsList();
              for (const a of allAgents) {
                removeSkillMount(path.join(expandTilde(a.skillsDir), skillName));
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
                        // Antigravity special check: if it's already managed by AgentHub hardlink tree
                        if (a.id === 'antigravity' && fs.existsSync(path.join(central, ent.name))) {
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
              const targetSkillsDir = targetAgent ? expandTilde(targetAgent.skillsDir) : expandTilde(`~/.${agentId}/skills`);

              const localDir = path.join(targetSkillsDir, skillName);
              const targetName = resolution === 'rename' ? `${skillName}-${agentId}` : skillName;
              const targetCentral = path.join(central, targetName);

              if (resolution !== 'skip' && fs.existsSync(localDir)) {
                if (fs.existsSync(targetCentral)) {
                  fs.rmSync(targetCentral, { recursive: true, force: true });
                }
                copyDirRecursive(localDir, targetCentral);
                fs.rmSync(localDir, { recursive: true, force: true });
                createJunction(localDir, targetCentral);
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
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
