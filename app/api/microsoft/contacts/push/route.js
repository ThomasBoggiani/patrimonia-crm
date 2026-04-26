import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGraph } from '@/lib/microsoft-graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) throw new Error('UNAUTHORIZED');
  const accessToken = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

// POST /api/microsoft/contacts/push
// body: { clientId } → pousse un client CRM vers Outlook (créé ou mis à jour)
export async function POST(request) {
  try {
    const user = await getUser(request);
    const { clientId } = await request.json();
    
    if (!clientId) {
      return NextResponse.json({ error: 'clientId requis' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Récupérer le client
    const { data: client, error: clientError } = await adminSupabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    
    if (clientError || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    if (!client.email) {
      return NextResponse.json({ error: 'Le client doit avoir un email' }, { status: 400 });
    }

    // Construire le contact Outlook
    const outlookContact = {
      givenName: client.prenom || '',
      surname: client.nom || '',
      emailAddresses: [{
        address: client.email,
        name: `${client.prenom || ''} ${client.nom || ''}`.trim()
      }],
      ...(client.telephone && { mobilePhone: client.telephone }),
      ...(client.societe && { companyName: client.societe }),
      ...(client.fonction && { jobTitle: client.fonction }),
      categories: ['I&P CRM']  // Tag pour identifier les contacts CRM
    };

    let outlookContactId = client.outlook_contact_id;

    if (outlookContactId) {
      // Mise à jour
      try {
        await callGraph({
          supabase: adminSupabase,
          userId: user.id,
          endpoint: `/me/contacts/${outlookContactId}`,
          method: 'PATCH',
          body: outlookContact
        });
      } catch (err) {
        // Si le contact a été supprimé d'Outlook, on en crée un nouveau
        if (err.message?.includes('404') || err.message?.includes('NotFound')) {
          outlookContactId = null;
        } else {
          throw err;
        }
      }
    }
    
    if (!outlookContactId) {
      // Création
      const created = await callGraph({
        supabase: adminSupabase,
        userId: user.id,
        endpoint: '/me/contacts',
        method: 'POST',
        body: outlookContact
      });
      outlookContactId = created.id;
      
      // Sauvegarder l'ID Outlook côté CRM
      await adminSupabase
        .from('clients')
        .update({ outlook_contact_id: outlookContactId })
        .eq('id', clientId);
    }

    return NextResponse.json({ success: true, outlookContactId });
  } catch (err) {
    console.error('Push contact error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
