import { ensureDemoUser } from './demoUser';

export function ensureSeeded(): void {
  const user = ensureDemoUser();
  console.log(`[seed] conta demo pronta: ${user.email}`);
}
