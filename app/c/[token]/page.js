import ClientReviewV7 from '../../../components/ClientReviewV7';

export const metadata = { title: 'Content for review' };

export default function ClientPage({ params }) {
  return <ClientReviewV7 token={params.token} />;
}
