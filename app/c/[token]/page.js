import ClientReview from '../../../components/ClientReview';

export const metadata = { title: 'Content for review' };

export default function ClientPage({ params }) {
  return <ClientReview token={params.token} />;
}
