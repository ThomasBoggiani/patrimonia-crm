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

// GET /api/microsoft/contacts → liste tous les contacts Outlook (pour sélection)
export async function GET(request) {
  try {
    const user = await getUser(request);
    
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Récupérer tous les contacts (max 250)
    const result = await callGraph({
      supabase: adminSupabase,
      userId: user.id,
      endpoint: '/me/contacts?$top=250&$orderby=displayName&$select=id,displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle,categories'
    });

    const contacts = (result.value || []).map(c => ({
      id: c.id,
      displayName: c.displayName,
      givenName: c.givenName,
      surname: c.surname,
      email: c.emailAddresses?.[0]?.address || null,
      phone: c.mobilePhone || c.businessPhones?.[0] || null,
      companyName: c.companyName,
      jobTitle: c.jobTitle,
      categories: c.categories || [],
      hasEmail: !!c.emailAddresses?.[0]?.address
    }));

    // Récupérer les clients existants pour signaler les doublons
    const emails = contacts.map(c => c.email).filter(Boolean);
    const { data: existingClients } = await adminSupabase
      .from('clients')
      .select('id, email')
      .in('email', emails);
    
    const existingEmails = new Set((existingClients || []).map(c => c.email?.toLowerCase()));

    return NextResponse.json({ 
      contacts: contacts.map(c => ({
        ...c,
        alreadyInCrm: c.email && existingEmails.has(c.email.toLowerCase())
      }))
    });
  } catch (err) {
    console.error('List contacts error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/microsoft/contacts → import sélection vers CRM
// body: { contactIds: ['outlook-id-1', 'outlook-id-2', ...] }
export async function POST(request) {
  try {
    const user = await getUser(request);
    const { contactIds } = await request.json();
    
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'contactIds doit être un tableau non vide' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const contactId of contactIds) {
      try {
        // Récupérer le contact Outlook complet
        const contact = await callGraph({
          supabase: adminSupabase,
          userId: user.id,
          endpoint: `/me/contacts/${contactId}`
        });

        const email = contact.emailAddresses?.[0]?.address;
        if (!email) {
          skipped++;
          errors.push(`${contact.displayName}: pas d'email`);
          continue;
        }

        // Vérifier si déjà dans le CRM
        const { data: existing } = await adminSupabase
          .from('clients')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        
        if (existing) {
          skipped++;
          continue;
        }

        // Créer le client
        const { error } = await adminSupabase.from('clients').insert({
          prenom: contact.givenName || '',
          nom: contact.surname || contact.displayName || '',
          email: email,
          telephone: contact.mobilePhone || contact.businessPhones?.[0] || null,
          societe: contact.companyName || null,
          fonction: contact.jobTitle || null,
          source: 'Outlook',
          outlook_contact_id: contact.id,
          actif: true,
          created_by: user.id
        });
        
        if (error) {
          errors.push(`${contact.displayName}: ${error.message}`);
          skipped++;
        } else {
          imported++;
        }
      } catch (err) {
        errors.push(`Contact ${contactId}: ${err.message}`);
        skipped++;
      }
    }

    return NextResponse.json({ imported, skipped, errors });
  } catch (err) {
    console.error('Import contacts error:', err);
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Microsoft non connecté', code: 'NOT_CONNECTED' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
