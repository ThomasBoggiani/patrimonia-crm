// Helpers pour l'intégration Microsoft Graph
// Utilisé server-side dans les API routes

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com';
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Permissions demandées (doivent matcher Azure AD)
export const MS_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
  'Calendars.Read.Shared',
  'Mail.ReadWrite',
  'Mail.Send',
  'Contacts.ReadWrite'
].join(' ');

// Construit l'URL d'autorisation OAuth (étape 1 du flow)
export function buildAuthorizeUrl({ tenantId, clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MS_SCOPES,
    state: state,
    prompt: 'select_account'  // permet à l'utilisateur de choisir le compte
  });
  return `${MICROSOFT_AUTH_URL}/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

// Échange le code d'autorisation contre des tokens (étape 2 du flow)
export async function exchangeCodeForTokens({ tenantId, clientId, clientSecret, code, redirectUri }) {
  const response = await fetch(`${MICROSOFT_AUTH_URL}/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: MS_SCOPES
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[callGraph] Endpoint:', endpoint);
    console.error('[callGraph] Full URL:', `${GRAPH_API_URL}${endpoint}`);
    console.error('[callGraph] Status:', response.status);
    console.error('[callGraph] Body:', errorText.slice(0, 500));
    throw new Error(`Graph API error ${response.status}: ${errorText}`);
  }

  return await response.json();
  // Réponse : { access_token, refresh_token, expires_in, scope, id_token, token_type }
}

// Rafraîchit un access_token expiré avec le refresh_token
export async function refreshAccessToken({ tenantId, clientId, clientSecret, refreshToken }) {
  const response = await fetch(`${MICROSOFT_AUTH_URL}/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MS_SCOPES
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
}

// Récupère le profil de l'utilisateur connecté (pour stocker email + nom)
export async function getMyProfile(accessToken) {
  const response = await fetch(`${GRAPH_API_URL}/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Profile fetch failed');
  return await response.json();
  // { id, displayName, mail, userPrincipalName, ... }
}

// Wrapper pour appeler Graph API avec gestion auto du refresh token
// Récupère l'intégration depuis Supabase, refresh si besoin, fait l'appel
export async function callGraph({ supabase, userId, endpoint, method = 'GET', body = null }) {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  // Récupérer l'intégration de l'user
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .single();

  if (error || !integration) {
    throw new Error('NOT_CONNECTED');
  }

  let accessToken = integration.access_token;
  const expiresAt = new Date(integration.token_expires_at).getTime();
  const now = Date.now();

  // Refresh préventif si le token expire dans moins de 2 minutes
  if (expiresAt - now < 2 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken({
        tenantId, clientId, clientSecret,
        refreshToken: integration.refresh_token
      });
      accessToken = refreshed.access_token;
      
      // Mise à jour en base
      await supabase
        .from('user_integrations')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || integration.refresh_token,
          token_expires_at: new Date(now + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id);
    } catch (err) {
      throw new Error('TOKEN_REFRESH_FAILED');
    }
  }

  // Appel à Graph
  const response = await fetch(`${GRAPH_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API error ${response.status}: ${errorText}`);
  }

  // Certains endpoints (DELETE par ex) ne renvoient pas de JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return null;
}

// Génère un state aléatoire pour le CSRF protection
export function generateState() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
