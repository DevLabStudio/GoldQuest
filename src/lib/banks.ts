
'use client';

import React from 'react';
import { Landmark } from 'lucide-react';
// Importar apenas alguns ícones específicos bem conhecidos e estáveis de react-icons/si
import {
  SiNubank,
  SiItauunibanco, // Nome comum para Itaú Unibanco em Simple Icons
  SiSantander,
  SiHsbc, // Exemplo de banco internacional comum
  SiPagseguro, // Outro exemplo brasileiro
  SiRevolut, // Exemplo europeu
  SiN26      // Exemplo europeu
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

// Mapeamento de nomes de bancos para componentes de ícones específicos
// Se um ícone específico não estiver aqui, ele usará DefaultBankIcon
const specificBankIcons: { [key: string]: React.ReactNode } = {
  "Nubank": <SiNubank size={defaultIconSize} />,
  "Itaú Unibanco": <SiItauunibanco size={defaultIconSize} />, // Corresponde a SiItauunibanco
  "Santander Brasil": <SiSantander size={defaultIconSize} />,
  "Santander (Spain/Global)": <SiSantander size={defaultIconSize} />,
  "HSBC (UK/Global)": <SiHsbc size={defaultIconSize} />,
  "PagBank": <SiPagseguro size={defaultIconSize} />,
  "Revolut (Europe/Global)": <SiRevolut size={defaultIconSize} />,
  "N26 (Europe/Global)": <SiN26 size={defaultIconSize} />
  // Adicione outros bancos aqui conforme você verifica os nomes corretos dos ícones
};

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: specificBankIcons["Banco do Brasil"] || React.createElement(DefaultBankIcon), dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconComponent: specificBankIcons["Itaú Unibanco"] || React.createElement(DefaultBankIcon), dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconComponent: specificBankIcons["Caixa Econômica Federal"] || React.createElement(DefaultBankIcon), dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconComponent: specificBankIcons["Bradesco"] || React.createElement(DefaultBankIcon), dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconComponent: specificBankIcons["Santander Brasil"] || React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "Nubank", iconComponent: specificBankIcons["Nubank"] || React.createElement(DefaultBankIcon), dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconComponent: specificBankIcons["Banco Inter"] || React.createElement(DefaultBankIcon), dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconComponent: specificBankIcons["BTG Pactual"] || React.createElement(DefaultBankIcon), dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconComponent: specificBankIcons["XP Investimentos"] || React.createElement(DefaultBankIcon), dataAiHint: "XP logo" },
    { name: "Banco Safra", iconComponent: specificBankIcons["Banco Safra"] || React.createElement(DefaultBankIcon), dataAiHint: "Safra logo" },
    { name: "Banco Original", iconComponent: specificBankIcons["Banco Original"] || React.createElement(DefaultBankIcon), dataAiHint: "Original logo" },
    { name: "C6 Bank", iconComponent: specificBankIcons["C6 Bank"] || React.createElement(DefaultBankIcon), dataAiHint: "C6 Bank" },
    { name: "PagBank", iconComponent: specificBankIcons["PagBank"] || React.createElement(DefaultBankIcon), dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconComponent: specificBankIcons["Banco Neon"] || React.createElement(DefaultBankIcon), dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconComponent: specificBankIcons["Banco Pan"] || React.createElement(DefaultBankIcon), dataAiHint: "Pan logo" },

    // Europe
    { name: "HSBC (UK/Global)", iconComponent: specificBankIcons["HSBC (UK/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconComponent: specificBankIcons["Barclays (UK)"] || React.createElement(DefaultBankIcon), dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconComponent: specificBankIcons["Lloyds Banking Group (UK)"] || React.createElement(DefaultBankIcon), dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", iconComponent: specificBankIcons["NatWest Group (UK)"] || React.createElement(DefaultBankIcon), dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconComponent: specificBankIcons["Santander (Spain/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "Santander logo" },
    { name: "BBVA (Spain)", iconComponent: specificBankIcons["BBVA (Spain)"] || React.createElement(DefaultBankIcon), dataAiHint: "BBVA logo" },
    { name: "CaixaBank (Spain)", iconComponent: specificBankIcons["CaixaBank (Spain)"] || React.createElement(DefaultBankIcon), dataAiHint: "CaixaBank logo" },
    { name: "BNP Paribas (France)", iconComponent: specificBankIcons["BNP Paribas (France)"] || React.createElement(DefaultBankIcon), dataAiHint: "BNP Paribas" },
    { name: "Crédit Agricole (France)", iconComponent: specificBankIcons["Crédit Agricole (France)"] || React.createElement(DefaultBankIcon), dataAiHint: "Credit Agricole" },
    { name: "Société Générale (France)", iconComponent: specificBankIcons["Société Générale (France)"] || React.createElement(DefaultBankIcon), dataAiHint: "Societe Generale" },
    { name: "Deutsche Bank (Germany)", iconComponent: specificBankIcons["Deutsche Bank (Germany)"] || React.createElement(DefaultBankIcon), dataAiHint: "Deutsche Bank" },
    { name: "Commerzbank (Germany)", iconComponent: specificBankIcons["Commerzbank (Germany)"] || React.createElement(DefaultBankIcon), dataAiHint: "Commerzbank logo" },
    { name: "ING Group (Netherlands/Global)", iconComponent: specificBankIcons["ING Group (Netherlands/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "ING logo" },
    { name: "UniCredit (Italy)", iconComponent: specificBankIcons["UniCredit (Italy)"] || React.createElement(DefaultBankIcon), dataAiHint: "UniCredit logo" },
    { name: "Intesa Sanpaolo (Italy)", iconComponent: specificBankIcons["Intesa Sanpaolo (Italy)"] || React.createElement(DefaultBankIcon), dataAiHint: "Intesa Sanpaolo" },
    { name: "UBS (Switzerland)", iconComponent: specificBankIcons["UBS (Switzerland)"] || React.createElement(DefaultBankIcon), dataAiHint: "UBS logo" },
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconComponent: specificBankIcons["Credit Suisse (Switzerland - now part of UBS)"] || React.createElement(DefaultBankIcon), dataAiHint: "Credit Suisse" },
    { name: "Nordea (Nordics)", iconComponent: specificBankIcons["Nordea (Nordics)"] || React.createElement(DefaultBankIcon), dataAiHint: "Nordea logo" },
    { name: "Danske Bank (Denmark/Nordics)", iconComponent: specificBankIcons["Danske Bank (Denmark/Nordics)"] || React.createElement(DefaultBankIcon), dataAiHint: "Danske Bank" },
    { name: "Revolut (Europe/Global)", iconComponent: specificBankIcons["Revolut (Europe/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconComponent: specificBankIcons["N26 (Europe/Global)"] || React.createElement(DefaultBankIcon), dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
