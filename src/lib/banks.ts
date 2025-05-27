
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Removed all specific Si* icon imports from 'react-icons/si' to prevent build errors.
// Specific icons can be re-added carefully one by one if they are confirmed to exist in the installed react-icons version.

const defaultIconSize = 20;

// Define DefaultBankIcon using React.createElement to avoid potential JSX parsing issues
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

export const popularBanks: BankInfo[] = [
    // Brazil - All using DefaultBankIcon now
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "Nubank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "XP logo" },
    { name: "Banco Safra", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" },
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" },

    // Europe (Selection - varies greatly by country) - All using DefaultBankIcon now
    { name: "HSBC (UK/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "BBVA (Spain)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BBVA logo" },
    { name: "CaixaBank (Spain)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "CaixaBank logo" },
    { name: "BNP Paribas (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BNP Paribas" },
    { name: "Crédit Agricole (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Credit Agricole" },
    { name: "Société Générale (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Societe Generale" },
    { name: "Deutsche Bank (Germany)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Deutsche Bank" },
    { name: "Commerzbank (Germany)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Commerzbank logo" },
    { name: "ING Group (Netherlands/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "ING logo" },
    { name: "UniCredit (Italy)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "UniCredit logo" },
    { name: "Intesa Sanpaolo (Italy)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Intesa Sanpaolo" },
    { name: "UBS (Switzerland)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "UBS logo" },
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Credit Suisse" },
    { name: "Nordea (Nordics)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Nordea logo" },
    { name: "Danske Bank (Denmark/Nordics)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Danske Bank" },
    { name: "Revolut (Europe/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
