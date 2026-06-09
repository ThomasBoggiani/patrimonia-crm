'use client';

import { useMemo } from 'react';
import { Sparkles, ExternalLink, User, MapPin } from 'lucide-react';
import { matchClientsForMandat } from '@/lib/matching';

// ─────────────────────────────────────────────────────────
// MandatMatches — clients compatibles avec un mandat
// Inverse de ClientMatches. Version simple (liste + score + voir).
// ─────────────────────────────────────────────────────────
export default function MandatMatches({ mandat, clients, onOpenClient }) {
  const matches = useMemo(() => {
    return matchClientsForMandat(mandat, clients || []);
  }, [mandat, clients]);

  if (!matches.length) {
    return (
      <div className="text-sm text-stone-500 italic py-4 text-center">
        Aucun client actif ne correspond aux critères de ce bien pour le moment.
      </div>
    );
  }

  return (
    <div className="divide-y divide-cream-dark">
      {matches.map(({ client, score, aQualifier }) => (
        <MatchRow
          key={client.id}
          client={client}
          score={score}
          aQualifier={aQualifier}
          onOpen={() => onOpenClient?.(client.id)}
        />
      ))}
    </div>
  );
}

function MatchRow({ client, score, aQualifier, onOpen }) {
  const nom = [client.prenom, client.nom].filter(Boolean).join(' ') || client.societe || '(anonyme)';
  const budget = (client.budgetMin || client.budget_min || client.budgetMax || client.budget_max)
    ? `${formatM(client.budgetMin || client.budget_min)} → ${formatM(client.budgetMax || client.budget_max)}`
    : null;
  const zones = (client.zones || []).slice(0, 2).join(', ');

  const scoreColor = score >= 85 ? 'bg-emerald-100 text-emerald-700'
    : score >= 65 ? 'bg-sage-100 text-sage-darker'
    : 'bg-stone-100 text-stone-600';

  return (
    <div className="p-3 hover:bg-cream-50 transition flex items-center gap-3 flex-wrap">
      <div className={`flex-shrink-0 px-2 py-1 rounded-md text-xs font-bold w-12 text-center ${scoreColor}`}>
        {score}%
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm text-stone-900 truncate flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-stone-400" />{nom}
          </span>
          {client.societe && [client.prenom, client.nom].filter(Boolean).length > 0 && (
            <span className="text-xs text-stone-500">· {client.societe}</span>
          )}
          {client.typologie && <span className="text-xs text-stone-500">· {client.typologie}</span>}
          {budget && <span className="text-xs font-medium text-stone-700">· {budget}</span>}
          {zones && (
            <span className="text-xs text-stone-500 flex items-center gap-0.5">
              · <MapPin className="w-3 h-3" /> {zones}
            </span>
          )}
          {aQualifier && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">à qualifier</span>
          )}
        </div>
      </div>

      <button
        onClick={onOpen}
        className="text-xs px-2.5 py-1 bg-white border border-stone-200 text-stone-700 rounded-md hover:bg-stone-50 flex items-center gap-1 flex-shrink-0"
        title="Voir la fiche client"
      >
        <ExternalLink className="w-3 h-3" /> Voir
      </button>
    </div>
  );
}

function formatM(v) {
  const n = parseFloat(v);
  if (!n || isNaN(n)) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M€`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k€`;
  return `${n} €`;
}
