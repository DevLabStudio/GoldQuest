
import type { ReactNode } from 'react';
import { Landmark } from 'lucide-react';
import {
  SiNubank, SiItau, SiBradesco, SiBancointer, SiBancodobrasil, SiCaixa, SiSantander, SiPagseguro,
  SiHsbc, SiBarclays, SiLloydsbank, SiNatwest, SiBbva, SiBnpParibas, SiCreditagricole,
  SiSocietegenerale, SiDeutschebank, SiCommerzbank, SiIng, SiUnicredit, SiIntesasanpaolo,
  SiUbs, SiCreditsuisse, SiNordea, SiDanskebank, SiRevolut, SiN26, SiXp, SiBtgpactual, SiSafra, SiC6Bank, SiBancooriginal, SiNeon, SiPan
} from 'react-icons/si';

const defaultIconSize = 20;
const DefaultBankIcon = () => <Landmark size={defaultIconSize} className="text-muted-foreground" />;

export interface BankInfo {
  name: string;
  iconComponent: ReactNode;
  // Removed iconUrl and dataAiHint as we are directly using components
}

export const popularBanks: BankInfo[] = [
    // Brazil
    { name: "Banco do Brasil", iconComponent: <SiBancodobrasil size={defaultIconSize} /> },
    { name: "Itaú Unibanco", iconComponent: <SiItau size={defaultIconSize} /> },
    { name: "Caixa Econômica Federal", iconComponent: <SiCaixa size={defaultIconSize} /> },
    { name: "Bradesco", iconComponent: <SiBradesco size={defaultIconSize} /> },
    { name: "Santander Brasil", iconComponent: <SiSantander size={defaultIconSize} /> },
    { name: "Nubank", iconComponent: <SiNubank size={defaultIconSize} /> },
    { name: "Banco Inter", iconComponent: <SiBancointer size={defaultIconSize} /> },
    { name: "BTG Pactual", iconComponent: <SiBtgpactual size={defaultIconSize} /> },
    { name: "XP Investimentos", iconComponent: <SiXp size={defaultIconSize} /> },
    { name: "Banco Safra", iconComponent: <SiSafra size={defaultIconSize} /> },
    { name: "Banco Original", iconComponent: <SiBancooriginal size={defaultIconSize} /> },
    { name: "C6 Bank", iconComponent: <SiC6Bank size={defaultIconSize} /> },
    { name: "PagBank", iconComponent: <SiPagseguro size={defaultIconSize} /> },
    { name: "Banco Neon", iconComponent: <SiNeon size={defaultIconSize} /> },
    { name: "Banco Pan", iconComponent: <SiPan size={defaultIconSize} /> },

    // Europe (Selection - varies greatly by country)
    { name: "HSBC (UK/Global)", iconComponent: <SiHsbc size={defaultIconSize} /> },
    { name: "Barclays (UK)", iconComponent: <SiBarclays size={defaultIconSize} /> },
    { name: "Lloyds Banking Group (UK)", iconComponent: <SiLloydsbank size={defaultIconSize} /> },
    { name: "NatWest Group (UK)", iconComponent: <SiNatwest size={defaultIconSize} /> },
    { name: "Santander (Spain/Global)", iconComponent: <SiSantander size={defaultIconSize} /> },
    { name: "BBVA (Spain)", iconComponent: <SiBbva size={defaultIconSize} /> },
    { name: "CaixaBank (Spain)", iconComponent: <DefaultBankIcon /> }, // Placeholder, specific icon likely not in react-icons/si
    { name: "BNP Paribas (France)", iconComponent: <SiBnpParibas size={defaultIconSize} /> },
    { name: "Crédit Agricole (France)", iconComponent: <SiCreditagricole size={defaultIconSize} /> },
    { name: "Société Générale (France)", iconComponent: <SiSocietegenerale size={defaultIconSize} /> },
    { name: "Deutsche Bank (Germany)", iconComponent: <SiDeutschebank size={defaultIconSize} /> },
    { name: "Commerzbank (Germany)", iconComponent: <SiCommerzbank size={defaultIconSize} /> },
    { name: "ING Group (Netherlands/Global)", iconComponent: <SiIng size={defaultIconSize} /> },
    { name: "UniCredit (Italy)", iconComponent: <SiUnicredit size={defaultIconSize} /> },
    { name: "Intesa Sanpaolo (Italy)", iconComponent: <SiIntesasanpaolo size={defaultIconSize} /> },
    { name: "UBS (Switzerland)", iconComponent: <SiUbs size={defaultIconSize} /> },
    { name: "Credit Suisse (Switzerland - now part of UBS)", iconComponent: <SiCreditsuisse size={defaultIconSize} /> },
    { name: "Nordea (Nordics)", iconComponent: <SiNordea size={defaultIconSize} /> },
    { name: "Danske Bank (Denmark/Nordics)", iconComponent: <SiDanskebank size={defaultIconSize} /> },
    { name: "Revolut (Europe/Global)", iconComponent: <SiRevolut size={defaultIconSize} /> },
    { name: "N26 (Europe/Global)", iconComponent: <SiN26 size={defaultIconSize} /> },
];

// Ensure all banks have an iconComponent, defaulting if necessary
popularBanks.forEach(bank => {
    if (!bank.iconComponent) { // Should not happen with current structure, but good safeguard
        bank.iconComponent = <DefaultBankIcon />;
    }
});

// Sort alphabetically for better usability in dropdowns
popularBanks.sort((a, b) => a.name.localeCompare(b.name));
