'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import CRM from '@/components/CRM';
import LoginPage from '@/components/LoginPage';

function AppGate() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div>Chargement...</div>
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
