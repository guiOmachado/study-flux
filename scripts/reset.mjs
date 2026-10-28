import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  console.log('Nada para apagar: a pasta de dados não existe.');
  process.exit(0);
}

const files = fs.readdirSync(dataDir);
if (!files.includes('studyflux.db') && files.length > 0) {
  console.error(`A pasta ${dataDir} não parece ser a pasta de dados do Study Flux. Nada foi apagado.`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`Isso apaga TODOS os dados locais em ${dataDir} (materiais, casos, histórico). Confirmar? [s/N] `);
rl.close();

if (answer.trim().toLowerCase() !== 's') {
  console.log('Cancelado.');
  process.exit(0);
}

fs.rmSync(dataDir, { recursive: true, force: true });
console.log('Dados apagados. Rode "npm run dev" ou "npm run seed" para recriar a conta demo.');
