"use client";

import dynamic from 'next/dynamic';
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Dynamically import the existing App component to avoid SSR issues with browser-only features
const MainContent = dynamic(() => import('../src/AppContent'), { ssr: false });

export default function CatchAllPage() {
    const { isLoaded, userId } = useClerkAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isLoaded) return null;

    return <MainContent />;
}
