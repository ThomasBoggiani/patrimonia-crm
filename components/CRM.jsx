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
  Image as ImageIcon, Camera, Plug, FolderOpen, Trophy, TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, isAdmin, getCurrentUserName, getCurrentUserInitials } from '@/lib/auth';
import { getPriceTTC, getPriceNV, isNVEstimated, getCommission, isCommissionEstimated } from '@/lib/priceDisplay';
import AICreateModal from './AICreateModal';
import MarkAsSoldModal from './MarkAsSoldModal';
import VoiceNoteModal from './VoiceNoteModal';
import MandatAIAssistant from './MandatAIAssistant';
import DocumentsModal from './DocumentsModal';
import AgendaTab from './AgendaTab';
import TeamTab from './TeamTab';
import MyProfile from './MyProfile';
import AIAnalyzeModal from './AIAnalyzeModal';
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

function isManager(profile) {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'directeur') return true;
  if (profile.prenom === 'Thomas' && (profile.nom === 'Ezquerra' || profile.nom === 'Boggiani')) return true;
  return false;
}
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
const STATUTS_MANDAT = ['Sourcing', 'Analyse', 'Mandat signé', 'Commercialisation', 'Offre', 'Promesse', 'Acte', 'Vendu par autres', 'Perdu'];
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
  const [showAICreate, setShowAICreate] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabKey, setTabKey] = useState(0);
  const [loading, setLoading] = useState(true);
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
  const [allProfiles, setAllProfiles] = useState([]);
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
      const profiles = await supabase.from('profiles').select('id, prenom, nom, role, actif').eq('actif', true);
    setAllProfiles(profiles.data || []);
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
    ...(isManager(profile) ? [{ id: 'direction', label: 'Direction', icon: Building2 }] : []),
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
            {/* Bouton ✨ Créer avec l'IA - unifié */}
            <button 
              onClick={() => { setShowAICreate(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mb-3 gradient-sage-dark text-white hover:opacity-90 shadow-luxe font-medium"
            >
              <Sparkles className="w-4 h-4" />
              <span>Créer avec l'IA</span>
            </button> 
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setTabKey(k => k + 1); setSidebarOpen(false); }}
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
                <button
                  onClick={() => { setActiveTab('myprofile'); setTabKey(k => k + 1); setSidebarOpen(false); }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg p-1 -m-1 hover:bg-cream-100 transition-colors group"
                  title="Voir ma fiche"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden gradient-sage-dark flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{getCurrentUserInitials(profile)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate group-hover:text-sage-darker">{getCurrentUserName(profile)}</div>
                    <div className="text-[10px] text-sage-dark truncate">{profile?.fonction || profile?.role || 'Utilisateur'}</div>
                  </div>
                </button>
                {!isMobileView && <NotificationBell />}
              </div>
              <button onClick={signOut} className="w-full text-[11px] text-ink/60 hover:text-ink py-1 rounded hover:bg-cream-100">
                Se déconnecter
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="fade-in" key={`${activeTab}-${tabKey}`}>
            {activeTab === 'dashboard' && <Dashboard mandats={mandats} clients={clients} deals={deals} todos={todos} reload={loadAll} allProfiles={allProfiles} />}
            {activeTab === 'mandats' && <MandatsTab mandats={mandats} reload={loadAll} clients={clients} deals={deals} interactions={interactions} todos={todos} annonces={annonces} allProfiles={allProfiles} />}
            {activeTab === 'clients' && <ClientsTab clients={clients} reload={loadAll} mandats={mandats} deals={deals} interactions={interactions} />}
            {activeTab === 'deals' && <DealsTab deals={deals} reload={loadAll} mandats={mandats} clients={clients} />}
            {activeTab === 'matching' && <MatchingTab mandats={mandats} clients={clients} deals={deals} reload={loadAll} />}
            {activeTab === 'todos' && <TodosTab todos={todos} reload={loadAll} mandats={mandats} clients={clients} deals={deals} allProfiles={allProfiles} />}
            {activeTab === 'direction' && <DashboardDirection mandats={mandats} deals={deals} clients={clients} todos={todos} allProfiles={allProfiles} />}
            {activeTab === 'myprofile' && <MyProfile mandats={mandats} todos={todos} clients={clients} allProfiles={allProfiles} RemunerationComponent={RemunerationTab} onNavigate={(t) => { setActiveTab(t); setTabKey(k => k + 1); }} />}
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

      {/* Modal ✨ Créer avec l'IA */}
      <AICreateModal
        open={showAICreate}
        onClose={() => setShowAICreate(false)}
        onCreated={({ mandat, client }) => {
          const parts = [];
          if (mandat) parts.push('Mandat créé');
          if (client) parts.push('Client créé');
          setImportToast(parts.join(' · '));
          loadAll();
          setTimeout(() => setImportToast(null), 5000);
        }}
      />
    </div>
  );
}

// === DASHBOARD ===
// ═══════════════════════════════════════════════════════════════════
// Dashboard v2 — vue centrée sur l'utilisateur connecté
// À coller dans components/CRM.jsx en remplacement de la fonction Dashboard actuelle
// Lignes ~365-446 dans l'original
// ═══════════════════════════════════════════════════════════════════

function Dashboard({ mandats, clients, deals, todos, reload, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const myInitials = getCurrentUserInitials(profile);
  const myFirstName = profile?.prenom || (profile?.nom ? profile.nom.split(' ')[0] : 'utilisateur');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

  // ─── KPIs personnalisés ───
  const myMandats = mandats.filter(m => m.owner === myInitials && !['Perdu', 'Acte', 'Vendu par autres'].includes(m.statut));
  
  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.toDateString() === today.toDateString();
  };
  
  const myTodayTasks = todos.filter(t => 
    (t.assignedToUserId === user?.id || t.assigned_to_user_id === user?.id)
    && t.statut !== 'Terminé' 
    && isToday(t.echeance)
  );

  // Affaires en cours = à partir de la signature de l'offre (Offre, Promesse, Acte)
  const affairesEnCours = mandats.filter(m => 
    ['Offre', 'Promesse', 'Acte'].includes(m.statut)
  );

  // Honoraires prévisionnels = uniquement mandats en Promesse (signée mais pas encore vendue)
  const honorairesPrevisionnels = mandats
    .filter(m => m.statut === 'Promesse')
    .reduce((sum, m) => sum + (parseFloat(m.honorairesMontant) || 0), 0);

  // ─── Tâches par priorité ───
  const myTasks = todos.filter(t => 
    (t.assignedToUserId === user?.id || t.assigned_to_user_id === user?.id)
    && t.statut !== 'Terminé'
  );

  const tasksRetard = myTasks.filter(t => {
    if (!t.echeance) return false;
    return new Date(t.echeance) < today;
  });

  const tasksAujourdhui = myTasks.filter(t => isToday(t.echeance));

  const tasksSemaine = myTasks.filter(t => {
    if (!t.echeance) return false;
    const d = new Date(t.echeance);
    return d >= tomorrow && d <= endOfWeek;
  });

  // ─── Alertes intelligentes ───
  const mandatsExpirentBientot = mandats.filter(m => {
    if (!m.mandatDateEcheance && !m.mandat_date_echeance) return false;
    const dateStr = m.mandatDateEcheance || m.mandat_date_echeance;
    const d = new Date(dateStr);
    const days = (d - today) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  });

  const mandatsSansDPE = mandats.filter(m => 
    !['Perdu', 'Acte', 'Vendu par autres'].includes(m.statut) 
    && !m.dpeConsommation 
    && !m.dpe_consommation
  );

  const mandatsSansPhotos = mandats.filter(m => {
    if (['Perdu', 'Acte'].includes(m.statut)) return false;
    const photos = m.photos || m.docs;
    if (!photos) return true;
    if (Array.isArray(photos)) return photos.length === 0;
    return false;
  });

  // Salutation contextuelle
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir';
  const dateLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-1">
          {greeting}, {myFirstName}
        </h1>
        <p className="text-stone-500 capitalize">{dateLabel}</p>
      </div>

      {/* ═══ 4 KPIs personnalisés ═══ */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Mes mandats"
          value={myMandats.length}
          icon={Building2}
          accent="sage"
          sublabel={`Sur ${mandats.filter(m => !['Perdu', 'Acte', 'Vendu par autres'].includes(m.statut)).length} actifs au total`}
        />
        <KpiCard
          label="Mes tâches du jour"
          value={myTodayTasks.length}
          icon={CheckSquare}
          accent={myTodayTasks.length > 0 ? "amber" : "stone"}
          sublabel={tasksRetard.length > 0 ? `+ ${tasksRetard.length} en retard` : 'À jour ✓'}
        />
        <KpiCard
          label="Affaires en cours"
          value={affairesEnCours.length}
          icon={Handshake}
          accent="emerald"
          sublabel="Offre → Acte"
        />
        <KpiCard
          label="Honoraires prévisionnels"
          value={formatPrixCompact(honorairesPrevisionnels)}
          icon={Sparkles}
          accent="sage"
          sublabel="Promesse signée"
          isAmount
        />
      </div>

      {/* ═══ Tâches par priorité ═══ */}
      <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-6">
        <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-sage-dark" />
          À faire aujourd'hui
        </h2>

        {tasksRetard.length === 0 && tasksAujourdhui.length === 0 && tasksSemaine.length === 0 && (
          <div className="text-center py-8 text-stone-400">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm">Aucune tâche en attente — bien joué !</p>
          </div>
        )}

        {tasksRetard.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <h3 className="text-sm font-semibold text-red-700">En retard ({tasksRetard.length})</h3>
            </div>
            <div className="space-y-1.5">
              {tasksRetard.slice(0, 5).map(t => (
                <TaskInline key={t.id} task={t} mandats={mandats} clients={clients} onUpdate={() => window.location.reload()} />
              ))}
            </div>
          </div>
        )}

        {tasksAujourdhui.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-sm font-semibold text-amber-700">Aujourd'hui ({tasksAujourdhui.length})</h3>
            </div>
            <div className="space-y-1.5">
              {tasksAujourdhui.slice(0, 5).map(t => (
                <TaskRow key={t.id} task={t} mandats={mandats} variant="today" />
              ))}
            </div>
          </div>
        )}

        {tasksSemaine.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-sage-dark" />
              <h3 className="text-sm font-semibold text-sage-darker">Cette semaine ({tasksSemaine.length})</h3>
            </div>
            <div className="space-y-1.5">
              {tasksSemaine.slice(0, 5).map(t => (
                <TaskRow key={t.id} task={t} mandats={mandats} variant="week" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Alertes intelligentes ═══ */}
      {(mandatsExpirentBientot.length > 0 || mandatsSansDPE.length > 0 || mandatsSansPhotos.length > 0) && (
        <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark mb-6">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Points d'attention
          </h2>
          <div className="space-y-2">
            {mandatsExpirentBientot.length > 0 && (
              <AlertRow
                level="warning"
                count={mandatsExpirentBientot.length}
                label={`mandat${mandatsExpirentBientot.length > 1 ? 's' : ''} expire${mandatsExpirentBientot.length > 1 ? 'nt' : ''} dans les 30 prochains jours`}
                items={mandatsExpirentBientot.slice(0, 3).map(m => m.nom)}
              />
            )}
            {mandatsSansDPE.length > 0 && (
              <AlertRow
                level="info"
                count={mandatsSansDPE.length}
                label={`mandat${mandatsSansDPE.length > 1 ? 's' : ''} sans DPE renseigné`}
                items={mandatsSansDPE.slice(0, 3).map(m => m.nom)}
              />
            )}
            {mandatsSansPhotos.length > 0 && (
              <AlertRow
                level="info"
                count={mandatsSansPhotos.length}
                label={`mandat${mandatsSansPhotos.length > 1 ? 's' : ''} sans photos`}
                items={mandatsSansPhotos.slice(0, 3).map(m => m.nom)}
              />
            )}
          </div>
        </div>
      )}

      {/* ═══ Récap global du portefeuille ═══ */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">Portefeuille total</div>
          <div className="text-2xl font-display font-semibold text-stone-900">
            {formatPrixCompact(mandats.filter(m => m.statut !== 'Perdu').reduce((s, m) => s + (parseFloat(m.prix) || 0), 0))}
          </div>
          <div className="text-xs text-stone-500 mt-1">{mandats.filter(m => !['Perdu', 'Acte', 'Vendu par autres'].includes(m.statut)).length} mandats actifs</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">Off-market</div>
          <div className="text-2xl font-display font-semibold text-stone-900">
            {mandats.filter(m => m.commercialisation === 'Off-market' && !['Perdu', 'Acte', 'Vendu par autres'].includes(m.statut)).length}
          </div>
          <div className="text-xs text-stone-500 mt-1">Mandats discrets</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">Clients actifs</div>
          <div className="text-2xl font-display font-semibold text-stone-900">
            {clients.filter(c => c.statut === 'Actif').length}
          </div>
          <div className="text-xs text-stone-500 mt-1">Sur {clients.length} au total</div>
        </div>
      </div>
    </div>
  );
}

// Carte KPI personnalisée
function KpiCard({ label, value, icon: Icon, accent, sublabel, isAmount }) {
  const accentColors = {
    sage: 'bg-sage-50 text-sage-dark border-sage-light',
    stone: 'bg-stone-50 text-stone-700 border-stone-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-luxe border border-cream-dark">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${accentColors[accent] || accentColors.stone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">{label}</div>
      <div className={`font-display font-semibold text-stone-900 ${isAmount ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      {sublabel && <div className="text-xs text-stone-500 mt-1">{sublabel}</div>}
    </div>
  );
}

// Ligne tâche avec lien au mandat
function TaskRow({ task, mandats, variant }) {
  const variantStyles = {
    late: 'bg-red-50/50 border-red-100',
    today: 'bg-amber-50/50 border-amber-100',
    week: 'bg-sage-50/40 border-sage-light/50',
  };
  const linkedMandat = task.mandatId || task.mandat_id ? mandats.find(m => m.id === (task.mandatId || task.mandat_id)) : null;
  const echeanceLabel = task.echeance 
    ? new Date(task.echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    : '—';
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${variantStyles[variant] || variantStyles.week}`}>
      <div className="w-3 h-3 rounded border-2 border-stone-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900 truncate">{task.titre}</div>
        {linkedMandat && (
          <div className="text-xs text-stone-500 truncate">→ {linkedMandat.nom}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.priorite === 'Haute' && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Haute</span>}
        <span className="text-xs text-stone-500 flex items-center gap-1">
          <Calendar className="w-3 h-3" />{echeanceLabel}
        </span>
      </div>
    </div>
  );
}

// Ligne d'alerte
function AlertRow({ level, count, label, items }) {
  const levelStyles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`p-3 rounded-lg border ${levelStyles[level] || levelStyles.info}`}>
      <div className="flex items-start gap-2">
        <div className="font-medium text-sm">
          <span className="font-bold">{count}</span> {label}
        </div>
      </div>
      {items && items.length > 0 && (
        <div className="mt-1 text-xs opacity-80">
          {items.join(' · ')}{items.length < count ? '...' : ''}
        </div>
      )}
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
    'Off-market': { dot: 'bg-amber-400', bg: 'bg-stone-900', text: 'text-amber-300', label: 'Off-market' },
    'Mandat exclusif': { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Exclusif' },
    'Mandat simple': { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', label: 'Simple' }
  };
  const c = config[comm] || config['Off-market'];
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${c.bg}`}>
        <div className={`w-1 h-1 rounded-full ${c.dot}`} />
        <span className={`text-[10px] font-medium ${c.text}`}>{c.label}</span>
      </div>
      {dateSignature && <span className="text-[9px] text-stone-500 ml-1.5">Signé {new Date(dateSignature).toLocaleDateString('fr-FR')}</span>}
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
    'Vendu par autres': 'bg-amber-50 text-amber-800',
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

// ═══════════════════════════════════════════════════════════════════
// TaskInline : composant réutilisable pour afficher + modifier une tâche
// Utilisé dans le Dashboard, fiche Mandat, fiche Client
// ═══════════════════════════════════════════════════════════════════
function TaskInline({ task, mandats = [], clients = [], allProfiles = [], onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ titre: task.titre, echeance: task.echeance || '', priorite: task.priorite || 'Moyenne', statut: task.statut || 'À faire', assignedToUserId: task.assignedToUserId || null, assignee: task.assignee || '' });

  const isLate = task.echeance && new Date(task.echeance) < new Date(new Date().toDateString()) && task.statut !== 'Terminé';
  const isToday = task.echeance && new Date(task.echeance).toDateString() === new Date().toDateString();
  const isDone = task.statut === 'Terminé';

  const linkedMandat = task.lienId && task.lienType === 'mandat' ? mandats.find(m => m.id === task.lienId) : null;
  const linkedClient = task.lienId && task.lienType === 'client' ? clients.find(c => c.id === task.lienId) : null;

  async function toggle() {
    await supabase.from('todos').update({
      statut: isDone ? 'À faire' : 'Terminé',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    if (onUpdate) onUpdate();
  }

  async function saveEdit() {
    await supabase.from('todos').update({
      titre: editData.titre,
      echeance: editData.echeance || null,
      priorite: editData.priorite,
      statut: editData.statut,
      assigned_to_user_id: editData.assignedToUserId || null,
      assignee: editData.assignee || null,
    }).eq('id', task.id);
    setEditing(false);
    if (onUpdate) onUpdate();
  }

  async function deleteTask() {
    if (!confirm('Supprimer cette tâche ?')) return;
    await supabase.from('todos').delete().eq('id', task.id);
    if (onUpdate) onUpdate();
  }

  if (editing) {
    return (
      <div className="p-3 bg-white border border-stone-300 rounded-lg space-y-2">
        <input type="text" value={editData.titre} onChange={e => setEditData({ ...editData, titre: e.target.value })}
          className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={editData.echeance} onChange={e => setEditData({ ...editData, echeance: e.target.value })}
            className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
          <select value={editData.priorite} onChange={e => setEditData({ ...editData, priorite: e.target.value })}
            className="px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
            <option>Haute</option>
            <option>Moyenne</option>
            <option>Basse</option>
          </select>
        </div>
        <select value={editData.statut} onChange={e => setEditData({ ...editData, statut: e.target.value })}
          className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
          <option>À faire</option>
          <option>En cours</option>
          <option>Terminé</option>
        </select>
        <select value={editData.assignedToUserId || ''} onChange={e => {
          const userId = e.target.value || null;
          const profile = allProfiles.find(p => p.id === userId);
          setEditData({ ...editData, assignedToUserId: userId, assignee: profile ? `${profile.prenom} ${profile.nom}` : '' });
        }} className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
          <option value="">Non assigné</option>
          {allProfiles.map(p => (
            <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={saveEdit} className="flex-1 px-3 py-1.5 bg-stone-900 text-white rounded text-sm hover:bg-stone-800">Enregistrer</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${
      isDone ? 'bg-stone-50 border-stone-200 opacity-60' :
      isLate ? 'bg-red-50/50 border-red-100' :
      isToday ? 'bg-amber-50/50 border-amber-100' :
      'bg-white border-stone-200 hover:bg-stone-50'
    }`}>
      <button onClick={toggle} className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
        isDone ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 hover:border-stone-500'
      }`}>
        {isDone && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isDone && setEditing(true)}>
        <div className={`text-sm font-medium ${isDone ? 'line-through text-stone-500' : 'text-stone-900'}`}>{task.titre}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {linkedMandat && <span className="text-[10px] text-stone-500">→ {linkedMandat.nom}</span>}
          {linkedClient && <span className="text-[10px] text-stone-500">→ {linkedClient.prenom} {linkedClient.nom}</span>}
          {task.priorite === 'Haute' && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Haute</span>}
          {task.echeance && (
            <span className={`text-[10px] flex items-center gap-1 ${isLate ? 'text-red-600 font-medium' : isToday ? 'text-amber-700 font-medium' : 'text-stone-500'}`}>
              <Calendar className="w-2.5 h-2.5" />
              {new Date(task.echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
          {task.assignee && <span className="text-[10px] text-stone-400">· {task.assignee}</span>}
        </div>
      </div>

      <button onClick={deleteTask} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0" title="Supprimer">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// QuickAddTask : ajout rapide de tâche en 1 ligne
function QuickAddTask({ lienType = null, lienId = null, defaultAssignee, defaultUserId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ titre: '', echeance: '', priorite: 'Moyenne' });

  async function save() {
    if (!data.titre.trim()) return;
    await supabase.from('todos').insert({
      titre: data.titre,
      priorite: data.priorite,
      statut: 'À faire',
      echeance: data.echeance || null,
      assignee: defaultAssignee || null,
      assigned_to_user_id: defaultUserId || null,
      lien_type: lienType,
      lien_id: lienId,
    });
    setData({ titre: '', echeance: '', priorite: 'Moyenne' });
    setOpen(false);
    if (onAdd) onAdd();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-900 hover:bg-stone-50 border border-dashed border-stone-300 rounded-lg">
        <Plus className="w-4 h-4" /> Ajouter une tâche
      </button>
    );
  }

  return (
    <div className="p-3 bg-white border border-stone-300 rounded-lg space-y-2">
      <input type="text" placeholder="Titre de la tâche..." value={data.titre} onChange={e => setData({ ...data, titre: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
        className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={data.echeance} onChange={e => setData({ ...data, echeance: e.target.value })}
          className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
        <select value={data.priorite} onChange={e => setData({ ...data, priorite: e.target.value })}
          className="px-2 py-1.5 border border-stone-200 rounded text-sm bg-white">
          <option>Haute</option>
          <option>Moyenne</option>
          <option>Basse</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={!data.titre.trim()} className="flex-1 px-3 py-1.5 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50">Ajouter</button>
        <button onClick={() => { setOpen(false); setData({ titre: '', echeance: '', priorite: 'Moyenne' }); }} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
      </div>
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
function MandatsTab({ mandats, reload, clients, deals, todos, annonces, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [secondaryDisplay, setSecondaryDisplay] = useState('m2'); // 'm2' | 'nv_comm'
  const [search, setSearch] = useState('');
  const [filterComm, setFilterComm] = useState('Tous');
  const [filterType, setFilterType] = useState('Tous');
  const [filterStatut, setFilterStatut] = useState('Actifs'); // 'Actifs' = exclut Perdu/Vendu par autres
  const [view, setView] = useState('list'); // 'list' | 'kanban'
  const [editingMandat, setEditingMandat] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedMandat, setSelectedMandat] = useState(null);
  const [sellingMandat, setSellingMandat] = useState(null);

  const filtered = mandats.filter(m => {
    if (search && !m.nom.toLowerCase().includes(search.toLowerCase()) && !(m.adresse || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterComm !== 'Tous' && m.commercialisation !== filterComm) return false;
    if (filterType !== 'Tous' && m.type !== filterType) return false;
    if (filterStatut === 'Actifs' && ['Perdu', 'Vendu par autres', 'Acte'].includes(m.statut)) return false;
    if (filterStatut !== 'Tous' && filterStatut !== 'Actifs' && m.statut !== filterStatut) return false;
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
    return <MandatDetail mandat={currentMandat} onBack={() => setSelectedMandat(null)} onEdit={() => { setEditingMandat(currentMandat); setSelectedMandat(null); }} deals={deals} clients={clients} reload={reload} todos={todos} annonces={annonces} allProfiles={allProfiles} />;
  }

  return (
    <div className="p-6 max-w-none">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Mandats</h1>
          <span className="text-stone-500 text-sm">
            {filtered.length} bien{filtered.length > 1 ? 's' : ''} · Portefeuille {formatPrixCompact(mandats.reduce((s,m)=>s+(getPriceTTC(m)||0),0))}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Prix m² / Net Vendeur + Commission */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5" title="Affichage secondaire sous le prix">
            <button onClick={() => setSecondaryDisplay('m2')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md ${secondaryDisplay === 'm2' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              title="Afficher le prix au m²">
              📐 m²
            </button>
            <button onClick={() => setSecondaryDisplay('nv_comm')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md ${secondaryDisplay === 'nv_comm' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              title="Afficher le net vendeur et la commission">
              💼 NV + Comm.
            </button>
          </div>
          {/* Toggle Liste / Kanban */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${view === 'list' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Liste
            </button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${view === 'kanban' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Kanban
            </button>
          </div>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-3 py-2 bg-ink-deep text-white rounded-lg hover:bg-stone-800 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nouveau mandat
          </button>
        </div>
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
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option value="Actifs">En cours</option>
          <option value="Tous">Tous</option>
          {STATUTS_MANDAT.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {view === 'kanban' ? (         <MandatsKanban mandats={filtered} onSelectMandat={setSelectedMandat} reload={reload} secondaryDisplay={secondaryDisplay} />       ) : (       <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <table className="w-full">
              <colgroup>
                <col style={{ width: '80px' }} />
                <col />
                <col style={{ width: '180px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
          <thead className="bg-stone-50 border-b border-cream-dark">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide w-24">Photo</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Bien</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Type</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Prix</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Rdt</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mandat</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide w-12">Owner</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const photoUrl = (m.photos && m.photos[0]) ? (m.photos[0].url || m.photos[0]) : null;
              return (
                <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group" onClick={() => setSelectedMandat(m)}>
                  <td className="px-3 py-2">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-cream-100 flex-shrink-0">
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
                    <div className="font-medium text-stone-900 text-sm">{formatPrix(getPriceTTC(m))}</div>
                    {secondaryDisplay === 'm2' ? (
                      m.prixM2 && parseFloat(m.prixM2) > 0 ? (
                        <div className="text-xs text-stone-500">{parseFloat(m.prixM2).toLocaleString('fr')} €/m²</div>
                      ) : null
                    ) : (
                      <div className="text-xs text-stone-500 leading-tight">
                        <span title={isNVEstimated(m) ? "Net vendeur estimé" : "Net vendeur"}>
                          NV {formatPrixCompact(getPriceNV(m))}{isNVEstimated(m) && <span className="text-amber-600">~</span>}
                        </span>
                        {' · '}
                        <span className="text-emerald-700 font-medium" title={isCommissionEstimated(m) ? "Commission estimée 5%" : "Commission agence"}>
                          💰 {formatPrixCompact(getCommission(m))}{isCommissionEstimated(m) && <span className="text-amber-600">~</span>}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {parseFloat(m.rendement) > 0 ? (
                      <span className="font-medium text-emerald-700 text-sm">{m.rendement}%</span>
                    ) : (
                      <span className="text-stone-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CommerceBadge comm={m.commercialisation} dateSignature={m.dateSignature} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sage-100 text-sage-darker text-xs font-semibold border border-sage-light" title={'Owner: ' + (m.owner || '—')}>
                      {m.owner || '?'}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingMandat(m)} className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setSellingMandat(m); }} className="p-1.5 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded" title="Marquer comme vendu (par autres)"><Trophy className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-12 text-center text-stone-500 text-sm">Aucun mandat trouvé</div>}
      </div>
      )}

      {sellingMandat && (
        <MarkAsSoldModal
          mandat={sellingMandat}
          clients={clients}
          onClose={() => setSellingMandat(null)}
          onSuccess={() => { setSellingMandat(null); reload(); }}
        />
      )}

      {(editingMandat || showNew) && (
        <MandatForm mandat={editingMandat} onSave={handleSave} onClose={() => { setEditingMandat(null); setShowNew(false); }} clients={clients} mandats={mandats} />
      )}
    </div>
  );
}

// === FORMULAIRE MANDAT avec IMPORT IA ===
// ═══════════════════════════════════════════════════════════════════
// MandatForm v2 — sections + ClientSelector + import dossier
// À coller dans components/CRM.jsx en remplacement de la fonction MandatForm actuelle
// ═══════════════════════════════════════════════════════════════════

// Composant : sélecteur de client mandant (recherche + suggestions)
function ClientSelector({ clients, mandats, value, onChange, onCreateNew }) {
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  // 5 derniers clients utilisés comme mandants (en regardant les mandats)
  const recentMandants = useMemo(() => {
    const seen = new Set();
    const recent = [];
    const sorted = [...mandats].sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    for (const m of sorted) {
      const cid = m.mandantClientId || m.mandant_client_id;
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        const client = clients.find(c => c.id === cid);
        if (client) recent.push(client);
        if (recent.length >= 5) break;
      }
    }
    return recent;
  }, [mandats, clients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return clients.filter(c => {
      const fullText = `${c.prenom || ''} ${c.nom || ''} ${c.societe || ''} ${c.email || ''} ${c.tel || ''}`.toLowerCase();
      return fullText.includes(q);
    }).slice(0, 8);
  }, [search, clients]);

  const selectedClient = value ? clients.find(c => c.id === value) : null;

  if (selectedClient) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-stone-900 truncate">
              {selectedClient.prenom} {selectedClient.nom}
              {selectedClient.societe && <span className="text-stone-500 font-normal"> · {selectedClient.societe}</span>}
            </div>
            <div className="text-xs text-stone-500 truncate">
              {selectedClient.tel && <span>{selectedClient.tel}</span>}
              {selectedClient.tel && selectedClient.email && <span> · </span>}
              {selectedClient.email && <span>{selectedClient.email}</span>}
            </div>
          </div>
        </div>
        <button onClick={() => onChange(null)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0" title="Retirer">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Rechercher un client (nom, société, email...)"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowList(true); }}
          onFocus={() => setShowList(true)}
          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
        />
        {showList && search.trim() && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-luxe max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-stone-500 text-center">
                Aucun client trouvé.
                <button onClick={() => { onCreateNew(search); setSearch(''); setShowList(false); }} className="block mx-auto mt-2 text-xs text-sage-dark hover:underline">
                  + Créer "{search}" comme nouveau client
                </button>
              </div>
            ) : (
              <>
                {filtered.map(c => (
                  <button key={c.id} onClick={() => { onChange(c.id); setSearch(''); setShowList(false); }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-stone-50 border-b border-stone-100 last:border-0 text-left">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-3.5 h-3.5 text-stone-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 truncate">
                        {c.prenom} {c.nom}{c.societe && <span className="text-stone-500 font-normal"> · {c.societe}</span>}
                      </div>
                      <div className="text-xs text-stone-500 truncate">
                        {c.typologie || 'Client'} · {c.tel || c.email || '—'}
                      </div>
                    </div>
                  </button>
                ))}
                <button onClick={() => { onCreateNew(search); setSearch(''); setShowList(false); }}
                  className="w-full p-2.5 text-sm text-sage-dark hover:bg-sage-50 text-left flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Créer "{search}" comme nouveau client
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!search.trim() && recentMandants.length > 0 && (
        <div>
          <div className="text-xs text-stone-500 mb-1.5">Mandants récents :</div>
          <div className="flex flex-wrap gap-1.5">
            {recentMandants.map(c => (
              <button key={c.id} onClick={() => onChange(c.id)}
                className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs hover:bg-stone-50 hover:border-sage-light flex items-center gap-1.5">
                <UserIcon className="w-3 h-3 text-stone-400" />
                {c.prenom} {c.nom}{c.societe ? ` · ${c.societe}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {!search.trim() && (
        <button onClick={() => onCreateNew('')}
          className="text-xs text-sage-dark hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Créer un nouveau client
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MandatForm v2 — 4 sections empilées + ClientSelector
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// MandatsKanban — vue Kanban des mandats avec drag & drop natif HTML5
// À ajouter dans components/CRM.jsx (avant la fonction MandatForm)
// ═══════════════════════════════════════════════════════════════════

function MandatsKanban({ mandats, onSelectMandat, reload, secondaryDisplay = 'm2' }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Colonnes Kanban — on exclut "Vendu par autres" et "Perdu" (consultables via filtre)
  const KANBAN_STATUTS = [
    { id: 'Sourcing',          label: 'Sourcing',       border: '#B4B2A9' },
    { id: 'Analyse',           label: 'Analyse',        border: '#5DCAA5' },
    { id: 'Mandat signé',      label: 'Mandat signé',   border: '#85B7EB' },
    { id: 'Commercialisation', label: 'Commercia.',     border: '#97C459' },
    { id: 'Offre',             label: 'Offre',          border: '#AFA9EC' },
    { id: 'Promesse',          label: 'Promesse',       border: '#7F77DD' },
    { id: 'Acte',              label: 'Acte',           border: '#639922' },
  ];

  // Group mandats par statut (exclut Vendu par autres + Perdu)
  const grouped = {};
  for (const c of KANBAN_STATUTS) grouped[c.id] = [];
  for (const m of mandats) {
    if (KANBAN_STATUTS.find(c => c.id === m.statut)) {
      grouped[m.statut].push(m);
    }
  }

  function handleDragStart(e, mandat) {
    setDraggingId(mandat.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', mandat.id);
  }

  function handleDragOver(e, statut) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(statut);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e, newStatut) {
    e.preventDefault();
    const mandatId = e.dataTransfer.getData('text/plain');
    if (!mandatId || updating) { setDragOverCol(null); return; }

    const mandat = mandats.find(m => m.id === mandatId);
    if (!mandat || mandat.statut === newStatut) {
      setDragOverCol(null);
      setDraggingId(null);
      return;
    }

    setUpdating(true);
    setDragOverCol(null);
    setDraggingId(null);
    try {
      const { error } = await supabase.from('mandats').update({ statut: newStatut }).eq('id', mandatId);
      if (error) {
        alert('Erreur changement statut : ' + error.message);
      } else {
        if (reload) reload();
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setUpdating(false);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${KANBAN_STATUTS.length}, minmax(160px, 1fr))` }}>
        {KANBAN_STATUTS.map(col => {
          const mandatsInCol = grouped[col.id] || [];
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
              className={`bg-cream-50/70 rounded-lg p-2 min-h-[280px] transition-colors ${isOver ? 'bg-sage-100 ring-2 ring-sage-dark' : ''}`}
              style={{ borderLeft: `2px solid ${col.border}` }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{col.label}</span>
                <span className="bg-white rounded-full px-1.5 py-0.5 text-[10px] text-stone-700 border border-stone-200">{mandatsInCol.length}</span>
              </div>

              <div className="space-y-1.5">
                {mandatsInCol.map(m => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={e => handleDragStart(e, m)}
                    onDragEnd={handleDragEnd}
                    onClick={() => !draggingId && onSelectMandat && onSelectMandat(m)}
                    className={`bg-white border border-stone-200 rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-luxe transition-shadow ${draggingId === m.id ? 'opacity-50' : ''}`}
                  >
                    <div className="text-xs font-medium text-stone-900 line-clamp-2 leading-tight mb-1">{m.nom}</div>
                    {m.adresse && (
                      <div className="text-[10px] text-stone-500 truncate flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" /><span className="truncate">{m.adresse}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex flex-col leading-tight min-w-0">
                        <span className="text-[11px] font-medium text-stone-900">{formatPrixCompact(getPriceTTC(m) || 0)}</span>
                        {secondaryDisplay === 'nv_comm' && (
                          <span className="text-[9px] text-stone-500 truncate">
                            NV {formatPrixCompact(getPriceNV(m))} · <span className="text-emerald-700 font-medium">💰 {formatPrixCompact(getCommission(m))}</span>
                          </span>
                        )}
                      </div>
                      <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage-100 text-sage-darker text-[9px] font-semibold border border-sage-light flex-shrink-0" title={'Owner: ' + (m.owner || '—')}>
                        {m.owner || '?'}
                      </div>
                    </div>
                  </div>
                ))}
                {mandatsInCol.length === 0 && (
                  <div className="text-[10px] text-stone-400 text-center py-4 italic">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {updating && (
        <div className="mt-2 text-xs text-stone-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />Mise à jour du statut...
        </div>
      )}
    </div>
  );
}
function MandatForm({ mandat, onSave, onClose, clients = [], mandats = [] }) {
  const { profile } = useAuth();
  const userInitials = (profile?.prenom && profile?.nom) ? getCurrentUserInitials(profile) : 'TB';
  const [data, setData] = useState(mandat || {
    nom: '', adresse: '', ville: '', type: "Immeuble d'habitation", sousType: '', prix: 0, prixM2: 0,
    surface: 0, loyersAnnuels: 0, rendement: 0, nbLots: 1,
    commercialisation: 'Off-market', dateSignature: null,
    statut: 'Sourcing', owner: userInitials, description: '',
    contact: '', tel: '', docs: [], alerts: [], highlights: [],
    nbPieces: 0, nbChambres: 0, etage: 0, anneeConstruction: 0,
    chargesAnnuelles: 0, taxeFonciere: 0,
    dpeConsommation: 0, dpeEmissions: 0, dpeDate: null,
    mandatNumero: '', mandatType: '', mandatDateEcheance: null,
    honorairesTaux: 0, honorairesMontant: 0, honorairesCharge: '',
    mandantClientId: null,
    pourvoyeurId: null,
    vendeurId: null,
  });

  const [allProfiles, setAllProfiles] = useState([]);
  useEffect(() => {
    supabase.from('profiles').select('id, prenom, nom').eq('actif', true).then(({ data }) => setAllProfiles(data || []));
  }, []);
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [filledFields, setFilledFields] = useState(new Set());
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientPrefill, setNewClientPrefill] = useState('');
  const folderInputRef = React.useRef(null);

  const update = (k, v) => setData({ ...data, [k]: v });

  const REQUIRED_FIELDS = {
    nom: 'Nom du bien', adresse: 'Adresse', type: "Type d'actif",
    prix: 'Prix annoncé (TTC)', surface: 'Surface totale',
  };

  async function compressImage(file) {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1920;
          let { width, height } = img;
          if (width > MAX_WIDTH) { height = (MAX_WIDTH / width) * height; width = MAX_WIDTH; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            const compressed = new File([blob], file.name, { type: 'image/jpeg' });
            resolve(compressed.size < file.size ? compressed : file);
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  const FIELD_MAP = {
    nom: 'nom', adresse: 'adresse', ville: 'ville', type: 'type',
    sous_type: 'sousType', surface: 'surface',
    nb_pieces: 'nbPieces', nb_chambres: 'nbChambres', etage: 'etage',
    annee_construction: 'anneeConstruction',
    prix: 'prix', prix_net_vendeur: 'prix', prix_m2: 'prixM2',
    honoraires_charge: 'honorairesCharge', honoraires_taux: 'honorairesTaux', honoraires_montant: 'honorairesMontant',     pourvoyeur_id: 'pourvoyeurId', vendeur_id: 'vendeurId',
    loyers_annuels: 'loyersAnnuels', rendement: 'rendement',
    charges_annuelles: 'chargesAnnuelles', taxe_fonciere: 'taxeFonciere',
    dpe_consommation: 'dpeConsommation', dpe_emissions: 'dpeEmissions', dpe_date: 'dpeDate',
    mandat_numero: 'mandatNumero', mandat_type: 'mandatType',
    date_signature: 'dateSignature', mandat_date_echeance: 'mandatDateEcheance',
    nb_lots: 'nbLots', description: 'description', commercialisation: 'commercialisation',
  };

  // ═══════════════════════════════════════════════════════════════════
// FIX : Fonction handleFolderImport COMPLÈTE corrigée
// À COPIER ENTIÈREMENT dans MandatForm pour remplacer la version cassée
// ═══════════════════════════════════════════════════════════════════

async function handleFolderImport(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  setImportResult(null);
  setImportProgress({ current: 0, total: files.length, fileName: 'Préparation...' });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { alert('Session expirée'); setImportProgress(null); return; }

    let mandatId = mandat?.id || data.id;
    if (!mandatId) {
      const { data: created, error: createErr } = await supabase.from('mandats').insert({
        nom: data.nom || 'Nouveau mandat (import en cours)',
        type: data.type || "Immeuble d'habitation",
        statut: 'Sourcing',
        owner: data.owner || userInitials,         pourvoyeur_id: data.pourvoyeurId || null,         vendeur_id: data.vendeurId || null,
        commercialisation: data.commercialisation || 'Off-market',
      }).select().single();
      if (createErr || !created) {
        alert('Erreur création mandat : ' + (createErr?.message || 'inconnue'));
        setImportProgress(null);
        return;
      }
      mandatId = created.id;
      setData(d => ({ ...d, id: mandatId }));
    }

    let totalFilled = 0;
    const allExtracted = {};
    const categoriesByLabel = {};
    let errors = 0;
    const BATCH_SIZE = 3;
    let processed = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (file) => {
        const compressed = await compressImage(file);
        setImportProgress({ current: processed + 1, total: files.length, fileName: file.name });

        const cleanName = (file.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = mandatId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;
        const { error: uploadErr } = await supabase.storage.from('mandat-docs').upload(storagePath, compressed, {
          contentType: compressed.type || 'application/octet-stream',
          upsert: false,
        });
        if (uploadErr) {
          processed++;
          return { ok: false, error: uploadErr.message };
        }

        let category = 'autre';
        let extractedData = {};
        let filledKeys = [];
        try {
          const aiRes = await fetch('/api/mandats/' + mandatId + '/import-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, storage_path: storagePath, applyToMandat: true }),
          });
          const aiData = await aiRes.json();
          if (aiData.ok) {
            category = aiData.category || 'autre';
            extractedData = aiData.data || {};
            filledKeys = aiData.filled || [];
          }
        } catch (e) {
          console.warn('[import] AI failed:', e.message);
        }

        await fetch('/api/mandats/' + mandatId + '/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            type: 'file_meta',
            category,
            nom: file.name,
            storage_path: storagePath,
            taille_bytes: compressed.size,
            mime_type: compressed.type || 'application/octet-stream',
          }),
        });

        processed++;
        return { ok: true, category, extracted: extractedData, filled: filledKeys };
      }));

      for (const r of results) {
        if (r.ok) {
          totalFilled += (r.filled?.length || 0);
          const label = ({
            mandat: 'Mandat', diagnostics: 'Diagnostics', plans_photos: 'Plans & photos',
            notes: 'Notes', mandant: 'Mandant', autre: 'Autre',
          })[r.category] || 'Autre';
          categoriesByLabel[label] = (categoriesByLabel[label] || 0) + 1;
          for (const [k, v] of Object.entries(r.extracted || {})) {
            if (v !== null && v !== undefined && v !== '') allExtracted[k] = v;
          }
        } else {
          errors++;
        }
      }
      if (i + BATCH_SIZE < files.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Recharger le mandat depuis la BDD pour avoir les valeurs à jour
    const { data: refreshed } = await supabase.from('mandats').select('*').eq('id', mandatId).maybeSingle();
    if (refreshed) {
      const newData = { ...data, id: refreshed.id };
      const newFilled = new Set();
      for (const [snake, camel] of Object.entries(FIELD_MAP)) {
        if (refreshed[snake] !== null && refreshed[snake] !== undefined && refreshed[snake] !== '') {
          newData[camel] = refreshed[snake];
          if (allExtracted[snake] !== undefined) newFilled.add(camel);
        }
      }
      if (newData.prix && newData.surface && !newData.prixM2) {
        newData.prixM2 = Math.round(newData.prix / newData.surface);
        newFilled.add('prixM2');
      }
      setData(newData);
      setFilledFields(newFilled);
    }

    setImportProgress(null);
    setImportResult({
      total: files.length,
      success: files.length - errors,
      errors,
      totalFilled,
      categoriesByLabel,
    });
    if (folderInputRef.current) folderInputRef.current.value = '';
  } catch (e) {
    console.error('[FolderImport] Erreur:', e);
    alert('Erreur : ' + e.message);
    setImportProgress(null);
  }
}

  async function handleCreateClient(prefillName) {
    setNewClientPrefill(prefillName);
    setShowNewClient(true);
  }

  async function saveNewClient(clientData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error } = await supabase.from('clients').insert({
        nom: clientData.nom, prenom: clientData.prenom || null,
        societe: clientData.societe || null, tel: clientData.tel || null,
        email: clientData.email || null, typologie: 'Mandant',
        created_by: user?.id, owner: data.owner || userInitials,         pourvoyeur_id: data.pourvoyeurId || null,         vendeur_id: data.vendeurId || null,
      }).select().single();
      if (error || !created) { alert('Erreur création client : ' + (error?.message || 'inconnue')); return; }
      update('mandantClientId', created.id);
      // Ajouter localement à la liste
      clients.push(created);
      setShowNewClient(false);
    } catch (e) { alert('Erreur : ' + e.message); }
  }

  const missingFields = Object.entries(REQUIRED_FIELDS).filter(([k]) => {
    const v = data[k];
    return v === null || v === undefined || v === '' || v === 0;
  });

  const fieldClass = (key) => {
    const base = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-stone-900";
    if (filledFields.has(key)) return base + " border-emerald-300 bg-emerald-50/30";
    return base + " border-stone-200";
  };

  const sectionClass = "bg-cream-50/50 rounded-xl p-5 border border-cream-dark/50";
  const sectionTitleClass = "font-display text-base font-semibold text-stone-900 mb-4 flex items-center gap-2";

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-3xl w-full max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-6 border-b border-stone-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900">{mandat ? 'Modifier' : 'Nouveau'} mandat</h2>
            <p className="text-xs text-stone-500 mt-0.5">Importe un dossier — l'IA pré-remplit automatiquement</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>

        {/* Zone d'import dossier (toujours visible) */}
        <div className="p-6 border-b border-stone-200 bg-gradient-to-br from-sage-50/70 to-cream-50">
          <input type="file" ref={folderInputRef} onChange={handleFolderImport} className="hidden" multiple webkitdirectory="" directory="" />
          <button type="button" onClick={() => folderInputRef.current?.click()} disabled={importProgress !== null}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-sage-dark text-white rounded-xl hover:bg-sage-darker disabled:opacity-50 transition-colors">
            <Wand2 className="w-5 h-5" />
            <span className="font-medium">{importProgress ? 'Import en cours...' : 'Importer un dossier ✨'}</span>
          </button>
          <p className="text-xs text-stone-600 text-center mt-2">L'IA lira tous les fichiers, les classera et pré-remplira la fiche</p>

          {importProgress && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-sage-light">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-sage-dark flex-shrink-0" />
                <span className="text-sage-darker font-medium">{importProgress.current}/{importProgress.total}</span>
                <span className="text-stone-600 truncate">— {importProgress.fileName}</span>
              </div>
              <div className="mt-2 h-1.5 bg-sage-100 rounded-full overflow-hidden">
                <div className="h-full bg-sage-dark transition-all" style={{ width: (importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0) + '%' }} />
              </div>
            </div>
          )}

          {importResult && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-sage-light">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-stone-900">Import terminé : {importResult.success}/{importResult.total} fichiers</div>
                  <div className="text-stone-700 mt-0.5">{Object.entries(importResult.categoriesByLabel).map(([label, count]) => label + ' (' + count + ')').join(' · ')}</div>
                  {importResult.totalFilled > 0 && (<div className="text-emerald-700 font-medium mt-1">✨ {importResult.totalFilled} champ(s) pré-remplis</div>)}
                  {importResult.errors > 0 && (<div className="text-red-600 mt-0.5">{importResult.errors} fichier(s) en erreur</div>)}
                </div>
                <button onClick={() => setImportResult(null)} className="text-stone-400 hover:text-stone-700"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {filledFields.size > 0 && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Les champs en <span className="font-semibold">vert</span> ont été remplis automatiquement par l'IA.
            </div>
          )}

          {/* SECTION 1 : IDENTITÉ */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>🏠 Identité du bien</h3>
            <div className="space-y-3">
              <Field label="Nom du bien"><input type="text" value={data.nom} onChange={e => update('nom', e.target.value)} className={fieldClass('nom')} /></Field>
              <Field label="Adresse"><input type="text" value={data.adresse} onChange={e => update('adresse', e.target.value)} className={fieldClass('adresse')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ville"><input type="text" value={data.ville || ''} onChange={e => update('ville', e.target.value)} className={fieldClass('ville')} /></Field>
                <Field label="Surface (m²)"><input type="number" value={data.surface} onChange={e => update('surface', +e.target.value)} className={fieldClass('surface')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type d'actif">
                  <select value={data.type} onChange={e => update('type', e.target.value)} className={fieldClass('type')}>
                    {TYPES_ACTIF.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Sous-catégorie"><input type="text" value={data.sousType || ''} onChange={e => update('sousType', e.target.value)} className={fieldClass('sousType')} /></Field>
              </div>
            </div>
          </div>

          {/* SECTION 2 : MANDAT & FINANCES */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>💰 Mandat & Finances</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="N° mandat"><input type="text" value={data.mandatNumero || ''} onChange={e => update('mandatNumero', e.target.value)} className={fieldClass('mandatNumero')} /></Field>
                <Field label="Type de mandat">
                  <select value={data.mandatType || ''} onChange={e => update('mandatType', e.target.value)} className={fieldClass('mandatType')}>
                    <option value="">—</option>
                    <option>EXCLUSIF</option>
                    <option>SEMI EXCLUSIF</option>
                    <option>SIMPLE</option>
                  </select>
                </Field>
                <Field label="Échéance"><input type="date" value={data.mandatDateEcheance || ''} onChange={e => update('mandatDateEcheance', e.target.value)} className={fieldClass('mandatDateEcheance')} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Prix annoncé TTC (€)"><input type="number" value={data.prix} onChange={e => update('prix', +e.target.value)} className={fieldClass('prix')} placeholder="Honoraires inclus" /></Field>
                <Field label="Prix/m² (€)"><input type="number" value={data.prixM2} onChange={e => update('prixM2', +e.target.value)} className={fieldClass('prixM2')} /></Field>
                <Field label="Loyers/an (€)"><input type="number" value={data.loyersAnnuels} onChange={e => update('loyersAnnuels', +e.target.value)} className={fieldClass('loyersAnnuels')} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Rendement (%)"><input type="number" step="0.01" value={data.rendement} onChange={e => update('rendement', +e.target.value)} className={fieldClass('rendement')} /></Field>
                <Field label="Honoraires (%)"><input type="number" step="0.01" value={data.honorairesTaux || 0} onChange={e => update('honorairesTaux', +e.target.value)} className={fieldClass('honorairesTaux')} /></Field>
                <Field label="Honoraires (€)"><input type="number" value={data.honorairesMontant || 0} onChange={e => update('honorairesMontant', +e.target.value)} className={fieldClass('honorairesMontant')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type de commercialisation">
                  <select value={data.commercialisation} onChange={e => update('commercialisation', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                    <option>Off-market</option>
                    <option>Mandat exclusif</option>
                    <option>Mandat simple</option>
                  </select>
                </Field>
                <Field label="Statut pipeline">
                  <select value={data.statut} onChange={e => update('statut', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                    {STATUTS_MANDAT.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="🤝 Pourvoyeur (apporteur du mandat)">
                  <select value={data.pourvoyeurId || ''} onChange={e => update('pourvoyeurId', e.target.value || null)} className={fieldClass('pourvoyeurId')}>
                    <option value="">—</option>
                    {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </Field>
                <Field label="🎯 Vendeur (closer de la vente)">
                  <select value={data.vendeurId || ''} onChange={e => update('vendeurId', e.target.value || null)} className={fieldClass('vendeurId')}>
                    <option value="">—</option>
                    {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* SECTION 3 : CARACTÉRISTIQUES TECHNIQUES */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>🔧 Caractéristiques techniques</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Pièces"><input type="number" value={data.nbPieces || 0} onChange={e => update('nbPieces', +e.target.value)} className={fieldClass('nbPieces')} /></Field>
                <Field label="Chambres"><input type="number" value={data.nbChambres || 0} onChange={e => update('nbChambres', +e.target.value)} className={fieldClass('nbChambres')} /></Field>
                <Field label="Étage"><input type="number" value={data.etage || 0} onChange={e => update('etage', +e.target.value)} className={fieldClass('etage')} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Année construction"><input type="number" value={data.anneeConstruction || 0} onChange={e => update('anneeConstruction', +e.target.value)} className={fieldClass('anneeConstruction')} /></Field>
                <Field label="Charges/an (€)"><input type="number" value={data.chargesAnnuelles || 0} onChange={e => update('chargesAnnuelles', +e.target.value)} className={fieldClass('chargesAnnuelles')} /></Field>
                <Field label="Taxe foncière (€)"><input type="number" value={data.taxeFonciere || 0} onChange={e => update('taxeFonciere', +e.target.value)} className={fieldClass('taxeFonciere')} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="DPE consommation"><input type="number" value={data.dpeConsommation || 0} onChange={e => update('dpeConsommation', +e.target.value)} className={fieldClass('dpeConsommation')} /></Field>
                <Field label="DPE émissions"><input type="number" value={data.dpeEmissions || 0} onChange={e => update('dpeEmissions', +e.target.value)} className={fieldClass('dpeEmissions')} /></Field>
                <Field label="DPE date"><input type="date" value={data.dpeDate || ''} onChange={e => update('dpeDate', e.target.value)} className={fieldClass('dpeDate')} /></Field>
              </div>
            </div>
          </div>

          {/* SECTION 4 : CONTACT PROPRIÉTAIRE */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>📞 Contact propriétaire</h3>
            {showNewClient ? (
              <NewClientMiniForm prefillName={newClientPrefill} onSave={saveNewClient} onCancel={() => setShowNewClient(false)} />
            ) : (
              <ClientSelector
                clients={clients}
                mandats={mandats}
                value={data.mandantClientId}
                onChange={(id) => update('mandantClientId', id)}
                onCreateNew={handleCreateClient}
              />
            )}
          </div>

          {/* DESCRIPTION en bas */}
          <Field label="Description du bien">
            <textarea value={data.description || ''} onChange={e => update('description', e.target.value)} rows={4} className={fieldClass('description')} placeholder="Descriptif marketing, points forts..." />
          </Field>

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
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={() => onSave(data, [])} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// Mini-formulaire pour créer un nouveau client à la volée
function NewClientMiniForm({ prefillName, onSave, onCancel }) {
  const guess = (prefillName || '').trim().split(' ');
  const [c, setC] = useState({
    prenom: guess.length > 1 ? guess[0] : '',
    nom: guess.length > 1 ? guess.slice(1).join(' ') : (prefillName || ''),
    societe: '', tel: '', email: '',
  });
  const upd = (k, v) => setC({ ...c, [k]: v });
  return (
    <div className="space-y-2 p-3 bg-white border border-stone-200 rounded-lg">
      <div className="text-xs font-semibold text-stone-700 mb-1">Nouveau client</div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Prénom" value={c.prenom} onChange={e => upd('prenom', e.target.value)} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
        <input type="text" placeholder="Nom" value={c.nom} onChange={e => upd('nom', e.target.value)} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
      </div>
      <input type="text" placeholder="Société (optionnel)" value={c.societe} onChange={e => upd('societe', e.target.value)} className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Téléphone" value={c.tel} onChange={e => upd('tel', e.target.value)} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
        <input type="email" placeholder="Email" value={c.email} onChange={e => upd('email', e.target.value)} className="px-2 py-1.5 border border-stone-200 rounded text-sm" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(c)} disabled={!c.nom.trim()} className="flex-1 px-3 py-1.5 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50">Créer</button>
        <button onClick={onCancel} className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded text-sm hover:bg-stone-100">Annuler</button>
      </div>
    </div>
  );
}
// Helpers DPE
function getDPEClass(conso) {
  if (!conso) return null;
  const c = parseFloat(conso);
  if (c <= 70) return 'A';
  if (c <= 110) return 'B';
  if (c <= 180) return 'C';
  if (c <= 250) return 'D';
  if (c <= 330) return 'E';
  if (c <= 420) return 'F';
  return 'G';
}

function getDPEColor(conso) {
  const cls = getDPEClass(conso);
  return {
    'A': '#00A651',  // vert vif
    'B': '#52B847',  // vert
    'C': '#A6CE39',  // vert clair
    'D': '#F9C20B',  // jaune
    'E': '#F58220',  // orange
    'F': '#E94E1B',  // rouge orangé
    'G': '#C8102E',  // rouge foncé
  }[cls] || '#9CA3AF';
}

function MandatDetail({ mandat, onBack, onEdit, deals, clients, reload, todos, annonces, allProfiles = [] }) {
  const [openModal, setOpenModal] = useState(null); // 'photos' | 'visite' | 'mandant' | null
  const [aiAnalyzeOpen, setAiAnalyzeOpen] = useState(false);
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
    'Off-market': 'bg-stone-900 text-amber-300 border-amber-500/30'
  }[mandat.commercialisation] || 'bg-stone-100 text-stone-700 border-stone-200';

  return (
    <div className="p-8 max-w-7xl">

      {/* ═══ EN-TÊTE ═══ */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-1">{mandat.nom}</h1>
          <p className="text-stone-500 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4" />{mandat.adresse}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setAiAnalyzeOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-sage-100 to-sage-200 text-sage-darker rounded-lg text-sm hover:from-sage-200 hover:to-sage-300 font-medium border border-sage-light" title="Analyser tous les documents du mandat avec l'IA">
            <Sparkles className="w-4 h-4" /> Analyser IA
          </button>
          <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">
            <Edit2 className="w-4 h-4" /> Modifier
          </button>
        </div>
      </div>

      {/* ═══ PHOTO + TAGS IA (côte à côte) ═══ */}
      <div className="flex items-stretch gap-4 mb-4">
        {(mandat.photos && mandat.photos.length > 0) ? (
          <button onClick={() => setOpenModal('photos')} className="flex-shrink-0 w-48 h-32 rounded-lg overflow-hidden bg-cream-100 border border-cream-dark hover:opacity-90 relative">
            <img src={mandat.photos[0].url || mandat.photos[0]} alt={mandat.nom} className="w-full h-full object-cover" />
            {mandat.photos.length > 1 && (
              <div className="absolute bottom-1.5 right-1.5 bg-stone-900/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">+{mandat.photos.length - 1}</div>
            )}
          </button>
        ) : (
          <button onClick={() => setOpenModal('photos')} className="flex-shrink-0 w-48 h-32 rounded-lg bg-cream-100 border border-dashed border-cream-dark hover:bg-cream-200 flex flex-col items-center justify-center text-stone-400 text-xs gap-1">
            <ImageIcon className="w-6 h-6" />
            <span>Ajouter photos</span>
          </button>
        )}

        <div className="flex-1 min-w-0 bg-amber-50/30 border border-amber-100 rounded-lg p-3">
          {highlights.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto scrollbar-thin">
              {highlights.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium rounded-full">
                  <Sparkles className="w-3 h-3 text-amber-600 flex-shrink-0" />{h}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-stone-400 italic flex items-center gap-2 h-full">
              <Sparkles className="w-4 h-4" />Aucun point fort identifié — L'IA en générera lors de l'analyse du dossier
            </div>
          )}
        </div>
      </div>

      {/* ═══ BARRE D'ACTIONS COMPACTE (1 ligne) ═══ */}
      <div className="mb-6 pb-4 border-b border-stone-200 flex items-center gap-2 flex-wrap">
        <PdfExportButtons mandatId={mandat.id} mandatNom={mandat.nom} isOffMarket={mandat.is_off_market} />
        <button onClick={() => setOpenModal('photos')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
          <ImageIcon className="w-3.5 h-3.5" /> Photos {(mandat.photos || []).length > 0 && <span className="text-[10px] bg-sage-100 text-sage-dark px-1.5 py-0.5 rounded-full">{mandat.photos.length}</span>}
        </button>
        <button onClick={() => setOpenModal('visite')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
          <Eye className="w-3.5 h-3.5" /> Visite {(mandat.visiteInfo || mandat.visite_info) && Object.values(mandat.visiteInfo || mandat.visite_info).some(v => v) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>
        <button onClick={() => setOpenModal('mandant')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
          <UserIcon className="w-3.5 h-3.5" /> Mandant {(mandat.mandantInfo || mandat.mandant_info) && Object.values(mandat.mandantInfo || mandat.mandant_info).some(v => v) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>
        <button onClick={() => setOpenModal('documents')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
          <FolderOpen className="w-3.5 h-3.5" /> Documents
        </button>

        <div className="flex-1" />

        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${commColor}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} title={isPublished ? 'Publié' : 'Non publié'} />
          <span>{mandat.commercialisation}</span>
        </div>

        <OwnerSelector mandat={mandat} reload={reload} />
      </div>
      <div className="space-y-4">
        <div className="col-span-3 space-y-4">
          {/* ═══ ANALYSE FINANCIÈRE — REMONTÉE EN PREMIÈRE POSITION ═══ */}
          <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Analyse financière</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">Prix annoncé (TTC)</div>
                <div className="text-2xl font-display font-semibold text-stone-900">{formatPrix(getPriceTTC(mandat))}</div>
                <div className="text-[11px] text-stone-500 mt-1 leading-tight">
                  Net vendeur : <span className="font-medium">{formatPrix(getPriceNV(mandat))}</span>
                  {isNVEstimated(mandat) && <span className="text-amber-600 ml-1" title="Honoraires non renseignés, estimation à 5%">~ estimé</span>}
                  <br />
                  Commission : <span className="font-medium text-emerald-700">{formatPrix(getCommission(mandat))}</span>
                  {isCommissionEstimated(mandat) && <span className="text-amber-600 ml-1" title="Commission estimée à 5% du TTC">~ estimée</span>}
                </div>
              </div>
              <DetailItem label="Prix au m²" value={mandat.prixM2 ? `${parseFloat(mandat.prixM2).toLocaleString('fr')}€` : '—'} />
              <DetailItem label="Loyers annuels" value={mandat.loyersAnnuels ? `${parseFloat(mandat.loyersAnnuels).toLocaleString('fr')}€` : '—'} />
              <DetailItem label="Rendement" value={parseFloat(mandat.rendement) > 0 ? `${mandat.rendement}%` : '—'} highlight />
            </div>
            <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-cream">
              <DetailItem label="Surface" value={mandat.surface ? `${mandat.surface} m²` : '—'} />
              <DetailItem label="Type" value={mandat.type} />
              <DetailItem label="DPE" value={mandat.dpeConsommation ? <span className="text-2xl font-bold" style={{color: getDPEColor(mandat.dpeConsommation)}}>{getDPEClass(mandat.dpeConsommation)}</span> : '—'} />
              <DetailItem label="Taxe foncière" value={mandat.taxeFonciere ? `${parseFloat(mandat.taxeFonciere).toLocaleString('fr')} €` : '—'} />
              <DetailItem label="Charges annuelles" value={mandat.chargesAnnuelles ? `${parseFloat(mandat.chargesAnnuelles).toLocaleString('fr')} €` : '—'} />
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
            <div className="space-y-2">
              {mandatTodos.filter(t => t.statut !== 'Terminé').map(t => (
                <TaskInline key={t.id} task={t} mandats={[mandat]} clients={clients} allProfiles={allProfiles} onUpdate={reload} />
              ))}
              <QuickAddTask
                lienType="mandat"
                lienId={mandat.id}
                defaultAssignee={mandat.owner === 'TB' ? 'Thomas Boggiani' : null}
                onAdd={reload}
              />
            </div>
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
      {openModal === 'documents' && (
        <DocumentsModal mandat={mandat} onClose={() => setOpenModal(null)} />
      )}
    {/* Quelque chose */}

      {/* Assistant IA — sidebar fixe en bas à droite */}
      <MandatAIAssistant mandat={mandat} />

      {/* Modal Analyser avec l'IA — analyse complète des documents du mandat */}
      <AIAnalyzeModal
        open={aiAnalyzeOpen}
        mandatId={mandat.id}
        mandatLabel={mandat.nom || mandat.adresse}
        onClose={() => setAiAnalyzeOpen(false)}
        onCompleted={() => reload?.()}
      />

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
    statut: 'Actif', maturite: 'Moyen', origine: 'Apporteur', owner: getCurrentUserInitials(profile) || 'TB'
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
// ═══════════════════════════════════════════════════════════════════
// RemunerationTab v2 — page "📈 Rémunération" : commissions par commercial
// Calcul : prix_HT = prix_TTC / 1.20
//          commission_agence = prix_HT * 5%  (la base à partager)
//          part pourvoyeur = commission * 30%
//          part vendeur = commission * 30%
//          part agence = commission * 40%
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// DashboardDirection — Vue manager pour TE/TB
// Sprint A : structure de base + onglet conditionnel
// À COLLER dans components/CRM.jsx avant la fonction TodosTab
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// DashboardDirection v2 — avec filtre temporel
// Filtre sur created_at : Mois en cours / Trimestre / Année / Tout
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// ReglagesSection — Panneau admin pour modifier les taux de commission
// À COLLER dans components/CRM.jsx avant la fonction DashboardDirection
// ═══════════════════════════════════════════════════════════════════

function ReglagesSection({ rates, setRates, userId }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rates);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // Sync draft when rates change
  useEffect(() => {
    setDraft(rates);
  }, [rates]);

  const total = (parseFloat(draft.pourvoyeur) || 0) + (parseFloat(draft.vendeur) || 0) + (parseFloat(draft.agence) || 0);
  const isValid = Math.abs(total - 100) < 0.01;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);

    const newValue = {
      pourvoyeur: parseFloat(draft.pourvoyeur) || 0,
      vendeur: parseFloat(draft.vendeur) || 0,
      agence: parseFloat(draft.agence) || 0,
      taux_commission: parseFloat(draft.taux_commission) || 5,
      tva: rates.tva || 20,
    };

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'commission_rates',
        value: newValue,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (!error) {
      setRates(prev => ({ ...prev, ...newValue }));
      setSavedAt(new Date());
      setEditing(false);
    } else {
      alert('Erreur lors de la sauvegarde : ' + error.message);
    }
    setSaving(false);
  }

  function handleCancel() {
    setDraft(rates);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden mt-6">
      <div className="p-5 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-stone-900 flex items-center gap-2">⚙️ Réglages</h2>
          <p className="text-xs text-stone-500 mt-1">Taux de commission appliqués sur l'ensemble du CRM</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
          >
            <Edit2 className="w-3.5 h-3.5" /> Modifier
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳ Enregistrement...' : '✓ Enregistrer'}
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-4 gap-4">
          {/* Pourvoyeur */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">🤝 Pourvoyeur</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={draft.pourvoyeur}
                  onChange={e => setDraft({ ...draft, pourvoyeur: e.target.value })}
                  className="w-full px-2 py-1 border border-blue-300 rounded text-2xl font-semibold text-blue-900 bg-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-2xl font-semibold text-blue-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-blue-900">{rates.pourvoyeur}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-blue-600 mt-1">Apporteur du mandat</div>
          </div>

          {/* Vendeur */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">🎯 Vendeur</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={draft.vendeur}
                  onChange={e => setDraft({ ...draft, vendeur: e.target.value })}
                  className="w-full px-2 py-1 border border-amber-300 rounded text-2xl font-semibold text-amber-900 bg-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-2xl font-semibold text-amber-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-amber-900">{rates.vendeur}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-amber-600 mt-1">Closer de la vente</div>
          </div>

          {/* Agence */}
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <div className="text-xs font-medium text-stone-700 uppercase tracking-wide mb-2">🏛️ Agence</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={draft.agence}
                  onChange={e => setDraft({ ...draft, agence: e.target.value })}
                  className="w-full px-2 py-1 border border-stone-300 rounded text-2xl font-semibold text-stone-900 bg-white focus:outline-none focus:border-stone-500"
                />
                <span className="text-2xl font-semibold text-stone-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-stone-900">{rates.agence}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-stone-600 mt-1">Part agence</div>
          </div>

          {/* Taux commission */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-2">💰 Taux commission</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={draft.taux_commission}
                  onChange={e => setDraft({ ...draft, taux_commission: e.target.value })}
                  className="w-full px-2 py-1 border border-emerald-300 rounded text-2xl font-semibold text-emerald-900 bg-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-2xl font-semibold text-emerald-900">%</span>
              </div>
            ) : (
              <div className="text-3xl font-semibold text-emerald-900">{rates.taux_commission}<span className="text-xl">%</span></div>
            )}
            <div className="text-[10px] text-emerald-600 mt-1">% du HT</div>
          </div>
        </div>

        {/* Validation */}
        {editing && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            isValid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {isValid ? (
              <>
                <span>✅</span>
                <span>La répartition fait bien <strong>100%</strong> (Pourvoyeur + Vendeur + Agence)</span>
              </>
            ) : (
              <>
                <span>⚠️</span>
                <span>La répartition doit faire <strong>100%</strong>. Total actuel : <strong>{total.toFixed(1)}%</strong></span>
              </>
            )}
          </div>
        )}

        {/* Confirmation après save */}
        {!editing && savedAt && (
          <div className="mt-4 p-3 rounded-lg flex items-center gap-2 text-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span>✅</span>
            <span>Réglages mis à jour à {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Les calculs (Rémunération, Dashboard Direction) sont automatiquement à jour.</span>
          </div>
        )}

        {/* Aide */}
        <div className="mt-4 text-xs text-stone-500">
          <strong>Calcul :</strong> Prix TTC ÷ {(1 + (rates.tva || 20) / 100).toFixed(2)} = HT · Commission agence = HT × {rates.taux_commission}% · Répartition Pourvoyeur {rates.pourvoyeur}% / Vendeur {rates.vendeur}% / Agence {rates.agence}%
        </div>
      </div>
    </div>
  );
}
function DashboardDirection({ mandats, deals, clients, todos, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [rates, setRates] = useState({ pourvoyeur: 30, vendeur: 30, agence: 40, taux_commission: 5, tva: 20 });
  const [periode, setPeriode] = useState('all'); // 'month' | 'quarter' | 'year' | 'all'

  // Charger les taux commission
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'commission_rates').single().then(({ data }) => {
      if (data?.value) setRates(prev => ({ ...prev, ...data.value }));
    });
  }, []);

  // Liste des commerciaux actifs
  const commerciaux = allProfiles.filter(p => 
    ['Thomas', 'Lucas', 'Philippe'].includes(p.prenom)
  );

  // ═══════════════════════════════════════════════════════════════
  // FILTRE TEMPOREL
  // ═══════════════════════════════════════════════════════════════
  
  function isInPeriode(mandatDate, periode) {
    if (periode === 'all') return true;
    if (!mandatDate) return false;
    
    const date = new Date(mandatDate);
    const now = new Date();
    
    if (periode === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (periode === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const dq = Math.floor(date.getMonth() / 3);
      return dq === q && date.getFullYear() === now.getFullYear();
    }
    if (periode === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
    return true;
  }
  
  // Mandats filtrés par période
  const mandatsFiltres = mandats.filter(m => isInPeriode(m.createdAt || m.created_at, periode));
  
  // Mandats actifs (filtrés)
  const mandatsActifs = mandatsFiltres.filter(m => 
    !['Perdu', 'Vendu par autres'].includes(m.statut)
  );

  // Commission totale par mandat
  function commissionMandat(m) {
    const prixTTC = parseFloat(m.prix) || 0;
    const prixHT = prixTTC / (1 + rates.tva / 100);
    return prixHT * (rates.taux_commission / 100);
  }

  // CA total
  const caGlobal = mandatsActifs.reduce((sum, m) => sum + (parseFloat(m.prix) || 0), 0);

  // Commissions par statut
  const commissionEncaissee = mandatsFiltres
    .filter(m => m.statut === 'Acte')
    .reduce((sum, m) => sum + commissionMandat(m), 0);

  const commissionEnCours = mandatsFiltres
    .filter(m => m.statut === 'Promesse')
    .reduce((sum, m) => sum + commissionMandat(m), 0);

  const commissionPotentielle = mandatsFiltres
    .filter(m => m.statut === 'Offre')
    .reduce((sum, m) => sum + commissionMandat(m), 0);

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE PAR STATUT (sur mandats filtrés)
  // ═══════════════════════════════════════════════════════════════

  const STATUTS_PIPELINE = ['Sourcing', 'Analyse', 'Mandat signé', 'Commercialisation', 'Offre', 'Promesse', 'Acte'];
  const pipelineParStatut = STATUTS_PIPELINE.map(statut => {
    const m = mandatsFiltres.filter(m => m.statut === statut);
    return {
      statut,
      count: m.length,
      ca: m.reduce((sum, x) => sum + (parseFloat(x.prix) || 0), 0),
      commission: m.reduce((sum, x) => sum + commissionMandat(x), 0),
    };
  });

  // ═══════════════════════════════════════════════════════════════
  // PERFORMANCES PAR COMMERCIAL (sur mandats filtrés)
  // ═══════════════════════════════════════════════════════════════

  const perfParCommercial = commerciaux.map(p => {
    const mandatsAsPourvoyeur = mandatsActifs.filter(m => m.pourvoyeurId === p.id);
    const mandatsAsVendeur = mandatsActifs.filter(m => m.vendeurId === p.id);
    
    let partTotal = 0;
    let partEncaissee = 0;
    
    mandatsActifs.forEach(m => {
      const comm = commissionMandat(m);
      const isPourvoyeur = m.pourvoyeurId === p.id;
      const isVendeur = m.vendeurId === p.id;
      let partMandat = 0;
      if (isPourvoyeur) partMandat += comm * (rates.pourvoyeur / 100);
      if (isVendeur) partMandat += comm * (rates.vendeur / 100);
      partTotal += partMandat;
      if (m.statut === 'Acte') partEncaissee += partMandat;
    });

    const tachesEnCours = (todos || []).filter(t => 
      t.assignedToUserId === p.id && t.statut !== 'Fait'
    ).length;

    return {
      profile: p,
      nbMandatsPourvoyeur: mandatsAsPourvoyeur.length,
      nbMandatsVendeur: mandatsAsVendeur.length,
      partTotal,
      partEncaissee,
      tachesEnCours,
    };
  });

  perfParCommercial.sort((a, b) => b.partTotal - a.partTotal);

  // ═══════════════════════════════════════════════════════════════
  // TOP AFFAIRES (Promesse + Offre, sur mandats filtrés)
  // ═══════════════════════════════════════════════════════════════

  const topAffaires = mandatsFiltres
    .filter(m => ['Promesse', 'Offre'].includes(m.statut))
    .map(m => ({
      ...m,
      commission: commissionMandat(m),
      pourvoyeurNom: allProfiles.find(p => p.id === m.pourvoyeurId)?.prenom + ' ' + allProfiles.find(p => p.id === m.pourvoyeurId)?.nom || '—',
      vendeurNom: m.vendeurId ? allProfiles.find(p => p.id === m.vendeurId)?.prenom + ' ' + allProfiles.find(p => p.id === m.vendeurId)?.nom : null,
    }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5);

  // ═══════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════

  const STATUT_COLORS = {
    'Sourcing': 'bg-stone-100 text-stone-700',
    'Analyse': 'bg-blue-50 text-blue-700',
    'Mandat signé': 'bg-cyan-50 text-cyan-700',
    'Commercialisation': 'bg-amber-50 text-amber-700',
    'Offre': 'bg-purple-50 text-purple-700',
    'Promesse': 'bg-indigo-50 text-indigo-700',
    'Acte': 'bg-emerald-50 text-emerald-700',
  };

  const PERIODES = [
    { id: 'month', label: 'Ce mois' },
    { id: 'quarter', label: 'Ce trimestre' },
    { id: 'year', label: 'Cette année' },
    { id: 'all', label: 'Tout' },
  ];

  const periodeLabel = PERIODES.find(p => p.id === periode)?.label || 'Tout';

  return (
    <div className="p-6 max-w-none">

      {/* En-tête avec filtre temporel */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-1">🏛️ Dashboard Direction</h1>
          <p className="text-stone-500 text-sm">Vue 360° de l'activité — {commerciaux.length} commerciaux · {mandatsActifs.length} mandats actifs · <span className="font-medium text-stone-700">{periodeLabel}</span></p>
        </div>
        
        {/* Boutons de filtre temporel */}
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {PERIODES.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriode(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                periode === p.id
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ALERTES ═══ */}
      {(() => {
        const now = new Date();
        const j30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const j15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        // 1. Mandats sans activité depuis 30 jours
        const mandatsInactifs = mandatsActifs.filter(m => {
          // Pas mis à jour récemment ?
          const updatedAt = m.updatedAt || m.updated_at || m.createdAt || m.created_at;
          if (!updatedAt) return false;
          if (new Date(updatedAt) > j30) return false;
          // A-t-il une tâche récente ?
          const tachesMandat = (todos || []).filter(t =>
            t.lienType === 'mandat' && t.lienId === m.id &&
            t.createdAt && new Date(t.createdAt) > j30
          );
          return tachesMandat.length === 0;
        });

        // 2. Tâches en retard
        const tachesEnRetard = (todos || []).filter(t => {
          if (t.statut === 'Fait') return false;
          if (!t.echeance) return false;
          return new Date(t.echeance) < now;
        });

        // 3. Tâches sans échéance
        const tachesSansEcheance = (todos || []).filter(t =>
          t.statut !== 'Fait' && !t.echeance
        );

        // 4. Mandats avec échéance proche (15 jours)
        const mandatsEcheanceProche = mandatsActifs.filter(m => {
          const ech = m.mandatDateEcheance || m.mandat_date_echeance;
          if (!ech) return false;
          const echDate = new Date(ech);
          return echDate > now && echDate < j15;
        });

        // 5. Mandats sans photos ou sans description
        const mandatsIncomplets = mandatsActifs.filter(m => {
          const sansPhoto = !m.photos || m.photos.length === 0;
          const sansDesc = !m.description || m.description.trim().length < 50;
          return sansPhoto || sansDesc;
        });

        const alertes = [
          {
            count: mandatsInactifs.length,
            label: 'Mandats sans activité',
            sub: 'Pas de tâche ni mise à jour depuis 30 jours',
            color: 'from-amber-50 to-amber-100 border-amber-200 text-amber-900',
            icon: '⚠️',
            items: mandatsInactifs.slice(0, 3).map(m => m.nom),
          },
          {
            count: tachesEnRetard.length,
            label: 'Tâches en retard',
            sub: 'Échéance dépassée',
            color: 'from-red-50 to-red-100 border-red-200 text-red-900',
            icon: '🔴',
            items: tachesEnRetard.slice(0, 3).map(t => t.titre),
          },
          {
            count: tachesSansEcheance.length,
            label: 'Tâches sans échéance',
            sub: 'À planifier',
            color: 'from-stone-50 to-stone-100 border-stone-200 text-stone-900',
            icon: '📅',
            items: tachesSansEcheance.slice(0, 3).map(t => t.titre),
          },
          {
            count: mandatsEcheanceProche.length,
            label: 'Mandats expirent bientôt',
            sub: 'Échéance dans moins de 15 jours',
            color: 'from-orange-50 to-orange-100 border-orange-200 text-orange-900',
            icon: '⏰',
            items: mandatsEcheanceProche.slice(0, 3).map(m => m.nom),
          },
          {
            count: mandatsIncomplets.length,
            label: 'Fiches mandat incomplètes',
            sub: 'Sans photo ou description courte',
            color: 'from-blue-50 to-blue-100 border-blue-200 text-blue-900',
            icon: '📦',
            items: mandatsIncomplets.slice(0, 3).map(m => m.nom),
          },
        ];

        const totalAlertes = alertes.reduce((s, a) => s + a.count, 0);

        if (totalAlertes === 0) {
          return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-medium text-emerald-900">Tout est sous contrôle</div>
                <div className="text-xs text-emerald-700">Aucune alerte active à signaler</div>
              </div>
            </div>
          );
        }

        return (
          <div className="mb-6">
            <h2 className="font-display text-lg font-semibold text-stone-900 mb-3 flex items-center gap-2">
              ⚠️ Points d'attention
              <span className="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{totalAlertes}</span>
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {alertes.map((a, i) => (
                <div
                  key={i}
                  className={`bg-gradient-to-br ${a.color} border rounded-xl p-3 ${a.count === 0 ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-2xl font-semibold">{a.count}</span>
                  </div>
                  <div className="text-xs font-medium leading-tight">{a.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{a.sub}</div>
                  {a.count > 0 && a.items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/10 text-[10px] space-y-0.5 opacity-80">
                      {a.items.map((item, j) => (
                        <div key={j} className="truncate">• {item}</div>
                      ))}
                      {a.count > 3 && <div className="italic">+ {a.count - 3} autre{a.count - 3 > 1 ? 's' : ''}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {/* ═══ KPIs GLOBAUX ═══ */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">CA portefeuille</div>
          <div className="text-2xl font-semibold text-stone-900">{formatPrixCompact(caGlobal)}</div>
          <div className="text-xs text-stone-500 mt-1">{mandatsActifs.length} mandats actifs · TTC</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-emerald-700 mb-1">Encaissé</div>
          <div className="text-2xl font-semibold text-emerald-900">{formatPrixCompact(commissionEncaissee)}</div>
          <div className="text-xs text-emerald-700 mt-1">Mandats à l'Acte</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5 border border-indigo-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-indigo-700 mb-1">En cours</div>
          <div className="text-2xl font-semibold text-indigo-900">{formatPrixCompact(commissionEnCours)}</div>
          <div className="text-xs text-indigo-700 mt-1">Mandats à la Promesse</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-purple-700 mb-1">Potentiel</div>
          <div className="text-2xl font-semibold text-purple-900">{formatPrixCompact(commissionPotentielle)}</div>
          <div className="text-xs text-purple-700 mt-1">Mandats à l'Offre</div>
        </div>
      </div>

      {/* ═══ PIPELINE ═══ */}
      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 p-5 mb-6">
        <h2 className="font-display text-lg font-semibold text-stone-900 mb-4">📊 Pipeline commercial</h2>
        <div className="grid grid-cols-7 gap-2">
          {pipelineParStatut.map(({ statut, count, ca, commission }) => (
            <div key={statut} className={`rounded-lg p-3 ${STATUT_COLORS[statut] || 'bg-stone-100'}`}>
              <div className="text-[10px] uppercase tracking-wide opacity-70">{statut}</div>
              <div className="text-2xl font-semibold mt-0.5">{count}</div>
              {count > 0 && (
                <div className="text-[10px] mt-1 opacity-70">
                  {formatPrixCompact(ca)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PERFORMANCES COMMERCIAUX ═══ */}
      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden mb-6">
        <div className="p-5 border-b border-stone-200">
          <h2 className="font-display text-lg font-semibold text-stone-900">🏆 Performances commerciaux</h2>
          <p className="text-xs text-stone-500 mt-1">Triés par part personnelle (encaissée + en cours + potentielle) · {periodeLabel}</p>
        </div>
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Commercial</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Pourvoyeur</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Vendeur</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Tâches</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Encaissé</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody>
            {perfParCommercial.map((perf, i) => (
              <tr key={perf.profile.id} className="border-t border-stone-100 hover:bg-stone-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {i === 0 && perf.partTotal > 0 && <span className="text-amber-500">🥇</span>}
                    {i === 1 && perf.partTotal > 0 && <span className="text-stone-400">🥈</span>}
                    {i === 2 && perf.partTotal > 0 && <span className="text-orange-700">🥉</span>}
                    <div>
                      <div className="text-sm font-medium text-stone-900">{perf.profile.prenom} {perf.profile.nom}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center px-3 py-3 text-sm text-stone-700">{perf.nbMandatsPourvoyeur}</td>
                <td className="text-center px-3 py-3 text-sm text-stone-700">{perf.nbMandatsVendeur}</td>
                <td className="text-center px-3 py-3 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${perf.tachesEnCours > 5 ? 'bg-red-50 text-red-700' : perf.tachesEnCours > 2 ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                    {perf.tachesEnCours}
                  </span>
                </td>
                <td className="text-right px-4 py-3 text-sm font-medium text-emerald-700">{formatPrixCompact(perf.partEncaissee)}</td>
                <td className="text-right px-4 py-3 text-sm font-semibold text-stone-900">{formatPrixCompact(perf.partTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ TOP AFFAIRES ═══ */}
      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-200">
          <h2 className="font-display text-lg font-semibold text-stone-900">🎯 Top affaires en cours</h2>
          <p className="text-xs text-stone-500 mt-1">Mandats à l'Offre ou à la Promesse · {periodeLabel}</p>
        </div>
        {topAffaires.length === 0 ? (
          <div className="p-12 text-center text-stone-400 text-sm">Aucune affaire en cours sur cette période</div>
        ) : (
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mandat</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Statut</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Pourvoyeur</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Vendeur</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Prix TTC</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Commission</th>
              </tr>
            </thead>
            <tbody>
              {topAffaires.map(m => (
                <tr key={m.id} className="border-t border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-stone-900 truncate max-w-md">{m.nom}</div>
                    <div className="text-xs text-stone-500">{m.adresse}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLORS[m.statut]}`}>{m.statut}</span>
                  </td>
                  <td className="px-3 py-3 text-sm text-stone-700">{m.pourvoyeurNom}</td>
                  <td className="px-3 py-3 text-sm text-stone-700">{m.vendeurNom || <span className="text-stone-400 italic">—</span>}</td>
                  <td className="text-right px-4 py-3 text-sm text-stone-700">{formatPrixCompact(parseFloat(m.prix) || 0)}</td>
                  <td className="text-right px-4 py-3 text-sm font-semibold text-emerald-700">{formatPrixCompact(m.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ RÉGLAGES ADMIN ═══ */}
      <ReglagesSection rates={rates} setRates={setRates} userId={user?.id} />
    
    </div>
  );
}
function RemunerationTab({ mandats, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [rates, setRates] = useState({ pourvoyeur: 30, vendeur: 30, agence: 40, taux_commission: 5, tva: 20 });
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Manager ou pas
  const isManager = profile?.role === 'admin' || profile?.role === 'directeur' ||
    (profile?.prenom === 'Thomas' && (profile?.nom === 'Ezquerra' || profile?.nom === 'Boggiani'));

  // Charger les taux depuis settings
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'commission_rates').single().then(({ data }) => {
      if (data?.value) {
        setRates(prev => ({ ...prev, ...data.value }));
      }
    });
  }, []);

  // Par défaut : on affiche la fiche de l'utilisateur connecté
  useEffect(() => {
    if (user && !selectedUserId) setSelectedUserId(user.id);
  }, [user, selectedUserId]);

  if (!selectedUserId) return <div className="p-8">Chargement...</div>;

  // Identité du commercial affiché
  const targetProfile = allProfiles.find(p => p.id === selectedUserId);
  const isMe = selectedUserId === user?.id;

  // Filtrer les mandats où je suis pourvoyeur OU vendeur
  const myMandats = mandats.filter(m =>
    m.pourvoyeurId === selectedUserId || m.vendeurId === selectedUserId
  );

  // Calcul commission par mandat
  function computeCommission(m) {
    const prixTTC = parseFloat(m.prix) || 0;
    const prixHT = prixTTC / (1 + rates.tva / 100);
    const commissionAgence = prixHT * (rates.taux_commission / 100); // 5% du HT

    const isPourvoyeur = m.pourvoyeurId === selectedUserId;
    const isVendeur = m.vendeurId === selectedUserId;

    let partPerso = 0;
    if (isPourvoyeur) partPerso += commissionAgence * (rates.pourvoyeur / 100);
    if (isVendeur) partPerso += commissionAgence * (rates.vendeur / 100);

    return { prixTTC, prixHT, commissionAgence, partPerso, isPourvoyeur, isVendeur };
  }

  // KPIs agrégés
  const STATUTS_ENCAISSE = ['Acte'];
  const STATUTS_EN_COURS = ['Promesse'];
  const STATUTS_POTENTIEL = ['Offre'];
  const STATUTS_ALL = [...STATUTS_ENCAISSE, ...STATUTS_EN_COURS, ...STATUTS_POTENTIEL];

  const filteredMandats = myMandats.filter(m => STATUTS_ALL.includes(m.statut));

  let caTotal = 0;           // Somme prix TTC des mandats où j'interviens
  let commissionAgence = 0;  // 5% du HT (la base à partager)
  let partEncaisse = 0;
  let partEnCours = 0;
  let partPotentiel = 0;

  for (const m of filteredMandats) {
    const calc = computeCommission(m);
    caTotal += calc.prixTTC;
    commissionAgence += calc.commissionAgence;
    if (STATUTS_ENCAISSE.includes(m.statut)) partEncaisse += calc.partPerso;
    if (STATUTS_EN_COURS.includes(m.statut)) partEnCours += calc.partPerso;
    if (STATUTS_POTENTIEL.includes(m.statut)) partPotentiel += calc.partPerso;
  }

  const partTotal = partEncaisse + partEnCours + partPotentiel;

  // Couleur statut
  const statutColor = {
    'Acte': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Promesse': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Offre': 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="p-6 max-w-none">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-semibold text-stone-900">📈 Rémunération</h1>
          {targetProfile && (
            <span className="text-stone-500 text-sm">
              {isMe ? 'Mes commissions' : `${targetProfile.prenom} ${targetProfile.nom}`}
            </span>
          )}
        </div>

        {/* Sélecteur de commercial pour les managers */}
        {isManager && (
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
          >
            {allProfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}{p.id === user?.id ? ' (moi)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Bandeau info taux */}
      <div className="mb-4 p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center gap-4 text-xs text-stone-600 flex-wrap">
        <span>💡 Calcul :</span>
        <span>Prix TTC ÷ {(1 + rates.tva / 100).toFixed(2)} = HT</span>
        <span>· Commission agence = HT × {rates.taux_commission}%</span>
        <span>· Répartition : Pourvoyeur {rates.pourvoyeur}% + Vendeur {rates.vendeur}% + Agence {rates.agence}%</span>
      </div>

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">CA total participé</div>
          <div className="text-2xl font-semibold text-stone-900">{formatPrixCompact(caTotal)}</div>
          <div className="text-xs text-stone-500 mt-1">{filteredMandats.length} mandat{filteredMandats.length > 1 ? 's' : ''} · TTC</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">Commission agence ({rates.taux_commission}% HT)</div>
          <div className="text-2xl font-semibold text-stone-900">{formatPrixCompact(commissionAgence)}</div>
          <div className="text-xs text-stone-500 mt-1">à partager 30/30/40</div>
        </div>
        <div className="bg-gradient-to-br from-sage-50 to-sage-100 rounded-xl p-5 border border-sage-200 shadow-luxe">
          <div className="text-xs uppercase tracking-wide text-sage-darker mb-1">Ma part (total)</div>
          <div className="text-2xl font-semibold text-sage-darker">{formatPrixCompact(partTotal)}</div>
          <div className="text-xs text-sage-dark mt-1">
            <span className="text-emerald-700 font-medium">{formatPrixCompact(partEncaisse)} encaissé</span>
            {' · '}
            <span>{formatPrixCompact(partEnCours)} en cours</span>
          </div>
        </div>
      </div>

      {/* Tableau des mandats */}
      <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mandat</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Statut</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Mon rôle</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Prix TTC</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Commission ({rates.taux_commission}% HT)</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Ma part</th>
            </tr>
          </thead>
          <tbody>
            {filteredMandats.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-stone-500 text-sm">Aucun mandat éligible (Acte / Promesse / Offre)</td>
              </tr>
            ) : (
              filteredMandats.map(m => {
                const calc = computeCommission(m);
                const isPotentiel = STATUTS_POTENTIEL.includes(m.statut);
                const isEncaisse = STATUTS_ENCAISSE.includes(m.statut);
                return (
                  <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-stone-900 truncate max-w-md">{m.nom}</div>
                      <div className="text-xs text-stone-500 truncate">{m.adresse}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statutColor[m.statut] || 'bg-stone-100 text-stone-700 border-stone-200'}`}>{m.statut}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {calc.isPourvoyeur && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">🤝 Pourvoyeur</span>}
                        {calc.isVendeur && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200">🎯 Vendeur</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-stone-700">{formatPrixCompact(calc.prixTTC)}</td>
                    <td className="px-3 py-2 text-right text-sm text-stone-700">{formatPrixCompact(calc.commissionAgence)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className={`text-sm font-semibold ${isEncaisse ? 'text-emerald-700' : isPotentiel ? 'text-stone-400' : 'text-stone-900'}`}>
                        {formatPrixCompact(calc.partPerso)}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredMandats.length > 0 && (
            <tfoot className="bg-stone-50 border-t-2 border-stone-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-stone-900">TOTAL</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-stone-900">{formatPrixCompact(caTotal)}</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-stone-900">{formatPrixCompact(commissionAgence)}</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-sage-darker">{formatPrixCompact(partTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
function TodosTab({ todos, reload, mandats, clients, deals, allProfiles = [] }) {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [newTodo, setNewTodo] = useState({ titre: '', priorite: 'Moyenne', statut: 'À faire', echeance: '', assignee: '', assignedToUserId: null, lienType: null, lienId: null });
  const [filterPerson, setFilterPerson] = useState('me'); // 'me' par défaut (mes tâches uniquement)

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
        {filtered.map(t => (
          <TaskInline key={t.id} task={t} mandats={mandats} clients={clients} allProfiles={allProfiles} onUpdate={reload} />
        ))}
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
