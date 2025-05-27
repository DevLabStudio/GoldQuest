
'use client';

import type { ReactNode } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import LoginPage from '@/app/login/page';
import {
    SidebarProvider,
    Sidebar,
    SidebarHeader,
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
import { Landmark, Wallet, ArrowLeftRight, Settings, ChevronDown, TrendingUp, TrendingDown, LayoutList, Users, LogOut, Network, PieChart, Database, SlidersHorizontal, FileText, ArchiveIcon, MapIcon, Bitcoin as BitcoinIcon } from 'lucide-react'; // Added BitcoinIcon
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DateRangeProvider } from '@/contexts/DateRangeContext';
import GlobalHeader from './GlobalHeader';
import { Button } from '@/components/ui/button';

const LogoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mr-2 text-primary"
  >
    <path d="M75 25 L50 10 L25 25 L25 75 L50 90 L75 75 L75 50 L50 50" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="75" cy="25" r="5" fill="hsl(var(--primary))"/>
    <circle cx="50" cy="10" r="5" fill="hsl(var(--primary))"/>
    <circle cx="25" cy="25" r="5" fill="hsl(var(--primary))"/>
    <circle cx="25" cy="75" r="5" fill="hsl(var(--primary))"/>
    <circle cx="50" cy="90" r="5" fill="hsl(var(--primary))"/>
    <circle cx="75" cy="75" r="5" fill="hsl(var(--primary))"/>
    <circle cx="75" cy="50" r="5" fill="hsl(var(--primary))"/>
    <circle cx="50" cy="50" r="5" fill="hsl(var(--primary))"/>
  </svg>
);


