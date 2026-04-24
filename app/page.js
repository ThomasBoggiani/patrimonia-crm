'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import LoginPage from '@/components/LoginPage';

function Inner() {
  const { loading } = useAuth();
  if (loading) return <div style={{padding:40}}>Chargement...</div>;
  return <LoginPage />;
}

export default function Home() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
