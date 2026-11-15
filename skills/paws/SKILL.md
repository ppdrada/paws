---
name: paws
description: Abre o PAWS (Panel - Agentes - Workflows - Skills), o painel local no navegador que mostra as sessões, os agentes, as tarefas agendadas e as skills do Claude Code, com um escritório em pixel art. Use quando a pessoa digitar /paws ou pedir para abrir, ligar, ver ou parar o PAWS ou o painel dos agentes.
---

# PAWS

O servidor é o arquivo `server.js` na raiz deste plugin: duas pastas acima do diretório base desta skill (o diretório base aparece quando a skill é carregada). Ele só precisa de Node 18 ou mais novo, não tem dependências, só lê arquivos e escuta só em `127.0.0.1:4777`.

Responda em português, curto.

Normalmente o painel já está ligado: o plugin roda `iniciar.js` toda vez que o Claude Code abre e liga o servidor em segundo plano. Então, na maioria das vezes, basta abrir o endereço (passo 3).

## Abrir o painel

1. Veja se já está rodando:
   - macOS ou Linux: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4777/api`
   - Windows (PowerShell): `(Invoke-WebRequest -UseBasicParsing http://localhost:4777/api).StatusCode`

   Se a resposta for 200, pule para o passo 3.
2. Se não estiver rodando, confira `node --version`. Sem Node, ou com versão abaixo de 18, diga para instalar a versão LTS em https://nodejs.org e pare. Com Node, inicie o servidor em segundo plano, de um jeito que continue rodando depois que você terminar:
   - macOS ou Linux: `nohup node "<raiz do plugin>/server.js" > /dev/null 2>&1 &`
   - Windows (PowerShell): `Start-Process node -ArgumentList '"<raiz do plugin>\server.js"' -WindowStyle Hidden`

   Espere 1 segundo e confira de novo como no passo 1.
3. Abra http://paws.localhost:4777/#office no navegador (macOS: `open`, Windows: `start`, Linux: `xdg-open`). Se houver um navegador embutido no app em que você está, pode abrir nele. Se o navegador não abrir esse endereço, use http://localhost:4777/#office (é o mesmo painel).
4. Diga o endereço e que o painel se atualiza sozinho.

## Se a porta 4777 estiver ocupada por outro programa

Inicie com outra porta e abra essa porta:
- macOS ou Linux: `PORT=4778 nohup node "<raiz do plugin>/server.js" > /dev/null 2>&1 &`
- Windows (PowerShell): `$env:PORT=4778; Start-Process node -ArgumentList '"<raiz do plugin>\server.js"' -WindowStyle Hidden`

## Parar o painel

Só quando a pessoa pedir. Encerre apenas o processo `node` que roda o `server.js` deste plugin:
- macOS ou Linux: `pkill -f "<raiz do plugin>/server.js"`
- Windows (PowerShell): `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*<raiz do plugin>*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId }`

## Regras

- O PAWS só lê. Não altere nada em `~/.claude` nem na pasta do app Claude.
- Não abra nem mostre arquivos de credenciais.
