
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Try to import only SiNubank as it was confirmed to work.
// Other Si* icons that caused "Export doesn't exist" errors are removed.
import { SiNubank } from 'react-icons/si';

const defaultIconSize = 20;

// Default generic bank icon
const DefaultBankIcon = () => {
  return React.createElement(Landmark, {
    size: defaultIconSize,
    className: "text-muted-foreground"
  });
};

export interface BankInfo {
  name: string;
  iconComponent: React.ReactNode;
  dataAiHint?: string;
}

// Map for specific bank icons that are verified to work.
// Add more here cautiously after verifying the exact export name and testing.
const specificBankIcons: { [key: string]: React.ReactNode } = {
  "Nubank": React.createElement(SiNubank, { size: defaultIconSize, color: "#820AD1" }),
  // Example for when SiItauunibanco is verified:
  // "Itaú Unibanco": React.createElement(SiItauunibanco, { size: defaultIconSize, color: "#EC7000" }),
};

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", dataAiHint: "Caixa Federal" },
    { name: "Bradesco", dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", dataAiHint: "Santander logo" },
    { name: "Nubank", dataAiHint: "Nubank logo" }, // Will attempt to use SiNubank
    { name: "Banco Inter", dataAiHint: "Inter logo" },
    { name: "BTG Pactual", dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", dataAiHint: "XP logo" },
    { name: "Banco Safra", dataAiHint: "Safra logo" },
    { name: "Banco Original", dataAiHint: "Original logo" },
    { name: "C6 Bank", dataAiHint: "C6 Bank" },
    { name: "PagBank", dataAiHint: "PagBank logo" },
    { name: "Banco Neon", dataAiHint: "Neon logo" },
    { name: "Banco Pan", dataAiHint: "Pan logo" },

    // Europe
    { name: "HSBC (UK/Global)", dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", dataAiHint: "Santander logo" },
    { name: "BBVA (Spain)", dataAiHint: "BBVA logo" },
    { name: "CaixaBank (Spain)", dataAiHint: "CaixaBank logo" },
    { name: "BNP Paribas (France)", dataAiHint: "BNP Paribas" },
    { name: "Crédit Agricole (France)", dataAiHint: "Credit Agricole" },
    { name: "Société Générale (France)", dataAiHint: "Societe Generale" },
    { name: "Deutsche Bank (Germany)", dataAiHint: "Deutsche Bank" },
    { name: "Commerzbank (Germany)", dataAiHint: "Commerzbank logo" },
    { name: "ING Group (Netherlands/Global)", dataAiHint: "ING logo" },
    { name: "UniCredit (Italy)", dataAiHint: "UniCredit logo" },
    { name: "Intesa Sanpaolo (Italy)", dataAiHint: "Intesa Sanpaolo" },
    { name: "UBS (Switzerland)", dataAiHint: "UBS logo" },
    { name: "Credit Suisse (Switzerland - now part of UBS)", dataAiHint: "Credit Suisse" },
    { name: "Nordea (Nordics)", dataAiHint: "Nordea logo" },
    { name: "Danske Bank (Denmark/Nordics)", dataAiHint: "Danske Bank" },
    { name: "Revolut (Europe/Global)", dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", dataAiHint: "N26 logo" },
].map(bank => ({
    ...bank,
    // Attempt to get specific icon, otherwise default
    iconComponent: specificBankIcons[bank.name] || React.createElement(DefaultBankIcon),
})).sort((a, b) => a.name.localeCompare(b.name));
