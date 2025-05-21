
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
  title: 'GoldQuest - Your Financial Adventure',
  description: 'Embark on your GoldQuest to master personal finances, track investments, and achieve your financial goals.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply oxanium.variable to html tag for global CSS variable availability
    // Add suppressHydrationWarning to handle client-side theme class changes
    <html lang="en" className={oxanium.variable} suppressHydrationWarning>
      <head>
          {/* Metadata will be injected by Next.js from the export above */}
      </head>
      <body
      className={cn(
          'font-sans antialiased', 
          'min-h-screen flex flex-col'
        )}
        suppressHydrationWarning 
      >
        <AuthProvider> 
          <AuthWrapper>{children}</AuthWrapper> 
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
