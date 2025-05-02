import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
import { PiggyBank, Landmark, Wallet, ArrowLeftRight } from 'lucide-react'; // Added Wallet
import Link from 'next/link';
import { Toaster } from '@/components/ui/toaster';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FinancioSimples',
  description: 'Simple personal finance management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable} antialiased`,
          'min-h-screen flex flex-col'
        )}
      >
        <SidebarProvider>
          <Sidebar side="left" variant="inset" collapsible="icon">
            <SidebarHeader className="items-center justify-between">
              <span className="text-lg font-semibold text-primary">FinancioSimples</span>
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
