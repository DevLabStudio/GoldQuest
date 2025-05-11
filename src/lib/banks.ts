
/**
 * A list of popular banks in Brazil and Europe, now with icon placeholders.
 * This list is not exhaustive and can be expanded.
 */
export interface BankInfo {
  name: string;
  iconUrl: string;
  dataAiHint: string;
}

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconUrl: "https://picsum.photos/seed/bancodobrasil/40/40", dataAiHint: "Brasil logo" },
    { name: "Itaú Unibanco", iconUrl: "https://picsum.photos/seed/itau/40/40", dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconUrl: "https://picsum.photos/seed/caixa/40/40", dataAiHint: "Caixa Federal" },
    { name: "Bradesco", iconUrl: "https://picsum.photos/seed/bradesco/40/40", dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconUrl: "https://picsum.photos/seed/santanderbr/40/40", dataAiHint: "Santander logo" },
    { name: "Nubank", iconUrl: "https://picsum.photos/seed/nubank/40/40", dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconUrl: "https://picsum.photos/seed/inter/40/40", dataAiHint: "Inter logo" },
    { name: "BTG Pactual", iconUrl: "https://picsum.photos/seed/btg/40/40", dataAiHint: "BTG Pactual" },
    { name: "XP Investimentos", iconUrl: "https://picsum.photos/seed/xp/40/40", dataAiHint: "XP logo" },
    { name: "Banco Safra", iconUrl: "https://picsum.photos/seed/safra/40/40", dataAiHint: "Safra logo" },
    { name: "Banco Original", iconUrl: "https://picsum.photos/seed/original/40/40", dataAiHint: "Original logo" },
    { name: "C6 Bank", iconUrl: "https://picsum.photos/seed/c6/40/40", dataAiHint: "C6 Bank" },
    { name: "PagBank", iconUrl: "https://picsum.photos/seed/pagbank/40/40", dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconUrl: "https://picsum.photos/seed/neon/40/40", dataAiHint: "Neon logo" },
    { name: "Banco Pan", iconUrl: "https://picsum.photos/seed/pan/40/40", dataAiHint: "Pan logo" },

    // Europe (Selection - varies greatly by country)
    { name: "HSBC (UK/Global)", iconUrl: "https://picsum.photos/seed/hsbc/40/40", dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconUrl: "https://picsum.photos/seed/barclays/40/40", dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconUrl: "https://picsum.photos/seed/lloyds/40/40", dataAiHint: "Lloyds Bank" },
    { name: "NatWest Group (UK)", iconUrl: "https://picsum.photos/seed/natwest/40/40", dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconUrl: "https://picsum.photos/seed/santanderes/40/40", dataAiHint: "Santander logo" },
    { name: "BBVA (Spain)", iconUrl: "https://picsum.photos/seed/bbva/40/40", dataAiHint: "BBVA logo" },
    { name: "CaixaBank (Spain)", iconUrl: "https://picsum.photos/seed/caixabank/40/40", dataAiHint: "CaixaBank logo" },
    { name: "BNP Paribas (France)", iconUrl: "https://picsum.photos/seed/bnp/40/40", dataAiHint: "BNP Paribas" },
    { name: "Crédit Agricole (France)", iconUrl: "https://picsum.photos/seed/creditagricole/40/40", dataAiHint: "Credit Agricole" },
    { name: "Société Générale (France)", iconUrl: "https://picsum.photos/seed/societegenerale/40/40", dataAiHint: "Societe Generale" },
    { name: "Deutsche Bank (Germany)", iconUrl: "https://picsum.photos/seed/deutsche/40/40", dataAiHint: "Deutsche Bank" },
    { name: "Commerzbank (Germany)", iconUrl: "https://picsum.photos/seed/commerzbank/40/40", dataAiHint: "Commerzbank logo" },
    { name: "ING Group (Netherlands/Global)", iconUrl: "https://picsum.photos/seed/ing/40/40", dataAiHint: "ING logo" },
    { name: "UniCredit (Italy)", iconUrl: "https://picsum.photos/seed/unicredit/40/40", dataAiHint: "UniCredit logo" },
    { name: "Intesa Sanpaolo (Italy)", iconUrl: "https://picsum.photos/seed/intesasanpaolo/40/40", dataAiHint: "Intesa Sanpaolo" },
    { name: "UBS (Switzerland)", iconUrl: "https://picsum.photos/seed/ubs/40/40", dataAiHint: "UBS logo" },
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconUrl: "https://picsum.photos/seed/creditsuisse/40/40", dataAiHint: "Credit Suisse" },
    { name: "Nordea (Nordics)", iconUrl: "https://picsum.photos/seed/nordea/40/40", dataAiHint: "Nordea logo" },
    { name: "Danske Bank (Denmark/Nordics)", iconUrl: "https://picsum.photos/seed/danskebank/40/40", dataAiHint: "Danske Bank" },
    { name: "Revolut (Europe/Global)", iconUrl: "https://picsum.photos/seed/revolutbank/40/40", dataAiHint: "Revolut logo" },
    { name: "N26 (Europe/Global)", iconUrl: "https://picsum.photos/seed/n26/40/40", dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
