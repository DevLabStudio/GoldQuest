
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update } from 'firebase/database';
import type { User } from 'firebase/auth';
import { getTransactions, addTransaction as addTransactionService } from '@/services/transactions'; // Import getTransactions and addTransactionService

/**
 * Represents a financial account with multi-currency balances.
 */
export interface Account {
  id: string;
  name: string;
  type: string; // 'checking', 'savings', 'credit card', 'investment', 'other', 'exchange', 'wallet', 'staking'
  balances: Array<{ currency: string; amount: number }>;
  primaryCurrency: string | null;
  providerName?: string;
  providerDisplayIconUrl?: string | null; // URL for fetched logo (e.g., from CoinGecko for exchanges)
  isActive?: boolean;
  lastActivity?: string;
  category: 'asset' | 'crypto';
  includeInNetWorth?: boolean;
}

// For adding a new account, we'll specify an initial currency and balance.
export type NewAccountData = Omit<Account, 'id' | 'balances' | 'primaryCurrency'> & {
  initialCurrency: string;
  initialBalance: number;
  primaryCurrency?: string; // Optional on creation, will default to initialCurrency
  providerDisplayIconUrl?: string;
};

function getAccountsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access accounts.");
  return `users/${currentUser.uid}/accounts`;
}

function getSingleAccountRefPath(currentUser: User | null, accountId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access account.");
  return `users/${currentUser.uid}/accounts/${accountId}`;
}

function getDefaultAccountValues(category: 'asset' | 'crypto'): Partial<Omit<Account, 'id' | 'name' | 'type' | 'balances' | 'primaryCurrency' | 'providerDisplayIconUrl'>> {
    return {
        isActive: true,
        lastActivity: new Date().toISOString(),
        category: category,
        includeInNetWorth: true,
    };
}

export async function getAccounts(): Promise<Account[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getAccounts called without authenticated user, returning empty array.");
    return [];
  }
  const accountsRefPath = getAccountsRefPath(currentUser);
  const accountsRef = ref(database, accountsRefPath);

  try {
    const snapshot = await get(accountsRef);
    if (snapshot.exists()) {
      const accountsData = snapshot.val();
      return Object.entries(accountsData).map(([id, data]) => {
        const rawData = data as any;
        let balances: Array<{ currency: string; amount: number }> = [];
        let primaryCurrency: string | null = null;

        if (Array.isArray(rawData.balances) && rawData.balances.length > 0) {
          const consolidatedBalancesMap = rawData.balances.reduce((acc: Record<string, number>, b: any) => {
            const currency = String(b.currency || 'USD').toUpperCase();
            const amount = parseFloat(String(b.amount)) || 0;
            acc[currency] = parseFloat(((acc[currency] || 0) + amount).toFixed(2));
            return acc;
          }, {} as Record<string, number>);
          balances = Object.entries(consolidatedBalancesMap).map(([curr, amt]) => ({ currency: curr, amount: amt }));
          
          primaryCurrency = rawData.primaryCurrency && balances.some(b => b.currency === rawData.primaryCurrency.toUpperCase())
            ? rawData.primaryCurrency.toUpperCase()
            : (balances[0]?.currency || 'USD').toUpperCase();

        } else if (rawData.balance !== undefined && rawData.currency !== undefined) { // Legacy single balance support
          const singleCurrency = String(rawData.currency).toUpperCase();
          balances = [{ currency: singleCurrency, amount: parseFloat(String(rawData.balance)) || 0 }];
          primaryCurrency = singleCurrency;
        } else { // Default if no balance info
          balances = [{ currency: 'USD', amount: 0 }]; 
          primaryCurrency = 'USD';
        }
        
        if (!primaryCurrency && balances.length > 0) {
            primaryCurrency = balances[0].currency;
        } else if (!primaryCurrency && balances.length === 0) { // Ensure there's always a balance entry and primary currency
            balances = [{ currency: 'USD', amount: 0 }];
            primaryCurrency = 'USD';
        }


        return {
          id,
          name: rawData.name || 'Unnamed Account',
          type: rawData.type || (rawData.category === 'crypto' ? 'wallet' : 'checking'),
          providerName: rawData.providerName,
          providerDisplayIconUrl: rawData.providerDisplayIconUrl || null,
          category: rawData.category || 'asset',
          ...getDefaultAccountValues(rawData.category || 'asset'),
          balances,
          primaryCurrency,
          includeInNetWorth: rawData.includeInNetWorth === undefined ? true : rawData.includeInNetWorth,
        };
      });
    }
    return [];
  } catch (error: any) {
    if (error.message?.toLowerCase().includes("permission_denied")) {
        console.error(`Firebase Permission Denied: Could not fetch accounts from ${accountsRefPath}. Please check your Firebase Realtime Database security rules to ensure authenticated users have read access to their data under 'users/\${uid}/accounts'. Example rule: { "rules": { "users": { "$uid": { ".read": "$uid === auth.uid", ".write": "$uid === auth.uid" } } } }`);
        throw new Error(`Permission Denied: Cannot read accounts. Please verify Firebase security rules.`);
    }
    console.error("Error fetching accounts from Firebase:", error);
    throw error;
  }
}

