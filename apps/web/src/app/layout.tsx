import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'RSS ERP - Rehan Shahid & Sons Builders & Developers',
  description: 'Luxury Construction ERP for Rehan Shahid & Sons Builders & Developers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
