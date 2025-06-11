
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OldImportPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/data-management');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting to Data Management...</p>
    </div>
  );
}
