import type { Metadata } from 'next';
import { Oxanium } from 'next/font/google'; // Import Oxanium
import './globals.css';
import { cn } from '@/lib/utils';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { PiggyBank, Landmark, Wallet, ArrowLeftRight, Settings } from 'lucide-react'; // Added Settings icon
import Link from 'next/link';
import { Toaster } from '@/components/ui/toaster';

// Configure Oxanium font
const oxanium = Oxanium({
  variable: '--font-oxanium',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'The Golden Game',
  description: 'Simple personal finance management',
};

// SVG Logo Component
const LogoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mr-2 text-primary" // Use primary color from theme
  >
    {/* Thin grid lines */}
    <path d="M50 10 L75 25 L75 75 L50 90 L25 75 L25 25 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M25 25 L75 75 M75 25 L25 75 M50 10 L50 90 M25 50 L75 50" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M25 25 L50 50 L75 25 L50 10 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M25 25 L25 75 L50 90 L75 75 L75 25 M50 50 L25 75 M50 50 L75 75" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>

    {/* Thick 'G' Lines */}
    <path d="M75 25 A 30 30 0 0 0 25 25 L 25 75 L 50 90 L 75 75 V 50 H 50 V 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>

    {/* Circles */}
    <circle cx="50" cy="10" r="5" fill="currentColor"/>
    <circle cx="75" cy="25" r="5" fill="currentColor"/>
    <circle cx="75" cy="75" r="5" fill="currentColor"/>
    <circle cx="50" cy="90" r="5" fill="currentColor"/>
    <circle cx="25" cy="75" r="5" fill="currentColor"/>
    <circle cx="25" cy="25" r="5" fill="currentColor"/>
    <circle cx="50" cy="50" r="5" fill="currentColor"/>

  </svg>
);


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
      className={cn(
          `${oxanium.variable} font-sans antialiased`, // Apply Oxanium font variable and set as default sans font
          'min-h-screen flex flex-col'
        )}
      >
        <SidebarProvider>
          <Sidebar side="left" variant="inset" collapsible="icon">
            <SidebarHeader className="items-center justify-between">
              {/* Wrap logo and text in a flex container */}
              <div className="flex items-center">
                 <LogoIcon />
                 <span className="text-lg font-semibold text-primary">The Golden Game</span>
              </div>
              <SidebarTrigger className="md:hidden" />
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarGroup>
                  <SidebarGroupLabel>Menu</SidebarGroupLabel>
                    <SidebarMenuItem>
                      <Link href="/" passHref>
                        <SidebarMenuButton tooltip="Dashboard Overview">
                          <PiggyBank />
                          <span>Dashboard</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <Link href="/accounts" passHref>
                        <SidebarMenuButton tooltip="Manage Accounts">
                          <Landmark />
                          <span>Accounts</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <Link href="/transactions" passHref>
                        <SidebarMenuButton tooltip="View Transactions">
                          <ArrowLeftRight />
                          <span>Transactions</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    {/* TODO: Add Debits link when page is created */}
                    {/*
                    <SidebarMenuItem>
                        <Link href="/debits" passHref>
                            <SidebarMenuButton tooltip="Manage Debits">
                                <CreditCard />
                                <span>Debits</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    */}
                    <SidebarMenuItem>
                        <Link href="/investments" passHref>
                            <SidebarMenuButton tooltip="Manage Investments">
                                <Wallet />
                                <span>Investments</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarGroup>
                 <SidebarGroup>
                  <SidebarGroupLabel>Settings</SidebarGroupLabel>
                    <SidebarMenuItem>
                      <Link href="/preferences" passHref>
                        <SidebarMenuButton tooltip="User Preferences">
                          <Settings />
                          <span>Preferences</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                </SidebarGroup>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
              {/* Footer content if needed */}
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex-1 overflow-y-auto">
              {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
