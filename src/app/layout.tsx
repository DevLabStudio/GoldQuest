
import type { Metadata } from 'next';
import { Oxanium } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import AuthWrapper from '@/components/layout/auth-wrapper'; // This component handles theme application
import { AuthProvider } from '@/contexts/AuthContext'; // This provides the theme state

const oxanium = Oxanium({
  variable: '--font-oxanium',
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
    // Apply oxanium.variable to html tag for global CSS variable availability
    // Add suppressHydrationWarning to handle client-side theme class changes
    <html lang="en" className={oxanium.variable} suppressHydrationWarning>
      <head>
          {/* Metadata will be injected by Next.js from the export above */}
      </head>
      <body
      className={cn(
          // oxanium.className, // Removed from here
          'font-sans antialiased', // font-sans will use var(--font-oxanium) from html
          'min-h-screen flex flex-col'
        )}
        suppressHydrationWarning // Add this to the body tag
      >
        <AuthProvider> {/* AuthProvider provides theme via AuthContext */}
          <AuthWrapper>{children}</AuthWrapper> {/* AuthWrapper applies theme to <html> */}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
