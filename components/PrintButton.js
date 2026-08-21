'use client';
export default function PrintButton() {
  return <button className="btn dark noprint" onClick={() => window.print()}>Print or save as PDF</button>;
}
