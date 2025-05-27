
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Attempt to import specific icons. If an icon causes a build error (Export doesn't exist),
// it should be removed from this import list and its corresponding bank entry below
// should be changed to use React.createElement(DefaultBankIcon).
import {
  SiNubank,
  SiItauunibanco, // For Itaú Unibanco
  SiBtgpactual,   // For BTG Pactual
  // --- Placeholder for other common icons we might verify later ---
  // SiSantander,
  // SiPagseguro,
  // SiHsbc,
  // SiRevolut,
  // SiN26
} from 'react-icons/si';

const defaultIconSize = 20;

// DefaultBankIcon for banks where specific icon is not found or causes issues
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

// Define specific icons and their colors
const NUBANK_COLOR = "#820AD1";
const ITAU_COLOR = "#EC7000";
const BTG_COLOR = "#00305C";

const specificBankIcons: { [key: string]: React.ReactNode } = {
  "Nubank": React.createElement(SiNubank, { size: defaultIconSize, color: NUBANK_COLOR }),
  "Itaú Unibanco": React.createElement(SiItauunibanco, { size: defaultIconSize, color: ITAU_COLOR }),
  "BTG Pactual": React.createElement(SiBtgpactual, { size: defaultIconSize, color: BTG_COLOR }),
  // --- Examples for other icons if confirmed to exist and work ---
  // "Santander Brasil": React.createElement(SiSantander, { size: defaultIconSize, color: "#EC0000" }), // Example color
  // "PagBank": React.createElement(SiPagseguro, { size: defaultIconSize, color: "#F9A825" }), // Example color
};


export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: specificBankIcons["Itaú Unibanco"] || React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" }, // Fallback, can try SiSantander later
    { name: "Nubank", iconComponent: specificBankIcons["Nubank"] || React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: specificBankIcons["BTG Pactual"] || React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "XP logo" },
    { name: "Banco Safra", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" },
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" }, // Fallback, can try SiPagseguro later
    { name: "Banco Neon", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" },

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" }, // Fallback, can try SiHsbc later
    { name: "Barclays (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" }, // Fallback
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
    { name: "Revolut (Europe/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" }, // Fallback, can try SiRevolut later
    { name: "N26 (Europe/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" }, // Fallback, can try SiN26 later
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
