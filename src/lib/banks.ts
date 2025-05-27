
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
import {
  SiNubank, SiItauunibanco, SiSantander, SiHsbc, SiPagseguro, SiRevolut, SiN26 // Keep known working icons
  // Comment out or remove other Si* icons if they cause issues
  // SiBradesco, SiCaixa, SiBancointer, SiBancodobrasil, SiBbva, SiBnpParibas, SiCreditagricole,
  // SiSocietegenerale, SiDeutschebank, SiCommerzbank, SiIng, SiUnicredit, SiIntesasanpaolo,
  // SiUbs, SiCreditsuisse, SiNordea, SiDanskebank, SiXp, SiBtgpactual, SiSafra, SiC6Bank, SiBancooriginal, SiNeon, SiPan
} from 'react-icons/si';

const defaultIconSize = 20;

// Define DefaultBankIcon using React.createElement to bypass JSX parsing issues
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

// Specific icons map for those confirmed to work or to be tested carefully
const specificBankIcons: { [key: string]: React.ElementType | (() => React.ReactNode) } = {
  Nubank: () => React.createElement(SiNubank, { size: defaultIconSize, color: "#820AD1" }),
  "Itaú Unibanco": SiItauunibanco,
  Santander: SiSantander,
  "Santander Brasil": SiSantander,
  HSBC: SiHsbc,
  PagBank: SiPagseguro,
  Revolut: SiRevolut,
  N26: SiN26,
  // Add other known working icons here
};

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: specificBankIcons["Itaú Unibanco"] ? React.createElement(specificBankIcons["Itaú Unibanco"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: specificBankIcons["Santander Brasil"] ? React.createElement(specificBankIcons["Santander Brasil"], { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "Nubank", iconComponent: specificBankIcons.Nubank ? (specificBankIcons.Nubank as () => React.ReactNode)() : React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "XP logo" }, // Defaulted, SiXp might exist
    { name: "Banco Safra", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" }, // Defaulted, SiSafra might exist
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: specificBankIcons.PagBank ? React.createElement(specificBankIcons.PagBank, { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" }, // Defaulted, SiNeon might exist
    { name: "Banco Pan", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" }, // Defaulted, SiPan might exist

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: specificBankIcons.HSBC ? React.createElement(specificBankIcons.HSBC, { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" }, // Defaulted
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" }, // Defaulted
    { name: "NatWest Group (UK)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" }, // Defaulted
    { name: "Santander (Spain/Global)", iconComponent: specificBankIcons.Santander ? React.createElement(specificBankIcons.Santander, { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
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
    { name: "Revolut (Europe/Global)", iconComponent: specificBankIcons.Revolut ? React.createElement(specificBankIcons.Revolut, { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconComponent: specificBankIcons.N26 ? React.createElement(specificBankIcons.N26, { size: defaultIconSize }) : React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
