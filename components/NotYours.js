import Link from 'next/link';
export default function NotYours({ what }) {
  return (
    <>
      <div className="eyebrow">Not your screen</div>
      <h1>{what}</h1>
      <p className="lede">
        This one is not part of your role, so there is nothing here for you. That is deliberate,
        not a fault. If you think you should see it, ask Himanshu or Aashif to change your permissions.
      </p>
      <div className="guard"><Link href="/">Back to your home screen</Link></div>
    </>
  );
}
