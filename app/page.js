'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import CRM from '@/components/CRM';
import LoginPage from '@/components/LoginPage';
import { Loader2 } from 'lucide-react';

function AppGate() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-sage-dark mx-auto mb-3" />
          <div className="text-sm text-sage-dark">Chargement…</div>
        </div>
      </div>
    );
  }
  
  if (!user) return <LoginPage />;
  return <CRM />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
