import SharedView from '../../../components/SharedView';
export const metadata = { title: 'Creators Network' };
export default function Page({ params }) {
  return <SharedView token={params.token} />;
}
