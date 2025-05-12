
'use client';

import type { ReactNode } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
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
import { Landmark, Wallet, ArrowLeftRight, Settings, ChevronDown, TrendingUp, TrendingDown, LayoutList, Upload, Users, LogOut, Network, PieChart, CalendarClock, Archive as ArchiveIcon, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DateRangeProvider } from '@/contexts/DateRangeContext';
import GlobalHeader from './GlobalHeader';
import { Button } from '@/components/ui/button';

// New GoldQuest Logo
const LogoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mr-2 text-primary"
  >
    {/* Thin grid lines */}
    <path d="M25 43.3013L50 28.8675L75 43.3013" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M25 56.6987L50 71.1325L75 56.6987" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M50 28.8675L50 71.1325" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M25 43.3013L25 56.6987" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M75 43.3013L75 56.6987" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M25 43.3013L50 56.6987L75 43.3013" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <path d="M25 56.6987L50 43.3013L75 56.6987" stroke="currentColor" strokeWidth="1" opacity="0.5"/>

    {/* Thick "G" shape lines */}
    <path d="M75 25 L50 10 L25 25 L25 75 L50 90 L75 75 L75 50 L50 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>

    {/* Circles at vertices */}
    <circle cx="75" cy="25" r="5" fill="currentColor"/>
    <circle cx="50" cy="10" r="5" fill="currentColor"/>
    <circle cx="25" cy="25" r="5" fill="currentColor"/>
    <circle cx="25" cy="75" r="5" fill="currentColor"/>
    <circle cx="50" cy="90" r="5" fill="currentColor"/>
    <circle cx="75" cy="75" r="5" fill="currentColor"/>
    <circle cx="75" cy="50" r="5" fill="currentColor"/> {/* Added this circle */}
    <circle cx="50" cy="50" r="5" fill="currentColor"/>
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
  const [isClient, setIsClient] = useState(false);
  const [loadingDivClassName, setLoadingDivClassName] = useState("flex items-center justify-center min-h-screen");


  useEffect(() => {
    setIsClient(true);
    // Set class name after mount to ensure styles are applied correctly
    setLoadingDivClassName("flex items-center justify-center min-h-screen bg-background text-foreground");
  }, []);
  
  useEffect(() => {
      const applyTheme = () => {
          if (!isClient) return; // Only run on client
          const root = document.documentElement;
          let currentTheme = theme;

          if (currentTheme === 'system') {
              const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              currentTheme = systemPrefersDark ? 'dark' : 'light';
          }

          root.classList.remove('dark', 'light');
          root.classList.add(currentTheme);
          root.style.colorScheme = currentTheme; // Important for native elements
      };

      applyTheme(); 

      // Listen for system theme changes if 'system' is selected
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
    }
  }, [pathname, isClient]);


  useEffect(() => {
    if (!isClient || isLoadingAuth || !isFirebaseActive || !user) {
      return;
    }

    const firstLoginFlagKey = `hasLoggedInBefore-${user.uid}`;
    
    if(typeof window !== 'undefined') {
        const hasLoggedInBefore = localStorage.getItem(firstLoginFlagKey);
        // Check if preferences are loaded and specifically if the theme is set.
        // This implies preferences have been fetched at least once.
        const preferencesLoadedAndThemeSet = userPreferences && userPreferences.theme;

        if (!hasLoggedInBefore && !preferencesLoadedAndThemeSet && pathname !== '/preferences') {
          localStorage.setItem(firstLoginFlagKey, 'true');
          router.push('/preferences');
        }
    }

  }, [user, isLoadingAuth, router, pathname, isClient, isFirebaseActive, userPreferences]);



  const isActive = (path: string) => isClient && pathname === path;
  const isAnyTransactionRouteActive = isClient && (pathname.startsWith('/transactions') || pathname.startsWith('/revenue') || pathname.startsWith('/expenses') || pathname.startsWith('/transfers'));
  const isAnyFinancialControlRouteActive = isClient && pathname === '/financial-control';
  const isOrganizationActive = isClient && (pathname === '/organization' || pathname.startsWith('/categories/') || pathname.startsWith('/tags/') || pathname.startsWith('/groups/'));
  const isAccountsActive = isClient && (pathname === '/accounts' || pathname.startsWith('/accounts/'));


  if (!isClient || isLoadingAuth) {
    return (
      <div className={loadingDivClassName}>Loading authentication...</div>
    );
  }
  
  if (firebaseError && !isFirebaseActive) {
     if (pathname !== '/login' && pathname !== '/signup') {
         router.push('/login'); // Redirect to login if firebase is critically broken and not on auth pages
         return <div className={loadingDivClassName}>Firebase not available. Redirecting...</div>;
     }
     // Allow login/signup pages to render with the firebase error message handled within them
  }


  if (!isAuthenticated && isFirebaseActive) {
    if (pathname !== '/signup' && pathname !== '/login') {
        return <LoginPage />;
    }
    return <>{children}</>;
  }

  if(!isFirebaseActive && pathname !== '/login' && pathname !== '/signup') {
    router.push('/login');
    return <div className={loadingDivClassName}>Redirecting to login...</div>;
  }

  if (isAuthenticated || (!isFirebaseActive && (pathname === '/login' || pathname === '/signup'))) {
     // If firebase is inactive but we are on login/signup, allow those pages to render
     if (!isAuthenticated && (pathname !== '/login' && pathname !== '/signup')) {
         return <LoginPage />;
     }
      if (pathname === '/login' || pathname === '/signup') {
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
                <SidebarTrigger className="md:hidden" />
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
                    </SidebarGroup>
                    <SidebarGroup>
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
                    <AvatarImage src={user?.photoURL || "https://picsum.photos/seed/useravatar/40/40"} alt={user?.displayName || user?.email || "User"} data-ai-hint="user avatar" />
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

  // Fallback for any unhandled state, though ideally one of the above conditions should always be met.
  return <div className={loadingDivClassName}>Preparing application...</div>;
}


