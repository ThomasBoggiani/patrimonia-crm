// ═══════════════════════════════════════════════════════════════════
// components/ReferencesImportModal.jsx
// Import en masse de références depuis un fichier Excel (.xlsx)
// ═══════════════════════════════════════════════════════════════════

'use client';
import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, Check, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { 
  TYPOLOGIES_REFERENCE, 
  TRANCHES_PRIX_REFERENCE, 
  getTrancheFromPrix 
} from '@/lib/references-constants';

export default function ReferencesImportModal({ onClose, onImported }) {
  const { user } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null); // {rows, errors}
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  // Template Excel téléchargeable
  function downloadTemplate() {
    const headers = [
      'nom', 'adresse', 'ville', 'arrondissement',
      'typologies (séparer par ;)', 'surface_m2', 'nb_lots',
      'prix_vente', 'date_vente (YYYY-MM-DD)', 'duree_commercialisation_semaines',
      'type_acquereur', 'commentaire_commercial', 'confidentiel (oui/non)'
    ];
    const exampleRows = [
      [
        'Immeuble mixte – Aubervilliers',
        '12 rue Henri Barbusse, Aubervilliers',
        'Aubervilliers',
        '93300',
        'mixte;tertiaire',
        1553,
        12,
        4800000,
        '2024-03-15',
        6,
        'Family office',
        'Vente en bloc à un family office français en 6 semaines, prix au-dessus du marché.',
        'non'
      ],
      [
        'Immeuble d\'habitation – 18e arrdt',
        '45 rue Caulaincourt, 75018 Paris',
        'Paris',
        '75018',
        'habitation',
        485,
        8,
        2900000,
        '2024-06-20',
        4,
        'Investisseur privé',
        'Vente entièrement louée à un investisseur patrimonial, prix conforme au marché.',
        'non'
      ],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    // Largeur des colonnes
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length, 18) }));
    
    // Feuille de référence : valeurs valides
    const refSheet = XLSX.utils.aoa_to_sheet([
      ['VALEURS VALIDES'],
      [''],
      ['Typologies disponibles (utiliser ces valeurs exactes, séparées par ;)'],
      ...TYPOLOGIES_REFERENCE.map(t => [t.value, t.label]),
      [''],
      ['Tranches de prix (déduites automatiquement du prix de vente)'],
      ...TRANCHES_PRIX_REFERENCE.map(t => [t.value, t.label]),
    ]);
    refSheet['!cols'] = [{ wch: 25 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Références');
    XLSX.utils.book_append_sheet(wb, refSheet, 'Aide');
    XLSX.writeFile(wb, 'template_references_ventes.xlsx');
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResult(null);
    setParsed(null);
    
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames[0];
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      
      const validTypologies = TYPOLOGIES_REFERENCE.map(t => t.value);
      const rows = [];
      const errors = [];
      
      raw.forEach((row, idx) => {
        const lineNum = idx + 2; // +2 car ligne 1 = headers, idx 0-based
        
        // Récupérer la valeur quelle que soit la casse/variation
        const get = (keys) => {
          for (const k of keys) {
            for (const rk of Object.keys(row)) {
              if (rk.toLowerCase().includes(k.toLowerCase())) return row[rk];
            }
          }
          return '';
        };
        
        const nom = String(get(['nom']) || '').trim();
        if (!nom) {
          errors.push({ line: lineNum, error: 'Nom manquant' });
          return;
        }
        
        const prixVente = parseFloat(get(['prix_vente', 'prix vente'])) || 0;
        if (!prixVente) {
          errors.push({ line: lineNum, error: `"${nom}" : Prix de vente manquant ou invalide` });
          return;
        }
        
        const typoStr = String(get(['typologies']) || '').trim();
        const typologies = typoStr.split(/[;,|]/).map(s => s.trim().toLowerCase()).filter(t => validTypologies.includes(t));
        if (typologies.length === 0) {
          errors.push({ line: lineNum, error: `"${nom}" : Aucune typologie valide (valeurs : ${validTypologies.join(', ')})` });
          return;
        }
        
        const dateVenteRaw = get(['date_vente', 'date vente']);
        let dateVente = null;
        if (dateVenteRaw) {
          if (dateVenteRaw instanceof Date) {
            dateVente = dateVenteRaw.toISOString().split('T')[0];
          } else {
            const d = new Date(String(dateVenteRaw));
            if (!isNaN(d)) dateVente = d.toISOString().split('T')[0];
          }
        }
        
        const conf = String(get(['confidentiel'])).toLowerCase().trim();
        const confidentiel = ['oui', 'yes', 'true', '1', 'x'].includes(conf);
        
        rows.push({
          nom,
          adresse: String(get(['adresse']) || '').trim() || null,
          ville: String(get(['ville']) || '').trim() || null,
          arrondissement: String(get(['arrondissement', 'code_postal'])).trim() || null,
          typologies,
          surface: parseFloat(get(['surface'])) || null,
          nb_lots: parseInt(get(['nb_lots', 'nb lots'])) || null,
          prix_vente: prixVente,
          tranche_prix: getTrancheFromPrix(prixVente),
          date_vente: dateVente,
          duree_commercialisation_semaines: parseInt(get(['duree_commercialisation', 'semaines'])) || null,
          type_acquereur: String(get(['type_acquereur', 'acquereur'])).trim() || null,
          commentaire_commercial: String(get(['commentaire_commercial', 'commentaire'])).trim() || null,
          confidentiel,
          medias: [],
        });
      });
      
      setParsed({ rows, errors });
    } catch (e) {
      alert('Erreur lecture fichier : ' + e.message);
    }
    setParsing(false);
  }

  async function handleImport() {
    if (!parsed?.rows?.length) return;
    setImporting(true);
    let success = 0, failed = 0;
    
    for (const row of parsed.rows) {
      try {
        const { error } = await supabase
          .from('references_ventes')
          .insert({ ...row, created_by: user?.id });
        if (error) {
          console.warn('Erreur insert:', row.nom, error.message);
          failed++;
        } else {
          success++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    setResult({ success, failed, total: parsed.rows.length });
    setImporting(false);
    if (success > 0) {
      setTimeout(() => onImported?.(), 2000);
    }
  }

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="font-display text-xl font-semibold text-stone-900">Importer des références</h2>
            <p className="text-xs text-stone-500 mt-0.5">Format Excel (.xlsx)</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {!parsed && !result && (
            <>
              {/* Étape 1 : télécharger le template */}
              <div className="bg-sage-50 rounded-xl p-4 border border-sage-light">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-sage-dark flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-stone-900 mb-1">Étape 1 — Télécharger le template</h3>
                    <p className="text-xs text-stone-600 mb-3">Le fichier contient les colonnes attendues et 2 lignes d'exemple. Une 2ᵉ feuille "Aide" liste les valeurs valides.</p>
                    <button 
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-dark text-white rounded-lg text-xs hover:bg-sage-darker"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger template_references.xlsx
                    </button>
                  </div>
                </div>
              </div>

              {/* Étape 2 : uploader */}
              <div className="bg-cream-50 rounded-xl p-4 border border-cream-dark">
                <div className="flex items-start gap-3">
                  <Upload className="w-5 h-5 text-stone-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-stone-900 mb-1">Étape 2 — Importer ton fichier rempli</h3>
                    <p className="text-xs text-stone-600 mb-3">Une fois ton fichier prêt, importe-le ici. Les lignes seront validées avant insertion.</p>
                    <input 
                      ref={fileRef} 
                      type="file" 
                      accept=".xlsx,.xls" 
                      onChange={handleFile} 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileRef.current?.click()}
                      disabled={parsing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-deep text-white rounded-lg text-xs hover:bg-stone-800 disabled:opacity-50"
                    >
                      {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {parsing ? 'Analyse en cours...' : 'Choisir un fichier Excel'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-900">
                💡 <strong>Important :</strong> les photos doivent être ajoutées manuellement après l'import (édition de chaque référence).
              </div>
            </>
          )}

          {parsed && !result && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-medium text-emerald-900">{parsed.rows.length} référence(s) prête(s) à importer</h3>
                </div>
                {parsed.errors.length > 0 && (
                  <p className="text-xs text-emerald-700">+ {parsed.errors.length} ligne(s) ignorée(s) (voir ci-dessous)</p>
                )}
              </div>

              {parsed.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200 max-h-40 overflow-y-auto">
                  <h4 className="text-xs font-medium text-red-900 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {parsed.errors.length} erreur(s) :
                  </h4>
                  <ul className="text-xs text-red-800 space-y-1">
                    {parsed.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>Ligne {e.line} : {e.error}</li>
                    ))}
                    {parsed.errors.length > 10 && <li>... et {parsed.errors.length - 10} autre(s)</li>}
                  </ul>
                </div>
              )}

              <div className="max-h-60 overflow-y-auto bg-stone-50 rounded-xl p-3 text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="text-stone-600">
                      <th className="text-left pb-1">Nom</th>
                      <th className="text-left pb-1">Typologies</th>
                      <th className="text-right pb-1">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-stone-200">
                        <td className="py-1 text-stone-800 truncate max-w-xs">{r.nom}</td>
                        <td className="py-1 text-stone-600">{r.typologies.join(', ')}</td>
                        <td className="py-1 text-right text-stone-800">{(r.prix_vente || 0).toLocaleString('fr-FR')} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 20 && <p className="text-stone-400 mt-2">... et {parsed.rows.length - 20} autre(s)</p>}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setParsed(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="flex-1 px-4 py-2 text-sm text-stone-700 bg-white border border-stone-200 hover:bg-cream-100 rounded-lg"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleImport}
                  disabled={importing || parsed.rows.length === 0}
                  className="flex-1 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {importing ? 'Import en cours…' : `Importer ${parsed.rows.length} référence(s)`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200 text-center">
              <Check className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-base font-medium text-emerald-900 mb-1">Import terminé</h3>
              <p className="text-sm text-emerald-700">
                {result.success} référence(s) ajoutée(s)
                {result.failed > 0 && ` · ${result.failed} échec(s)`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
