'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Handshake, CheckSquare, Megaphone, FileQuestion, 
  Mail, Plus, Search, Calendar, Phone, MessageSquare, 
  MapPin, FileText, Trash2, Edit2, X, Check, 
  LayoutGrid, List, QrCode, Clock, AlertCircle,
  ChevronRight, Home, Send, Upload, Download,
  Circle, CheckCircle2, Eye, Copy, Sparkles,
  FileUp, Loader2, AlertTriangle, Info, Wand2, Mic,
  User as UserIcon, LogOut, Shield, Menu,
  Image as ImageIcon, Camera, Plug
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, isAdmin, getCurrentUserName, getCurrentUserInitials } from '@/lib/auth';
import VoiceNoteModal from './VoiceNoteModal';
import MandatAIAssistant from './MandatAIAssistant';
import SmartImportModal from './SmartImportModal';
import GlobalVoiceModal from './GlobalVoiceModal';
import AgendaTab from './AgendaTab';
import TeamTab from './TeamTab';
import NotificationBell from './NotificationBell';
import PhotoUploader from './PhotoUploader';
import IntegrationsTab from './IntegrationsTab';
import ClientEmails from './ClientEmails';
import ContactsImportModal from './ContactsImportModal';
import PdfExportButtons from '@/components/PdfExportButtons';
import { PhotosModal, VisiteModal, MandantModal } from './MandatModals';
// ═══ HELPERS PRIX ═══
const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function formatPrix(n) {
  const num = parseFloat(n);
  if (!Number.isFinite(num) || num === 0) return '—';
  return eurFormatter.format(num);
}

function formatPrixCompact(n) {
  const num = parseFloat(n);
  if (!Number.isFinite(num) || num === 0) return '—';
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace('.', ',') + ' M€';
  }
  if (num >= 1_000) {
    return Math.round(num / 1_000) + ' k€';
  }
  return eurFormatter.format(num);
}
// === CONSTANTES ===
const STATUTS_MANDAT = ['Sourcing', 'Analyse', 'Mandat signé', 'Commercialisation', 'Offre', 'Promesse', 'Acte', 'Perdu'];
const STATUTS_DEAL = ['À proposer', 'Envoyé', 'En étude', 'Visite', 'Offre', 'Refusé', 'Gagné', 'Perdu'];
const TYPES_ACTIF = ['Immeuble d\'habitation', 'Immeuble mixte', 'Immeuble tertiaire', 'Local commercial', 'Local d\'activité', 'Hôtel', 'Hébergement hôtelier', 'Appartement', 'Maison', 'Studio', 'Terrain', 'Bureau', 'Promotion immobilière'];
const TYPOLOGIES_CLIENT = ['Foncières', 'Marchands de biens', 'Particuliers', 'Fonds', 'Promoteurs', 'Family Office'];
const ZONES = ['Paris 3e', 'Paris 4e', 'Paris 8e', 'Paris 9e', 'Paris 10e', 'Paris 11e', 'Paris 13e', 'Paris 15e', 'Paris 16e', 'Paris 17e', 'Paris 18e', 'Paris 19e', 'Paris 20e', 'Hauts-de-Seine (92)', 'Seine-Saint-Denis (93)', 'Val-de-Marne (94)', 'Val-d\'Oise (95)', 'Yvelines (78)', 'Seine-et-Marne (77)', 'Essonne (91)', 'Province'];
const PORTAILS = ['seloger', 'leboncoin', 'bienici', 'figaro'];
const STATUTS_PORTAIL = ['En ligne', 'En attente', 'À corriger', 'Non diffusé'];

// Conversion snake_case ↔ camelCase pour Supabase
const toCamel = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  const result = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
};

const toSnake = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  const result = {};
  for (const key in obj) {
    if (key === 'id') { result.id = obj.id; continue; }
    const snakeKey = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
};

