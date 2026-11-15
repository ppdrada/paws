// Self-check dos parsers: node test.js
const assert = require('node:assert/strict');
const { frontmatter, parseTail, nextCron } = require('./server.js');

// frontmatter: simples, entre aspas, bloco dobrado (>) e sem frontmatter
assert.deepEqual(frontmatter('---\nname: git-sync\ndescription: Verifica repos\n---\ncorpo'), { name: 'git-sync', description: 'Verifica repos' });
assert.equal(frontmatter('---\nname: g\ndescription: "Use para: grafos"\n---').description, 'Use para: grafos');
assert.equal(frontmatter('---\ndescription: >\n  linha um\n  linha dois\nname: x\n---').description, 'linha um linha dois');
assert.deepEqual(frontmatter('sem frontmatter'), {});

// transcript: pega a última ação relevante, pulando thinking, tool_result e lixo
const L = o => JSON.stringify(o);
const linhas = [
  L({ type: 'user', cwd: '/p', message: { role: 'user', content: 'arrume o bug' } }),
  L({ type: 'assistant', cwd: '/p', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test', description: 'Roda os testes' } }] } }),
  L({ type: 'user', cwd: '/p', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
  L({ type: 'assistant', cwd: '/p', message: { content: [{ type: 'thinking', thinking: '...' }] } }),
  '{linha cortada',
];
assert.deepEqual(parseTail(linhas), { cwd: '/p', acao: 'Bash: Roda os testes' });
assert.equal(parseTail([L({ type: 'user', message: { content: [{ type: 'text', text: '<system-reminder>x' }, { type: 'text', text: 'oi' }] } })]).acao, 'Você: oi');
assert.equal(parseTail([L({ type: 'assistant', message: { content: [{ type: 'text', text: 'Pronto.' }] } })]).acao, 'Claude: Pronto.');

// cron (hora local): domingo 15/11/2026 16:00 → segunda 16/11 09:00
const dom = new Date(2026, 10, 15, 16, 0).getTime();
assert.equal(nextCron('0 9 * * 1', dom), new Date(2026, 10, 16, 9, 0).getTime());
assert.equal(nextCron('*/15 * * * *', dom), new Date(2026, 10, 15, 16, 15).getTime());
assert.equal(nextCron('30 8 1 * *', dom), new Date(2026, 11, 1, 8, 30).getTime());
assert.equal(nextCron('0 9 * * MON', dom), null);

console.log('ok: todos os testes passaram');
