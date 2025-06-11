
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page now simply redirects to the DeFi investments page by default.
export default function InvestmentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/investments/defi');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting to DeFi Investments...</p>
    </div>
  );
}