export async function addAccount(accountData: NewAccountData): Promise<Account> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add account.");
  }
  const accountsRefPath = getAccountsRefPath(currentUser);
  const accountsRef = ref(database, accountsRefPath);
  const newAccountRef = push(accountsRef);

  if (!newAccountRef.key) {
    throw new Error("Failed to generate a new account ID.");
  }

  const initialCurrencyUpper = accountData.initialCurrency.toUpperCase();
  const newAccountFull: Omit<Account, 'id'> = {
    name: accountData.name,
    type: accountData.type,
    providerName: accountData.providerName,
    providerDisplayIconUrl: accountData.providerDisplayIconUrl || null,
    ...getDefaultAccountValues(accountData.category),
    category: accountData.category,
    balances: [{ currency: initialCurrencyUpper, amount: accountData.initialBalance }],
    primaryCurrency: (accountData.primaryCurrency ? accountData.primaryCurrency.toUpperCase() : initialCurrencyUpper),
    includeInNetWorth: accountData.includeInNetWorth === undefined ? true : accountData.includeInNetWorth,
  };

  try {
    await set(newAccountRef, newAccountFull);
    const createdAccount = { id: newAccountRef.key, ...newAccountFull };

    // Add an "Opening Balance" transaction for the new account
    if (accountData.initialBalance !== 0) {
        await addTransactionService({
            accountId: createdAccount.id,
            amount: accountData.initialBalance,
            transactionCurrency: initialCurrencyUpper,
            date: new Date().toISOString().split('T')[0], // Today's date
            description: "Opening Balance",
            category: "Opening Balance",
            tags: [],
        }, { skipBalanceModification: true }); // Skip balance modification here as it's already set
    }

    return createdAccount;
  } catch (error) {
    console.error("Error adding account to Firebase:", error);
    throw error;
  }
}

export async function updateAccount(updatedAccountData: Account): Promise<Account> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot update account.");
  }
  if (!updatedAccountData.id) throw new Error("Account ID is required for update.");
  const accountRefPath = getSingleAccountRefPath(currentUser, updatedAccountData.id);
  const accountRef = ref(database, accountRefPath);

  const dataToSet: Omit<Account, 'id'> = {
    name: updatedAccountData.name,
    type: updatedAccountData.type,
    providerName: updatedAccountData.providerName,
    providerDisplayIconUrl: updatedAccountData.providerDisplayIconUrl || null, 
    isActive: updatedAccountData.isActive,
    lastActivity: updatedAccountData.lastActivity || new Date().toISOString(),
    category: updatedAccountData.category,
    balances: updatedAccountData.balances.map(b => ({...b, currency: b.currency.toUpperCase()})),
    primaryCurrency: updatedAccountData.primaryCurrency ? updatedAccountData.primaryCurrency.toUpperCase() : (updatedAccountData.balances[0]?.currency.toUpperCase() || 'USD'),
    includeInNetWorth: updatedAccountData.includeInNetWorth,
  };

  try {
    await set(accountRef, dataToSet);
    return { id: updatedAccountData.id, ...dataToSet };
  } catch (error) {
    console.error("Error updating account in Firebase:", error);
    throw error;
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete account.");
  }
  const accountRefPath = getSingleAccountRefPath(currentUser, accountId);
  const accountRef = ref(database, accountRefPath);

  try {
    await remove(accountRef);
    const transactionsBasePath = `users/${currentUser.uid}/transactions/${accountId}`;
    const transactionsForAccountRef = ref(database, transactionsBasePath);
    await remove(transactionsForAccountRef);
    console.log(`Also deleted transactions for account ${accountId} at ${transactionsBasePath}`);
  } catch (error) {
    console.error("Error deleting account from Firebase:", error);
    throw error;
  }
}

