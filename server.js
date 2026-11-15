// Paw: painel local, só leitura, dos agentes, skills e tarefas agendadas do Claude Code.
// Uso: node server.js  →  http://localhost:4777   (porta: PORT=xxxx node server.js)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const APP = path.join(HOME, 'Library/Application Support/Claude/claude-code-sessions');
const PORT = Number(process.env.PORT) || 4777;
const RECENTE_MS = 24 * 3600e3;
const MAX_RECENTES = 25;
const PROIBIDO = /credential|auth\.json|token|\.key$/i; // nunca abrir esses arquivos

const ls = (d, opts) => { try { return fs.readdirSync(d, opts); } catch { return []; } };
const read = p => (PROIBIDO.test(path.basename(p)) ? null : fs.readFileSync(p, 'utf8'));
const readJSON = p => JSON.parse(read(p));
const clip = (s, n = 220) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

// Relê um arquivo só quando o mtime muda; guarda apenas o que fn extrai.
const memo = new Map();
function byMtime(p, fn) {
  let m; try { m = fs.statSync(p).mtimeMs; } catch { return null; }
  const c = memo.get(p);
  if (c && c.m === m) return c.v;
  let v = null; try { v = fn(p); } catch {}
  memo.set(p, { m, v });
  return v;
}

// --- parsers (testados em test.js) ---

function frontmatter(txt) {
  const out = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(txt || '');
  if (!m) return out;
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1]; out[key] = /^[>|][-+]?$/.test(kv[2]) ? '' : kv[2]; }
    else if (key && /^\s/.test(line)) out[key] += ' ' + line.trim();
  }
  for (const k in out) out[k] = out[k].trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
  return out;
}

function resumoFerramenta(i = {}) {
  return i.description || i.command || i.file_path || i.pattern || i.url || i.query || i.prompt || JSON.stringify(i);
}

// Descreve uma linha do transcript como "o que está fazendo", ou null se não for relevante.
function descrever(o) {
  if (o.isMeta || o.isSidechain) return null;
  const c = o.message?.content;
  if (o.type === 'assistant' && Array.isArray(c)) {
    for (const b of [...c].reverse()) {
      if (b.type === 'tool_use') return `${b.name}: ${resumoFerramenta(b.input)}`;
      if (b.type === 'text' && b.text?.trim()) return `Claude: ${b.text}`;
    }
  }
  if (o.type === 'user') {
    const blocos = typeof c === 'string' ? [c] : Array.isArray(c) ? c.filter(b => b.type === 'text').map(b => b.text) : [];
    const t = blocos.filter(s => s && !s.trimStart().startsWith('<')).join(' ');
    if (t.trim()) return `Você: ${t}`;
  }
  return null;
}

function parseTail(lines) {
  const info = {};
  for (let i = lines.length - 1; i >= 0 && !(info.acao && info.cwd); i--) {
    let o; try { o = JSON.parse(lines[i]); } catch { continue; }
    if (!info.cwd && o.cwd) info.cwd = o.cwd;
    if (!info.acao) { const d = descrever(o); if (d) info.acao = clip(d); }
  }
  return info;
}

// shortcut: lê só os últimos 512 KB do transcript; se a última ação estiver antes disso, fica sem "agora".
function tailTranscript(p) {
  const fd = fs.openSync(p, 'r');
  try {
    const size = fs.fstatSync(fd).size, len = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    return parseTail(buf.toString('utf8').split('\n').slice(size > len ? 1 : 0));
  } finally { fs.closeSync(fd); }
}

function cronCampo(f, min, max) {
  const ok = new Set();
  for (const parte of f.split(',')) {
    const [faixa, passoS] = parte.split('/');
    const passo = Number(passoS) || 1;
    let [a, b] = faixa === '*' ? [min, max] : faixa.split('-').map(Number);
    if (b === undefined) b = passoS ? max : a;
    for (let v = a; v <= b; v += passo) ok.add(v);
  }
  return ok;
}

