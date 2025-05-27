
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Attempt to import only SiNubank and other highly common/stable icons from react-icons/si
// Comment out or remove others if they cause "Export doesn't exist" errors.
import {
  SiNubank,
  // SiItauunibanco, // Itaú Unibanco often uses this combined name - REMOVED
  SiSantander,
  SiPagseguro,
  SiHsbc,
  SiRevolut,
  SiN26
  // Other Si* icons like SiBradesco, SiCaixa, etc., are removed if they caused issues.
  // We will default them to DefaultBankIcon.
} from 'react-icons/si';

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

// Specific icons map - only include icons confirmed to import correctly
// For Nubank, we apply a specific color. For others, they will use their default SVG colors if monochromatic, or inherit text color.
const specificBankIcons: { [key: string]: React.ElementType | (() => React.ReactNode) } = {
  Nubank: () => React.createElement(SiNubank, { size: defaultIconSize, className: "text-[#820AD1]" }),
  // Itaú Unibanco: SiItauunibanco, // REMOVED
  Santander: SiSantander,
  "Santander Brasil": SiSantander,
  "Santander (Spain/Global)": SiSantander,
  PagBank: SiPagseguro,
  HSBC: SiHsbc,
  "HSBC (UK/Global)": SiHsbc,
  Revolut: SiRevolut,
  "Revolut (Europe/Global)": SiRevolut,
  N26: SiN26,
  "N26 (Europe/Global)": SiN26,
};

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" }, // Fallback
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: specificBankIcons["Santander Brasil"] ? React.createElement(specificBankIcons["Santander Brasil"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "Nubank", iconComponent: specificBankIcons.Nubank ? (specificBankIcons.Nubank as () => React.ReactNode)() : React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "XP logo" },
    { name: "Banco Safra", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" },
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: specificBankIcons.PagBank ? React.createElement(specificBankIcons.PagBank, { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" },

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: specificBankIcons["HSBC (UK/Global)"] ? React.createElement(specificBankIcons["HSBC (UK/Global)"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconComponent: specificBankIcons["Santander (Spain/Global)"] ? React.createElement(specificBankIcons["Santander (Spain/Global)"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
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
    { name: "Revolut (Europe/Global)", iconComponent: specificBankIcons["Revolut (Europe/Global)"] ? React.createElement(specificBankIcons["Revolut (Europe/Global)"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconComponent: specificBankIcons["N26 (Europe/Global)"] ? React.createElement(specificBankIcons["N26 (Europe/Global)"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
