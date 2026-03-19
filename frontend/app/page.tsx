'use client';
import dynamic from 'next/dynamic';

// Dynamically import to avoid SSR issues with WebSockets and AudioContext
const KDSApp = dynamic(() => import('@/components/KDSApp'), { ssr: false });

export default function Page() {
  return <KDSApp />;
}
