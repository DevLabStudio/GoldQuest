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
              <span className="text-lg font-semibold text-primary">The Golden Game</span>
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
