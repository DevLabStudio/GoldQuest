
'use client'; // Required for using state and hooks

import { useState, useEffect } from 'react'; // Import useEffect
import { Oxanium } from 'next/font/google';
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
import { PiggyBank, Landmark, Wallet, ArrowLeftRight, Settings, ListTree, ChevronDown, TrendingUp, TrendingDown, LayoutList, Upload, Tag, Users, LogOut } from 'lucide-react'; // Added LogOut
import Link from 'next/link';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth'; // Import the auth hook
import LoginPage from '@/app/login/page'; // Import the Login page component
import { Button } from '@/components/ui/button'; // Import Button for logout

// Configure Oxanium font
const oxanium = Oxanium({
  variable: '--font-oxanium',
  subsets: ['latin'],
});

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
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth(); // Use the auth hook
  const [isClient, setIsClient] = useState(false); // State to track client-side rendering

   useEffect(() => {
     // This effect runs only on the client after the initial render
     setIsClient(true);
   }, []);

  // Avoid rendering mismatch during hydration: show loading or default state on server/initial client render
   if (!isClient) {
     // You could return a loading spinner or null here
     return (
        <html lang="en" className="dark">
            <head>
                <title>The Golden Game</title>
                <meta name="description" content="Simple personal finance management" />
            </head>
            <body className={cn(`${oxanium.variable} font-sans antialiased`, 'min-h-screen flex flex-col')}>
                {/* Optional: Loading component */}
                <div className="flex items-center justify-center min-h-screen">Loading...</div>
            </body>
        </html>
     );
   }

  // If not authenticated on the client, render the login page
  if (!isAuthenticated) {
    return (
      <html lang="en" className="dark">
        <head>
            <title>Login - The Golden Game</title>
            <meta name="description" content="Login to The Golden Game" />
        </head>
        <body className={cn(`${oxanium.variable} font-sans antialiased`, 'min-h-screen flex flex-col')}>
          <LoginPage />
          <Toaster />
        </body>
      </html>
    );
  }

  // If authenticated, render the main application layout
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
        <SidebarProvider>
          <Sidebar side="left" variant="inset" collapsible="icon">
            <SidebarHeader className="items-center justify-between">
              <div className="flex items-center">
                 <LogoIcon />
                 <span className="text-lg font-semibold text-primary">The Golden Game</span>
              </div>
              <SidebarTrigger className="md:hidden" />
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {/* Existing Menu Items */}
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

                    {/* Transactions Group (Collapsible) */}
                    <SidebarMenuItem>
                         <SidebarMenuButton
                            tooltip="Transactions"
                            onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
                            className="justify-between"
                         >
                           <div className="flex items-center gap-2">
                             <ArrowLeftRight />
                             <span>Transactions</span>
                           </div>
                           <ChevronDown
                              className={cn(
                                 "h-4 w-4 transition-transform duration-200",
                                 isTransactionsOpen && "rotate-180"
                              )}
                           />
                         </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Conditionally Rendered Transaction Sub-Items */}
                    {isTransactionsOpen && (
                        <>
                          <SidebarMenuItem className="ml-4">
                             <Link href="/transactions" passHref>
                                 <SidebarMenuButton tooltip="Transactions Overview" size="sm">
                                     <LayoutList />
                                     <span>Overview</span>
                                 </SidebarMenuButton>
                             </Link>
                         </SidebarMenuItem>
                         <SidebarMenuItem className="ml-4">
                             <Link href="/revenue" passHref>
                                 <SidebarMenuButton tooltip="View Revenue/Income" size="sm">
                                     <TrendingUp />
                                     <span>Revenue/Income</span>
                                 </SidebarMenuButton>
                             </Link>
                         </SidebarMenuItem>
                         <SidebarMenuItem className="ml-4">
                             <Link href="/expenses" passHref>
                                 <SidebarMenuButton tooltip="View Expenses" size="sm">
                                     <TrendingDown />
                                     <span>Expenses</span>
                                 </SidebarMenuButton>
                             </Link>
                         </SidebarMenuItem>
                          <SidebarMenuItem className="ml-4">
                             <Link href="/transfers" passHref>
                                 <SidebarMenuButton tooltip="View Transfers" size="sm">
                                     <ArrowLeftRight />
                                     <span>Transfers</span>
                                 </SidebarMenuButton>
                             </Link>
                         </SidebarMenuItem>
                         </>
                    )}

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
                    <SidebarGroupLabel>Organization</SidebarGroupLabel>
                    <SidebarMenuItem>
                        <Link href="/categories" passHref>
                            <SidebarMenuButton tooltip="Manage Categories">
                                <ListTree />
                                <span>Categories</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/tags" passHref>
                            <SidebarMenuButton tooltip="Manage Tags">
                                <Tag />
                                <span>Tags</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <Link href="/groups" passHref>
                            <SidebarMenuButton tooltip="Manage Groups">
                                <Users />
                                <span>Groups</span>
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
                    <SidebarMenuItem>
                      <Link href="/import" passHref>
                        <SidebarMenuButton tooltip="Import Data">
                          <Upload />
                          <span>Import Data</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                </SidebarGroup>
                 {/* --- Logout Button --- */}
                 <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Logout" onClick={logout}>
                       <LogOut />
                       <span>Logout</span>
                    </SidebarMenuButton>
                 </SidebarMenuItem>
                 {/* -------------------- */}
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
