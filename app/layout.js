import './globals.css';
export const metadata = { title: 'CN Ops Portal', description: 'Creators Network operations' };
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
