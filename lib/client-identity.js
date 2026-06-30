// ─────────────────────────────────────────────────────────
// Sprint 3 — Chantier 2 : l'AFFICHAGE lit l'identité depuis le contact lié.
//
// Source unique des personnes = la table `contacts`. Un `client` (profil
// acheteur) ne fait que pointer vers son contact via `contact_id`. Pendant la
// transition, les colonnes nom/prenom/societe/email/tel de `clients` restent
// remplies (Chantier 1) : on les garde en REPLI si le contact n'est pas (encore)
// lié ou si un champ y est vide. Le jour où l'on arrêtera de recopier ces
// colonnes, l'affichage continuera de marcher car il lira d'abord le contact.
//
// À utiliser sur chaque client chargé pour l'affichage, juste après toCamel().
// Le contact imbriqué arrive du select Supabase `contact:contacts(...)`.
// ─────────────────────────────────────────────────────────
export function withContactIdentity(client) {
  if (!client || typeof client !== 'object') return client;
  // Selon la requête, le contact imbriqué peut s'appeler `contact` ou `contacts`.
  const c = client.contact || client.contacts || null;
  if (!c) return client;
  return {
    ...client,
    // Contact d'abord, repli sur la colonne recopiée du client si vide/absent.
    prenom: c.prenom || client.prenom,
    nom: c.nom || client.nom,
    societe: c.societe || client.societe,
    email: c.email || client.email,
    tel: c.tel || client.tel,
  };
}
