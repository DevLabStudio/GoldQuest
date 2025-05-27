
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Attempt to import only SiNubank and other highly common/stable icons from react-icons/si
// Comment out or remove others if they cause "Export doesn't exist" errors.
import {
  SiNubank,
  // SiItauunibanco, // Itaú Unibanco often uses this combined name - REMOVED if causes errors
  // SiSantander, // REMOVED
  SiPagseguro,
  SiHsbc,
  SiRevolut,
  SiN26
  // Other Si* icons like SiBradesco, SiCaixa, etc., are removed if they caused issues.
  // We will default them to DefaultBankIcon.
} from 'react-icons/si';

const defaultIconSize = 20;

const DefaultBankIcon = () => {
  // Using React.createElement to avoid potential JSX parsing issues with props
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

// For icons that were causing issues, we directly use DefaultBankIcon.
// For Nubank, we attempt the specific icon with color.
const specificBankIcons: { [key: string]: React.ReactNode } = {
  Nubank: React.createElement(SiNubank, { size: defaultIconSize, className: "text-[#820AD1]" }),
  PagBank: React.createElement(SiPagseguro, { size: defaultIconSize }),
  HSBC: React.createElement(SiHsbc, { size: defaultIconSize }),
  "HSBC (UK/Global)": React.createElement(SiHsbc, { size: defaultIconSize }),
  Revolut: React.createElement(SiRevolut, { size: defaultIconSize }),
  "Revolut (Europe/Global)": React.createElement(SiRevolut, { size: defaultIconSize }),
  N26: React.createElement(SiN26, { size: defaultIconSize }),
  "N26 (Europe/Global)": React.createElement(SiN26, { size: defaultIconSize }),
  // Banks that had issues will get DefaultBankIcon below
};

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" }, // Defaulted
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" }, // Defaulted
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" }, // Defaulted
    { name: "Santander Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" }, // Defaulted
    { name: "Nubank", iconComponent: specificBankIcons.Nubank || React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" }, // Defaulted
    { name: "BTG Pactual", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" }, // Defaulted
    { name: "XP Investimentos", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "XP logo" }, // Defaulted
    { name: "Banco Safra", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" }, // Defaulted
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" }, // Defaulted
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" }, // Defaulted
    { name: "PagBank", iconComponent: specificBankIcons.PagBank || React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" }, // Defaulted
    { name: "Banco Pan", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" }, // Defaulted

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: specificBankIcons["HSBC (UK/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" }, // Defaulted
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" }, // Defaulted
    { name: "NatWest Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" }, // Defaulted
    { name: "Santander (Spain/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" }, // Defaulted
    { name: "BBVA (Spain)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BBVA logo" }, // Defaulted
    { name: "CaixaBank (Spain)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "CaixaBank logo" }, // Defaulted
    { name: "BNP Paribas (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BNP Paribas" }, // Defaulted
    { name: "Crédit Agricole (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Credit Agricole" }, // Defaulted
    { name: "Société Générale (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Societe Generale" }, // Defaulted
    { name: "Deutsche Bank (Germany)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Deutsche Bank" }, // Defaulted
    { name: "Commerzbank (Germany)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Commerzbank logo" }, // Defaulted
    { name: "ING Group (Netherlands/Global)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "ING logo" }, // Defaulted
    { name: "UniCredit (Italy)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "UniCredit logo" }, // Defaulted
    { name: "Intesa Sanpaolo (Italy)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Intesa Sanpaolo" }, // Defaulted
    { name: "UBS (Switzerland)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "UBS logo" }, // Defaulted
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Credit Suisse" }, // Defaulted
    { name: "Nordea (Nordics)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Nordea logo" }, // Defaulted
    { name: "Danske Bank (Denmark/Nordics)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Danske Bank" }, // Defaulted
    { name: "Revolut (Europe/Global)", iconComponent: specificBankIcons["Revolut (Europe/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconComponent: specificBankIcons["N26 (Europe/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
