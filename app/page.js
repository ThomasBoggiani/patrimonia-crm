'use client';
import { AuthProvider, useAuth } from '@/lib/auth';

function Inner() {
  const { user, loading } = useAuth();
  return (
    <div style={{padding: 40, fontFamily: 'sans-serif'}}>
      <h1>Test AuthProvider</h1>
      <p>Loading: {loading ? 'oui' : 'non'}</p>
      <p>User: {user ? 'connecté' : 'non connecté'}</p>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
