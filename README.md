# PAWS

**Panel - Agentes - Workflows - Skills.** Um painel local, só de leitura, para ver no navegador o que o Claude Code está fazendo no seu Mac. Atualiza sozinho a cada 5 segundos.

- **Sessões:** conversas do Claude Code abertas agora e das últimas 24 horas, com pasta, tempo e o último comando ou mensagem. Em amarelo, as que estão trabalhando.
- **Agentes:** os seus (`~/.claude/agents`), os dos plugins e os embutidos que rodaram hoje. Em amarelo, os que estão rodando.
- **Agendados:** as tarefas agendadas do app Claude, com a próxima e a última execução.
- **Skills:** as suas, as sincronizadas da conta e as que vêm nos plugins.

Tem tema claro e escuro (Auto, Claro ou Escuro, no rodapé do menu).

## Requisitos

- macOS com Claude Code instalado.
- Node 18 ou mais novo. Não tem dependências nem build: é um `server.js` e um `index.html`.
- Para a seção Agendados, o app Claude para desktop. Em outros sistemas, ela mostra só os nomes das tarefas.

## Como rodar

```bash
git clone https://github.com/ppdrada/paws.git
node paws/server.js
```

Depois abra http://localhost:4777.

- Outra porta: `PORT=5000 node paws/server.js`
- Se você usa `CLAUDE_CONFIG_DIR`, o PAWS lê essa pasta no lugar de `~/.claude`.

## Teste

```bash
node paws/test.js
```

## Ligar sozinho no login (opcional)

Crie `~/Library/LaunchAgents/com.paws.server.plist` trocando os dois caminhos (veja o do Node com `which node`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.paws.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/CAMINHO/DO/node</string>
    <string>/CAMINHO/DO/paws/server.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
```

Para ligar e desligar:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.paws.server.plist
launchctl bootout gui/$(id -u)/com.paws.server
```

## Privacidade e limites

- Escuta só em `127.0.0.1` e recusa pedidos que não venham de `localhost`.
- Só lê: não altera nada em `~/.claude`.
- Nunca abre arquivos de credenciais (`.credentials*`, `auth.json`, tokens, `*.key`) nem o `settings.json`.
- Mostra trechos dos seus transcripts (o último comando ou mensagem de cada sessão), só no seu navegador.
- A seção Agendados lê arquivos internos do app Claude que não são documentados. Uma atualização do app pode quebrar essa parte.
