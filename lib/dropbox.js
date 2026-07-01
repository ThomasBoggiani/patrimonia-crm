// ===================================================================
// lib/dropbox.js - helpers OAuth + API Dropbox (Sprint 4)
// Connexion du compte Dropbox de l'utilisateur (token stocke dans
// user_integrations, provider='dropbox') puis lecture d'un dossier partage
// fichier par fichier (pas de ZIP geant -> aucune limite de taille).
// ===================================================================

const SCOPES = 'files.metadata.read files.content.read sharing.read';

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    token_access_type: 'offline', // => refresh_token
    scope: SCOPES,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export function generateState() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Dropbox token exchange ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, account_id, scope, ... }
}

export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Dropbox token refresh ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json(); // { access_token, expires_in, ... } (pas de nouveau refresh_token)
}

export async function getCurrentAccount(accessToken) {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json(); // { name:{display_name}, email, ... }
}

// L'en-tete Dropbox-API-Arg doit etre en ASCII : on echappe le non-ASCII en \uXXXX.
function apiArg(obj) {
  const json = JSON.stringify(obj);
  let out = '';
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    out += code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : json[i];
  }
  return out;
}

// Liste tous les fichiers d'un dossier partage (via son lien public), recursif,
// en suivant la pagination. Renvoie [{ name, path }] (path relatif au lien).
export async function listSharedLinkFiles({ accessToken, url, maxFiles = 200 }) {
  const files = [];
  async function page(body, isContinue) {
    const res = await fetch(`https://api.dropboxapi.com/2/files/list_folder${isContinue ? '/continue' : ''}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Dropbox list_folder ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json();
  }

  // Le mode recursif n'est pas supporte sur un lien partage : on descend
  // dossier par dossier en construisant nous-memes le chemin relatif au lien.
  async function listPath(relPath) {
    if (files.length >= maxFiles) return;
    let data = await page({ path: relPath, shared_link: { url } });
    const subfolders = [];
    while (true) {
      for (const e of (data.entries || [])) {
        const childPath = `${relPath}/${e.name}`; // "" -> "/nom" ; "/sous" -> "/sous/nom"
        if (e['.tag'] === 'file') {
          files.push({ name: e.name, path: childPath });
          if (files.length >= maxFiles) return;
        } else if (e['.tag'] === 'folder') {
          subfolders.push(childPath);
        }
      }
      if (data.has_more && data.cursor) {
        data = await page({ cursor: data.cursor }, true);
      } else break;
    }
    for (const sf of subfolders) {
      if (files.length >= maxFiles) return;
      await listPath(sf);
    }
  }

  await listPath('');
  return files;
}

// Telecharge un fichier d'un lien partage. Renvoie un Buffer.
export async function downloadSharedLinkFile({ accessToken, url, path }) {
  const res = await fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': apiArg({ url, path }),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Dropbox get_shared_link_file ${res.status}: ${t.slice(0, 200)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
