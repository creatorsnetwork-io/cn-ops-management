import SignIn from '../../components/SignIn';
import { oauthClient, allowedDomain } from '../../lib/oauth';
import { sanity } from '../../lib/sanity';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in, CN Ops' };

export default async function Page() {
  const c = oauthClient();
  let people = [];
  try { people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name,role}'); } catch (e) {}

  const local = process.env.NODE_ENV !== 'production';
  const origins = c ? (c.origins || []) : [];
  const hostReady = origins.some((o) => o.includes('localhost'));

  return (
    <SignIn
      clientId={c ? c.id : null}
      domain={allowedDomain()}
      people={people}
      allowLocal={local}
      hostReady={hostReady}
      origins={origins}
    />
  );
}
