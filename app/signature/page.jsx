// app/signature/page.jsx
'use client';

export default function SignaturePage() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Aperçu signature email</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Sélectionne tout (Cmd+A), copie (Cmd+C) puis colle dans Mac Mail → Réglages → Signatures.
      </p>
      <hr style={{ marginBottom: 32, border: 0, borderTop: '1px solid #ddd' }} />

      {/* ⬇️ La signature à copier commence ici ⬇️ */}
      <table cellPadding="0" cellSpacing="0" border="0" style={{ fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 580 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', padding: '0 24px 0 0', width: 150 }}>
              <img
                src="https://patrimonia-crm.vercel.app/logo-light.png"
                alt="Immeubles & Patrimoine"
                width="150"
                style={{ display: 'block', border: 0 }}
              />
            </td>
            <td style={{ verticalAlign: 'top', borderLeft: '1px solid #d6d3d1', paddingLeft: 24 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: '#1c1917', lineHeight: 1.1, marginBottom: 4, letterSpacing: '-0.3px' }}>
                Thomas Boggiani
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#4a5d3a', fontStyle: 'italic', marginBottom: 16 }}>
                Directeur du développement
              </div>

              <table cellPadding="0" cellSpacing="0" border="0" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, color: '#57534e', lineHeight: 1.7 }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: 8, verticalAlign: 'top', color: '#8a9a78', fontWeight: 'bold' }}>M</td>
                    <td><a href="tel:+33663649443" style={{ color: '#292524', textDecoration: 'none' }}>+33 6 63 64 94 43</a></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 8, verticalAlign: 'top', color: '#8a9a78', fontWeight: 'bold' }}>E</td>
                    <td><a href="mailto:thomas.boggiani@immeubles-patrimoine.fr" style={{ color: '#292524', textDecoration: 'none' }}>thomas.boggiani@immeubles-patrimoine.fr</a></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 8, verticalAlign: 'top', color: '#8a9a78', fontWeight: 'bold' }}>W</td>
                    <td><a href="https://www.immeubles-patrimoine.fr" style={{ color: '#292524', textDecoration: 'none' }}>www.immeubles-patrimoine.fr</a></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 8, verticalAlign: 'top', color: '#8a9a78', fontWeight: 'bold' }}>A</td>
                    <td>7 rue de Penthièvre, 75008 Paris</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 18 }}>
                
                  href="https://patrimonia-crm.vercel.app/q/acquereur/3hbx6168"
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#4a5d3a',
                    color: '#ffffff',
                    padding: '10px 18px',
                    textDecoration: 'none',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.3px',
                    borderRadius: 4
                  }}
                >
                  → Définir mon profil investisseur
                </a>
                <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10, color: '#a8a29e', marginTop: 6, fontStyle: 'italic' }}>
                  3 minutes · Confidentiel · Réponse sous 24h
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      {/* ⬆️ La signature à copier finit ici ⬆️ */}

      <hr style={{ marginTop: 40, border: 0, borderTop: '1px solid #ddd' }} />
      <div style={{ marginTop: 24, padding: 16, background: '#f5f4ee', borderRadius: 8, fontSize: 13, color: '#666' }}>
        <strong>Mode d'emploi Mac Mail :</strong>
        <ol style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Cmd+A pour tout sélectionner sur cette page</li>
          <li>Cmd+C pour copier</li>
          <li>Mail → Réglages → Signatures → choisis ton compte</li>
          <li>+ pour créer une nouvelle signature</li>
          <li>Cmd+V dans la zone à droite</li>
          <li>Décoche "Toujours utiliser ma police par défaut"</li>
        </ol>
      </div>
    </div>
  );
}
