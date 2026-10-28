import { spawn } from 'node:child_process';

const children = [];

function run(command, args, name) {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[dev] ${name} terminou com código ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('npx', ['tsx', 'watch', 'server/index.ts'], 'api');
run('npx', ['vite', '--host', '0.0.0.0', '--port', '5173', '--strictPort'], 'web');
