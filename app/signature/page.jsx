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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          if (mounted) { setError('non-connecte'); setLoading(false); }
          return;
        }
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, prenom, nom, email, telephone, fonction, questionnaire_token')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profileData) {
          if (mounted) { setError('profil-introuvable'); setLoading(false); }
          return;
        }
        if (mounted) { setProfile(profileData); setLoading(false); }
      } catch (err) {
        console.error('[signature] Erreur chargement:', err);
        if (mounted) { setError(err.message || 'Erreur inconnue'); setLoading(false); }
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

  // Style du bloc signature (largeur cible = 580px)
  const SIG_WIDTH = 620;
  const LOGO_SIZE = 240;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
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

      {/* SIGNATURE COPIABLE */}
      <div id="signature-content">
        <table cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: 'collapse', width: SIG_WIDTH }}>
          <tbody>
            {/* Ligne 1 : Logo + Infos */}
            <tr>
              <td style={{ verticalAlign: 'top', width: LOGO_SIZE, padding: 0 }}>
                <img
                  src="https://patrimonia-crm.vercel.app/logo-light.png"
                  alt="Immeubles &amp; Patrimoine"
                  width={LOGO_SIZE}
                  height={LOGO_SIZE}
                  style={{ display: 'block', border: 0, width: LOGO_SIZE, height: LOGO_SIZE, objectFit: 'contain', backgroundColor: '#f5f3ee' }}
                />
              </td>
              <td style={{ verticalAlign: 'top', borderLeft: '1px solid #d6d3d1', padding: '4px 0 0 20px', height: LOGO_SIZE }}>
                {/* BLOC 1 - Identité personnelle */}
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1c1917', lineHeight: 1.15, marginBottom: 3 }}>
                  {fullName}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#78716c', fontStyle: 'italic', marginBottom: 12 }}>
                  {fonction}
                </div>
                {tel && (
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#1c1917', lineHeight: 1.6 }}>
                    <a href={`tel:${telDigits}`} style={{ color: '#1c1917', textDecoration: 'none', fontWeight: 700 }}>{tel}</a>
                  </div>
                )}
                {email && (
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#1c1917', lineHeight: 1.6 }}>
                    <a href={`mailto:${email}`} style={{ color: '#1c1917', textDecoration: 'none' }}>{email}</a>
                  </div>
                )}

                {/* Séparateur fin */}
                <div style={{ height: 1, backgroundColor: '#e7e5e4', margin: '12px 0' }} />

                {/* BLOC 2 - Identité agence */}
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#4a5d3a', marginBottom: 3 }}>
                  Immeubles &amp; Patrimoine
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#57534e', lineHeight: 1.6 }}>
                  7 rue de Penthi&egrave;vre &middot; 75008 Paris
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#57534e', lineHeight: 1.6 }}>
                  <a href="https://www.immeubles-patrimoine.fr" style={{ color: '#57534e', textDecoration: 'none' }}>www.immeubles-patrimoine.fr</a>
                </div>
              </td>
            </tr>

            {/* Bandeau off-market — pleine largeur, discret avec trait fin */}
            {questionnaireUrl && (
              <tr>
                <td colSpan={2} style={{ paddingTop: 0 }}>
                  
                    href={questionnaireUrl}
                    style={{
                      display: 'block',
                      borderTop: '1px solid #e7e5e4',
                      marginTop: 16,
                      paddingTop: 14,
                      textDecoration: 'none',
                      fontFamily: 'Georgia, serif',
                      width: SIG_WIDTH,
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: '#1c1917', marginBottom: 4, lineHeight: 1.4 }}>
                      Rejoignez notre r&eacute;seau d&rsquo;investisseurs et acc&eacute;dez &agrave; nos biens confidentiels
                    </div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#4a5d3a', textDecoration: 'underline', marginBottom: 5 }}>
                      80% de nos biens sont off-market, les d&eacute;couvrir ici &rarr;
                    </div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#a8a29e', fontStyle: 'italic' }}>
                      Questionnaire confidentiel &middot; 3 minutes
                    </div>
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
