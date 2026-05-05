// app/api/microsoft/debug/route.js
// Route TEMPORAIRE pour diagnostiquer les variables d'env Microsoft
// À SUPPRIMER après usage

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  return NextResponse.json({
    tenant_id: {
      defined: !!tenantId,
      length: tenantId?.length || 0,
      first4: tenantId?.slice(0, 4) || null,
      last4: tenantId?.slice(-4) || null,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId || ''),
    },
    client_id: {
      defined: !!clientId,
      length: clientId?.length || 0,
      first4: clientId?.slice(0, 4) || null,
      last4: clientId?.slice(-4) || null,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId || ''),
    },
    client_secret: {
      defined: !!clientSecret,
      length: clientSecret?.length || 0,
      first4: clientSecret?.slice(0, 4) || null,
      last4: clientSecret?.slice(-4) || null,
      hasTilde: clientSecret?.includes('~') || false,
    },
    expected: {
      tenant_id: 'd332ecb2-...-cf84 (UUID, 36 chars)',
      client_id: '99a11172-...-e4cf (UUID, 36 chars)',
      client_secret: 'POy8...bYm (40 chars, contient ~)',
    },
  });
}