// === COMPOSANT PRINCIPAL ===
export default function CRM() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [showGlobalVoice, setShowGlobalVoice] = useState(false);
  const [importToast, setImportToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Détection responsive avec écouteur de redimensionnement
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const [mandats, setMandats] = useState([]);
  const [clients, setClients] = useState([]);
  const [deals, setDeals] = useState([]);
  const [todos, setTodos] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [campagnes, setCampagnes] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [interactions, setInteractions] = useState([]);

  // Chargement initial depuis Supabase
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [m, c, d, t, a, cp, q, i] = await Promise.all([
        supabase.from('mandats').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('deals').select('*'),
        supabase.from('todos').select('*'),
        supabase.from('annonces').select('*'),
        supabase.from('campagnes').select('*'),
        supabase.from('questionnaires').select('*'),
        supabase.from('interactions').select('*').order('date', { ascending: false }),
      ]);
      setMandats((m.data || []).map(toCamel));
      setClients((c.data || []).map(toCamel));
      setDeals((d.data || []).map(toCamel));
      setTodos((t.data || []).map(toCamel));
      setAnnonces((a.data || []).map(toCamel));
      setCampagnes((cp.data || []).map(toCamel));
      setQuestionnaires((q.data || []).map(toCamel));
      setInteractions((i.data || []).map(toCamel));
    } catch (err) {
      console.error('Erreur chargement:', err);
    }
    setLoading(false);
  }

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'mandats', label: 'Mandats', icon: Building2 },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'deals', label: 'Deals', icon: Handshake },
    { id: 'matching', label: 'Matching auto', icon: Sparkles },
    { id: 'todos', label: 'To-do perso', icon: CheckSquare },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'annonces', label: 'Annonces', icon: Megaphone },
    { id: 'questionnaires', label: 'Questionnaires', icon: FileQuestion },
    { id: 'emailings', label: 'Emailings & Sourcing', icon: Mail },
    { id: 'integrations', label: 'Intégrations', icon: Plug },
    ...(isAdmin(profile) ? [{ id: 'team', label: 'Équipe', icon: Users, admin: true }] : [])
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-sage-dark mx-auto mb-3" />
          <div className="text-stone-600 text-sm">Chargement…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* HEADER MOBILE - visible uniquement sur mobile */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-cream-dark z-30 flex items-center justify-between px-3">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-cream-100"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5 text-ink" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo-light.png" alt="I&P" className="w-8 h-8" />
          <span className="font-display text-sm font-semibold text-ink">Immeubles & Patrimoine</span>
        </div>
        {isMobileView && <NotificationBell />}
      </header>

      {/* OVERLAY MOBILE - quand sidebar ouverte */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-ink/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-screen overflow-hidden pt-14 md:pt-0">
        <aside className={`
          fixed md:relative top-0 left-0 h-full
          w-72 md:w-64 bg-white border-r border-cream-dark text-ink flex flex-col flex-shrink-0
          z-50 md:z-auto
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Bouton fermer sur mobile */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute top-3 right-3 p-2 rounded-lg hover:bg-cream-100 z-10"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5 text-ink" />
          </button>
         <div className="px-4 py-5 border-b border-cream-dark bg-gradient-to-b from-cream-50 to-white">
            <div className="flex items-center justify-center">
              <img 
                src="/logo-light.png" 
                alt="Immeubles & Patrimoine" 
                className="w-12 h-12"
              />
            </div>
          </div>
          <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
            {/* Bouton Import intelligent - accessible partout */}
            <button 
              onClick={() => { setShowSmartImport(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mb-2 gradient-sage-dark text-white hover:opacity-90 shadow-luxe font-medium"
            >
              <Sparkles className="w-4 h-4" />
              <span>Import intelligent</span>
            </button>
            {/* Bouton Note vocale globale */}
            <button 
              onClick={() => { setShowGlobalVoice(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mb-3 bg-white border border-sage text-sage-dark hover:bg-sage-50 font-medium"
            >
              <Mic className="w-4 h-4" />
              <span>Note vocale</span>
            </button>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${
                    active 
                      ? 'bg-sage-50 text-sage-darker font-medium border border-sage-light' 
                      : 'text-ink/70 hover:bg-cream-100 hover:text-ink'
                  }`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-sage-dark' : ''}`} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-sage" />}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-cream-dark">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full gradient-sage-dark flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                  {getCurrentUserInitials(profile)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{getCurrentUserName(profile)}</div>
                  <div className="text-[10px] text-sage-dark truncate">{profile?.fonction || profile?.role || 'Utilisateur'}</div>
                </div>
                {!isMobileView && <NotificationBell />}
              </div>
              <button onClick={signOut} className="w-full text-[11px] text-ink/60 hover:text-ink py-1 rounded hover:bg-cream-100">
                Se déconnecter
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="fade-in" key={activeTab}>
            {activeTab === 'dashboard' && <Dashboard mandats={mandats} clients={clients} deals={deals} todos={todos} />}
            {activeTab === 'mandats' && <MandatsTab mandats={mandats} reload={loadAll} clients={clients} deals={deals} interactions={interactions} todos={todos} annonces={annonces} />}
            {activeTab === 'clients' && <ClientsTab clients={clients} reload={loadAll} mandats={mandats} deals={deals} interactions={interactions} />}
            {activeTab === 'deals' && <DealsTab deals={deals} reload={loadAll} mandats={mandats} clients={clients} />}
            {activeTab === 'matching' && <MatchingTab mandats={mandats} clients={clients} deals={deals} reload={loadAll} />}
            {activeTab === 'todos' && <TodosTab todos={todos} reload={loadAll} mandats={mandats} clients={clients} deals={deals} />}
            {activeTab === 'agenda' && <AgendaTab />}
            {activeTab === 'integrations' && <IntegrationsTab />}
            {activeTab === 'team' && <TeamTab />}
            {activeTab === 'annonces' && <AnnoncesTab annonces={annonces} reload={loadAll} mandats={mandats} />}
            {activeTab === 'questionnaires' && <QuestionnairesTab questionnaires={questionnaires} reload={loadAll} />}
            {activeTab === 'emailings' && <EmailingsTab campagnes={campagnes} reload={loadAll} clients={clients} />}
          </div>
        </main>
      </div>

      {/* BOUTON FLOTTANT MOBILE : Note vocale rapide */}
      <button
        onClick={() => setShowGlobalVoice(true)}
        className="md:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full gradient-sage-dark text-white shadow-luxe-hover flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform"
        aria-label="Note vocale rapide"
      >
        <Mic className="w-6 h-6" />
      </button>

      {/* Toast de succès après import intelligent */}
      {importToast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-sage-light rounded-xl shadow-luxe-hover p-4 max-w-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-sage-dark" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">Import réussi</div>
              <div className="text-xs text-sage-dark mt-0.5">{importToast}</div>
            </div>
            <button onClick={() => setImportToast(null)} className="text-stone-400 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Import intelligent */}
      {showSmartImport && (
        <SmartImportModal
          mandats={mandats}
          clients={clients}
          onClose={() => setShowSmartImport(false)}
          onSuccess={({ mandatId, clientId, tasksCreated }) => {
            setShowSmartImport(false);
            const parts = [];
            if (mandatId) parts.push('1 mandat');
            if (clientId) parts.push('1 client');
            if (tasksCreated > 0) parts.push(`${tasksCreated} tâche${tasksCreated > 1 ? 's' : ''}`);
            setImportToast(parts.length > 0 ? parts.join(' · ') + ' enregistré' + (parts.length > 1 || tasksCreated > 1 ? 's' : '') : 'Import terminé');
            loadAll();
            setTimeout(() => setImportToast(null), 5000);
          }}
        />
      )}

      {/* Modal Note vocale globale */}
      {showGlobalVoice && (
        <GlobalVoiceModal
          mandats={mandats}
          clients={clients}
          onClose={() => setShowGlobalVoice(false)}
          onSuccess={(mode, counts) => {
            setShowGlobalVoice(false);
            let msg = '';
            if (mode === 'taches') msg = `${counts.tachesCount} tâche${counts.tachesCount > 1 ? 's' : ''} créée${counts.tachesCount > 1 ? 's' : ''}`;
            else if (mode === 'reunion_recurrente') msg = 'Réunion récurrente ajoutée à l\'agenda';
            else if (mode === 'compte_rendu') msg = `Compte-rendu enregistré${counts.actionsCount ? ` avec ${counts.actionsCount} action${counts.actionsCount > 1 ? 's' : ''}` : ''}`;
            else msg = 'Note enregistrée';
            setImportToast(msg);
            loadAll();
            setTimeout(() => setImportToast(null), 5000);
          }}
        />
      )}
    </div>
  );
}

// === DASHBOARD ===
function Dashboard({ mandats, clients, deals, todos }) {
  const stats = {
    mandatsActifs: mandats.filter(m => !['Perdu', 'Acte'].includes(m.statut)).length,
    clientsActifs: clients.filter(c => c.statut === 'Actif').length,
    dealsEnCours: deals.filter(d => !['Perdu', 'Gagné', 'Refusé'].includes(d.statut)).length,
    tachesUrgentes: todos.filter(t => t.statut !== 'Terminé' && t.priorite === 'Haute').length,
    caTotal: mandats.filter(m => m.statut !== 'Perdu').reduce((s, m) => s + (parseFloat(m.prix) || 0), 0),
    exclusifs: mandats.filter(m => m.commercialisation === 'Mandat exclusif').length,
    simples: mandats.filter(m => m.commercialisation === 'Mandat simple').length,
    offmarket: mandats.filter(m => m.commercialisation === 'Off-market').length
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Tableau de bord</h1>
        <p className="text-stone-500">Vue d'ensemble de votre activité patrimoniale</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Mandats actifs" value={stats.mandatsActifs} icon={Building2} color="amber" />
        <StatCard label="Clients actifs" value={stats.clientsActifs} icon={Users} color="stone" />
        <StatCard label="Deals en cours" value={stats.dealsEnCours} icon={Handshake} color="emerald" />
        <StatCard label="Tâches urgentes" value={stats.tachesUrgentes} icon={AlertCircle} color="red" />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Portefeuille sous mandat</h2>
          <div className="text-4xl font-display font-semibold text-stone-900 mb-1">
            {formatPrixCompact(stats.caTotal)}
          </div>
          <p className="text-sm text-stone-500 mb-6">Valeur totale des biens en commercialisation</p>
          <div className="space-y-3">
            <CommRow label="Mandats exclusifs" value={stats.exclusifs} color="bg-emerald-500" />
            <CommRow label="Mandats simples" value={stats.simples} color="bg-blue-500" />
            <CommRow label="Off-market" value={stats.offmarket} color="bg-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Pipeline deals</h2>
          <div className="space-y-2.5">
            {STATUTS_DEAL.slice(0, 6).map(s => {
              const count = deals.filter(d => d.statut === s).length;
              const pct = deals.length ? (count / deals.length) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-stone-700">{s}</span>
                    <span className="font-medium text-stone-900">{count}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full gradient-gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Tâches prioritaires</h2>
        <div className="space-y-2">
          {todos.filter(t => t.statut !== 'Terminé').slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-cream-50">
              <div className={`w-2 h-2 rounded-full ${
                t.priorite === 'Haute' ? 'bg-red-500' : t.priorite === 'Moyenne' ? 'bg-amber-500' : 'bg-stone-300'
              }`} />
              <span className="flex-1 text-sm text-stone-700">{t.titre}</span>
              <span className="text-xs text-stone-500">{t.echeance}</span>
            </div>
          ))}
          {todos.filter(t => t.statut !== 'Terminé').length === 0 && (
            <p className="text-sm text-stone-500 italic">Aucune tâche en cours</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    amber: 'bg-sage-50 text-sage-dark border-sage-light',
    stone: 'bg-stone-50 text-stone-700 border-stone-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100'
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="font-display text-3xl font-semibold text-stone-900 mb-0.5">{value}</div>
      <div className="text-sm text-stone-500">{label}</div>
    </div>
  );
}

function CommRow({ label, value, color }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="flex-1 text-sm text-stone-700">{label}</span>
      <span className="font-medium text-stone-900">{value}</span>
    </div>
  );
}

function CommerceBadge({ comm, dateSignature }) {
  const config = {
    'Off-market': { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'Off-market' },
    'Mandat exclusif': { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Exclusif' },
    'Mandat simple': { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', label: 'Simple' }
  };
  const c = config[comm] || config['Off-market'];
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
      </div>
      {dateSignature && <span className="text-[10px] text-stone-500 ml-2">Signé {new Date(dateSignature).toLocaleDateString('fr-FR')}</span>}
    </div>
  );
}

function StatutBadge({ statut }) {
  const colors = {
    'Sourcing': 'bg-cream-100 text-ink',
    'Analyse': 'bg-sage-50 text-sage-dark',
    'Mandat signé': 'bg-blue-50 text-blue-700',
    'Commercialisation': 'bg-emerald-50 text-emerald-700',
    'Offre': 'bg-purple-50 text-purple-700',
    'Promesse': 'bg-indigo-50 text-indigo-700',
    'Acte': 'bg-green-100 text-green-800',
    'Perdu': 'bg-red-50 text-red-700'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[statut] || 'bg-cream-100 text-ink'}`}>{statut}</span>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <div className="text-xs text-stone-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={highlight ? 'font-display text-xl font-semibold text-stone-900' : 'text-sm font-medium text-stone-900'}>{value}</div>
    </div>
  );
}

function DealStatutBadge({ statut }) {
  const colors = {
    'À proposer': 'bg-cream-100 text-ink',
    'Envoyé': 'bg-blue-50 text-blue-700',
    'En étude': 'bg-sage-50 text-sage-dark',
    'Visite': 'bg-indigo-50 text-indigo-700',
    'Offre': 'bg-purple-50 text-purple-700',
    'Refusé': 'bg-red-50 text-red-700',
    'Gagné': 'bg-emerald-50 text-emerald-700',
    'Perdu': 'bg-stone-100 text-stone-500'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[statut]}`}>{statut}</span>;
}

function MaturiteBadge({ maturite }) {
  const colors = {
    'Haute': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Moyen': 'bg-sage-50 text-sage-dark border-sage-light',
    'Basse': 'bg-cream-100 text-ink/80 border-stone-200'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[maturite]}`}>{maturite}</span>;
}

function TypeInteractionBadge({ type }) {
  const config = {
    'Appel': { icon: Phone, color: 'bg-blue-50 text-blue-700' },
    'Email': { icon: Mail, color: 'bg-purple-50 text-purple-700' },
    'Rendez-vous': { icon: Calendar, color: 'bg-sage-50 text-sage-dark' },
    'Visite': { icon: Eye, color: 'bg-emerald-50 text-emerald-700' },
    'Message': { icon: MessageSquare, color: 'bg-cream-100 text-ink' }
  };
  const c = config[type] || config['Message'];
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.color}`}><Icon className="w-3 h-3" />{type}</span>;
}

// === MANDATS ===
function MandatsTab({ mandats, reload, clients, deals, todos, annonces }) {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [filterComm, setFilterComm] = useState('Tous');
  const [filterType, setFilterType] = useState('Tous');
  const [editingMandat, setEditingMandat] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedMandat, setSelectedMandat] = useState(null);

  const filtered = mandats.filter(m => {
    if (search && !m.nom.toLowerCase().includes(search.toLowerCase()) && !(m.adresse || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterComm !== 'Tous' && m.commercialisation !== filterComm) return false;
    if (filterType !== 'Tous' && m.type !== filterType) return false;
    return true;
  });

  const handleSave = async (mandat, actions = []) => {
    const snakeData = toSnake(mandat);
    delete snakeData.created_at;
    delete snakeData.updated_at;
    let mandatId = mandat.id;
    if (mandat.id) {
      snakeData.updated_by = user?.id;
      await supabase.from('mandats').update(snakeData).eq('id', mandat.id);
    } else {
      delete snakeData.id;
      snakeData.created_by = user?.id;
      const { data: created } = await supabase.from('mandats').insert(snakeData).select().single();
      if (created) mandatId = created.id;
    }
    
    // Créer les tâches liées au mandat pour les actions sélectionnées
    if (actions.length > 0 && mandatId) {
      const todosToInsert = actions.map(a => {
        const echeance = new Date();
        echeance.setDate(echeance.getDate() + (a.echeanceJours || 7));
        return {
          titre: a.titre,
          priorite: a.priorite || 'Moyenne',
          statut: 'À faire',
          echeance: echeance.toISOString().split('T')[0],
          assignee: getCurrentUserName(profile),
          assigned_to_user_id: user?.id,
          created_by: user?.id,
          lien_type: 'mandat',
          lien_id: mandatId
        };
      });
      await supabase.from('todos').insert(todosToInsert);
    }
    
    setEditingMandat(null);
    setShowNew(false);
    reload();
  };

  const handleDelete = async (id) => {
    if (confirm('Supprimer ce mandat ?')) {
      await supabase.from('mandats').delete().eq('id', id);
      reload();
    }
  };

  if (selectedMandat) {
    const currentMandat = mandats.find(m => m.id === selectedMandat.id) || selectedMandat;
    return <MandatDetail mandat={currentMandat} onBack={() => setSelectedMandat(null)} onEdit={() => { setEditingMandat(currentMandat); setSelectedMandat(null); }} deals={deals} clients={clients} reload={reload} todos={todos} annonces={annonces} />;
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Mandats</h1>
          <p className="text-stone-500">{filtered.length} bien{filtered.length > 1 ? 's' : ''} • Portefeuille {formatPrixCompact(mandats.reduce((s,m)=>s+(parseFloat(m.prix)||0),0))}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouveau mandat
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un bien, une adresse..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
        </div>
        <select value={filterComm} onChange={e => setFilterComm(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option>Tous</option>
          <option>Off-market</option>
          <option>Mandat exclusif</option>
          <option>Mandat simple</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option>Tous</option>
          {TYPES_ACTIF.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-cream-dark">
            <tr>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide w-24">Photo</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Bien</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Type</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Prix</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Rdt</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Potentiel</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">État</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Situation</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mandat</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const photoUrl = (m.photos && m.photos[0]) ? (m.photos[0].url || m.photos[0]) : null;
              return (
                <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group" onClick={() => setSelectedMandat(m)}>
                  <td className="px-3 py-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-cream-100 flex-shrink-0">
                      {photoUrl ? (
                        <img src={photoUrl} alt={m.nom} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
                          <Building2 className="w-5 h-5 text-stone-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 max-w-xs">
                    <div className="font-medium text-stone-900 text-sm truncate">{m.nom}</div>
                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{m.adresse}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-stone-700">{m.type}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-stone-900 text-sm">{formatPrix(m.prix)}</div>
                    {m.prixM2 && parseFloat(m.prixM2) > 0 && (
                      <div className="text-xs text-stone-500">{parseFloat(m.prixM2).toLocaleString('fr')} €/m²</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {parseFloat(m.rendement) > 0 ? (
                      <span className="font-medium text-emerald-700 text-sm">{m.rendement}%</span>
                    ) : (
                      <span className="text-stone-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-stone-400">—</td>
                  <td className="px-3 py-3 text-sm text-stone-400">—</td>
                  <td className="px-3 py-3 text-sm text-stone-400">—</td>
                  <td className="px-3 py-3">
                    <CommerceBadge comm={m.commercialisation} dateSignature={m.dateSignature} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingMandat(m)} className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-12 text-center text-stone-500 text-sm">Aucun mandat trouvé</div>}
      </div>

      {(editingMandat || showNew) && (
        <MandatForm mandat={editingMandat} onSave={handleSave} onClose={() => { setEditingMandat(null); setShowNew(false); }} />
      )}
    </div>
  );
}

// === FORMULAIRE MANDAT avec IMPORT IA ===
function MandatForm({ mandat, onSave, onClose }) {
  const [data, setData] = useState(mandat || {
    nom: '', adresse: '', ville: '', type: "Immeuble d'habitation", sousType: '', prix: 0, prixM2: 0,
    surface: 0, loyersAnnuels: 0, rendement: 0, nbLots: 1,
    commercialisation: 'Off-market', dateSignature: null,
    statut: 'Sourcing', owner: 'JD', description: '',
    contact: '', tel: '', docs: [], alerts: [], highlights: []
  });

  const [importState, setImportState] = useState({ loading: false, error: null, result: null });
  const [importedFiles, setImportedFiles] = useState([]);
  const [filledFields, setFilledFields] = useState(new Set());
  const [selectedActions, setSelectedActions] = useState(new Set());

  const update = (k, v) => setData({ ...data, [k]: v });

  const REQUIRED_FIELDS = {
    nom: 'Nom du bien', adresse: 'Adresse', type: "Type d'actif",
    prix: 'Prix net vendeur', surface: 'Surface totale',
    loyersAnnuels: 'Loyers annuels', rendement: 'Rendement',
    nbLots: 'Nombre de lots', contact: 'Contact propriétaire'
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Compresse les images au-dessus d'une certaine taille pour rester sous la limite API
  const compressImage = (file, maxWidth = 2000, quality = 0.85) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Compression échouée'));
          const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Prépare un fichier pour envoi : compresse si image trop lourde
  const prepareFile = async (file) => {
    const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 Mo max (sécurité par rapport à la limite 4,5 Mo de Vercel)
    
    let finalFile = file;
    if (file.type.startsWith('image/') && file.size > MAX_SIZE_BYTES) {
      finalFile = await compressImage(file);
      // Si toujours trop gros, compression plus agressive
      if (finalFile.size > MAX_SIZE_BYTES) {
        finalFile = await compressImage(file, 1500, 0.7);
      }
    }
    
    return {
      name: file.name,
      type: finalFile.type,
      data: await fileToBase64(finalFile),
      originalSize: file.size,
      finalSize: finalFile.size
    };
  };

  const analyzeDocuments = async (files) => {
    setImportState({ loading: true, error: null, result: null });
    try {
      // Préparer et compresser les fichiers
      const filesData = await Promise.all(files.map(prepareFile));
      
      // Vérifier la taille totale après compression
      const totalBase64Size = filesData.reduce((sum, f) => sum + f.data.length, 0);
      const MAX_PAYLOAD = 4 * 1024 * 1024; // 4 Mo (marge sécurité sous la limite 4,5 Mo de Vercel)
      
      if (totalBase64Size > MAX_PAYLOAD) {
        const totalMB = (totalBase64Size / 1024 / 1024).toFixed(1);
        // Identifier les fichiers PDF qui sont probablement à l'origine du souci
        const bigPdfs = filesData.filter(f => f.type === 'application/pdf' && f.data.length > 1024 * 1024);
        let msg = `Le poids total des fichiers (${totalMB} Mo) dépasse la limite de 4 Mo pour l'analyse. `;
        if (bigPdfs.length > 0) {
          msg += `Le(s) PDF volumineux : ${bigPdfs.map(f => f.name).join(', ')}. `;
          msg += `Astuce : réduisez votre PDF avec un outil comme ilovepdf.com (fonction « compresser PDF ») puis réessayez.`;
        } else {
          msg += `Essayez de sélectionner moins de fichiers, ou des fichiers plus légers.`;
        }
        throw new Error(msg);
      }
      
      // Envoi seulement des champs nécessaires (pas originalSize/finalSize)
      const payload = filesData.map(({ name, type, data }) => ({ name, type, data }));

      const response = await fetch('/api/analyze-mandat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload })
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Les fichiers sont trop volumineux après compression. Essayez avec un PDF compressé (ilovepdf.com) ou des images plus petites.");
        }
        const errText = await response.text().catch(() => '');
        throw new Error(`Erreur API ${response.status}: ${errText.slice(0, 100)}`);
      }
      const parsed = await response.json();

      const newFilled = new Set();
      const newData = { ...data };
      Object.entries(parsed.fields || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          newData[key] = value;
          newFilled.add(key);
        }
      });

      if (newData.prix && newData.surface && !newData.prixM2) {
        newData.prixM2 = Math.round(newData.prix / newData.surface);
        newFilled.add('prixM2');
      }

      newData.alerts = parsed.alerts || [];
      newData.highlights = parsed.highlights || [];

      setData(newData);
      setFilledFields(newFilled);
      setImportedFiles([...importedFiles, ...files.map(f => f.name)]);
      
      // Cocher automatiquement les actions de priorité Haute et Moyenne
      const actions = parsed.actions || [];
      const autoSelected = new Set();
      actions.forEach((a, i) => {
        if (a.priorite === 'Haute' || a.priorite === 'Moyenne') autoSelected.add(i);
      });
      setSelectedActions(autoSelected);
      
      setImportState({ loading: false, error: null, result: parsed });
    } catch (err) {
      console.error(err);
      setImportState({ loading: false, error: err.message || "Erreur d'analyse", result: null });
    }
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) analyzeDocuments(files);
  };

  // Charge des fichiers depuis Dropbox (via leur URL directe) puis les analyse
  const handleDropboxFiles = async (dropboxFiles) => {
    if (!dropboxFiles || !dropboxFiles.length) return;
    setImportState({ loading: true, error: null, result: null });
    try {
      // Télécharge chaque fichier Dropbox et le convertit en File
      const files = await Promise.all(dropboxFiles.map(async (dbf) => {
        // dbf.link est l'URL de prévisualisation, on remplace dl=0 par dl=1 pour téléchargement direct
        const directUrl = dbf.link.replace('?dl=0', '?dl=1').replace('&dl=0', '&dl=1');
        const urlWithDl = directUrl.includes('dl=') ? directUrl : directUrl + (directUrl.includes('?') ? '&' : '?') + 'dl=1';
        const response = await fetch(urlWithDl);
        if (!response.ok) throw new Error(`Impossible de télécharger ${dbf.name}`);
        const blob = await response.blob();
        // Déduire le type MIME si besoin
        let mime = blob.type;
        if (!mime || mime === 'application/octet-stream') {
          const ext = dbf.name.split('.').pop().toLowerCase();
          if (ext === 'pdf') mime = 'application/pdf';
          else if (['jpg','jpeg'].includes(ext)) mime = 'image/jpeg';
          else if (ext === 'png') mime = 'image/png';
          else if (ext === 'webp') mime = 'image/webp';
          else if (ext === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else mime = 'text/plain';
        }
        return new File([blob], dbf.name, { type: mime });
      }));
      await analyzeDocuments(files);
    } catch (err) {
      setImportState({ loading: false, error: err.message || "Erreur téléchargement Dropbox", result: null });
    }
  };

  const openDropboxChooser = () => {
    if (typeof window === 'undefined' || !window.Dropbox) {
      setImportState({ loading: false, error: "Dropbox n'est pas encore chargé, réessayez dans quelques secondes.", result: null });
      return;
    }
    window.Dropbox.choose({
      success: handleDropboxFiles,
      linkType: 'direct',
      multiselect: true,
      extensions: ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.txt']
    });
  };

  const missingFields = Object.entries(REQUIRED_FIELDS).filter(([k]) => {
    const v = data[k];
    return v === null || v === undefined || v === '' || v === 0;
  });

  const alertConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle },
    warning: { bg: 'bg-sage-50', border: 'border-sage-light', text: 'text-sage-darker', icon: AlertTriangle },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info }
  };

  const fieldClass = (key) => {
    const base = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-stone-900";
    if (filledFields.has(key)) return `${base} border-emerald-300 bg-emerald-50/30`;
    return `${base} border-stone-200`;
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-3xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900">{mandat ? 'Modifier' : 'Nouveau'} mandat</h2>
            {!mandat && <p className="text-xs text-stone-500 mt-0.5">Importez un dossier pour pré-remplir automatiquement</p>}
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {!mandat && (
          <div className="p-6 border-b border-stone-200 bg-gradient-to-br from-sage-50/70 to-cream-50">
            {!importState.result && !importState.loading && (
              <>
                <label className="block border-2 border-dashed border-sage-light rounded-xl p-6 text-center cursor-pointer hover:border-sage hover:bg-white/50">
                  <input type="file" multiple accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt" onChange={handleFiles} className="hidden" />
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 gradient-sage-dark rounded-xl flex items-center justify-center mb-1">
                      <Wand2 className="w-6 h-6 text-cream-50" />
                    </div>
                    <div className="font-display text-lg font-semibold text-stone-900">Importer un ou plusieurs dossiers</div>
                    <div className="text-sm text-stone-600 max-w-md">Plaquette, fiche immeuble, baux, photos… Claude lira tout et remplira la fiche en signalant les points d'attention.</div>
                    <div className="text-xs text-stone-500 mt-2 flex items-center gap-3">
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />PDF</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />DOCX</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />Images</span>
                    </div>
                  </div>
                </label>

                {/* Bouton appareil photo direct (mobile) */}
                <label className="md:hidden mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-ink-deep text-white rounded-xl text-sm font-medium hover:bg-ink cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" onChange={handleFiles} className="hidden" />
                  <Camera className="w-5 h-5" />
                  Prendre une photo du dossier
                </label>
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-sage-light/50"></div>
                  <span className="text-xs text-stone-500 uppercase tracking-wide">ou</span>
                  <div className="flex-1 h-px bg-sage-light/50"></div>
                </div>
                <button
                  type="button"
                  onClick={openDropboxChooser}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-sage-light rounded-xl hover:bg-sage-50 hover:border-sage transition-colors text-sm font-medium text-stone-800"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0061FF"><path d="M12 6.5L6 2.5l-6 4 6 4 6-4zm12 0l-6-4-6 4 6 4 6-4zM0 14.5l6 4 6-4-6-4-6 4zm18-4l-6 4 6 4 6-4-6-4zm-12 9.5l6 4 6-4-6-4-6 4z"/></svg>
                  Importer depuis Dropbox
                </button>
              </>
            )}

            {importState.loading && (
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-sage-light">
                <Loader2 className="w-6 h-6 text-sage-dark animate-spin" />
                <div>
                  <div className="font-medium text-stone-900 text-sm">Analyse en cours…</div>
                  <div className="text-xs text-stone-500">Claude lit vos documents et extrait les informations</div>
                </div>
              </div>
            )}

            {importState.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                <div className="font-medium mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Erreur d'analyse</div>
                <div>{importState.error}</div>
                <button onClick={() => setImportState({ loading: false, error: null, result: null })} className="mt-2 text-xs underline">Réessayer</button>
              </div>
            )}

            {importState.result && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-stone-900 text-sm">{filledFields.size} champ{filledFields.size > 1 ? 's' : ''} rempli{filledFields.size > 1 ? 's' : ''} automatiquement</span>
                  </div>
                  <label className="text-xs text-stone-600 hover:text-stone-900 cursor-pointer flex items-center gap-1">
                    <input type="file" multiple accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt" onChange={handleFiles} className="hidden" />
                    <FileUp className="w-3 h-3" /> Ajouter d'autres docs
                  </label>
                </div>

                {importedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {importedFiles.map((f, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-white border border-stone-200 rounded-full text-stone-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" />{f}
                      </span>
                    ))}
                  </div>
                )}

                {importState.result.alerts && importState.result.alerts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-stone-600 mt-2">Points d'attention détectés</div>
                    {importState.result.alerts.map((a, i) => {
                      const cfg = alertConfig[a.type] || alertConfig.info;
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className={`p-3 rounded-lg border ${cfg.bg} ${cfg.border} flex items-start gap-2`}>
                          <Icon className={`w-4 h-4 ${cfg.text} flex-shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${cfg.text}`}>{a.title}</div>
                            <div className={`text-xs ${cfg.text} opacity-90 mt-0.5`}>{a.message}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {missingFields.length > 0 && (
                  <div className="p-3 rounded-lg bg-stone-100 border border-cream-dark">
                    <div className="text-xs font-semibold uppercase tracking-wide text-stone-700 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Informations manquantes ({missingFields.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {missingFields.map(([k, label]) => (
                        <span key={k} className="text-xs px-2 py-1 bg-white border border-stone-300 rounded-full text-stone-700">{label}</span>
                      ))}
                    </div>
                    <div className="text-xs text-stone-600 mt-2 italic">Complétez-les manuellement ci-dessous.</div>
                  </div>
                )}

                {importState.result.highlights && importState.result.highlights.length > 0 && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Atouts commerciaux
                    </div>
                    <ul className="space-y-1">
                      {importState.result.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-emerald-900 flex items-start gap-1.5">
                          <Check className="w-3 h-3 mt-0.5 flex-shrink-0" /><span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {importState.result.actions && importState.result.actions.length > 0 && (
                  <div className="p-3 rounded-lg bg-white border-2 border-sage-light">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-sage-darker flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5" /> Actions à mener ({selectedActions.size}/{importState.result.actions.length})
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setSelectedActions(new Set(importState.result.actions.map((_,i) => i)))}
                          className="text-[10px] text-sage-dark hover:underline">Tout cocher</button>
                        <button type="button" onClick={() => setSelectedActions(new Set())}
                          className="text-[10px] text-stone-500 hover:underline">Tout décocher</button>
                      </div>
                    </div>
                    <div className="text-[11px] text-stone-600 mb-2 italic">Ces tâches seront créées dans votre to-do et liées à ce mandat dès l'enregistrement.</div>
                    <div className="space-y-1.5">
                      {importState.result.actions.map((a, i) => (
                        <label key={i} className="flex items-start gap-2 p-2 rounded-md hover:bg-sage-50 cursor-pointer">
                          <input type="checkbox" 
                            checked={selectedActions.has(i)}
                            onChange={() => {
                              const s = new Set(selectedActions);
                              if (s.has(i)) s.delete(i); else s.add(i);
                              setSelectedActions(s);
                            }}
                            className="mt-0.5 accent-[#6B7F5A]" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-stone-900">{a.titre}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                a.priorite === 'Haute' ? 'bg-red-50 text-red-700' : 
                                a.priorite === 'Moyenne' ? 'bg-amber-50 text-amber-700' : 
                                'bg-stone-100 text-stone-600'
                              }`}>{a.priorite}</span>
                              <span className="text-[10px] text-stone-500">
                                <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                                {a.echeanceJours}j
                              </span>
                            </div>
                            {a.motif && <div className="text-[10px] text-stone-500 mt-0.5 italic">{a.motif}</div>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-4">
          {filledFields.size > 0 && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Les champs en <span className="font-semibold">vert</span> ont été remplis automatiquement — vérifiez-les avant d'enregistrer.
            </div>
          )}

          <Field label="Nom du bien"><input type="text" value={data.nom} onChange={e => update('nom', e.target.value)} className={fieldClass('nom')} /></Field>
          <Field label="Adresse"><input type="text" value={data.adresse} onChange={e => update('adresse', e.target.value)} className={fieldClass('adresse')} /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type d'actif">
              <select value={data.type} onChange={e => update('type', e.target.value)} className={fieldClass('type')}>
                {TYPES_ACTIF.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Sous-catégorie"><input type="text" value={data.sousType || ''} onChange={e => update('sousType', e.target.value)} className={fieldClass('sousType')} /></Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Prix net (€)"><input type="number" value={data.prix} onChange={e => update('prix', +e.target.value)} className={fieldClass('prix')} /></Field>
            <Field label="Prix/m²"><input type="number" value={data.prixM2} onChange={e => update('prixM2', +e.target.value)} className={fieldClass('prixM2')} /></Field>
            <Field label="Surface (m²)"><input type="number" value={data.surface} onChange={e => update('surface', +e.target.value)} className={fieldClass('surface')} /></Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Loyers annuels"><input type="number" value={data.loyersAnnuels} onChange={e => update('loyersAnnuels', +e.target.value)} className={fieldClass('loyersAnnuels')} /></Field>
            <Field label="Rendement (%)"><input type="number" step="0.01" value={data.rendement} onChange={e => update('rendement', +e.target.value)} className={fieldClass('rendement')} /></Field>
            <Field label="Nb lots"><input type="number" value={data.nbLots} onChange={e => update('nbLots', +e.target.value)} className={fieldClass('nbLots')} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type de commercialisation">
              <select value={data.commercialisation} onChange={e => update('commercialisation', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Off-market</option>
                <option>Mandat exclusif</option>
                <option>Mandat simple</option>
              </select>
            </Field>
            <Field label="Date signature">
              <input type="date" value={data.dateSignature || ''} onChange={e => update('dateSignature', e.target.value)}
                disabled={data.commercialisation === 'Off-market'}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900 disabled:bg-stone-50 disabled:text-stone-400" />
            </Field>
          </div>

          <Field label="Statut pipeline">
            <select value={data.statut} onChange={e => update('statut', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              {STATUTS_MANDAT.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact propriétaire"><input type="text" value={data.contact || ''} onChange={e => update('contact', e.target.value)} className={fieldClass('contact')} /></Field>
            <Field label="Téléphone"><input type="text" value={data.tel || ''} onChange={e => update('tel', e.target.value)} className={fieldClass('tel')} /></Field>
          </div>

          <Field label="Description"><textarea value={data.description || ''} onChange={e => update('description', e.target.value)} rows={3} className={fieldClass('description')} /></Field>
        </div>

        <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={() => {
            const docsAjoutes = importedFiles.length ? [...(data.docs || []), ...importedFiles] : (data.docs || []);
            // Préparer les actions à créer dans la to-do
            const actionsToCreate = importState.result?.actions 
              ? importState.result.actions.filter((_, i) => selectedActions.has(i))
              : [];
            onSave({ ...data, docs: docsAjoutes }, actionsToCreate);
          }} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
            Enregistrer{selectedActions.size > 0 ? ` + ${selectedActions.size} tâche${selectedActions.size > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function MandatDetail({ mandat, onBack, onEdit, deals, clients, reload, todos, annonces }) {
  const [openModal, setOpenModal] = useState(null); // 'photos' | 'visite' | 'mandant' | null
  const mandatDeals = deals.filter(d => d.mandatId === mandat.id);
  const alerts = mandat.alerts || [];
  const highlights = mandat.highlights || [];
  const mandatTodos = (todos || []).filter(t => t.lienType === 'mandat' && t.lienId === mandat.id);
  const mandatAnnonce = (annonces || []).find(a => a.mandatId === mandat.id);
  const isPublished = mandatAnnonce && Object.values(mandatAnnonce.portails || {}).some(p => p === 'En ligne');

  // KPIs
  const nbMatching = clients.filter(c => {
    const prix = parseFloat(mandat.prix);
    const minOk = prix >= parseFloat(c.budgetMin || 0);
    const maxOk = prix <= parseFloat(c.budgetMax || Infinity);
    return minOk && maxOk;
  }).length;
  const nbRapprochements = mandatDeals.length;
  const nbOffres = mandatDeals.filter(d => d.statut === 'Offre' || d.statut === 'Promesse' || d.statut === 'Gagné').length;
  const nbVisites = mandatDeals.filter(d => d.statut === 'Visite').length;

  // Couleur badge mandat
  const commColor = {
    'Mandat exclusif': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Mandat simple': 'bg-blue-50 text-blue-700 border-blue-200',
    'Off-market': 'bg-stone-100 text-stone-700 border-stone-200'
  }[mandat.commercialisation] || 'bg-stone-100 text-stone-700 border-stone-200';

  return (
    <div className="p-8 max-w-7xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 mb-6">
        <ChevronRight className="w-4 h-4 rotate-180" /> Retour aux mandats
      </button>

      {/* ═══ EN-TÊTE ═══ */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-1">{mandat.nom}</h1>
          <p className="text-stone-500 flex items-center gap-2 text-sm mb-3">
            <MapPin className="w-4 h-4" />{mandat.adresse}
          </p>
          {/* Highlights remontés en badges */}
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {highlights.slice(0, 5).map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium rounded-full">
                  <Sparkles className="w-3 h-3 text-amber-600" />{h}
                </span>
              ))}
              {highlights.length > 5 && (
                <span className="inline-flex items-center px-2.5 py-1 bg-cream-100 text-stone-600 text-xs rounded-full">
                  +{highlights.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink flex-shrink-0">
          <Edit2 className="w-4 h-4" /> Modifier
        </button>
      </div>

      {/* ═══ BARRE D'ACTIONS ═══ */}
      <div className="mb-6 pb-6 border-b border-stone-200 flex items-center gap-4 flex-wrap">
        {/* Boutons PDF + actions */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Dossier</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <PdfExportButtons mandatId={mandat.id} mandatNom={mandat.nom} isOffMarket={mandat.is_off_market} />
            <button onClick={() => setOpenModal('photos')} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
              <ImageIcon className="w-4 h-4" /> Photos {(mandat.photos || []).length > 0 && <span className="text-[10px] bg-sage-100 text-sage-dark px-1.5 py-0.5 rounded-full ml-0.5">{mandat.photos.length}</span>}
            </button>
            <button onClick={() => setOpenModal('visite')} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
              <Eye className="w-4 h-4" /> Visite {(mandat.visiteInfo || mandat.visite_info) && Object.values(mandat.visiteInfo || mandat.visite_info).some(v => v) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
            <button onClick={() => setOpenModal('mandant')} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
              <UserIcon className="w-4 h-4" /> Mandant {(mandat.mandantInfo || mandat.mandant_info) && Object.values(mandat.mandantInfo || mandat.mandant_info).some(v => v) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
          </div>
        </div>

        {/* Badge mandat avec lumière publié */}
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${commColor}`}>
            <span>{mandat.commercialisation}</span>
            <div className="flex items-center gap-1" title={isPublished ? 'Publié sur les portails' : 'Non publié'}>
              <div className={`w-2 h-2 rounded-full ${isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
            </div>
          </div>
        </div>

        {/* Avatar owner avec dropdown de réassignement */}
        <OwnerSelector mandat={mandat} reload={reload} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {/* ═══ ANALYSE FINANCIÈRE — REMONTÉE EN PREMIÈRE POSITION ═══ */}
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Analyse financière</h2>
            <div className="grid grid-cols-4 gap-4">
              <DetailItem label="Prix net vendeur" value={formatPrix(mandat.prix)} highlight />
              <DetailItem label="Prix au m²" value={mandat.prixM2 ? `${parseFloat(mandat.prixM2).toLocaleString('fr')}€` : '—'} />
              <DetailItem label="Loyers annuels" value={mandat.loyersAnnuels ? `${parseFloat(mandat.loyersAnnuels).toLocaleString('fr')}€` : '—'} />
              <DetailItem label="Rendement" value={parseFloat(mandat.rendement) > 0 ? `${mandat.rendement}%` : '—'} highlight />
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-cream">
              <DetailItem label="Surface" value={mandat.surface ? `${mandat.surface} m²` : '—'} />
              <DetailItem label="Type" value={mandat.type} />
              <DetailItem label="Owner" value={mandat.owner} />
              <DetailItem label="Créé le" value={mandat.createdAt ? new Date(mandat.createdAt).toLocaleDateString('fr-FR') : '—'} />
            </div>
          </div>

          {/* ═══ STATISTIQUES DU DOSSIER ═══ */}
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sage-dark" />Statistiques du dossier
            </h2>
            <div className="grid grid-cols-4 gap-3">
              <KpiBox label="Rapprochements" value={nbRapprochements} icon={Handshake} />
              <KpiBox label="Clients potentiels" value={nbMatching} icon={Users} sublabel="(matching)" />
              <KpiBox label="Offres" value={nbOffres} icon={CheckCircle2} />
              <KpiBox label="Visites" value={nbVisites} icon={Eye} />
            </div>
          </div>

          {/* ═══ TÂCHES LIÉES AU MANDAT ═══ */}
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-sage-dark" />Tâches liées au mandat
              {mandatTodos.length > 0 && (
                <span className="text-sm text-stone-500 font-normal">({mandatTodos.filter(t => t.statut !== 'Terminé').length} en cours)</span>
              )}
            </h2>
            {mandatTodos.length === 0 ? (
              <p className="text-sm text-stone-500 italic">Aucune tâche liée à ce mandat</p>
            ) : (
              <div className="space-y-2">
                {mandatTodos.slice(0, 8).map(t => {
                  const enRetard = t.echeance && new Date(t.echeance) < new Date() && t.statut !== 'Terminé';
                  return (
                    <div key={t.id} className={`flex items-start gap-3 p-3 rounded-lg ${
                      t.statut === 'Terminé' ? 'bg-stone-50 opacity-60' : 'bg-cream-50/50 hover:bg-cream-50'
                    }`}>
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 ${
                        t.statut === 'Terminé' ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'
                      }`}>
                        {t.statut === 'Terminé' && <Check className="w-2.5 h-2.5 text-white mx-auto" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${t.statut === 'Terminé' ? 'line-through text-stone-500' : 'text-stone-900'}`}>{t.titre}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            t.priorite === 'Haute' ? 'bg-red-50 text-red-700' : t.priorite === 'Moyenne' ? 'bg-sage-50 text-sage-dark' : 'bg-cream-100 text-ink/80'
                          }`}>{t.priorite}</span>
                          {t.echeance && (
                            <span className={`text-xs flex items-center gap-1 ${enRetard ? 'text-red-600 font-medium' : 'text-stone-500'}`}>
                              <Calendar className="w-3 h-3" />{new Date(t.echeance).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                          {t.assignee && <span className="text-xs text-stone-500">· {t.assignee}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {mandatTodos.length > 8 && (
                  <p className="text-xs text-stone-500 text-center pt-2">... et {mandatTodos.length - 8} de plus</p>
                )}
              </div>
            )}
          </div>

          {/* ═══ ALERTES (si existantes) ═══ */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-sage-dark" />Points d'attention
              </h2>
              <div className="space-y-2">
                {alerts.map((a, i) => {
                  const cfg = { critical: 'border-red-200 bg-red-50 text-red-800', warning: 'border-sage-light bg-sage-50 text-sage-darker', info: 'border-blue-200 bg-blue-50 text-blue-800' }[a.type] || 'border-stone-200 bg-stone-50 text-stone-800';
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${cfg}`}>
                      <div className="font-medium text-sm">{a.title}</div>
                      <div className="text-xs mt-0.5 opacity-90">{a.message}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ DESCRIPTION ═══ */}
          {mandat.description && (
            <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-3">Description</h2>
              <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{mandat.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {openModal === 'photos' && (
        <PhotosModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
      {openModal === 'visite' && (
        <VisiteModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
      {openModal === 'mandant' && (
        <MandantModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
    {/* Quelque chose */}

      {/* Assistant IA — sidebar fixe en bas à droite */}
      <MandatAIAssistant mandat={mandat} />

    </div>
  );
}

// Composant : sélecteur de responsable (dropdown réassignable)
function OwnerSelector({ mandat, reload }) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const ownerInitials = (mandat.owner || '?').toUpperCase().slice(0, 2);

  useEffect(() => {
    supabase.from('profiles').select('id, prenom, nom').eq('actif', true)
      .then(({ data }) => setProfiles(data || []));
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('.owner-selector')) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const reassign = async (newInitials) => {
    if (newInitials === mandat.owner) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await supabase.from('mandats').update({ owner: newInitials }).eq('id', mandat.id);
      if (reload) reload();
      setOpen(false);
    } catch (e) {
      console.error('Erreur réassignement:', e);
      alert('Erreur lors du réassignement');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (p) => `${(p.prenom || '').charAt(0)}${(p.nom || '').charAt(0)}`.toUpperCase() || '??';

  return (
    <div className="flex flex-col items-center owner-selector relative">
      <div className="text-[10px] uppercase text-stone-500 tracking-wide mb-1">Resp.</div>
      <button onClick={() => setOpen(!open)} disabled={saving}
        className="w-10 h-10 rounded-full gradient-sage-dark flex items-center justify-center text-white font-medium text-sm shadow-luxe hover:opacity-90 disabled:opacity-50 cursor-pointer relative"
        title={`Responsable : ${mandat.owner || '—'} — clic pour réassigner`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : ownerInitials}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center shadow border border-cream-dark">
          <ChevronRight className="w-2.5 h-2.5 text-stone-600 rotate-90" />
        </div>
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-luxe-hover border border-cream-dark py-1 z-30 min-w-[180px]">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-stone-500 border-b border-cream-dark">
            Réassigner à
          </div>
          {profiles.map(p => {
            const initials = getInitials(p);
            const isCurrent = initials === mandat.owner;
            return (
              <button key={p.id} onClick={() => reassign(initials)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50 ${isCurrent ? 'bg-sage-50' : ''}`}>
                <div className="w-7 h-7 rounded-full gradient-sage-dark flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                  {initials}
                </div>
                <span className="flex-1 text-stone-800">{p.prenom} {p.nom}</span>
                {isCurrent && <Check className="w-3.5 h-3.5 text-sage-dark" />}
              </button>
            );
          })}
          {profiles.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-500 italic">Aucun commercial actif</div>
          )}
        </div>
      )}
    </div>
  );
}
// Composant KPI réutilisable
function KpiBox({ label, value, icon: Icon, sublabel }) {
  return (
    <div className="bg-cream-50 rounded-lg p-4 border border-cream-dark">
      <div className="flex items-start justify-between mb-2">
        <Icon className="w-4 h-4 text-sage-dark" />
        <div className="font-display text-2xl font-semibold text-stone-900 leading-none">{value}</div>
      </div>
      <div className="text-xs text-stone-700 font-medium">{label}</div>
      {sublabel && <div className="text-[10px] text-stone-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}
// === CLIENTS ===
function ClientsTab({ clients, reload, mandats, deals, interactions }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTypo, setFilterTypo] = useState('Tous');
  const [editingClient, setEditingClient] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showVoice, setShowVoice] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState(null);
  const [showImportContacts, setShowImportContacts] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle()
      .then(({ data }) => setOutlookConnected(!!data));
  }, [user]);

  const filtered = clients.filter(c => {
    if (search && !`${c.prenom || ''} ${c.nom} ${c.societe || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTypo !== 'Tous' && c.typologie !== filterTypo) return false;
    return true;
  });

  const handleSave = async (client) => {
    const snakeData = toSnake(client);
    delete snakeData.created_at;
    delete snakeData.updated_at;
    if (client.id) {
      snakeData.updated_by = user?.id;
      await supabase.from('clients').update(snakeData).eq('id', client.id);
    } else {
      delete snakeData.id;
      snakeData.created_by = user?.id;
      await supabase.from('clients').insert(snakeData);
    }
    setEditingClient(null);
    setShowNew(false);
    reload();
  };

  if (selectedClient) {
    const current = clients.find(c => c.id === selectedClient.id) || selectedClient;
    return <ClientDetail client={current} reload={reload} interactions={interactions} onBack={() => setSelectedClient(null)} onEdit={() => { setEditingClient(current); setSelectedClient(null); }} deals={deals} mandats={mandats} />;
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Clients</h1>
          <p className="text-stone-500">{filtered.length} investisseur{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {outlookConnected && (
            <button onClick={() => setShowImportContacts(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-cream-dark text-ink rounded-lg hover:bg-cream-50 text-sm font-medium">
              <Download className="w-4 h-4" /> Importer Outlook
            </button>
          )}
          <button onClick={() => setShowVoice(true)} className="flex items-center gap-2 px-4 py-2.5 gradient-sage-dark text-white rounded-lg hover:opacity-90 text-sm font-medium shadow-md">
            <Mic className="w-4 h-4" /> Note vocale
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nouveau client
          </button>
        </div>
      </div>

      {voiceFeedback && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span className="text-emerald-900">
            {voiceFeedback.action === 'update' ? 'Fiche client enrichie' : 'Nouveau client créé'} via note vocale avec succès.
          </span>
          <button onClick={() => setVoiceFeedback(null)} className="ml-auto text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
        </div>
        <select value={filterTypo} onChange={e => setFilterTypo(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option>Tous</option>
          {TYPOLOGIES_CLIENT.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.map(c => {
          const nbDeals = deals.filter(d => d.clientId === c.id && !['Perdu','Refusé'].includes(d.statut)).length;
          const clientInteractions = interactions.filter(i => i.clientId === c.id);
          const lastInter = clientInteractions[0];
          return (
            <div key={c.id} onClick={() => setSelectedClient(c)} className="bg-white rounded-xl p-5 shadow-luxe hover:shadow-luxe-hover border border-stone-200 cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display text-lg font-semibold text-stone-900">{c.prenom} {c.nom}</div>
                  <div className="text-sm text-stone-600">{c.societe}</div>
                </div>
                <MaturiteBadge maturite={c.maturite} />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-xs px-2 py-0.5 bg-cream-100 text-ink rounded-full">{c.typologie}</span>
                {(c.zones || []).slice(0, 2).map(z => <span key={z} className="text-xs px-2 py-0.5 bg-sage-50 text-sage-dark rounded-full">{z}</span>)}
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-cream">
                <div><div className="text-[10px] text-stone-500 uppercase">Budget</div><div className="text-xs font-medium text-stone-900">{(parseFloat(c.budgetMin)/1000000).toFixed(1)}-{(parseFloat(c.budgetMax)/1000000).toFixed(1)}M€</div></div>
                <div><div className="text-[10px] text-stone-500 uppercase">Rdt min</div><div className="text-xs font-medium text-stone-900">{c.rendementMin}%</div></div>
                <div><div className="text-[10px] text-stone-500 uppercase">Deals</div><div className="text-xs font-medium text-stone-900">{nbDeals}</div></div>
              </div>
              {lastInter && (
                <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Dernière interaction : {new Date(lastInter.date).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(editingClient || showNew) && (
        <ClientForm client={editingClient} onSave={handleSave} onClose={() => { setEditingClient(null); setShowNew(false); }} />
      )}

      {showVoice && (
        <VoiceNoteModal
          existingClients={clients}
          onClose={() => setShowVoice(false)}
          onSuccess={(action, clientId) => {
            setShowVoice(false);
            setVoiceFeedback({ action, clientId });
            reload();
            setTimeout(() => setVoiceFeedback(null), 5000);
          }}
        />
      )}

      {showImportContacts && (
        <ContactsImportModal
          onClose={() => setShowImportContacts(false)}
          onImported={() => { setShowImportContacts(false); reload(); }}
        />
      )}
    </div>
  );
}

function ClientForm({ client, onSave, onClose }) {
  const [data, setData] = useState(client || {
    nom: '', prenom: '', societe: '', tel: '', email: '',
    typologie: 'Foncières', nature: 'Privée', budgetMin: 0, budgetMax: 0,
    rendementMin: 0, zones: [], typologiesRecherchees: [],
    statut: 'Actif', maturite: 'Moyen', origine: 'Apporteur', owner: 'JD'
  });
  const update = (k, v) => setData({ ...data, [k]: v });
  const toggleArray = (key, value) => {
    const arr = data[key] || [];
    update(key, arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-cream-dark">
          <h2 className="font-display text-2xl font-semibold text-stone-900">{client ? 'Modifier' : 'Nouveau'} client</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input type="text" value={data.prenom || ''} onChange={e => update('prenom', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Nom"><input type="text" value={data.nom} onChange={e => update('nom', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <Field label="Société"><input type="text" value={data.societe || ''} onChange={e => update('societe', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone"><input type="tel" value={data.tel || ''} onChange={e => update('tel', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Email"><input type="email" value={data.email || ''} onChange={e => update('email', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Typologie">
              <select value={data.typologie} onChange={e => update('typologie', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                {TYPOLOGIES_CLIENT.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Maturité">
              <select value={data.maturite} onChange={e => update('maturite', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Haute</option><option>Moyen</option><option>Basse</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Budget min (€)"><input type="number" value={data.budgetMin} onChange={e => update('budgetMin', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Budget max (€)"><input type="number" value={data.budgetMax} onChange={e => update('budgetMax', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
            <Field label="Rdt min (%)"><input type="number" step="0.1" value={data.rendementMin} onChange={e => update('rendementMin', +e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
          </div>
          <Field label="Zones recherchées">
            <div className="flex flex-wrap gap-2">
              {ZONES.map(z => (
                <button key={z} type="button" onClick={() => toggleArray('zones', z)}
                  className={`px-3 py-1 text-xs rounded-full border ${(data.zones || []).includes(z) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{z}</button>
              ))}
            </div>
          </Field>
          <Field label="Typologies recherchées">
            <div className="flex flex-wrap gap-2">
              {TYPES_ACTIF.map(t => (
                <button key={t} type="button" onClick={() => toggleArray('typologiesRecherchees', t)}
                  className={`px-3 py-1 text-xs rounded-full border ${(data.typologiesRecherchees || []).includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origine">
              <select value={data.origine} onChange={e => update('origine', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Apporteur</option><option>Salon</option><option>Pub</option><option>Mandant</option><option>Site web</option><option>Autre</option>
              </select>
            </Field>
            <Field label="Statut">
              <select value={data.statut} onChange={e => update('statut', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Actif</option><option>Veille</option><option>Inactif</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-cream-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={() => onSave(data)} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function ClientDetail({ client, reload, interactions, onBack, onEdit, deals, mandats }) {
  const { user } = useAuth();
  const [showNewInter, setShowNewInter] = useState(false);
  const [newInter, setNewInter] = useState({ date: new Date().toISOString().split('T')[0], type: 'Appel', resume: '', nextStep: '', dateNextStep: '' });
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [pushingOutlook, setPushingOutlook] = useState(false);
  const [pushFeedback, setPushFeedback] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle()
      .then(({ data }) => setOutlookConnected(!!data));
  }, [user]);

  const clientDeals = deals.filter(d => d.clientId === client.id);
  const clientInteractions = interactions.filter(i => i.clientId === client.id);

  const addInteraction = async () => {
    if (!newInter.resume) return;
    await supabase.from('interactions').insert({
      client_id: client.id,
      date: newInter.date,
      type: newInter.type,
      resume: newInter.resume,
      next_step: newInter.nextStep,
      date_next_step: newInter.dateNextStep || null
    });
    setNewInter({ date: new Date().toISOString().split('T')[0], type: 'Appel', resume: '', nextStep: '', dateNextStep: '' });
    setShowNewInter(false);
    reload();
  };

  const deleteInteraction = async (id) => {
    await supabase.from('interactions').delete().eq('id', id);
    reload();
  };

  const pushToOutlook = async () => {
    if (!client.email) {
      setPushFeedback({ type: 'error', text: 'Email du client requis' });
      return;
    }
    setPushingOutlook(true);
    setPushFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/microsoft/contacts/push', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId: client.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      setPushFeedback({ type: 'success', text: client.outlook_contact_id ? 'Contact mis à jour dans Outlook' : 'Contact ajouté à Outlook' });
      reload();
      setTimeout(() => setPushFeedback(null), 4000);
    } catch (err) {
      setPushFeedback({ type: 'error', text: err.message });
    } finally {
      setPushingOutlook(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 mb-6">
        <ChevronRight className="w-4 h-4 rotate-180" /> Retour aux clients
      </button>
      
      {pushFeedback && (
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${
          pushFeedback.type === 'success' 
            ? 'bg-sage-50 border border-sage-light text-sage-darker' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {pushFeedback.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div>{pushFeedback.text}</div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">{client.prenom} {client.nom}</h1>
          <p className="text-stone-500">{client.societe}</p>
        </div>
        <div className="flex items-center gap-2">
          {outlookConnected && (
            <button onClick={pushToOutlook} disabled={pushingOutlook || !client.email}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-cream-dark text-ink rounded-lg text-sm hover:bg-cream-50 disabled:opacity-50">
              {pushingOutlook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {client.outlook_contact_id ? 'MAJ Outlook' : 'Pousser Outlook'}
            </button>
          )}
          <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
            <Edit2 className="w-4 h-4" /> Modifier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Critères d'investissement</h2>
            <div className="grid grid-cols-3 gap-4">
              <DetailItem label="Typologie" value={client.typologie} />
              <DetailItem label="Maturité" value={<MaturiteBadge maturite={client.maturite} />} />
              <DetailItem label="Origine" value={client.origine} />
              <DetailItem label="Budget" value={`${formatPrixCompact(client.budgetMin)} – ${formatPrixCompact(client.budgetMax)}`} highlight />
              <DetailItem label="Rendement min" value={`${client.rendementMin}%`} highlight />
              <DetailItem label="Statut" value={client.statut} />
            </div>
            {(client.zones || []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-cream">
                <div className="text-xs text-stone-500 uppercase mb-2">Zones</div>
                <div className="flex flex-wrap gap-1.5">{(client.zones || []).map(z => <span key={z} className="text-xs px-2 py-1 bg-sage-50 text-sage-dark rounded-full">{z}</span>)}</div>
              </div>
            )}
            {(client.typologiesRecherchees || []).length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-stone-500 uppercase mb-2">Typologies recherchées</div>
                <div className="flex flex-wrap gap-1.5">{(client.typologiesRecherchees || []).map(t => <span key={t} className="text-xs px-2 py-1 bg-cream-100 text-ink rounded-full">{t}</span>)}</div>
              </div>
            )}
          </div>

          {/* Emails Outlook avec ce client */}
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-sage-dark" />Emails Outlook
            </h2>
            <ClientEmails client={client} />
          </div>

          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold text-stone-900">Historique des interactions</h2>
              <button onClick={() => setShowNewInter(!showNewInter)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-stone-100 hover:bg-cream-200 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Nouvelle
              </button>
            </div>

            {showNewInter && (
              <div className="bg-stone-50 rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-stone-600 uppercase mb-1 block">Date <span className="text-red-500">*</span></label>
                    <input type="date" value={newInter.date} onChange={e => setNewInter({...newInter, date: e.target.value})} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-stone-900" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 uppercase mb-1 block">Type</label>
                    <select value={newInter.type} onChange={e => setNewInter({...newInter, type: e.target.value})} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-stone-900">
                      <option>Appel</option><option>Email</option><option>Rendez-vous</option><option>Visite</option><option>Message</option>
                    </select>
                  </div>
                </div>
                <textarea value={newInter.resume} onChange={e => setNewInter({...newInter, resume: e.target.value})} rows={2} placeholder="Décrivez l'échange…" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-stone-900" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={newInter.nextStep} onChange={e => setNewInter({...newInter, nextStep: e.target.value})} placeholder="Prochaine action" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-stone-900" />
                  <input type="date" value={newInter.dateNextStep} onChange={e => setNewInter({...newInter, dateNextStep: e.target.value})} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-stone-900" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNewInter(false)} className="px-3 py-1.5 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
                  <button onClick={addInteraction} className="px-3 py-1.5 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Ajouter</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {clientInteractions.length === 0 ? (
                <p className="text-sm text-stone-500 italic text-center py-6">Aucune interaction</p>
              ) : clientInteractions.map(i => (
                <div key={i.id} className="border-l-2 border-sage-light pl-4 py-2 group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <TypeInteractionBadge type={i.type} />
                      <span className="text-xs font-medium text-stone-900 bg-sage-50 px-2 py-0.5 rounded-md">
                        {new Date(i.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <button onClick={() => deleteInteraction(i.id)} className="opacity-0 group-hover:opacity-100 text-cream-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-stone-700 mb-1">{i.resume}</p>
                  {i.nextStep && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 mt-1.5">
                      <ChevronRight className="w-3 h-3" />
                      <span>{i.nextStep}</span>
                      {i.dateNextStep && <span className="text-sage-dark font-medium">• {new Date(i.dateNextStep).toLocaleDateString('fr-FR')}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h3 className="font-display text-lg font-semibold text-stone-900 mb-3">Coordonnées</h3>
            <div className="space-y-2 text-sm">
              {client.tel && <div className="flex items-center gap-2 text-stone-700"><Phone className="w-3.5 h-3.5 text-stone-400" />{client.tel}</div>}
              {client.email && <div className="flex items-center gap-2 text-stone-700"><Mail className="w-3.5 h-3.5 text-stone-400" />{client.email}</div>}
            </div>
          </div>

          {clientDeals.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-3">Deals ({clientDeals.length})</h3>
              <div className="space-y-2">
                {clientDeals.map(d => {
                  const m = mandats.find(x => x.id === d.mandatId);
                  if (!m) return null;
                  return (
                    <div key={d.id} className="p-3 bg-stone-50 rounded-lg">
                      <div className="text-sm font-medium text-stone-900 mb-1">{m.nom}</div>
                      <DealStatutBadge statut={d.statut} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// === DEALS ===
function DealsTab({ deals, reload, mandats, clients }) {
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');

  const enriched = deals.map(d => ({
    ...d,
    mandat: mandats.find(m => m.id === d.mandatId),
    client: clients.find(c => c.id === d.clientId)
  })).filter(d => d.mandat && d.client);

  const filtered = enriched.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.mandat.nom.toLowerCase().includes(q) || `${d.client.prenom || ''} ${d.client.nom} ${d.client.societe || ''}`.toLowerCase().includes(q);
  });

  const updateDealStatut = async (id, statut) => {
    const deal = deals.find(d => d.id === id);
    const update = { statut };
    if (statut === 'Envoyé' && !deal.dateEnvoi) update.date_envoi = new Date().toISOString().split('T')[0];
    await supabase.from('deals').update(update).eq('id', id);
    reload();
  };

  const deleteDeal = async (id) => {
    if (confirm('Supprimer ce deal ?')) {
      await supabase.from('deals').delete().eq('id', id);
      reload();
    }
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Deals</h1>
          <p className="text-stone-500">{filtered.length} rapprochement{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1">
          <button onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === 'table' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            <List className="w-4 h-4" /> Tableau
          </button>
          <button onClick={() => setView('kanban')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === 'kanban' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            <LayoutGrid className="w-4 h-4" /> Kanban
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
        </div>
      </div>

      {view === 'table' ? (
        <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-cream-dark">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Bien</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Acquéreur</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Statut</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Date envoi</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-600 uppercase">Commentaire</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-stone-100 hover:bg-cream-50">
                  <td className="px-5 py-4">
                    <div className="font-medium text-stone-900 text-sm">{d.mandat.nom}</div>
                    <div className="text-xs text-stone-500">{formatPrix(d.mandat.prix)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-stone-900 text-sm">{d.client.prenom} {d.client.nom}</div>
                    <div className="text-xs text-stone-500">{d.client.societe}</div>
                  </td>
                  <td className="px-5 py-4">
                    <select value={d.statut} onChange={e => updateDealStatut(d.id, e.target.value)}
                      className="text-xs font-medium px-2 py-1 border border-stone-200 rounded-md focus:outline-none focus:border-stone-900 bg-white">
                      {STATUTS_DEAL.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">{d.dateEnvoi ? new Date(d.dateEnvoi).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{d.commentaire || '—'}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => deleteDeal(d.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-12 text-center text-stone-500 text-sm">Aucun deal</div>}
        </div>
      ) : (
        <DealsKanbanView deals={filtered} onStatutChange={updateDealStatut} />
      )}
    </div>
  );
}

function DealsKanbanView({ deals, onStatutChange }) {
  const [dragging, setDragging] = useState(null);
  const columns = ['À proposer', 'Envoyé', 'En étude', 'Visite', 'Offre', 'Gagné'];

  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
      {columns.map(col => {
        const items = deals.filter(d => d.statut === col);
        return (
          <div key={col} className="flex-shrink-0 w-72 bg-stone-100 rounded-xl p-3"
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragging) { onStatutChange(dragging, col); setDragging(null); } }}>
            <div className="flex items-center justify-between px-2 mb-3">
              <h3 className="font-semibold text-stone-900 text-sm">{col}</h3>
              <span className="text-xs font-medium bg-white text-stone-600 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {items.map(d => (
                <div key={d.id} draggable onDragStart={() => setDragging(d.id)} onDragEnd={() => setDragging(null)}
                  className="bg-white rounded-lg p-3 shadow-luxe cursor-move hover:shadow-luxe-hover">
                  <div className="font-medium text-sm text-stone-900 mb-1 line-clamp-1">{d.mandat.nom}</div>
                  <div className="text-xs text-stone-500 mb-2">{d.client.prenom} {d.client.nom} • {d.client.societe}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-700">{formatPrix(d.mandat.prix)}</span>
                    {d.dateEnvoi && <span className="text-stone-500">{new Date(d.dateEnvoi).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === MATCHING ===
function MatchingTab({ mandats, clients, deals, reload }) {
  const [selectedMandatId, setSelectedMandatId] = useState(mandats[0]?.id || null);
  const mandat = mandats.find(m => m.id === selectedMandatId);

  const computeScore = (client, m) => {
    if (!m) return 0;
    let score = 0;
    const prix = parseFloat(m.prix);
    if (prix >= parseFloat(client.budgetMin) && prix <= parseFloat(client.budgetMax)) score += 40;
    else if (prix >= parseFloat(client.budgetMin) * 0.9 && prix <= parseFloat(client.budgetMax) * 1.1) score += 20;
    if (parseFloat(m.rendement) >= parseFloat(client.rendementMin)) score += 30;
    if ((client.typologiesRecherchees || []).includes(m.type)) score += 20;
    if (client.statut === 'Actif') score += 10;
    return score;
  };

  const matches = mandat ? clients.map(c => ({
    client: c, score: computeScore(c, mandat),
    alreadyLinked: deals.some(d => d.mandatId === mandat.id && d.clientId === c.id)
  })).sort((a, b) => b.score - a.score) : [];

  const addMatch = async (clientId) => {
    await supabase.from('deals').insert({
      mandat_id: mandat.id, client_id: clientId,
      statut: 'À proposer', commentaire: 'Créé via matching auto'
    });
    reload();
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Matching automatique</h1>
        <p className="text-stone-500">Rapprochement intelligent acquéreurs ↔ mandats</p>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 mb-6">
        <label className="text-xs font-medium text-stone-600 uppercase tracking-wide mb-2 block">Sélectionner un mandat</label>
        <select value={selectedMandatId || ''} onChange={e => setSelectedMandatId(e.target.value)} 
          className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          {mandats.map(m => <option key={m.id} value={m.id}>{m.nom} — {formatPrix(m.prix)} • Rdt {m.rendement}%</option>)}
        </select>
      </div>

      {mandat && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-sage-dark" />
            <h2 className="font-display text-xl font-semibold text-stone-900">Acquéreurs compatibles</h2>
            <span className="text-sm text-stone-500">({matches.filter(m => m.score > 0).length} matches)</span>
          </div>
          {matches.filter(m => m.score > 0).map(({ client, score, alreadyLinked }) => (
            <div key={client.id} className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-sage-100 text-sage-dark' : 'bg-cream-100 text-ink/80'
              }`}>
                <div className="font-display text-2xl font-bold">{score}</div>
                <div className="text-[9px] uppercase font-medium">Score</div>
              </div>
              <div className="flex-1">
                <div className="font-display text-lg font-semibold text-stone-900">{client.prenom} {client.nom}</div>
                <div className="text-sm text-stone-600 mb-2">{client.societe}</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 bg-cream-100 text-ink rounded-full">{client.typologie}</span>
                  <span className="text-xs px-2 py-0.5 bg-sage-50 text-sage-dark rounded-full">{formatPrixCompact(client.budgetMin)} – {formatPrixCompact(client.budgetMax)}</span>
                  <MaturiteBadge maturite={client.maturite} />
                </div>
              </div>
              {alreadyLinked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream-100 text-ink/80 rounded-lg text-sm"><CheckCircle2 className="w-4 h-4" /> Déjà lié</span>
              ) : (
                <button onClick={() => addMatch(client.id)} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-stone-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Rapprocher
                </button>
              )}
            </div>
          ))}
          {matches.filter(m => m.score > 0).length === 0 && (
            <div className="text-center py-12 text-stone-500 text-sm">Aucun acquéreur compatible</div>
          )}
        </div>
      )}
    </div>
  );
}

// === TODOS ===
function TodosTab({ todos, reload, mandats, clients, deals }) {
  const { user, profile } = useAuth();
  const [allProfiles, setAllProfiles] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [newTodo, setNewTodo] = useState({ titre: '', priorite: 'Moyenne', statut: 'À faire', echeance: '', assignee: '', assignedToUserId: null, lienType: null, lienId: null });
  const [filterPerson, setFilterPerson] = useState('all'); // all | me | <userId>

  useEffect(() => {
    supabase.from('profiles').select('id, prenom, nom').eq('actif', true).then(({ data }) => {
      setAllProfiles(data || []);
    });
  }, []);

  useEffect(() => {
    if (profile && !newTodo.assignee) {
      setNewTodo(prev => ({ ...prev, assignee: getCurrentUserName(profile), assignedToUserId: user?.id }));
    }
  }, [profile, user]);

  const filtered = todos.filter(t => {
    if (filter === 'todo' && t.statut !== 'À faire') return false;
    if (filter === 'doing' && t.statut !== 'En cours') return false;
    if (filter === 'done' && t.statut !== 'Terminé') return false;
    if (filter === 'urgent' && (t.priorite !== 'Haute' || t.statut === 'Terminé')) return false;
    if (filterPerson === 'me' && t.assignedToUserId !== user?.id) return false;
    if (filterPerson !== 'all' && filterPerson !== 'me' && t.assignedToUserId !== filterPerson) return false;
    return true;
  }).sort((a, b) => {
    const p = { 'Haute': 0, 'Moyenne': 1, 'Basse': 2 };
    return p[a.priorite] - p[b.priorite] || (a.echeance || '').localeCompare(b.echeance || '');
  });

  const addTodo = async () => {
    if (!newTodo.titre) return;
    await supabase.from('todos').insert({
      titre: newTodo.titre,
      priorite: newTodo.priorite,
      statut: newTodo.statut,
      echeance: newTodo.echeance || null,
      assignee: newTodo.assignee || getCurrentUserName(profile),
      assigned_to_user_id: newTodo.assignedToUserId || user?.id,
      created_by: user?.id,
      lien_type: newTodo.lienType,
      lien_id: newTodo.lienId || null
    });
    setNewTodo({ titre: '', priorite: 'Moyenne', statut: 'À faire', echeance: '', assignee: getCurrentUserName(profile), assignedToUserId: user?.id, lienType: null, lienId: null });
    setShowNew(false);
    reload();
  };

  const updateTodo = async (id, updates) => {
    await supabase.from('todos').update(updates).eq('id', id);
    reload();
  };

  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id);
    reload();
  };

  const getLienLabel = (todo) => {
    if (!todo.lienType || !todo.lienId) return null;
    if (todo.lienType === 'mandat') { const m = mandats.find(x => x.id === todo.lienId); return m ? `📁 ${m.nom}` : null; }
    if (todo.lienType === 'client') { const c = clients.find(x => x.id === todo.lienId); return c ? `👤 ${c.prenom} ${c.nom}` : null; }
    if (todo.lienType === 'deal') {
      const d = deals.find(x => x.id === todo.lienId);
      if (!d) return null;
      const m = mandats.find(x => x.id === d.mandatId);
      const c = clients.find(x => x.id === d.clientId);
      return (m && c) ? `🤝 ${m.nom} × ${c.nom}` : null;
    }
    return null;
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">To-do personnelle</h1>
          <p className="text-stone-500">Vos priorités, liées ou indépendantes</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </button>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { id: 'all', label: 'Toutes', count: todos.length },
          { id: 'urgent', label: 'Urgentes', count: todos.filter(t => t.priorite === 'Haute' && t.statut !== 'Terminé').length },
          { id: 'todo', label: 'À faire', count: todos.filter(t => t.statut === 'À faire').length },
          { id: 'doing', label: 'En cours', count: todos.filter(t => t.statut === 'En cours').length },
          { id: 'done', label: 'Terminées', count: todos.filter(t => t.statut === 'Terminé').length }
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f.id ? 'bg-ink-deep text-white' : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'}`}>
            {f.label} <span className="opacity-70">({f.count})</span>
          </button>
        ))}
      </div>
      
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <span className="text-xs uppercase tracking-wide text-sage-dark">Assignée à :</span>
        <button onClick={() => setFilterPerson('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${filterPerson === 'all' ? 'bg-sage-dark text-white' : 'bg-white text-ink/70 hover:bg-cream-100 border border-cream-dark'}`}>
          Tout le monde
        </button>
        <button onClick={() => setFilterPerson('me')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${filterPerson === 'me' ? 'bg-sage-dark text-white' : 'bg-white text-ink/70 hover:bg-cream-100 border border-cream-dark'}`}>
          Moi ({todos.filter(t => t.assignedToUserId === user?.id).length})
        </button>
        {allProfiles.filter(p => p.id !== user?.id).map(p => (
          <button key={p.id} onClick={() => setFilterPerson(p.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filterPerson === p.id ? 'bg-sage-dark text-white' : 'bg-white text-ink/70 hover:bg-cream-100 border border-cream-dark'}`}>
            {p.prenom} ({todos.filter(t => t.assignedToUserId === p.id).length})
          </button>
        ))}
      </div>

      {showNew && (
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 mb-4 space-y-3">
          <input autoFocus value={newTodo.titre} onChange={e => setNewTodo({...newTodo, titre: e.target.value})} placeholder="Que devez-vous faire ?"
            className="w-full px-3 py-2 border-b border-stone-200 text-base focus:outline-none focus:border-stone-900" />
          <div className="grid grid-cols-4 gap-3">
            <select value={newTodo.priorite} onChange={e => setNewTodo({...newTodo, priorite: e.target.value})} className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option>Haute</option><option>Moyenne</option><option>Basse</option>
            </select>
            <input type="date" value={newTodo.echeance} onChange={e => setNewTodo({...newTodo, echeance: e.target.value})} className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" />
            <select 
              value={newTodo.assignedToUserId || ''} 
              onChange={e => {
                const selected = allProfiles.find(p => p.id === e.target.value);
                setNewTodo({
                  ...newTodo,
                  assignedToUserId: e.target.value,
                  assignee: selected ? `${selected.prenom} ${selected.nom}` : ''
                });
              }}
              className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              {allProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.prenom} {p.nom}{p.id === user?.id ? ' (moi)' : ''}
                </option>
              ))}
            </select>
            <select value={newTodo.lienType || ''} onChange={e => setNewTodo({...newTodo, lienType: e.target.value || null, lienId: null})} className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">Aucun lien</option>
              <option value="mandat">Mandat</option>
              <option value="client">Client</option>
              <option value="deal">Deal</option>
            </select>
          </div>
          {newTodo.lienType && (
            <select value={newTodo.lienId || ''} onChange={e => setNewTodo({...newTodo, lienId: e.target.value})} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
              <option value="">Sélectionner…</option>
              {newTodo.lienType === 'mandat' && mandats.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              {newTodo.lienType === 'client' && clients.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
              {newTodo.lienType === 'deal' && deals.map(d => {
                const m = mandats.find(x => x.id === d.mandatId);
                const c = clients.find(x => x.id === d.clientId);
                return m && c ? <option key={d.id} value={d.id}>{m.nom} × {c.nom}</option> : null;
              })}
            </select>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
            <button onClick={addTodo} className="px-3 py-1.5 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Ajouter</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(t => {
          const lien = getLienLabel(t);
          const enRetard = t.echeance && new Date(t.echeance) < new Date() && t.statut !== 'Terminé';
          return (
            <div key={t.id} className={`bg-white rounded-xl p-4 shadow-luxe border group ${
              t.statut === 'Terminé' ? 'border-stone-200 opacity-60' : enRetard ? 'border-red-200' : 'border-stone-200 hover:shadow-luxe-hover'
            }`}>
              <div className="flex items-start gap-3">
                <button onClick={() => updateTodo(t.id, { statut: t.statut === 'Terminé' ? 'À faire' : 'Terminé' })}
                  className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 ${t.statut === 'Terminé' ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 hover:border-stone-500'}`}>
                  {t.statut === 'Terminé' && <Check className="w-3 h-3 text-white mx-auto" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${t.statut === 'Terminé' ? 'line-through text-stone-500' : 'text-stone-900'}`}>{t.titre}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.priorite === 'Haute' ? 'bg-red-50 text-red-700' : t.priorite === 'Moyenne' ? 'bg-sage-50 text-sage-dark' : 'bg-cream-100 text-ink/80'
                    }`}>{t.priorite}</span>
                    <select value={t.statut} onChange={e => updateTodo(t.id, { statut: e.target.value })} className="text-xs px-2 py-0.5 border border-stone-200 rounded-md bg-white focus:outline-none">
                      <option>À faire</option><option>En cours</option><option>Terminé</option>
                    </select>
                    {t.echeance && <span className={`text-xs flex items-center gap-1 ${enRetard ? 'text-red-600 font-medium' : 'text-stone-500'}`}><Calendar className="w-3 h-3" />{new Date(t.echeance).toLocaleDateString('fr-FR')}</span>}
                    {lien && <span className="text-xs text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">{lien}</span>}
                    {t.assignee && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                        t.assignedToUserId === user?.id ? 'bg-sage-100 text-sage-darker' : 'bg-cream-100 text-ink/70'
                      }`}>
                        <UserIcon className="w-3 h-3" />
                        {t.assignedToUserId === user?.id ? 'Moi' : t.assignee}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-cream-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-stone-500 text-sm bg-white rounded-xl border border-cream-dark">Aucune tâche</div>
        )}
      </div>
    </div>
  );
}

// === ANNONCES ===
function AnnoncesTab({ annonces, reload, mandats }) {
  const [showNew, setShowNew] = useState(false);

  const updatePortail = async (annonceId, portail, statut) => {
    const annonce = annonces.find(a => a.id === annonceId);
    const newPortails = { ...annonce.portails, [portail]: statut };
    await supabase.from('annonces').update({
      portails: newPortails,
      last_update: new Date().toISOString().split('T')[0]
    }).eq('id', annonceId);
    reload();
  };

  const addAnnonce = async (mandatId) => {
    await supabase.from('annonces').insert({
      mandat_id: mandatId,
      portails: { seloger: 'Non diffusé', leboncoin: 'Non diffusé', bienici: 'Non diffusé', figaro: 'Non diffusé' }
    });
    setShowNew(false);
    reload();
  };

  const deleteAnnonce = async (id) => {
    if (confirm('Supprimer cette annonce ?')) {
      await supabase.from('annonces').delete().eq('id', id);
      reload();
    }
  };

  const getColorStatut = (s) => {
    if (s === 'En ligne') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'En attente') return 'bg-sage-100 text-sage-dark border-sage-light';
    if (s === 'À corriger') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-stone-100 text-stone-500 border-stone-200';
  };

  const portailLabels = { seloger: 'SeLoger', leboncoin: 'LeBonCoin', bienici: "Bien'ici", figaro: 'Figaro Immo' };
  const mandatsDispo = mandats.filter(m => !annonces.some(a => a.mandatId === m.id));

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Suivi des annonces</h1>
          <p className="text-stone-500">Diffusion multi-portails — alimentation manuelle en attendant l'API</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} disabled={mandatsDispo.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 disabled:opacity-40 text-sm font-medium">
          <Plus className="w-4 h-4" /> Publier un bien
        </button>
      </div>

      {showNew && mandatsDispo.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-stone-200 mb-6">
          <h3 className="font-display text-lg font-semibold mb-3">Sélectionner un mandat</h3>
          <div className="grid grid-cols-2 gap-2">
            {mandatsDispo.map(m => (
              <button key={m.id} onClick={() => addAnnonce(m.id)}
                className="text-left p-3 border border-stone-200 rounded-lg hover:border-stone-900 hover:bg-cream-50">
                <div className="font-medium text-sm text-stone-900">{m.nom}</div>
                <div className="text-xs text-stone-500 mt-0.5">{m.type} • {formatPrix(m.prix)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {annonces.map(a => {
          const m = mandats.find(x => x.id === a.mandatId);
          if (!m) return null;
          const nbEnLigne = Object.values(a.portails || {}).filter(p => p === 'En ligne').length;
          return (
            <div key={a.id} className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-display text-lg font-semibold text-stone-900">{m.nom}</div>
                  <div className="text-xs text-stone-500 flex items-center gap-3 mt-1">
                    {a.datePublication && <span>Publié le {new Date(a.datePublication).toLocaleDateString('fr-FR')}</span>}
                    {a.lastUpdate && <><span>•</span><span>Maj {new Date(a.lastUpdate).toLocaleDateString('fr-FR')}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-stone-900">{nbEnLigne}<span className="text-stone-400 text-lg">/4</span></div>
                    <div className="text-xs text-stone-500">en ligne</div>
                  </div>
                  <button onClick={() => deleteAnnonce(a.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {PORTAILS.map(p => (
                  <div key={p} className="border border-stone-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-stone-700 uppercase tracking-wide mb-2">{portailLabels[p]}</div>
                    <select value={(a.portails || {})[p] || 'Non diffusé'} onChange={e => updatePortail(a.id, p, e.target.value)}
                      className={`w-full text-xs font-medium px-2 py-1.5 rounded-md border focus:outline-none ${getColorStatut((a.portails || {})[p])}`}>
                      {STATUTS_PORTAIL.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {annonces.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 text-stone-500 text-sm">
            Aucun bien publié pour le moment
          </div>
        )}
      </div>
    </div>
  );
}

// === QUESTIONNAIRES ===
function QuestionnairesTab({ questionnaires, reload }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showQR, setShowQR] = useState(null);

  const templates = {
    vendeur: {
      nom: 'Questionnaire Vendeur',
      color: 'amber',
      description: 'Qualification du bien et des attentes vendeur',
      sections: [
        { titre: 'Le bien', questions: ['Type et adresse', 'Surface totale et répartition', 'État général (toiture, façade, parties communes)', 'Travaux prévus ou à prévoir', 'Composition locative (lots, commerces)'] },
        { titre: 'Financier', questions: ['Prix de vente souhaité', 'Loyers annuels HC/HT', 'Taxe foncière', 'Charges annuelles', 'Rendement cible'] },
        { titre: 'Attentes & timing', questions: ['Type de commercialisation souhaitée', 'Timing de vente', "Contraintes particulières (locataires, préemption, indivision)", 'Exclusivité ou mandat simple'] }
      ]
    },
    acquereur: {
      nom: "Questionnaire Acquéreur",
      color: 'emerald',
      description: 'Profil investisseur et critères',
      sections: [
        { titre: "Identité", questions: ['Nom / Société', 'Typologie (Foncière, MDB, Family Office…)', 'Nature juridique', 'Personne de contact'] },
        { titre: 'Critères', questions: ["Type d'actifs recherchés", 'Budget min / max', 'Rendement minimum', 'Zones géographiques', 'Stratégie (Core, Value-add, Opportuniste)'] },
        { titre: 'Maturité & process', questions: ['Horizon de décision', 'Financement (cash, crédit, mixte)', "Historique d'acquisitions", 'Équipe & décisionnaires'] }
      ]
    }
  };

  const sendQuestionnaire = async (type) => {
    const lien = `https://patrimonia.crm/q/${type}/${Math.random().toString(36).slice(2, 10)}`;
    const { data } = await supabase.from('questionnaires').insert({
      type, nom: templates[type].nom, lien
    }).select().single();
    setShowQR(toCamel(data));
    reload();
  };

  const deleteQ = async (id) => {
    await supabase.from('questionnaires').delete().eq('id', id);
    reload();
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Questionnaires</h1>
        <p className="text-stone-500">Qualifiez vendeurs & acquéreurs avec des formulaires structurés</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {Object.entries(templates).map(([key, t]) => (
          <div key={key} className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <div className={`inline-flex w-12 h-12 rounded-xl mb-4 items-center justify-center ${
              t.color === 'amber' ? 'bg-sage-100 text-sage-dark' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <FileQuestion className="w-6 h-6" />
            </div>
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-1">{t.nom}</h2>
            <p className="text-sm text-stone-500 mb-4">{t.description}</p>
            <div className="mb-4">
              <div className="text-xs text-stone-500 uppercase mb-2 font-medium">Structure</div>
              {t.sections.map(s => (
                <div key={s.titre} className="text-sm text-stone-700 flex items-center gap-2 mb-1">
                  <Circle className="w-1.5 h-1.5 fill-current text-stone-400" />
                  {s.titre} <span className="text-stone-400 text-xs">({s.questions.length})</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedTemplate(key)} className="flex-1 px-3 py-2 bg-stone-100 text-stone-800 rounded-lg text-sm hover:bg-cream-200 flex items-center justify-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Aperçu
              </button>
              <button onClick={() => sendQuestionnaire(key)} className="flex-1 px-3 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-stone-800 flex items-center justify-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Générer un lien
              </button>
            </div>
          </div>
        ))}
      </div>

      {questionnaires.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 mb-4">Liens générés</h2>
          <div className="space-y-2">
            {questionnaires.map(q => (
              <div key={q.id} className="bg-white rounded-xl p-4 shadow-luxe border border-stone-200 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  q.type === 'vendeur' ? 'bg-sage-100 text-sage-dark' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <FileQuestion className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-stone-900">{q.nom}</div>
                  <div className="text-xs text-stone-500 truncate font-mono">{q.lien}</div>
                </div>
                <span className="text-xs text-stone-500">{(q.reponses || []).length} réponses</span>
                <button onClick={() => navigator.clipboard.writeText(q.lien)} className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg" title="Copier">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => setShowQR(q)} className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg" title="QR Code">
                  <QrCode className="w-4 h-4" />
                </button>
                <button onClick={() => deleteQ(q.id)} className="p-2 text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={() => setSelectedTemplate(null)}>
          <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-cream-dark">
              <h2 className="font-display text-2xl font-semibold text-stone-900">{templates[selectedTemplate].nom}</h2>
              <button onClick={() => setSelectedTemplate(null)}><X className="w-5 h-5 text-stone-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              {templates[selectedTemplate].sections.map(s => (
                <div key={s.titre}>
                  <h3 className="font-display text-lg font-semibold text-stone-900 mb-3">{s.titre}</h3>
                  <div className="space-y-2">
                    {s.questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-stone-700 p-3 bg-stone-50 rounded-lg">
                        <span className="text-stone-400 font-mono">{String(i+1).padStart(2, '0')}</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-xl shadow-luxe-hover max-w-md w-full p-8 text-center" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-4">{showQR.nom}</h2>
            <div className="bg-stone-100 rounded-xl p-6 mb-4">
              <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center relative overflow-hidden">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {Array.from({ length: 225 }).map((_, i) => {
                    const hash = ((String(showQR.id || '').charCodeAt(i % (String(showQR.id || 'x').length)) * (i + 1)) % 7);
                    if (hash < 3) return null;
                    return <rect key={i} x={(i % 15) * 6 + 5} y={Math.floor(i / 15) * 6 + 5} width="5" height="5" fill="#1c1917" />;
                  })}
                  <rect x="5" y="5" width="20" height="20" fill="none" stroke="#1c1917" strokeWidth="3" />
                  <rect x="75" y="5" width="20" height="20" fill="none" stroke="#1c1917" strokeWidth="3" />
                  <rect x="5" y="75" width="20" height="20" fill="none" stroke="#1c1917" strokeWidth="3" />
                  <rect x="12" y="12" width="6" height="6" fill="#1c1917" />
                  <rect x="82" y="12" width="6" height="6" fill="#1c1917" />
                  <rect x="12" y="82" width="6" height="6" fill="#1c1917" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-stone-500 font-mono mb-4 break-all">{showQR.lien}</p>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(showQR.lien)} className="flex-1 px-4 py-2 bg-stone-100 text-stone-800 rounded-lg text-sm hover:bg-cream-200 flex items-center justify-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copier le lien
              </button>
              <button onClick={() => setShowQR(null)} className="flex-1 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === EMAILINGS ===
function EmailingsTab({ campagnes, reload, clients }) {
  const [showNew, setShowNew] = useState(false);
  const [segment, setSegment] = useState({ typologies: [], zones: [], budgetMin: 0, budgetMax: 100000000, typologiesRecherchees: [] });
  const [newCampagne, setNewCampagne] = useState({ nom: '', sujet: '', corps: '' });

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (segment.typologies.length && !segment.typologies.includes(c.typologie)) return false;
      if (segment.zones.length && !(c.zones || []).some(z => segment.zones.includes(z))) return false;
      if (parseFloat(c.budgetMax) < segment.budgetMin || parseFloat(c.budgetMin) > segment.budgetMax) return false;
      if (segment.typologiesRecherchees.length && !(c.typologiesRecherchees || []).some(t => segment.typologiesRecherchees.includes(t))) return false;
      return true;
    });
  }, [clients, segment]);

  const toggleSegment = (key, value) => {
    const arr = segment[key];
    setSegment({ ...segment, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] });
  };

  const createCampagne = async () => {
    if (!newCampagne.nom) return;
    await supabase.from('campagnes').insert({
      nom: newCampagne.nom,
      sujet: newCampagne.sujet,
      corps: newCampagne.corps,
      segment: [segment.typologies.join('+'), segment.zones.join('+')].filter(Boolean).join(' — ') || 'Tous',
      nb_destinataires: filteredClients.length
    });
    setNewCampagne({ nom: '', sujet: '', corps: '' });
    setShowNew(false);
    reload();
  };

  const sendCampagne = async (id) => {
    await supabase.from('campagnes').update({
      statut: 'Envoyée',
      date_envoi: new Date().toISOString().split('T')[0],
      taux: Math.floor(20 + Math.random() * 30)
    }).eq('id', id);
    reload();
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">Emailings & Sourcing</h1>
          <p className="text-stone-500">Segmentez vos acquéreurs et activez-les sur les bons actifs</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-4 py-2.5 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouvelle campagne
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-stone-200 mb-6">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Créer une campagne ciblée</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Nom de la campagne"><input type="text" value={newCampagne.nom} onChange={e => setNewCampagne({...newCampagne, nom: e.target.value})} placeholder="Ex : Hôtels IDF Q2" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
              <Field label="Sujet"><input type="text" value={newCampagne.sujet} onChange={e => setNewCampagne({...newCampagne, sujet: e.target.value})} placeholder="Ex : Nouvelles opportunités" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900" /></Field>
              <Field label="Corps du message"><textarea value={newCampagne.corps} onChange={e => setNewCampagne({...newCampagne, corps: e.target.value})} rows={6} placeholder="Cher {prenom}…" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900 font-mono" /></Field>
            </div>
            <div className="space-y-4">
              <Field label="Typologies">
                <div className="flex flex-wrap gap-2">
                  {TYPOLOGIES_CLIENT.map(t => (
                    <button key={t} onClick={() => toggleSegment('typologies', t)}
                      className={`px-3 py-1 text-xs rounded-full border ${segment.typologies.includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Zones">
                <div className="flex flex-wrap gap-2">
                  {ZONES.map(z => (
                    <button key={z} onClick={() => toggleSegment('zones', z)}
                      className={`px-3 py-1 text-xs rounded-full border ${segment.zones.includes(z) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{z}</button>
                  ))}
                </div>
              </Field>
              <Field label="Typologies d'actifs recherchées">
                <div className="flex flex-wrap gap-2">
                  {TYPES_ACTIF.map(t => (
                    <button key={t} onClick={() => toggleSegment('typologiesRecherchees', t)}
                      className={`px-3 py-1 text-xs rounded-full border ${segment.typologiesRecherchees.includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <div className="bg-stone-50 rounded-lg p-4">
                <div className="text-xs text-stone-500 uppercase mb-1">Destinataires matchés</div>
                <div className="font-display text-3xl font-semibold text-stone-900">{filteredClients.length}</div>
                <div className="text-xs text-stone-500 mt-1">contacts selon vos critères</div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-cream-dark">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
            <button onClick={createCampagne} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Créer la campagne</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {campagnes.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-stone-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-display text-lg font-semibold text-stone-900">{c.nom}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.statut === 'Envoyée' ? 'bg-emerald-50 text-emerald-700' : 'bg-cream-100 text-ink/80'
                  }`}>{c.statut}</span>
                </div>
                <div className="text-sm text-stone-500 mb-3">{c.segment}</div>
                <div className="flex items-center gap-5 text-sm">
                  <div><span className="text-stone-500">Destinataires:</span> <span className="font-medium">{c.nbDestinataires}</span></div>
                  {c.dateEnvoi && <div><span className="text-stone-500">Envoyée le:</span> <span className="font-medium">{new Date(c.dateEnvoi).toLocaleDateString('fr-FR')}</span></div>}
                  {c.taux > 0 && <div><span className="text-stone-500">Ouverture:</span> <span className="font-medium text-emerald-700">{c.taux}%</span></div>}
                </div>
              </div>
              <div>
                {c.statut === 'Brouillon' ? (
                  <button onClick={() => sendCampagne(c.id)} className="flex items-center gap-1.5 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
                    <Send className="w-3.5 h-3.5" /> Envoyer
                  </button>
                ) : (
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-stone-900">{c.taux}%</div>
                    <div className="text-xs text-stone-500">ouverture</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {campagnes.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 text-stone-500 text-sm">
            Aucune campagne
          </div>
        )}
      </div>
    </div>
  );
}
