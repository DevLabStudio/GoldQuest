
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Attempt to import only a few, very common and likely stable icons.
// Others will use the DefaultBankIcon.
import {
  SiNubank, SiItau, SiSantander, SiPagseguro, SiHsbc, SiBarclays, SiLloydsbank,
  SiNatwest, SiIng, SiRevolut, SiN26, SiXp, SiSafra, SiNeon, SiPan
  // Commented out icons that previously caused issues or are less certain:
  // SiCaixa, SiBradesco, SiBancointer, SiBancodobrasil, SiBbva, SiBnpParibas, SiCreditagricole,
  // SiSocietegenerale, SiDeutschebank, SiCommerzbank, SiUnicredit, SiIntesasanpaolo,
  // SiUbs, SiCreditsuisse, SiNordea, SiDanskebank, SiBtgpactual, SiC6Bank, SiBancooriginal,
} from 'react-icons/si';

const defaultIconSize = 20;

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
    // Brazil
    { name: "Banco do Brasil", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: React.createElement(SiItau, { size: defaultIconSize }), dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: React.createElement(SiSantander, { size: defaultIconSize }), dataAiHint: "Santander logo" },
    { name: "Nubank", iconComponent: React.createElement(SiNubank, { size: defaultIconSize }), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: React.createElement(SiXp, { size: defaultIconSize }), dataAiHint: "XP logo" },
    { name: "Banco Safra", iconComponent: React.createElement(SiSafra, { size: defaultIconSize }), dataAiHint: "Safra logo" },
    { name: "Banco Original", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: React.createElement(SiPagseguro, { size: defaultIconSize }), dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconComponent: React.createElement(SiNeon, { size: defaultIconSize }), dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconComponent: React.createElement(SiPan, { size: defaultIconSize }), dataAiHint: "Pan logo" },

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: React.createElement(SiHsbc, { size: defaultIconSize }), dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconComponent: React.createElement(SiBarclays, { size: defaultIconSize }), dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconComponent: React.createElement(SiLloydsbank, { size: defaultIconSize }), dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", iconComponent: React.createElement(SiNatwest, { size: defaultIconSize }), dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconComponent: React.createElement(SiSantander, { size: defaultIconSize }), dataAiHint: "Santander logo" },
    { name: "BBVA (Spain)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BBVA logo" },
    { name: "CaixaBank (Spain)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "CaixaBank logo" },
    { name: "BNP Paribas (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "BNP Paribas" },
    { name: "Crédit Agricole (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Credit Agricole" },
    { name: "Société Générale (France)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Societe Generale" },
    { name: "Deutsche Bank (Germany)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Deutsche Bank" },
    { name: "Commerzbank (Germany)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Commerzbank logo" },
    { name: "ING Group (Netherlands/Global)", iconComponent: React.createElement(SiIng, { size: defaultIconSize }), dataAiHint: "ING logo" },
    { name: "UniCredit (Italy)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "UniCredit logo" },
    { name: "Intesa Sanpaolo (Italy)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Intesa Sanpaolo" },
    { name: "UBS (Switzerland)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "UBS logo" },
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Credit Suisse" },
    { name: "Nordea (Nordics)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Nordea logo" },
    { name: "Danske Bank (Denmark/Nordics)", iconComponent: React.createElement(DefaultBankIcon), dataAiHint: "Danske Bank" },
    { name: "Revolut (Europe/Global)", iconComponent: React.createElement(SiRevolut, { size: defaultIconSize }), dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconComponent: React.createElement(SiN26, { size: defaultIconSize }), dataAiHint: "N26 logo" },
];

popularBanks.sort((a, b) => a.name.localeCompare(b.name));