export async function recalculateAllAccountBalances(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot recalculate balances.");
  }

  const allAppAccounts = await getAccounts(); 

  for (const account of allAppAccounts) {
    const accountTransactions = await getTransactions(account.id); 

    const newBalancesMap = new Map<string, number>();

    // First pass: Establish initial balances from "Opening Balance" transactions
    for (const tx of accountTransactions) {
      if (tx.category?.toLowerCase() === 'opening balance') {
        const currency = tx.transactionCurrency.toUpperCase();
        // If multiple opening balances for the same currency, sum them (though ideally there's one per currency)
        newBalancesMap.set(currency, (newBalancesMap.get(currency) || 0) + tx.amount);
      }
    }
    
    // If no "Opening Balance" transaction was found for the account's primary currency,
    // AND the account was just created (e.g., has no other transactions yet),
    // its `account.balances` array might contain the initial balance set during creation.
    // This is a fallback if the explicit "Opening Balance" transaction wasn't created/found.
    // However, with the fix in `addAccount` to create an "Opening Balance" tx, this might be less needed.
    // For robustness, check if `newBalancesMap` is empty. If so, the account's current `balances`
    // are likely the "initial" ones set without a formal Opening Balance transaction, so use them.
    if (newBalancesMap.size === 0 && account.balances.length > 0) {
        account.balances.forEach(balanceEntry => {
            newBalancesMap.set(balanceEntry.currency.toUpperCase(), balanceEntry.amount);
        });
        console.warn(`Account ${account.name} (${account.id}) had no 'Opening Balance' transactions. Using existing account.balances as starting point.`);
    }


    // Second pass: Apply all other transactions
    for (const tx of accountTransactions) {
      if (tx.category?.toLowerCase() !== 'opening balance') {
        const currency = tx.transactionCurrency.toUpperCase();
        const currentBalanceForCurrency = newBalancesMap.get(currency) || 0;
        newBalancesMap.set(currency, parseFloat((currentBalanceForCurrency + tx.amount).toFixed(2)));
      }
    }

    const newBalancesArray: Array<{ currency: string; amount: number }> = [];
    newBalancesMap.forEach((amount, currency) => {
      newBalancesArray.push({ currency, amount });
    });
    
    let newPrimaryCurrency = account.primaryCurrency;
    if (newBalancesArray.length > 0) {
      if (!newPrimaryCurrency || !newBalancesArray.some(b => b.currency === newPrimaryCurrency)) {
        newPrimaryCurrency = newBalancesArray.sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount))[0].currency;
      }
    } else {
      // If still no balances (e.g. no opening balance and no other transactions), default it.
      newPrimaryCurrency = account.primaryCurrency || 'USD'; 
      newBalancesArray.push({ currency: newPrimaryCurrency, amount: 0 });
    }

    const updatedAccountData: Account = {
      ...account,
      balances: newBalancesArray.length > 0 ? newBalancesArray : [{currency: newPrimaryCurrency || 'USD', amount: 0}],
      primaryCurrency: newPrimaryCurrency,
      lastActivity: new Date().toISOString(), 
    };
    
    await updateAccount(updatedAccountData);
    console.log(`Recalculated balances for account ${account.name} (${account.id})`);
  }
}