interface AuthWrapperProps {
  children: ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, user, signOut, isLoadingAuth, isFirebaseActive, theme, userPreferences, firebaseError } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isFinancialControlOpen, setIsFinancialControlOpen] = useState(false);
  const [isInvestmentsOpen, setIsInvestmentsOpen] = useState(false); // New state for Investments dropdown
  const [isClient, setIsClient] = useState(false);
  const [loadingDivClassName, setLoadingDivClassName] = useState("flex items-center justify-center min-h-screen");


  useEffect(() => {
    setIsClient(true);
    setLoadingDivClassName("flex items-center justify-center min-h-screen bg-background text-foreground");
  }, []);

  useEffect(() => {
      const applyTheme = () => {
          if (!isClient) return;
          const root = document.documentElement;
          let currentTheme = theme;

          if (currentTheme === 'system') {
              const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              currentTheme = systemPrefersDark ? 'dark' : 'light';
          }

          root.classList.remove('dark', 'light', 'goldquest-theme');
          root.classList.add(currentTheme); // Adds 'light', 'dark', or 'goldquest-theme'
          root.style.colorScheme = (currentTheme === 'goldquest-theme' || currentTheme === 'dark') ? 'dark' : 'light';
      };

      applyTheme();

      if (theme === 'system' && typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = () => applyTheme();
          mediaQuery.addEventListener('change', handleChange);
          return () => mediaQuery.removeEventListener('change', handleChange);
      }
  }, [theme, isClient]);


  useEffect(() => {
    if (isClient) {
        setIsTransactionsOpen(pathname.startsWith('/transactions') || pathname.startsWith('/revenue') || pathname.startsWith('/expenses') || pathname.startsWith('/transfers'));
        setIsFinancialControlOpen(pathname.startsWith('/financial-control'));
        setIsInvestmentsOpen(pathname.startsWith('/investments/')); // Expand if any investment sub-page is active
    }
  }, [pathname, isClient]);


  useEffect(() => {
    if (!isClient || isLoadingAuth || !isFirebaseActive || !user) {
      return;
    }

    const firstLoginFlagKey = `hasLoggedInBefore-${user.uid}`;

    if(typeof window !== 'undefined') {
        const hasLoggedInBefore = localStorage.getItem(firstLoginFlagKey);
        const preferencesLoadedAndThemeSet = userPreferences && userPreferences.theme;

        if (!hasLoggedInBefore && !preferencesLoadedAndThemeSet && pathname !== '/preferences' && pathname !== '/welcome') {
          localStorage.setItem(firstLoginFlagKey, 'true');
          router.push('/preferences');
        }
    }

  }, [user, isLoadingAuth, router, pathname, isClient, isFirebaseActive, userPreferences]);


  const isActive = (path: string) => isClient && pathname === path;
  const isAnyTransactionRouteActive = isClient && (pathname.startsWith('/transactions') || pathname.startsWith('/revenue') || pathname.startsWith('/expenses') || pathname.startsWith('/transfers'));
  const isAnyFinancialControlRouteActive = isClient && pathname === '/financial-control';
  const isAnyInvestmentsRouteActive = isClient && pathname.startsWith('/investments/'); // For main group
  const isOrganizationActive = isClient && (pathname === '/organization' || pathname.startsWith('/categories/') || pathname.startsWith('/tags/') || pathname.startsWith('/groups/'));
  const isAccountsActive = isClient && (pathname === '/accounts' || pathname.startsWith('/accounts/'));
  const isDataManagementActive = isClient && pathname === '/data-management';


  if (!isClient || isLoadingAuth) {
    return (
      <div className={loadingDivClassName}>Loading authentication...</div>
    );
  }

  if (firebaseError && !isFirebaseActive) {
     if (pathname !== '/login' && pathname !== '/signup' && pathname !== '/welcome') {
         router.push('/login');
         return <div className={loadingDivClassName}>Firebase not available. Redirecting...</div>;
     }
  }


  if (!isAuthenticated && isFirebaseActive) {
    if (pathname !== '/signup' && pathname !== '/login' && pathname !== '/welcome') {
        return <LoginPage />;
    }
    return <>{children}</>;
  }

  if(!isFirebaseActive && pathname !== '/login' && pathname !== '/signup' && pathname !== '/welcome') {
    router.push('/login');
    return <div className={loadingDivClassName}>Redirecting to login...</div>;
  }

  if (isAuthenticated || (!isFirebaseActive && (pathname === '/login' || pathname === '/signup' || pathname === '/welcome'))) {
     if (!isAuthenticated && (pathname !== '/login' && pathname !== '/signup' && pathname !== '/welcome')) {
         return <LoginPage />;
     }
      if (pathname === '/login' || pathname === '/signup' || pathname === '/welcome') {
        return <>{children}</>;
      }

    return (
        <DateRangeProvider>
        <SidebarProvider>
            <Sidebar side="left" variant="inset" collapsible="icon">
            <SidebarHeader className="items-center justify-between">
                <div className="flex items-center">
                <LogoIcon />
                <span className="text-lg font-semibold text-primary">GoldQuest</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                <SidebarGroup>
                    <SidebarMenuItem>
                        <Link href="/" passHref>
                        <SidebarMenuButton tooltip="Dashboard Overview" isActive={isActive('/')}>
                            <PieChart />
                            <span>Dashboard</span>
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarMenuItem>
                        <Link href="/financial-control" passHref>
                            <SidebarMenuButton tooltip="Financial Control" isActive={isAnyFinancialControlRouteActive}>
                                <SlidersHorizontal />
                                <span>Financial Control</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                 </SidebarGroup>
                 <SidebarGroup>
                     <SidebarMenuItem>
                        <Link href="/accounts" passHref>
                        <SidebarMenuButton tooltip="Manage Accounts" isActive={isAccountsActive}>
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
                            <FileText />
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
                    </SidebarGroup>
                    <SidebarGroup>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip="Investments"
                                onClick={() => setIsInvestmentsOpen(!isInvestmentsOpen)}
                                className="justify-between"
                                isActive={isAnyInvestmentsRouteActive}
                            >
                                <div className="flex items-center gap-2">
                                <Wallet />
                                <span>Investments</span>
                                </div>
                                <ChevronDown
                                    className={cn(
                                        "h-4 w-4 transition-transform duration-200",
                                        isInvestmentsOpen && "rotate-180"
                                    )}
                                />
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        {isInvestmentsOpen && (
                            <>
                                <SidebarMenuItem className="ml-4">
                                <Link href="/investments/traditional" passHref>
                                    <SidebarMenuButton tooltip="Traditional Finances" size="sm" isActive={isActive('/investments/traditional')}>
                                        <Landmark />
                                        <span>Traditional</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem className="ml-4">
                                <Link href="/investments/defi" passHref>
                                    <SidebarMenuButton tooltip="Decentralized Finances" size="sm" isActive={isActive('/investments/defi')}>
                                        <BitcoinIcon />
                                        <span>DeFi</span>
                                    </SidebarMenuButton>
                                </Link>
                             </SidebarMenuItem>
                            </>
                        )}
                    </SidebarGroup>
                <SidebarGroup>
                     <SidebarMenuItem>
                        <Link href="/organization" passHref>
                            <SidebarMenuButton tooltip="Manage Organization" isActive={isOrganizationActive}>
                                <Network />
                                <span>Organization</span>
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
                        <Link href="/data-management" passHref>
                        <SidebarMenuButton tooltip="Data Management" isActive={isDataManagementActive}>
                            <Database />
                            <span>Data Management</span>
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarGroup>
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-2 border-t border-sidebar-border">
                <div className="flex items-center gap-3 p-2">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.photoURL || "https://placehold.co/40x40.png"} alt={user?.displayName || user?.email || "User"} data-ai-hint="user avatar" />
                    <AvatarFallback>{user?.email ? user.email.substring(0, 2).toUpperCase() : 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-sidebar-foreground">{user?.displayName || user?.email || "User"}</span>
                    <Button variant="link" size="sm" onClick={signOut} className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">
                        <LogOut className="mr-1.5 h-3 w-3" />
                        Logout
                    </Button>
                </div>
                </div>
            </SidebarFooter>
            </Sidebar>
            <SidebarInset className="flex flex-col flex-1">
                <GlobalHeader />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
        </DateRangeProvider>
    );
  }

  // Fallback for unauthenticated users on public routes (already handled), or if Firebase isn't active on those routes.
  // For other unhandled cases, this simple layout is a fallback.
  return (
      <html lang="en" className={cn(oxanium.variable, theme === 'dark' ? 'dark' : theme === 'goldquest-theme' ? 'goldquest-theme' : '')} suppressHydrationWarning>
          <head>
              <meta charSet="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>GoldQuest</title>
              <meta name="description" content="Embark on your GoldQuest to master personal finances, track investments, and achieve your financial goals." />
          </head>
          <body
          className={cn(
              'font-sans antialiased',
              'min-h-screen flex flex-col'
            )}
            suppressHydrationWarning
          >
             {/* Only render children if it's a public route that doesn't need AuthWrapper's full layout */}
            {(pathname === '/login' || pathname === '/signup' || pathname === '/welcome') && children}
            
            {/* Fallback for when firebase isn't active and user tries to access a non-public route (should ideally be caught by earlier redirect) */}
            {!isFirebaseActive && !(pathname === '/login' || pathname === '/signup' || pathname === '/welcome') && (
                 <div className="flex items-center justify-center min-h-screen">
                    <p>Service temporarily unavailable. Please try again later.</p>
                </div>
            )}
          </body>
    </html>
  );
}