// shortcut: cron de 5 campos só com números (*, a-b, a,b, /n); nomes como MON/JAN dão null.
function nextCron(expr, from) {
  const f = String(expr).trim().split(/\s+/);
  if (f.length !== 5) return null;
  const [mi, h, dom, mon, dow] = [cronCampo(f[0], 0, 59), cronCampo(f[1], 0, 23), cronCampo(f[2], 1, 31), cronCampo(f[3], 1, 12), cronCampo(f[4], 0, 7)];
  if ([mi, h, dom, mon, dow].some(s => s.size === 0 || [...s].some(Number.isNaN))) return null;
  if (dow.has(7)) dow.add(0);
  const domQualquer = f[2] === '*', dowQualquer = f[4] === '*';
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  while (d - from < 2 * 366 * 864e5) {
    const dia = domQualquer && dowQualquer ? true
      : domQualquer ? dow.has(d.getDay())
      : dowQualquer ? dom.has(d.getDate())
      : dom.has(d.getDate()) || dow.has(d.getDay());
    if (!mon.has(d.getMonth() + 1) || !dia) { d.setDate(d.getDate() + 1); d.setHours(0, 0); continue; }
    if (!h.has(d.getHours())) { d.setHours(d.getHours() + 1, 0); continue; }
    if (!mi.has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1); continue; }
    return d.getTime();
  }
  return null;
}

// --- coleta ---

function pasta(cwd) {
  if (!cwd) return '';
  if (cwd.includes('/scratch-workspaces/')) return 'pasta temporária do app';
  return cwd.startsWith(HOME) ? '~' + cwd.slice(HOME.length) : cwd;
}

