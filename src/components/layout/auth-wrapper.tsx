
'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/app/login/page';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PiggyBank, Landmark, Wallet, ArrowLeftRight, Settings, ListTree, ChevronDown, TrendingUp, TrendingDown, LayoutList, Upload, Tag, Users, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// SVG Logo Component (moved from layout.tsx)
const LogoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mr-2 text-primary"
  >
    <path d="M50 10 L75 25 L75 75 L50 90 L25 75 L25 25 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M25 25 L75 75 M75 25 L25 75 M50 10 L50 90 M25 50 L75 50" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M25 25 L50 50 L75 25 L50 10 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M25 25 L25 75 L50 90 L75 75 L75 25 M50 50 L25 75 M50 50 L75 75" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M75 25 A 30 30 0 0 0 25 25 L 25 75 L 50 90 L 75 75 V 50 H 50 V 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="50" cy="10" r="5" fill="currentColor"/>
    <circle cx="75" cy="25" r="5" fill="currentColor"/>
    <circle cx="75" cy="75" r="5" fill="currentColor"/>
    <circle cx="50" cy="90" r="5" fill="currentColor"/>
    <circle cx="25" cy="75" r="5" fill="currentColor"/>
    <circle cx="25" cy="25" r="5" fill="currentColor"/>
    <circle cx="50" cy="50" r="5" fill="currentColor"/>
  </svg>
);


interface AuthWrapperProps {
  children: ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, user, logout, isLoadingAuth } = useAuth();
  const pathname = usePathname();
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Ensures this runs only on client after mount
  }, []);

  useEffect(() => {
    if (isClient) { // Only run this logic on the client after mount
        setIsTransactionsOpen(pathname.startsWith('/transactions') || pathname.startsWith('/revenue') || pathname.startsWith('/expenses') || pathname.startsWith('/transfers'));
    }
  }, [pathname, isClient]);

  const isActive = (path: string) => isClient && pathname === path;
  const isAnyTransactionRouteActive = isClient && (pathname.startsWith('/transactions') || pathname.startsWith('/revenue') || pathname.startsWith('/expenses') || pathname.startsWith('/transfers'));

  if (!isClient || isLoadingAuth) {
    return <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
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
             <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
                <SidebarMenuItem>
                  <Link href="/" passHref>
                    <SidebarMenuButton tooltip="Dashboard Overview" isActive={isActive('/')}>
                      <PiggyBank />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/accounts" passHref>
                    <SidebarMenuButton tooltip="Manage Accounts" isActive={isActive('/accounts')}>
                      <Landmark />
                      <span>Accounts</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                     <SidebarMenuButton
                        tooltip="Transactions"
                        onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
                        className="justify-between"
                        isActive={isAnyTransactionRouteActive}
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
                {isTransactionsOpen && (
                    <>
                      <SidebarMenuItem className="ml-4">
                         <Link href="/transactions" passHref>
                             <SidebarMenuButton tooltip="Transactions Overview" size="sm" isActive={isActive('/transactions')}>
                                 <LayoutList />
                                 <span>Overview</span>
                             </SidebarMenuButton>
                         </Link>
                     </SidebarMenuItem>
                     <SidebarMenuItem className="ml-4">
                         <Link href="/revenue" passHref>
                             <SidebarMenuButton tooltip="View Revenue/Income" size="sm" isActive={isActive('/revenue')}>
                                 <TrendingUp />
                                 <span>Revenue/Income</span>
                             </SidebarMenuButton>
                         </Link>
                     </SidebarMenuItem>
                     <SidebarMenuItem className="ml-4">
                         <Link href="/expenses" passHref>
                             <SidebarMenuButton tooltip="View Expenses" size="sm" isActive={isActive('/expenses')}>
                                 <TrendingDown />
                                 <span>Expenses</span>
                             </SidebarMenuButton>
                         </Link>
                     </SidebarMenuItem>
                      <SidebarMenuItem className="ml-4">
                         <Link href="/transfers" passHref>
                             <SidebarMenuButton tooltip="View Transfers" size="sm" isActive={isActive('/transfers')}>
                                 <ArrowLeftRight />
                                 <span>Transfers</span>
                             </SidebarMenuButton>
                         </Link>
                     </SidebarMenuItem>
                     </>
                )}
                <SidebarMenuItem>
                    <Link href="/investments" passHref>
                        <SidebarMenuButton tooltip="Manage Investments" isActive={isActive('/investments')}>
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
                        <SidebarMenuButton tooltip="Manage Categories" isActive={isActive('/categories')}>
                            <ListTree />
                            <span>Categories</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/tags" passHref>
                        <SidebarMenuButton tooltip="Manage Tags" isActive={isActive('/tags')}>
                            <Tag />
                            <span>Tags</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/groups" passHref>
                        <SidebarMenuButton tooltip="Manage Groups" isActive={isActive('/groups')}>
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
                    <SidebarMenuButton tooltip="User Preferences" isActive={isActive('/preferences')}>
                      <Settings />
                      <span>Preferences</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/import" passHref>
                    <SidebarMenuButton tooltip="Import Data" isActive={isActive('/import')}>
                      <Upload />
                      <span>Import Data</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
            </SidebarGroup>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src="https://picsum.photos/40/40" alt={user || "User"} data-ai-hint="user avatar" />
              <AvatarFallback>{user ? user.substring(0, 2).toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-sm font-medium text-sidebar-foreground">{user || "User"}</span>
                 <Button variant="link" size="sm" onClick={logout} className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">
                    Logout
                 </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex-1 overflow-y-auto">
          {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
