"use client";

import { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
