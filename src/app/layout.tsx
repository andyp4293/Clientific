import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClientFlow - Customer Management & Review Platform',
  description: 'Manage customers, reviews, appointments, and loyalty programs for your service business',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
