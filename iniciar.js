// Liga o PAWS em segundo plano se ele ainda não estiver rodando. O plugin chama isto toda vez que o
// Claude Code abre (hook SessionStart). Não escreve nada na conversa e termina na hora.
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT) || 4777;
const ligar = () => {
  spawn(process.execPath, [path.join(__dirname, 'server.js')], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  process.exit(0);
};
const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', headers: { host: 'localhost' }, timeout: 800 }, res => {
  res.resume();
  process.exit(0); // já tem algo respondendo nessa porta: não faz nada
});
req.on('timeout', () => req.destroy());
req.on('error', ligar);