function vivo(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// Sessões do app Claude (títulos, tarefa agendada que as iniciou) e a agenda das tarefas.
function dadosDoApp() {
  const porSessao = new Map(), execucoes = [], agenda = [];
  for (const a of ls(APP)) for (const b of ls(path.join(APP, a))) {
    const dir = path.join(APP, a, b);
    const st = byMtime(path.join(dir, 'scheduled-tasks.json'), readJSON);
    if (Array.isArray(st?.scheduledTasks)) agenda.push(...st.scheduledTasks);
    for (const f of ls(dir)) {
      if (!/^local_.*\.json$/.test(f)) continue;
      // Só esses campos saem do arquivo; o resto (config de MCP etc.) nunca é guardado nem enviado.
      const s = byMtime(path.join(dir, f), p => {
        const o = readJSON(p);
        return { titulo: o.title, cli: [o.cliSessionId, o.lastAssistantCliSessionId].filter(Boolean), tarefa: o.scheduledTaskId, criada: o.createdAt };
      });
      if (!s) continue;
      for (const id of s.cli) porSessao.set(id, s);
      if (s.tarefa) execucoes.push(s);
    }
  }
  return { porSessao, execucoes, agenda };
}

function transcripts() {
  const idx = new Map();
  const base = path.join(CLAUDE, 'projects');
  for (const d of ls(base)) {
    for (const f of ls(path.join(base, d))) {
      if (!f.endsWith('.jsonl')) continue;
      const p = path.join(base, d, f);
      try { idx.set(f.slice(0, -6), { p, m: fs.statSync(p).mtimeMs }); } catch {}
    }
  }
  return idx;
}

function sessoes(app, nomesTarefas, tr, now) {
  const ativos = [];
  for (const f of ls(path.join(CLAUDE, 'sessions'))) {
    if (!/^\d+\.json$/.test(f)) continue; // os .key ao lado nunca são abertos
    const s = byMtime(path.join(CLAUDE, 'sessions', f), readJSON);
    if (s?.sessionId && vivo(s.pid)) ativos.push(s);
  }
  const linha = (id, extra) => {
    const t = tr.get(id);
    const tail = (t && byMtime(t.p, tailTranscript)) || {};
    const a = app.porSessao.get(id);
    const cwd = extra.cwd || tail.cwd;
    return {
      ...extra,
      id, cwd, pasta: pasta(cwd), acao: tail.acao || '', ultima: t?.m || extra.ultima || null,
      titulo: clip(a?.titulo || extra.nome || path.basename(cwd || '') || id, 90),
      tarefa: a?.tarefa ? (nomesTarefas.get(a.tarefa) || a.tarefa) : null,
      interna: (cwd || '').includes('/.claude-mem/'),
    };
  };
  const lista = ativos.map(s => linha(s.sessionId, {
    ativo: true, status: s.status || '', inicio: s.startedAt, nome: s.name, cwd: s.cwd, ultima: s.updatedAt,
  }));
  const ids = new Set(lista.map(l => l.id));
  const recentes = [...tr].filter(([id, t]) => !ids.has(id) && now - t.m < RECENTE_MS)
    .sort((x, y) => y[1].m - x[1].m)
    .map(([id]) => linha(id, { ativo: false }))
    .filter(l => !l.interna)
    .slice(0, MAX_RECENTES);
  for (const l of lista) l.rodandoTarefa = !!l.tarefa && l.status !== 'idle';
  lista.sort((x, y) => (y.status === 'busy') - (x.status === 'busy') || (y.ultima || 0) - (x.ultima || 0));
  return [...lista, ...recentes].map(({ nome, ...r }) => r);
}

const plugins = () => Object.entries(byMtime(path.join(CLAUDE, 'plugins/installed_plugins.json'), readJSON)?.plugins || {})
  .map(([nome, versoes]) => ({ nome: nome.split('@')[0], dir: versoes?.[0]?.installPath }));

// Agentes de verdade: os .md de ~/.claude/agents e dos plugins. "Rodando" vem dos
// subagentes (subagents/*.meta.json) das sessões abertas; embutidos aparecem se rodaram nas últimas 24 h.
function agentes(listaSessoes, tr, now) {
  const defs = new Map();
  const add = (p, chave, origem) => {
    const fm = byMtime(p, q => frontmatter(read(q)));
    if (!fm) return;
    const nome = chave(fm.name || path.basename(p, '.md'));
    defs.set(nome, { nome, descricao: clip(fm.description, 300), modelo: fm.model || '', origem, rodando: [], ultimoUso: null });
  };
  const meus = path.join(CLAUDE, 'agents');
  for (const f of ls(meus)) if (f.endsWith('.md')) add(path.join(meus, f), n => n, 'meu');
  for (const pl of plugins()) {
    const dir = path.join(pl.dir || '', 'agents');
    for (const f of ls(dir)) if (f.endsWith('.md')) add(path.join(dir, f), n => `${pl.nome}:${n}`, 'plugin ' + pl.nome);
  }
  for (const s of listaSessoes) {
    const t = tr.get(s.id);
    if (!t || now - t.m > RECENTE_MS) continue;
    const dir = path.join(t.p.slice(0, -6), 'subagents');
    for (const f of ls(dir)) {
      if (!f.endsWith('.meta.json')) continue;
      const meta = byMtime(path.join(dir, f), readJSON);
      if (!meta?.agentType) continue;
      let m; try { m = fs.statSync(path.join(dir, f.replace('.meta.json', '.jsonl'))).mtimeMs; } catch { continue; }
      if (!defs.has(meta.agentType)) defs.set(meta.agentType, { nome: meta.agentType, descricao: '', modelo: meta.model || '', origem: 'embutido', rodando: [], ultimoUso: null });
      const a = defs.get(meta.agentType);
      a.ultimoUso = Math.max(a.ultimoUso || 0, m);
      // shortcut: sem atividade por 2 min conta como parado, mesmo sem "finished" no meta.
      if (s.ativo && !meta.finished && now - m < 120e3) a.rodando.push({ tarefa: clip(meta.description, 120), sessao: s.titulo });
    }
  }
  const ordem = o => (o === 'meu' ? 0 : o === 'embutido' ? 2 : 1);
  return [...defs.values()].sort((a, b) => (b.rodando.length > 0) - (a.rodando.length > 0) || ordem(a.origem) - ordem(b.origem) || a.nome.localeCompare(b.nome));
}

function tarefas(app, ativosIds, now) {
  const dir = path.join(CLAUDE, 'scheduled-tasks');
  const agenda = new Map(app.agenda.map(t => [t.id, t]));
  const ids = new Set([...ls(dir).filter(n => !n.startsWith('.')), ...agenda.keys()]);
  return [...ids].map(id => {
    const t = agenda.get(id);
    const fm = byMtime(path.join(dir, id, 'SKILL.md'), p => frontmatter(read(p))) || {};
    const runs = app.execucoes.filter(r => r.tarefa === id);
    const ultima = Math.max(t?.lastRunAt || 0, ...runs.map(r => r.criada || 0)) || null;
    const cron = t?.cronExpression || t?.cron;
    let proxima = null;
    if (t?.enabled !== false && t) proxima = cron ? nextCron(cron, now) : (t.fireAt && !(ultima >= t.fireAt) ? t.fireAt : null);
    return {
      id, nome: t?.displayName || fm.name || id, descricao: clip(fm.description, 400),
      agenda: !t ? 'Sem agendamento no app' : t.enabled === false ? 'Desativada' : cron ? `Recorrente (cron ${cron})` : 'Uma vez',
      proxima, ultima, execucoes: runs.length,
      rodando: runs.some(r => r.cli.some(c => ativosIds.has(c))),
    };
  }).sort((a, b) => (b.rodando - a.rodando) || ((a.proxima ?? Infinity) - (b.proxima ?? Infinity)));
}

const skillPaths = new Map();
function acharSkills(dir, prof = 0, out = []) {
  if (!dir || prof > 6) return out;
  for (const e of ls(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) acharSkills(p, prof + 1, out);
    else if (e.name === 'SKILL.md') out.push(p);
  }
  return out;
}

function skills() {
  const out = [];
  const add = (p, origem) => {
    const fm = byMtime(p, q => frontmatter(read(q)));
    if (fm) out.push({ nome: fm.name || path.basename(path.dirname(p)), descricao: clip(fm.description, 400), origem });
  };
  const minhas = path.join(CLAUDE, 'skills');
  for (const d of ls(minhas)) add(path.join(minhas, d, 'SKILL.md'), 'minha');
  const sync = path.join(minhas, 'synced');
  for (const conta of ls(sync)) for (const d of ls(path.join(sync, conta))) add(path.join(sync, conta, d, 'SKILL.md'), 'sincronizada');
  for (const pl of plugins()) {
    if (!skillPaths.has(pl.dir)) skillPaths.set(pl.dir, acharSkills(pl.dir));
    for (const p of skillPaths.get(pl.dir)) add(p, 'plugin ' + pl.nome);
  }
  return out;
}

function estado() {
  const now = Date.now();
  const app = dadosDoApp();
  const nomes = new Map(app.agenda.map(t => [t.id, t.displayName || t.id]));
  const tr = transcripts();
  const ses = sessoes(app, nomes, tr, now);
  const ativosIds = new Set(ses.filter(s => s.ativo && s.status !== 'idle').map(s => s.id));
  return { agora: now, sessoes: ses, agentes: agentes(ses, tr, now), tarefas: tarefas(app, ativosIds, now), skills: skills() };
}

function servir(req, res) {
  // Bloqueia DNS rebinding: só aceita o painel aberto por localhost/127.0.0.1.
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return res.writeHead(403).end();
  if (req.method !== 'GET') return res.writeHead(405).end();
  if (req.url === '/api') {
    try {
      const body = JSON.stringify(estado());
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(body);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('erro: ' + e.message);
    }
  }
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  res.writeHead(404).end();
}

if (require.main === module) {
  http.createServer(servir).listen(PORT, '127.0.0.1', () => console.log(`PAWS em http://localhost:${PORT}`));
}

module.exports = { frontmatter, parseTail, nextCron, descrever, estado };
