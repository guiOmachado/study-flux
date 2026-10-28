import { SEED_DEMO } from '../config';
import { ensureDemoUser } from './demoUser';

export function ensureSeeded(): void {
  if (!SEED_DEMO) {
    console.log('[seed] conta demo desativada (SEED_DEMO=0) — usuários criam a própria conta');
    return;
  }
  const user = ensureDemoUser();
  console.log(`[seed] conta demo pronta: ${user.email}`);
}
