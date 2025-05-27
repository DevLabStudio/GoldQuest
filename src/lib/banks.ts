
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Attempt to import only SiNubank
import { SiNubank } from 'react-icons/si';

const defaultIconSize = 20;

// DefaultBankIcon for banks where specific icon is not found or causes issues
const DefaultBankIcon = () => {
  // Using React.createElement to avoid potential JSX parsing issues
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

// Specific icons map - only Nubank active for now
const specificBankIcons: { [key: string]: React.ReactNode } = {
  Nubank: React.createElement(SiNubank, { size: defaultIconSize, color: "#820AD1" }), // Attempting to set color directly
};

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "Nubank", iconComponent: specificBankIcons.Nubank || React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "XP logo" },
    { name: "Banco Safra", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" },
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" }, // Was SiPagseguro
    { name: "Banco Neon", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" },

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" }, // Was SiHsbc
    { name: "Barclays (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" }, // Was SiBarclays
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" }, // Was SiLloydsbank
    { name: "NatWest Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" }, // Was SiNatwest
    { name: "Santander (Spain/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" }, // Was SiSantander
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
    { name: "Revolut (Europe/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" }, // Was SiRevolut
    { name: "N26 (Europe/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" }, // Was SiN26
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
