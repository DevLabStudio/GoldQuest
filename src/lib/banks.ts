
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
    { name: "Banco do Brasil", iconUrl: "https://picsum.photos/seed/bancodobrasil/20/20", dataAiHint: "Banco do Brasil logo" },
    { name: "Itaú Unibanco", iconUrl: "https://picsum.photos/seed/itau/20/20", dataAiHint: "Itau logo" },
    { name: "Caixa Econômica Federal", iconUrl: "https://picsum.photos/seed/caixa/20/20", dataAiHint: "Caixa Economica Federal logo" },
    { name: "Bradesco", iconUrl: "https://picsum.photos/seed/bradesco/20/20", dataAiHint: "Bradesco logo" },
    { name: "Santander Brasil", iconUrl: "https://picsum.photos/seed/santanderbr/20/20", dataAiHint: "Santander logo" },
    { name: "Nubank", iconUrl: "https://picsum.photos/seed/nubank/20/20", dataAiHint: "Nubank logo" },
    { name: "Banco Inter", iconUrl: "https://picsum.photos/seed/inter/20/20", dataAiHint: "Banco Inter logo" },
    { name: "BTG Pactual", iconUrl: "https://picsum.photos/seed/btg/20/20", dataAiHint: "BTG Pactual logo" },
    { name: "XP Investimentos", iconUrl: "https://picsum.photos/seed/xp/20/20", dataAiHint: "XP Investimentos logo" },
    { name: "Banco Safra", iconUrl: "https://picsum.photos/seed/safra/20/20", dataAiHint: "Banco Safra logo" },
    { name: "Banco Original", iconUrl: "https://picsum.photos/seed/original/20/20", dataAiHint: "Banco Original logo" },
    { name: "C6 Bank", iconUrl: "https://picsum.photos/seed/c6/20/20", dataAiHint: "C6 Bank logo" },
    { name: "PagBank", iconUrl: "https://picsum.photos/seed/pagbank/20/20", dataAiHint: "PagBank logo" },
    { name: "Banco Neon", iconUrl: "https://picsum.photos/seed/neon/20/20", dataAiHint: "Banco Neon logo" },
    { name: "Banco Pan", iconUrl: "https://picsum.photos/seed/pan/20/20", dataAiHint: "Banco Pan logo" },

    // Europe (Selection - varies greatly by country)
    { name: "HSBC (UK/Global)", iconUrl: "https://picsum.photos/seed/hsbc/20/20", dataAiHint: "HSBC logo" },
    { name: "Barclays (UK)", iconUrl: "https://picsum.photos/seed/barclays/20/20", dataAiHint: "Barclays logo" },
    { name: "Lloyds Banking Group (UK)", iconUrl: "https://picsum.photos/seed/lloyds/20/20", dataAiHint: "Lloyds Bank logo" },
    { name: "NatWest Group (UK)", iconUrl: "https://picsum.photos/seed/natwest/20/20", dataAiHint: "NatWest logo" },
    { name: "Santander (Spain/Global)", iconUrl: "https://picsum.photos/seed/santanderes/20/20", dataAiHint: "Santander logo" },
    { name: "BBVA (Spain)", iconUrl: "https://picsum.photos/seed/bbva/20/20", dataAiHint: "BBVA logo" },
    { name: "CaixaBank (Spain)", iconUrl: "https://picsum.photos/seed/caixabank/20/20", dataAiHint: "CaixaBank logo" },
    { name: "BNP Paribas (France)", iconUrl: "https://picsum.photos/seed/bnp/20/20", dataAiHint: "BNP Paribas logo" },
    { name: "Crédit Agricole (France)", iconUrl: "https://picsum.photos/seed/creditagricole/20/20", dataAiHint: "Credit Agricole logo" },
    { name: "Société Générale (France)", iconUrl: "https://picsum.photos/seed/societegenerale/20/20", dataAiHint: "Societe Generale logo" },
    { name: "Deutsche Bank (Germany)", iconUrl: "https://picsum.photos/seed/deutsche/20/20", dataAiHint: "Deutsche Bank logo" },
    { name: "Commerzbank (Germany)", iconUrl: "https://picsum.photos/seed/commerzbank/20/20", dataAiHint: "Commerzbank logo" },
    { name: "ING Group (Netherlands/Global)", iconUrl: "https://picsum.photos/seed/ing/20/20", dataAiHint: "ING logo" },
    { name: "UniCredit (Italy)", iconUrl: "https://picsum.photos/seed/unicredit/20/20", dataAiHint: "UniCredit logo" },
    { name: "Intesa Sanpaolo (Italy)", iconUrl: "https://picsum.photos/seed/intesasanpaolo/20/20", dataAiHint: "Intesa Sanpaolo logo" },
    { name: "UBS (Switzerland)", iconUrl: "https://picsum.photos/seed/ubs/20/20", dataAiHint: "UBS logo" },
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconUrl: "https://picsum.photos/seed/creditsuisse/20/20", dataAiHint: "Credit Suisse logo" },
    { name: "Nordea (Nordics)", iconUrl: "https://picsum.photos/seed/nordea/20/20", dataAiHint: "Nordea logo" },
    { name: "Danske Bank (Denmark/Nordics)", iconUrl: "https://picsum.photos/seed/danskebank/20/20", dataAiHint: "Danske Bank logo" },
    { name: "Revolut (Europe/Global)", iconUrl: "https://picsum.photos/seed/revolutbank/20/20", dataAiHint: "Revolut logo" }, // Added a different seed to avoid conflict with crypto
    { name: "N26 (Europe/Global)", iconUrl: "https://picsum.photos/seed/n26/20/20", dataAiHint: "N26 logo" },
];

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
