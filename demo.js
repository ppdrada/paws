// Dados de exemplo para ver o PAWS sem ler nada do seu computador: PAWS_DEMO=1 node server.js
// 10 agentes, 100 skills, 20 tarefas agendadas e algumas sessões. Nada aqui é real.
const MIN = 60e3, H = 60 * MIN;

module.exports = function demo() {
  const agora = Date.now();
  const sessao = (id, titulo, pasta, extra) => ({ id, titulo, pasta, cwd: '', acao: '', tarefa: null, interna: false, ...extra });
  const sessoes = [
    sessao('s1', 'Corrigir bug no login', '~/projetos/loja-web',
      { ativo: true, status: 'busy', inicio: agora - 42 * MIN, ultima: agora - 5e3, acao: 'Bash: Roda os testes de login' }),
    sessao('s2', 'Revisar o carrinho de compras', '~/projetos/loja-web',
      { ativo: true, status: 'busy', inicio: agora - 18 * MIN, ultima: agora - 2e3, acao: 'Skill: revisar-codigo' }),
    sessao('s3', 'Relatório semanal de vendas', '~/relatorios',
      { ativo: true, status: 'busy', inicio: agora - 6 * MIN, ultima: agora - 9e3, acao: 'Skill: gerar-relatorio', tarefa: 'Relatório semanal de vendas', rodandoTarefa: true }),
    sessao('s4', 'Migrar banco para Postgres', '~/projetos/api',
      { ativo: true, status: 'idle', inicio: agora - 2 * H, ultima: agora - 12 * MIN, acao: 'Claude: Migração pronta. Quer que eu rode no ambiente de teste?' }),
    sessao('s5', 'Escrever a documentação da API', '~/projetos/api',
      { ativo: true, status: 'idle', inicio: agora - 3 * H, ultima: agora - 25 * MIN, acao: 'Claude: Deixei o rascunho em docs/api.md.' }),
    sessao('s6', 'Planejar a próxima sprint', '~/projetos/gestao',
      { ativo: true, status: 'idle', inicio: agora - 50 * MIN, ultima: agora - 8 * MIN, acao: 'Você: separe as tarefas por prioridade' }),
    sessao('s7', 'Atualizar dependências', '~/projetos/app-mobile', { ativo: false, ultima: agora - 3 * H, acao: 'Claude: Tudo atualizado e testado.' }),
    sessao('s8', 'Criar landing page', '~/projetos/site', { ativo: false, ultima: agora - 5 * H, acao: 'Claude: Página publicada na pasta dist.' }),
    sessao('s9', 'Ajustar a integração contínua', '~/projetos/api', { ativo: false, ultima: agora - 9 * H, acao: 'Claude: O pipeline voltou a passar.' }),
  ];

  const roda = (sessaoId, tarefa) => [{ tarefa, sessao: sessoes.find(s => s.id === sessaoId).titulo, sessaoId }];
  const agente = (nome, origem, modelo, descricao, extra = {}) => ({ nome, origem, modelo, descricao, rodando: [], ultimoUso: null, ...extra });
  const agentes = [
    agente('revisor', 'meu', 'sonnet', 'Revisa mudanças de código e aponta bugs antes do commit.', { rodando: roda('s2', 'Revisar o carrinho'), ultimoUso: agora }),
    agente('testador', 'meu', 'haiku', 'Escreve e roda testes para o que acabou de mudar.', { rodando: roda('s1', 'Testar o login'), ultimoUso: agora }),
    agente('documentador', 'meu', 'haiku', 'Mantém o README e a documentação em dia.', { ultimoUso: agora - 4 * H }),
    agente('pesquisador', 'meu', 'opus', 'Pesquisa bibliotecas e compara alternativas.'),
    agente('designer', 'meu', 'sonnet', 'Sugere melhorias de interface e acessibilidade.'),
    agente('analista-de-dados', 'meu', 'sonnet', 'Monta consultas e resume números para relatórios.', { rodando: roda('s3', 'Somar as vendas da semana'), ultimoUso: agora }),
    agente('qualidade:seguranca', 'plugin qualidade', 'opus', 'Procura falhas de segurança no código.'),
    agente('qualidade:desempenho', 'plugin qualidade', 'sonnet', 'Encontra trechos lentos e propõe otimizações.'),
    agente('Explore', 'embutido', 'haiku', '', { ultimoUso: agora - 2 * H }),
    agente('Plan', 'embutido', 'sonnet', '', { ultimoUso: agora - 6 * H }),
  ];

  const verbos = ['gerar', 'revisar', 'resumir', 'traduzir', 'testar', 'publicar', 'organizar', 'analisar', 'converter', 'planejar'];
  const coisas = ['relatorio', 'codigo', 'emails', 'planilha', 'apresentacao', 'contrato', 'reuniao', 'backlog', 'imagens', 'release'];
  const origens = [...Array(15).fill('minha'), ...Array(10).fill('sincronizada'), ...Array(30).fill('plugin dev-tools'),
    ...Array(25).fill('plugin docs-kit'), ...Array(20).fill('plugin dados')];
  const skills = verbos.flatMap(v => coisas.map(c => `${v}-${c}`)).map((nome, i) => ({
    nome, origem: origens[i], descricao: `Ajuda a ${nome.replace('-', ' o(a) ')} seguindo o padrão do time.`,
  }));

  const nomesTarefas = ['Relatório semanal de vendas', 'Backup do banco', 'Resumo diário de e-mails', 'Checar pull requests abertos',
    'Atualizar dependências', 'Limpar branches antigos', 'Lembrete da reunião de equipe', 'Conferir faturas do mês',
    'Publicar notas da versão', 'Verificar alertas de segurança', 'Exportar métricas do site', 'Revisar tarefas atrasadas',
    'Arquivar conversas antigas', 'Gerar slides da semana', 'Conferir status dos servidores', 'Enviar resumo para o time',
    'Organizar pasta de downloads', 'Checar certificados', 'Atualizar planilha de custos', 'Rodar testes noturnos'];
  const tarefas = nomesTarefas.map((nome, i) => {
    const rodando = i === 0, recorrente = i % 3 !== 2;
    return {
      id: 'demo-' + (i + 1), nome, descricao: `Tarefa de exemplo: ${nome.toLowerCase()}.`,
      agenda: recorrente ? `Recorrente (cron ${i % 2 ? '0 9 * * 1-5' : '30 8 * * 1'})` : 'Uma vez',
      proxima: rodando ? null : agora + (i * 2 + 1) * H, ultima: i % 4 === 3 ? null : agora - (i + 1) * 5 * H,
      execucoes: i % 4 === 3 ? 0 : 3 + (i * 7) % 20, rodando,
    };
  });

  return { agora, sessoes, agentes, tarefas, skills };
};
