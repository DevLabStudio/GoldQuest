/**
 * Represents a financial transaction.
 */
export interface Transaction {
  /**
   * The ID of the transaction.
   */
  id: string;
  /**
   * The date of the transaction.
   */
  date: string;
  /**
   * The amount of the transaction.
   */
  amount: number;
  /**
   * The description of the transaction.
   */
  description: string;
  /**
   * The category of the transaction (e.g., groceries, rent, utilities).
   */
  category: string;
  /**
   * The account ID that the transaction belongs to.
   */
  accountId: string;
}

/**
 * Asynchronously retrieves a list of financial transactions for a given account.
 *
 * @param accountId The ID of the account for which to retrieve transactions.
 * @returns A promise that resolves to an array of Transaction objects.
 */
export async function getTransactions(accountId: string): Promise<Transaction[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      id: '1',
      date: '2024-01-01',
      amount: 50,
      description: 'Groceries',
      category: 'groceries',
      accountId: accountId,
    },
    {
      id: '2',
      date: '2024-01-02',
      amount: 1000,
      description: 'Rent',
      category: 'rent',
      accountId: accountId,
    },
  ];
}
