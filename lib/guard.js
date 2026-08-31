import { navConfig } from './perm';

// The sidebar hides screens a role should not see. That is presentation, not
// security. This is the actual check, run on the server for each guarded page.
export async function pageAllowed(who, href) {
  const nav = await navConfig();
  for (const g of nav) {
    for (const i of g.items) {
      if (i.href === href) return i.roles.split(',').includes(who);
    }
  }
  return true;
}
