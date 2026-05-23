// ═══════════════════════════════════════════════════════════════════
// components/MandatStatsInline.jsx — v2
// 2 sections sur la fiche mandat :
//  1. Stats commerciales (clients potentiels, rapprochements, offres)
//  2. Stats de diffusion (visites, appels, vues, emails, envois plaquettes)
// Sources : table interactions (par mandat_id) + table deals + matching clients
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, Mail, Phone, Eye, Send, Users, Heart,
  TrendingUp, Target, Award, Camera, Megaphone
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MandatStatsInline({ mandat, deals = [], clients = [] }) {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mandat?.id) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('interactions')
      .select('id, type, date, client_id, resume, metadata')
      .eq('mandat_id', mandat.id)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[MandatStatsInline] Erreur load interactions:', error.message);
          setInteractions([]);
        } else {
          setInteractions(data || []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mandat?.id]);

  // ─── Filtre deals pour ce mandat ───
  const mandatDeals = (deals || []).filter(d => d.mandatId === mandat?.id || d.mandat_id === mandat?.id);

  // ─── Stats commerciales ───
  // Clients potentiels (matching budget) - cf MandatDetail
  const prix = parseFloat(mandat?.prix);
  const nbClientsPotentiels = (clients || []).filter(c => {
    if (!prix) return false;
    const minOk = prix >= parseFloat(c.budgetMin || c.budget_min || 0);
    const maxOk = prix <= parseFloat(c.budgetMax || c.budget_max || Infinity);
    return minOk && maxOk;
  }).length;

  const nbRapprochements = mandatDeals.length;
  const nbOffres = mandatDeals.filter(d => d.statut === 'Offre' || d.statut === 'Promesse' || d.statut === 'Gagné').length;

  // ─── Stats de diffusion ───
  const emailsSortants = interactions.filter(i => i.type === 'email_sortant');
  const emailsEntrants = interactions.filter(i => i.type === 'email_entrant');
  const appels = interactions.filter(i => i.type === 'appel');
  const envoisPlaquette = emailsSortants.filter(i => {
    const resume = (i.resume || '').toLowerCase();
    const meta = i.metadata ? JSON.stringify(i.metadata).toLowerCase() : '';
    return resume.includes('plaquette') || meta.includes('plaquette') || resume.includes('présentation');
  });
  const nbEnvoisPlaquette = envoisPlaquette.length;
  const nbAppels = appels.length;
  const nbEmailsTotal = emailsSortants.length + emailsEntrants.length;
  const nbVisites = mandatDeals.filter(d => d.statut === 'Visite').length;

  // Vues plateformes — placeholder (à remplir via API OTA plus tard)
  const diffusionPlateformes = mandat?.diffusionPlateformes || mandat?.diffusion_plateformes || [];
  const nbVuesTotal = Array.isArray(diffusionPlateformes)
    ? diffusionPlateformes.reduce((sum, p) => sum + (parseInt(p?.vues || 0) || 0), 0)
    : 0;

  // Date dernière activité
  const derniereActivite = interactions[0]?.date || null;

  return (
    <div id="stats" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sage-dark" />
          Statistiques d'activité
        </h2>
        {derniereActivite && (
          <span className="text-xs text-stone-500">
            Dernière activité : {new Date(derniereActivite).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-stone-500 py-4">Chargement…</div>
      ) : (
        <>
          {/* ─── Section commerciale ─── */}
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-wider text-sage-dark font-semibold mb-2 flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              Commercial
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Clients potentiels"
                value={nbClientsPotentiels}
                hint="Matching budget"
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Rapprochements"
                value={nbRapprochements}
                hint="Deals en cours"
              />
              <StatCard
                icon={<Award className="w-4 h-4" />}
                label="Offres"
                value={nbOffres}
                highlight={nbOffres > 0}
              />
            </div>
          </div>

          {/* ─── Section diffusion / mandant ─── */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-sage-dark font-semibold mb-2 flex items-center gap-1.5">
              <Megaphone className="w-3 h-3" />
              Diffusion & efforts commerciaux
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                icon={<Eye className="w-4 h-4" />}
                label="Visites"
                value={nbVisites}
                hint="Clients + techniques"
              />
              <StatCard
                icon={<Phone className="w-4 h-4" />}
                label="Appels"
                value={nbAppels}
              />
              <StatCard
                icon={<Camera className="w-4 h-4" />}
                label="Vues annonces"
                value={nbVuesTotal}
                hint="Plateformes"
              />
              <StatCard
                icon={<Mail className="w-4 h-4" />}
                label="Emails"
                value={nbEmailsTotal}
                hint={`${emailsSortants.length} env. · ${emailsEntrants.length} reç.`}
              />
              <StatCard
                icon={<Send className="w-4 h-4" />}
                label="Envois plaquette"
                value={nbEnvoisPlaquette}
              />
            </div>
          </div>

          {interactions.length === 0 && mandatDeals.length === 0 && (
            <p className="text-xs text-stone-400 italic mt-4">
              Aucune activité enregistrée pour ce mandat.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint, highlight = false }) {
  return (
    <div
      className={`flex flex-col gap-0.5 p-3 rounded-lg border ${
        highlight
          ? 'border-sage-light bg-sage-50'
          : 'border-cream-dark bg-cream-50'
      }`}
    >
      <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase tracking-wide font-semibold">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-2xl font-display font-semibold ${highlight ? 'text-sage-darker' : 'text-stone-900'}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-stone-400 leading-tight">{hint}</div>
      )}
    </div>
  );
}
