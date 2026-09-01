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
  // The origins list only ever comes from a local dropped OAuth-client JSON
  // (gitignored, never deployed), so it's always empty in production. There
  // is no way to introspect Google Cloud Console's Authorized origins from
  // here, so in production we trust it's been set up and let Google's own
  // script fail with its own error if it hasn't. The origins-based hint stays
  // for local dev, where the JSON file makes it accurate.
  const hostReady = local ? origins.some((o) => o.includes('localhost')) : true;

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
