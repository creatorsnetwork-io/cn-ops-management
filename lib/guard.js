import { NAV } from './perm';

// The sidebar hides screens a role should not see. That is presentation, not
// security. This is the actual check, run on the server for each guarded page.
export function pageAllowed(who, href) {
  for (const g of NAV) {
    for (const i of g.items) {
      if (i.href === href) return i.roles.split(',').includes(who);
    }
  }
  return true;
}
