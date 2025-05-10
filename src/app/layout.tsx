
'use client'; 

import { Oxanium } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import AuthWrapper from '@/components/layout/auth-wrapper'; // Import the new AuthWrapper

// Configure Oxanium font
const oxanium = Oxanium({
  variable: '--font-oxanium',
  subsets: ['latin'],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
          <title>The Golden Game</title>
          <meta name="description" content="Simple personal finance management" />
      </head>
      <body
      className={cn(
          `${oxanium.variable} font-sans antialiased`,
          'min-h-screen flex flex-col'
        )}
      >
        <AuthWrapper>{children}</AuthWrapper>
        <Toaster />
      </body>
    </html>
  );
}

