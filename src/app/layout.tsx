
import type { Metadata } from 'next';
import { Oxanium } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import AuthWrapper from '@/components/layout/auth-wrapper';
import { AuthProvider } from '@/contexts/AuthContext';

const oxanium = Oxanium({
  variable: '--font-oxanium',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'The Golden Game',
  description: 'Simple personal finance management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"> {/* Removed className="dark" */}
      <head>
          {/* Metadata will be injected by Next.js from the export above */}
      </head>
      <body
      className={cn(
          `${oxanium.variable} font-sans antialiased`,
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
