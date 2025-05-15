
import type { Metadata } from 'next';
import { Oxanium } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import AuthWrapper from '@/components/layout/auth-wrapper';
import { AuthProvider } from '@/contexts/AuthContext';

const oxanium = Oxanium({
  variable: '--font-oxanium', // This tells next/font to create a CSS variable
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GoldQuest',
  description: 'Simple personal finance management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={oxanium.variable}><head>
          {/* Metadata will be injected by Next.js from the export above */}
      </head>
      <body
      className={cn(
          // oxanium.className, // Removed from here
          'font-sans antialiased', // font-sans will use var(--font-oxanium) from html
          'min-h-screen flex flex-col'
        )}
      >
        <AuthProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
