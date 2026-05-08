'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Copy, Loader2 } from 'lucide-react';

export default function SignaturePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Récupère la session actuelle
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session?.user) {
          if (mounted) {
            setError('non-connecte');
            setLoading(false);
          }
          return;
        }

        // Récupère le profil complet
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, prenom, nom, email, telephone, fonction, questionnaire_token')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profileData) {
          if (mounted) {
            setError('profil-introuvable');
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setProfile(profileData);
          setLoading(false);
        }
      } catch (err) {
        console.error('[signature] Erreur chargement:', err);
        if (mounted) {
          setError(err.message || 'Erreur inconnue');
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ display: 'inline-block', color: '#4a5d3a' }} />
        <p style={{ color: '#666', marginTop: 16 }}>Chargement de ta signature...</p>
      </div>
    );
  }

  if (error === 'non-connecte') {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
        <h1>Acc&egrave;s restreint</h1>
        <p>Tu dois &ecirc;tre connect&eacute; pour voir ta signature email.</p>
        <a href="/" style={{ color: '#4a5d3a', textDecoration: 'underline' }}>&rarr; Retour &agrave; l'accueil</a>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
        <h1>Erreur</h1>
        <p style={{ color: '#dc2626' }}>{error}</p>
        <a href="/" style={{ color: '#4a5d3a', textDecoration: 'underline' }}>&rarr; Retour</a>
      </div>
    );
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://patrimonia-crm.vercel.app';
  const questionnaireUrl = profile.questionnaire_token
    ? `${baseUrl}/q/${profile.questionnaire_token}`
    : null;

  const fullName = `${profile.prenom || ''} ${profile.nom || ''}`.trim();
  const fonction = profile.fonction || 'Commercial';
  const tel = profile.telephone || '';
  const telDigits = tel.replace(/[^\d+]/g, '');
  const email = profile.email || '';

  const handleCopy = async () => {
    const sigEl = document.getElementById('signature-content');
    if (!sigEl) return;
    try {
      const range = document.createRange();
      range.selectNode(sigEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Erreur lors de la copie. Utilise Cmd+A puis Cmd+C manuellement.');
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>Aper&ccedil;u de ta signature email</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Bonjour <strong>{profile.prenom}</strong>, voici ta signature personnalis&eacute;e avec ton lien questionnaire unique.
      </p>

      {!questionnaireUrl && (
        <div style={{ padding: 16, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, marginBottom: 24, color: '#92400E', fontSize: 14 }}>
          <strong>&#9888; Pas de token questionnaire</strong> &mdash; Contacte un admin pour qu'il en g&eacute;n&egrave;re un.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 18px',
            background: copied ? '#16a34a' : '#4a5d3a',
            color: 'white',
            border: 0,
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copi\u00e9 !' : 'Copier la signature'}
        </button>
        <span style={{ fontSize: 13, color: '#666', alignSelf: 'center' }}>
          ou s&eacute;lectionne (Cmd+A), copie (Cmd+C) puis colle dans Mac Mail
        </span>
      </div>

      <hr style={{ marginBottom: 32 }} />

      <div id="signature-content">
        <table cellPadding="0" cellSpacing="0" border="0" style={{ fontFamily: 'Georgia, serif', maxWidth: 580 }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top', padding: '0 24px 0 0', width: 150 }}>
                <img src="https://patrimonia-crm.vercel.app/logo-light.png" alt="Immeubles &amp; Patrimoine" width="150" style={{ display: 'block', border: 0 }} />
              </td>
              <td style={{ verticalAlign: 'top', borderLeft: '1px solid #d6d3d1', paddingLeft: 24 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: '#1c1917', lineHeight: 1.1, marginBottom: 4 }}>
                  {fullName}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#4a5d3a', fontStyle: 'italic', marginBottom: 16 }}>
                  {fonction}
                </div>
                <table cellPadding="0" cellSpacing="0" border="0" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, color: '#57534e', lineHeight: 1.7 }}>
                  <tbody>
                    {tel && (
                      <tr>
                        <td style={{ paddingRight: 8, color: '#8a9a78', fontWeight: 'bold' }}>M</td>
                        <td><a href={`tel:${telDigits}`} style={{ color: '#292524', textDecoration: 'none' }}>{tel}</a></td>
                      </tr>
                    )}
                    {email && (
                      <tr>
                        <td style={{ paddingRight: 8, color: '#8a9a78', fontWeight: 'bold' }}>E</td>
                        <td><a href={`mailto:${email}`} style={{ color: '#292524', textDecoration: 'none' }}>{email}</a></td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ paddingRight: 8, color: '#8a9a78', fontWeight: 'bold' }}>W</td>
                      <td><a href="https://www.immeubles-patrimoine.fr" style={{ color: '#292524', textDecoration: 'none' }}>www.immeubles-patrimoine.fr</a></td>
                    </tr>
                    <tr>
                      <td style={{ paddingRight: 8, color: '#8a9a78', fontWeight: 'bold' }}>A</td>
                      <td>7 rue de Penthi&egrave;vre, 75008 Paris</td>
                    </tr>
                  </tbody>
                </table>

                {questionnaireUrl && (
                  <div style={{ marginTop: 18 }}>
                    <a href={questionnaireUrl} style={{ display: 'inline-block', backgroundColor: '#4a5d3a', color: '#ffffff', padding: '10px 18px', textDecoration: 'none', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, fontWeight: 600, borderRadius: 4 }}>
                      D&eacute;finir mon profil &rarr;
                    </a>
                    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 10, color: '#a8a29e', marginTop: 6, fontStyle: 'italic' }}>
                      3 minutes &middot; Confidentiel &middot; R&eacute;ponse sous 24h
                    </div>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 40, padding: 20, background: '#F5F5F4', borderRadius: 8, fontSize: 13, color: '#57534e' }}>
        <strong>Ton lien questionnaire :</strong>
        <div style={{ fontFamily: 'monospace', marginTop: 6, wordBreak: 'break-all', color: '#1c1917' }}>
          {questionnaireUrl || 'Non disponible'}
        </div>
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          Ce lien est <strong>permanent</strong>. Toute personne qui le remplit cr&eacute;e automatiquement une fiche client/mandat dans ton CRM.
        </p>
      </div>
    </div>
  );
}
