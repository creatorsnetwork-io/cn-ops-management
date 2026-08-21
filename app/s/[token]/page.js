import SharedViewV7 from '../../../components/SharedViewV7';
export const metadata = { title: 'Creators Network' };
export default function Page({ params }) {
  return <SharedViewV7 token={params.token} />;
}
