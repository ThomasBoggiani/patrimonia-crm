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
  const SIG_WIDTH = 500;
  const LOGO_SIZE = 150;
  
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
            {/* En-tête : titre Immeubles & Patrimoine pleine largeur */}
            <tr>
              <td colSpan={2} style={{ padding: '0 0 12px 0', borderBottom: '1px solid #e7e5e4' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: '#4a5d3a', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                  Immeubles &amp; Patrimoine
                </div>
              </td>
            </tr>

            {/* Ligne 1 : Logo + Infos */}
            <tr>
              <td style={{ verticalAlign: 'top', width: LOGO_SIZE, padding: '14px 0 0 0' }}>
                <img
                  src="https://patrimonia-crm.vercel.app/logo-light.png"
                  alt="Immeubles &amp; Patrimoine"
                  width={LOGO_SIZE}
                  height={LOGO_SIZE}
                  style={{ display: 'block', border: 0, width: LOGO_SIZE, height: LOGO_SIZE, objectFit: 'contain' }}
                />
              </td>
              <td style={{ verticalAlign: 'top', padding: '14px 0 0 22px' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1c1917', lineHeight: 1.1, marginBottom: 4 }}>
                  {fullName}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#78716c', fontStyle: 'italic', marginBottom: 12 }}>
                  {fonction}
                </div>
                {tel && (
                  <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, color: '#1c1917', lineHeight: 1.7 }}>
                    <a href={`tel:${telDigits}`} style={{ color: '#1c1917', textDecoration: 'none', fontWeight: 600 }}>{tel}</a>
                  </div>
                )}
                {email && (
                  <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 12, color: '#1c1917', lineHeight: 1.7 }}>
                    <a href={`mailto:${email}`} style={{ color: '#1c1917', textDecoration: 'none' }}>{email}</a>
                  </div>
                )}
                <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: '#78716c', lineHeight: 1.7, marginTop: 6 }}>
                  7 rue de Penthi&egrave;vre &middot; 75008 Paris
                </div>
                <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: '#78716c', lineHeight: 1.7 }}>
                  <a href="https://www.immeubles-patrimoine.fr" style={{ color: '#78716c', textDecoration: 'none' }}>www.immeubles-patrimoine.fr</a>
                </div>
              </td>
            </tr>

            {/* Bandeau off-market */}
            {questionnaireUrl && (
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  <div style={{ height: 16 }}></div>
                  
                    href={questionnaireUrl}
                    style={{
                      display: 'block',
                      backgroundColor: '#f5f3ee',
                      borderLeft: '3px solid #4a5d3a',
                      padding: '13px 16px',
                      textDecoration: 'none',
                      width: SIG_WIDTH,
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, color: '#1c1917', marginBottom: 4 }}>
                      Investisseurs : acc&eacute;dez ici &agrave; nos biens off-market.
                    </div>
                    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, color: '#a8a29e', fontStyle: 'italic' }}>
                      Questionnaire confidentiel &middot; 3 minutes
                    </div>
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>

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
