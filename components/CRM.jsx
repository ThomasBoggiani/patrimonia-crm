'use client'; import { useSearchParams } from 'next/navigation';
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
  Image as ImageIcon, Camera, Plug, FolderOpen, Trophy, TrendingUp, Inbox, Video
} from 'lucide-react';
import { ArrowLeft, Edit, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, isAdmin, getCurrentUserName, getCurrentUserInitials } from '@/lib/auth';
import { matchMandatsForClient } from '@/lib/matching';
import { getPriceTTC, getPriceNV, isNVEstimated, getCommission, isCommissionEstimated } from '@/lib/priceDisplay';
import AICreateModal from './AICreateModal';
import MarkAsSoldModal from './MarkAsSoldModal';
import VoiceNoteModal from './VoiceNoteModal';
import CascadeSelectMulti from './CascadeSelectMulti';
import MandatAIAssistant from './MandatAIAssistant';
import DocumentsModal from './DocumentsModal';
import AgendaTab from './AgendaTab';
import TeamTab from './TeamTab';
import MyProfile from './MyProfile';
import AIAnalyzeModal from './AIAnalyzeModal';
import EmailDraftsModal from './EmailDraftsModal';
import PhotoLightbox from './PhotoLightbox';
import NotificationBell from './NotificationBell';
import PhotoUploader from './PhotoUploader';
import IntegrationsTab from './IntegrationsTab';
import ClientEmails from './ClientEmails'; 
import ClientAIAssistant from './ClientAIAssistant'; 
import InboxTab from './InboxTab'; 
import QuestionnaireResponseModal from './QuestionnaireResponseModal'; 
import ClientMatches from './ClientMatches';
import ContactsImportModal from './ContactsImportModal';
import PdfExportButtons from '@/components/PdfExportButtons';
import { VisiteModal, MandantModal } from './MandatModals';
import CascadeSelect from './CascadeSelect';
import MediasModal from './MediasModal';
import {   formatPrix,   formatPrixCompact,   toCamel,   toSnake,   isManager,   getDPEClass,   getDPEColor,   STATUTS_MANDAT,   STATUTS_DEAL,   TYPES_ACTIF,   TYPES_ACTIF_B2B_TREE,   TYPES_HABITATION_B2C,   TYPOLOGIES_CLIENT,   ZONES,   NB_PIECES,   PORTAILS,   STATUTS_PORTAIL,   getSousTypesForFamille,   familleHasSousTypes,   getMarcheFromTypologieClient,   getSousTypologiesForClient,   clientHasSousTypologie,   groupTypologiesRecherchees,   getCoverPhoto,   getPhotos, } from '@/lib/crm-constants';
import {
  Field,
  DetailItem,
  KpiCard,
  KpiBox,
  TaskRow,
  AlertRow,
  CommerceBadge,
  StatutBadge,
  DealStatutBadge,
  MaturiteBadge,
  TypeInteractionBadge,
  TaskInline,
  QuickAddTask,
} from '@/components/crm/SharedComponents';
import {
  DashboardDirection,
  RemunerationTab,
} from '@/components/crm/DirectionTabs';
import {
  EmailingsTab,
  QuestionnairesTab,
} from '@/components/crm/MarketingTabs';
import {
  TodosTab,
  AnnoncesTab,
} from '@/components/crm/OperationalTabs';
import {
  DealsTab,
  MatchingTab,
} from '@/components/crm/DealsAndMatching';

// ═══ Helpers et constantes : voir lib/crm-constants.js ═══

// === COMPOSANT PRINCIPAL ===
// Helper : déclenche le matching auto batch en fire-and-forget après save d'un mandat ou client
async function triggerMatchingBatch({ mandatId, clientId }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    // Fire-and-forget : on n'attend pas la réponse
    fetch('/api/matching-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, mandatId, clientId }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (data?.notifsCreated > 0) {
        console.log(`[matching-batch] ${data.notifsCreated} notif(s) créée(s) pour ${data.ownersNotified?.join(', ')}`);
      }
    }).catch(e => console.warn('[matching-batch] échec:', e.message));
  } catch (e) {
    console.warn('[matching-batch] init failed:', e.message);
  }
}
export default function CRM() {
  const { profile, signOut } = useAuth();
  const [showAICreate, setShowAICreate] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabKey, setTabKey] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [pendingClientToOpen, setPendingClientToOpen] = useState(null);
  const [pendingMandatToOpen, setPendingMandatToOpen] = useState(null);

  // Helper : naviguer vers la fiche d'un client depuis n'importe où
  function navigateToClient(clientId) {
    setPendingClientToOpen(clientId);
    setActiveTab('clients');
    setTabKey(k => k + 1);
    pushHistory({ tab: 'clients', open: clientId });
  }

  // Helper : naviguer vers la fiche d'un mandat depuis n'importe où
  function navigateToMandat(mandatId) {
    setPendingMandatToOpen(mandatId);
    setActiveTab('mandats');
    setTabKey(k => k + 1);
    pushHistory({ tab: 'mandats', open: mandatId });
  }

  // ─── Historique navigateur : swipe \u00e0 2 doigts ou bouton retour ─────────
  // Push une entr\u00e9e dans l'historique \u00e0 chaque changement d'onglet/fiche
  function pushHistory(state) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (state.tab) url.searchParams.set('tab', state.tab); else url.searchParams.delete('tab');
    if (state.open) url.searchParams.set('open', state.open); else url.searchParams.delete('open');
    window.history.pushState(state, '', url.toString());
  }

  // Wrap setActiveTab pour qu'il pousse aussi dans l'historique (sauf si appel\u00e9 depuis popstate)
  const setActiveTabWithHistory = (newTab) => {
    setActiveTab(newTab);
    pushHistory({ tab: newTab });
  };

  // \u00c9coute le bouton retour navigateur / swipe 2 doigts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = (e) => {
      const state = e.state || {};
      const url = new URL(window.location.href);
      const tab = state.tab || url.searchParams.get('tab') || 'dashboard';
      const open = state.open || url.searchParams.get('open') || null;

      setActiveTab(tab);
      if (open && tab === 'mandats') setPendingMandatToOpen(open);
      else if (open && tab === 'clients') setPendingClientToOpen(open);
      else { setPendingMandatToOpen(null); setPendingClientToOpen(null); }
      setTabKey(k => k + 1);
    };
    window.addEventListener('popstate', handlePopState);

    // Au chargement initial : lit les query params pour deep-link
    const url = new URL(window.location.href);
    const initialTab = url.searchParams.get('tab');
    const initialOpen = url.searchParams.get('open');
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialOpen && initialTab === 'mandats') setPendingMandatToOpen(initialOpen);
      else if (initialOpen && initialTab === 'clients') setPendingClientToOpen(initialOpen);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Helper : naviguer vers l'onglet Matching auto avec un mandat pré-sélectionné
  const [pendingMatchingMandatId, setPendingMatchingMandatId] = useState(null);
  // Flag : si on arrive sur MandatsTab via "Mes mandats", on pré-active le filtre
  const [pendingMandatFilterMine, setPendingMandatFilterMine] = useState(false);
  function navigateToMatching(mandatId) {
    setPendingMatchingMandatId(mandatId);
    setActiveTab('matching');
    setTabKey(k => k + 1);
  }

  // Modal EmailDrafts : state + helper + listener event
  const [emailDraftsState, setEmailDraftsState] = useState(null); // { mandatId, clientIds: [] } | null
  function openEmailDrafts(mandatId, clientIds = []) {
    setEmailDraftsState({ mandatId, clientIds });
  }
  useEffect(() => {
    const handleOpenEmailDrafts = (e) => openEmailDrafts(e.detail?.mandatId, e.detail?.clientIds || []);
    window.addEventListener('crm:openEmailDrafts', handleOpenEmailDrafts);
    return () => window.removeEventListener('crm:openEmailDrafts', handleOpenEmailDrafts);
  }, []);


  // Écoute les events depuis NotificationBell (clic sur une notif)
  useEffect(() => {
    const handleOpenMandat = (e) => navigateToMandat(e.detail?.mandatId);
    const handleOpenClient = (e) => navigateToClient(e.detail?.clientId);
    const handleOpenEmailDrafts = (e) => openEmailDrafts(e.detail?.mandatId, e.detail?.clientIds || []);
    window.addEventListener('crm:openMandat', handleOpenMandat);
    window.addEventListener('crm:openClient', handleOpenClient);
    window.addEventListener('crm:openEmailDrafts', handleOpenEmailDrafts);
    return () => {
      window.removeEventListener('crm:openMandat', handleOpenMandat);
      window.removeEventListener('crm:openClient', handleOpenClient);
      window.removeEventListener('crm:openEmailDrafts', handleOpenEmailDrafts);
    };
  }, []);

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
    { id: 'inbox', label: 'Inbox', icon: Inbox },
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
                <button key={tab.id} onClick={() => { setActiveTabWithHistory(tab.id); setTabKey(k => k + 1); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${
                    active 
                      ? 'bg-sage-50 text-sage-darker font-medium border border-sage-light' 
                      : 'text-ink/70 hover:bg-cream-100 hover:text-ink'
                  }`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-sage-dark' : ''}`} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.id === 'inbox' && inboxUnreadCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-600 text-white min-w-[18px] text-center">
                      {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                    </span>
                  )}
                  {active && <ChevronRight className="w-3.5 h-3.5 text-sage" />}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-cream-dark">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => { setActiveTabWithHistory('myprofile'); setTabKey(k => k + 1); setSidebarOpen(false); }}
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
            {activeTab === 'dashboard' && <Dashboard mandats={mandats} clients={clients} deals={deals} todos={todos} reload={loadAll} allProfiles={allProfiles} onNavigate={(t, opts) => { setPendingMandatFilterMine(!!opts?.filterMine); setActiveTabWithHistory(t); setTabKey(k => k + 1); }} />}
            {activeTab === 'mandats' && <MandatsTab mandats={mandats} reload={loadAll} clients={clients} deals={deals} interactions={interactions} todos={todos} annonces={annonces} allProfiles={allProfiles} pendingMandatId={pendingMandatToOpen} onPendingMandatConsumed={() => setPendingMandatToOpen(null)} onOpenMatching={navigateToMatching} onOpenEmailDrafts={openEmailDrafts} initialFilterMine={pendingMandatFilterMine} />}
            {activeTab === 'clients' && <ClientsTab clients={clients} reload={loadAll} mandats={mandats} deals={deals} interactions={interactions} pendingClientId={pendingClientToOpen} onPendingClientConsumed={() => setPendingClientToOpen(null)} onOpenMandat={navigateToMandat} />}
            {activeTab === 'inbox' && <InboxTab onUnreadCountChange={setInboxUnreadCount} reload={loadAll} onOpenClient={navigateToClient} />}
            {activeTab === 'deals' && <DealsTab deals={deals} reload={loadAll} mandats={mandats} clients={clients} />}
            {activeTab === 'matching' && <MatchingTab mandats={mandats} clients={clients} deals={deals} reload={loadAll} initialMandatId={pendingMatchingMandatId} onInitialMandatConsumed={() => setPendingMatchingMandatId(null)} />}
            {activeTab === 'todos' && <TodosTab todos={todos} reload={loadAll} mandats={mandats} clients={clients} deals={deals} allProfiles={allProfiles} />}
            {activeTab === 'direction' && <DashboardDirection mandats={mandats} deals={deals} clients={clients} todos={todos} allProfiles={allProfiles} />}
            {activeTab === 'myprofile' && <MyProfile mandats={mandats} todos={todos} clients={clients} allProfiles={allProfiles} RemunerationComponent={RemunerationTab} onNavigate={(t) => { setActiveTabWithHistory(t); setTabKey(k => k + 1); }} />}
            {activeTab === 'integrations' && <IntegrationsTab />}
            {activeTab === 'team' && <TeamTab />}
            {activeTab === 'annonces' && <AnnoncesTab annonces={annonces} reload={loadAll} mandats={mandats} />}
            {activeTab === 'questionnaires' && <QuestionnairesTab questionnaires={questionnaires} reload={loadAll} />}
            {activeTab === 'emailings' && <EmailingsTab campagnes={campagnes} reload={loadAll} clients={clients} />}
          </div>
        </main>
      </div>

      {/* BOUTON FLOTTANT MOBILE : retiré (showGlobalVoice non implémenté) */}

      {/* Toast de succès après import / création IA */}
      {importToast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-sage-light rounded-xl shadow-luxe-hover p-4 max-w-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-sage-dark" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-ink mb-1">Import réussi</div>
              {/* Compatibilité ancienne (string) */}
              {typeof importToast === 'string' && (
                <div className="text-xs text-sage-dark">{importToast}</div>
              )}
              {/* Nouveau format (objet avec mandat / client) */}
              {typeof importToast === 'object' && (
                <div className="space-y-2">
                  {importToast.mandat && (
                    <div className="flex items-center justify-between gap-2 bg-sage-50 rounded-lg px-2.5 py-1.5">
                      <div className="text-xs text-ink truncate">
                        <span className="font-medium">Mandat :</span> {importToast.mandat.label}
                      </div>
                      <button
                        onClick={() => { navigateToMandat(importToast.mandat.id); setImportToast(null); }}
                        className="text-[11px] font-medium text-sage-darker hover:text-ink whitespace-nowrap"
                      >
                        Voir →
                      </button>
                    </div>
                  )}
                  {importToast.client && (
                    <div className="flex items-center justify-between gap-2 bg-sage-50 rounded-lg px-2.5 py-1.5">
                      <div className="text-xs text-ink truncate">
                        <span className="font-medium">Client :</span> {importToast.client.label}
                      </div>
                      <button
                        onClick={() => { navigateToClient(importToast.client.id); setImportToast(null); }}
                        className="text-[11px] font-medium text-sage-darker hover:text-ink whitespace-nowrap"
                      >
                        Voir →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setImportToast(null)} className="text-stone-400 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal ✨ Créer avec l'IA */}
      {emailDraftsState && (
        <EmailDraftsModal
          mandat={mandats.find(m => m.id === emailDraftsState.mandatId)}
          clients={clients}
          initialClientIds={emailDraftsState.clientIds}
          onClose={() => setEmailDraftsState(null)}
        />
      )}
      <AICreateModal
        open={showAICreate}
        onClose={() => setShowAICreate(false)}
        onCreated={({ mandat, client }) => {
          setImportToast({
            mandat: mandat ? { id: mandat.id, label: mandat.nom || 'Nouveau mandat' } : null,
            client: client ? { id: client.id, label: `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Nouveau client' } : null
          });
          loadAll();
          setTimeout(() => setImportToast(null), 10000);
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

function Dashboard({ mandats, clients, deals, todos, reload, allProfiles = [], onNavigate }) {
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
    // Nouveau : on regarde dans medias (photos uniquement)
    const mediasPhotos = Array.isArray(m.medias) ? m.medias.filter(x => x && x.type === 'photo') : [];
    if (mediasPhotos.length > 0) return false;
    // Fallback legacy : photos
    const legacyPhotos = m.photos;
    if (Array.isArray(legacyPhotos) && legacyPhotos.length > 0) return false;
    return true;
  });

  // Salutation contextuelle
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
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
          onClick={() => onNavigate?.('mandats', { filterMine: true })}
        />
        <KpiCard
          label="Mes tâches du jour"
          value={myTodayTasks.length}
          icon={CheckSquare}
          accent={myTodayTasks.length > 0 ? "amber" : "stone"}
          sublabel={tasksRetard.length > 0 ? `+ ${tasksRetard.length} en retard` : 'À jour ✓'}
          onClick={() => onNavigate?.('todos')}
        />
        <KpiCard
          label="Affaires en cours"
          value={affairesEnCours.length}
          icon={Handshake}
          accent="emerald"
          sublabel="Offre → Acte"
          onClick={() => onNavigate?.('deals')}
        />
        <KpiCard
          label="Honoraires prévisionnels"
          value={formatPrixCompact(honorairesPrevisionnels)}
          icon={Sparkles}
          accent="sage"
          sublabel="Promesse signée"
          isAmount
          onClick={() => onNavigate?.('deals')}
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

// === MANDATS ===
function MandatsTab({ mandats, reload, clients, deals, interactions, todos, annonces, allProfiles = [], pendingMandatId, onPendingMandatConsumed, onOpenMatching, onOpenEmailDrafts, initialFilterMine }) {
  const { user, profile } = useAuth();
  const [secondaryDisplay, setSecondaryDisplay] = useState('m2'); // 'm2' | 'nv_comm'
  const [search, setSearch] = useState('');
  const [filterComm, setFilterComm] = useState('Tous');
  const [filterType, setFilterType] = useState('Tous');
  const [filterStatut, setFilterStatut] = useState('Actifs'); // 'Actifs' = exclut Perdu/Vendu par autres
  const [filterMarche, setFilterMarche] = useState('Tous'); // 'Tous' | 'b2b' | 'b2c'
  const [filterMine, setFilterMine] = useState(!!initialFilterMine);
  const myInitials = getCurrentUserInitials(profile);

  // Si initialFilterMine change (re-navigation depuis Dashboard), on re-applique
  useEffect(() => {
    if (initialFilterMine) setFilterMine(true);
  }, [initialFilterMine]);
  const [view, setView] = useState('list'); // 'list' | 'kanban'
  const [editingMandat, setEditingMandat] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedMandat, setSelectedMandat] = useState(null);
  const [sellingMandat, setSellingMandat] = useState(null);

  // Deep-link : ouvre automatiquement la fiche du mandat si pendingMandatId est passé en prop
  useEffect(() => {
    if (pendingMandatId && Array.isArray(mandats) && mandats.length > 0) {
      const mandat = mandats.find(m => m.id === pendingMandatId);
      if (mandat) {
        setSelectedMandat(mandat);
        onPendingMandatConsumed?.();
      }
    }
  }, [pendingMandatId, mandats]);

  const filtered = mandats.filter(m => {
    if (filterMine && m.owner !== myInitials) return false;
    if (search && !m.nom.toLowerCase().includes(search.toLowerCase()) && !(m.adresse || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterComm !== 'Tous' && m.commercialisation !== filterComm) return false;
    if (filterType !== 'Tous' && m.type !== filterType && m.sousType !== filterType) return false;
    if (filterStatut === 'Actifs' && ['Perdu', 'Vendu par autres', 'Acte'].includes(m.statut)) return false;
    if (filterStatut !== 'Tous' && filterStatut !== 'Actifs' && m.statut !== filterStatut) return false;

    // Filtre marché B2B/B2C : utilise m.marche, sinon déduit du type
    if (filterMarche !== 'Tous') {
      let mMarche = m.marche;
      if (!mMarche) {
        if (TYPES_HABITATION_B2C.includes(m.type)) mMarche = 'b2c';
        else if (Object.keys(TYPES_ACTIF_B2B_TREE).includes(m.type)) mMarche = 'b2b';
        else if (Object.values(TYPES_ACTIF_B2B_TREE).flat().includes(m.type)) mMarche = 'b2b';
      }
      if (mMarche !== filterMarche) return false;
    }

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
    // Trigger matching auto batch (fire-and-forget)
    if (mandatId) triggerMatchingBatch({ mandatId });
  };

  const handleDelete = async (id) => {
    if (confirm('Supprimer ce mandat ?')) {
      await supabase.from('mandats').delete().eq('id', id);
      reload();
    }
  };

  if (selectedMandat) {
    const currentMandat = mandats.find(m => m.id === selectedMandat.id) || selectedMandat;
    return <MandatDetail mandat={currentMandat} onBack={() => setSelectedMandat(null)} onEdit={() => { setEditingMandat(currentMandat); setSelectedMandat(null); }} deals={deals} clients={clients} reload={reload} todos={todos} annonces={annonces} allProfiles={allProfiles} onOpenMatching={onOpenMatching} onOpenEmailDrafts={onOpenEmailDrafts} />;
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
        {/* Toggle marché B2B / B2C */}
        <div className="flex bg-white border border-stone-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setFilterMarche('Tous')}
            className={`px-3 py-2.5 text-xs font-medium ${filterMarche === 'Tous' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-50'}`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterMarche('b2b')}
            className={`px-3 py-2.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2b' ? 'bg-sage-100 text-sage-darker' : 'text-stone-600 hover:bg-stone-50'}`}
            title="Investissement (B2B)"
          >
            B2B
          </button>
          <button
            onClick={() => setFilterMarche('b2c')}
            className={`px-3 py-2.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2c' ? 'bg-blue-100 text-blue-900' : 'text-stone-600 hover:bg-stone-50'}`}
            title="Habitation (B2C)"
          >
            B2C
          </button>
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option value="Tous">Type : Tous</option>
          <optgroup label="Investissement (B2B)">
            {Object.entries(TYPES_ACTIF_B2B_TREE).map(([famille, sousTypes]) => (
              <React.Fragment key={famille}>
                <option value={famille}>{famille}</option>
                {sousTypes.map(s => (
                  <option key={`${famille}-${s}`} value={s}>&nbsp;&nbsp;&middot; {s}</option>
                ))}
              </React.Fragment>
            ))}
          </optgroup>
          <optgroup label="Habitation (B2C)">
            {TYPES_HABITATION_B2C.map(t => <option key={t} value={t}>{t}</option>)}
          </optgroup>
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
            {[...filtered].sort((a, b) => (parseFloat(a.prix) || Number.MAX_SAFE_INTEGER) - (parseFloat(b.prix) || Number.MAX_SAFE_INTEGER)).map(m => {
              const photoUrl = getCoverPhoto(m);
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
                  <td className="px-3 py-3 text-sm text-stone-700">
                    {(() => {
                      // Vocabulaire canonique : familles + sous-types B2B et types B2C
                      const FAMILLES_B2B = Object.keys(TYPES_ACTIF_B2B_TREE);
                      const SOUS_TYPES_B2B = Object.values(TYPES_ACTIF_B2B_TREE).flat();
                      const TYPES_B2C = TYPES_HABITATION_B2C;
                      const isCanonicalType = (v) => v && (FAMILLES_B2B.includes(v) || SOUS_TYPES_B2B.includes(v) || TYPES_B2C.includes(v));
                      const isCanonicalSousType = (v) => v && SOUS_TYPES_B2B.includes(v);

                      // On ne garde QUE les valeurs canoniques, on ignore le texte libre legacy
                      const cleanType = isCanonicalType(m.type) ? m.type : null;
                      const cleanSousType = isCanonicalSousType(m.sousType) ? m.sousType : null;

                      if (!cleanType && !cleanSousType) {
                        return <span className="text-stone-400">&mdash;</span>;
                      }

                      // Détermine le marché
                      let mMarche = m.marche;
                      if (!mMarche) {
                        if (TYPES_B2C.includes(cleanType)) mMarche = 'b2c';
                        else mMarche = 'b2b';
                      }

                      // Affichage : si sous-type existe, on n'affiche QUE le sous-type (sans la famille parent)
                      const typeLabel = cleanSousType || cleanType;
                      const tooltipFullPath = cleanSousType ? `${cleanType} \u2192 ${cleanSousType}` : cleanType;
                      const filterValue = cleanSousType || cleanType;
                      const badgeClass = mMarche === 'b2c'
                        ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        : 'bg-sage-50 text-sage-darker hover:bg-sage-100';
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFilterType(filterValue); }}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${badgeClass}`}
                          title={`Filtrer par ${tooltipFullPath}`}
                        >
                          {typeLabel}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-medium text-stone-900 text-sm">{formatPrix(getPriceTTC(m))}</div>
                    {secondaryDisplay === 'm2' ? (
                      m.prixM2 && parseFloat(m.prixM2) > 0 ? (
                        <div className="text-xs text-stone-500">{parseFloat(m.prixM2).toLocaleString('fr-FR')} €/m²</div>
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
                    {(() => {
                      const hasP = m.rendement !== null && m.rendement !== undefined && m.rendement !== '';
                      const hasO = m.rendementOptimise !== null && m.rendementOptimise !== undefined && m.rendementOptimise !== '';
                      const rP = hasP ? parseFloat(m.rendement) : null;
                      const rO = hasO ? parseFloat(m.rendementOptimise) : null;
                      return (
                        <div className="flex flex-col leading-tight">
                          <span className={`font-medium text-sm ${hasP ? 'text-emerald-700' : 'text-stone-300'}`} title="Rendement présent">
                            {hasP ? `${rP}%` : '—'}
                          </span>
                          <span className={`text-xs ${hasO ? 'text-amber-700' : 'text-stone-300'}`} title="Rendement optimisé">
                            {hasO ? `${rO}%` : '—'}
                          </span>
                        </div>
                      );
                    })()}
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
    nom: '', adresse: '', ville: '', marche: 'b2b', type: '', sousType: '', prix: 0, prixM2: 0,
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

  // Si on édite un mandat existant sans marché défini, on le déduit du type
  useEffect(() => {
    if (mandat && !data.marche) {
      const isB2C = ['Appartement', 'Maison', 'Hôtel particulier'].includes(mandat.type);
      setData(d => ({ ...d, marche: isB2C ? 'b2c' : 'b2b' }));
    }
  }, [mandat]);

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
  
  // Si le marché change, on reset type + sousType pour éviter de garder un sous-type incohérent 
  const updateMarche = (m) => setData({ ...data, marche: m, type: '', sousType: '' });

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
    loyers_annuels: 'loyersAnnuels', rendement: 'rendement', rendement_optimise: 'rendementOptimise',
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
              <Field label="Marché">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateMarche('b2b')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border ${data.marche === 'b2b' ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'}`}
                  >
                    Investissement (B2B)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMarche('b2c')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border ${data.marche === 'b2c' ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'}`}
                  >
                    Habitation (B2C)
                  </button>
                </div>
              </Field>
              {data.marche === 'b2b' ? (
                <CascadeSelect
                  tree={TYPES_ACTIF_B2B_TREE}
                  famille={data.type || ''}
                  sousType={data.sousType || ''}
                  onChange={({ famille, sousType }) => setData(d => ({ ...d, type: famille, sousType: sousType }))}
                  labelFamille="Famille d'actif"
                  labelSousType="Sous-type"
                />
              ) : (
                <Field label="Type d'habitation">
                  <select value={data.type || ''} onChange={e => update('type', e.target.value)} className={fieldClass('type')}>
                    <option value="">— Choisir —</option>
                    {TYPES_HABITATION_B2C.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </div>

          {/* SECTION 2 : MANDAT & FINANCES */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>💰 Mandat & Finances</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="N&deg; mandat"><input type="text" value={data.mandatNumero || ''} onChange={e => update('mandatNumero', e.target.value)} className={fieldClass('mandatNumero')} /></Field>
                <Field label="Type de mandat">
                  <select value={data.mandatType || ''} onChange={e => update('mandatType', e.target.value)} className={fieldClass('mandatType')}>
                    <option value="">&mdash;</option>
                    <option>EXCLUSIF</option>
                    <option>SEMI EXCLUSIF</option>
                    <option>SIMPLE</option>
                  </select>
                </Field>
                <Field label="&Eacute;ch&eacute;ance"><input type="date" value={data.mandatDateEcheance || ''} onChange={e => update('mandatDateEcheance', e.target.value)} className={fieldClass('mandatDateEcheance')} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Prix annonc&eacute; TTC (&euro;)"><input type="number" value={data.prix} onChange={e => update('prix', +e.target.value)} className={fieldClass('prix')} placeholder="Honoraires inclus" /></Field>
                <Field label="Prix/m&sup2; (&euro;)"><input type="number" value={data.prixM2} onChange={e => update('prixM2', +e.target.value)} className={fieldClass('prixM2')} /></Field>
                <Field label="Loyers/an (&euro;)"><input type="number" value={data.loyersAnnuels} onChange={e => update('loyersAnnuels', +e.target.value)} className={fieldClass('loyersAnnuels')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rendement pr&eacute;sent (%)">
                  <input type="number" step="0.01" value={data.rendement} onChange={e => update('rendement', +e.target.value)} className={fieldClass('rendement')} />
                  <span className="block text-[10px] text-stone-400 mt-1">&Agrave; ce jour, locataires en place</span>
                </Field>
                <Field label="Rendement optimis&eacute; (%)">
                  <input type="number" step="0.01" value={data.rendementOptimise || 0} onChange={e => update('rendementOptimise', +e.target.value)} className={fieldClass('rendementOptimise')} />
                  <span className="block text-[10px] text-stone-400 mt-1">Potentiel apr&egrave;s travaux ou relocation</span>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Honoraires (%)"><input type="number" step="0.01" value={data.honorairesTaux || 0} onChange={e => update('honorairesTaux', +e.target.value)} className={fieldClass('honorairesTaux')} /></Field>
                <Field label="Honoraires (&euro;)"><input type="number" value={data.honorairesMontant || 0} onChange={e => update('honorairesMontant', +e.target.value)} className={fieldClass('honorairesMontant')} /></Field>
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
                    <option value="">&mdash;</option>
                    {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </Field>
                <Field label="🎯 Vendeur (closer de la vente)">
                  <select value={data.vendeurId || ''} onChange={e => update('vendeurId', e.target.value || null)} className={fieldClass('vendeurId')}>
                    <option value="">&mdash;</option>
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

function MandatDetail({ mandat, onBack, onEdit, deals, clients, reload, todos, annonces, allProfiles = [], onOpenMatching, onOpenEmailDrafts }) {
  const [openModal, setOpenModal] = useState(null); // 'photos' | 'visite' | 'mandant' | null
  const [aiAnalyzeOpen, setAiAnalyzeOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false); 
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
        {(() => {
          const mandatPhotos = getPhotos(mandat);
          const cover = getCoverPhoto(mandat);
          return mandatPhotos.length > 0 ? (
            <button onClick={() => setLightboxOpen(true)} className="flex-shrink-0 w-48 h-32 rounded-lg overflow-hidden bg-cream-100 border border-cream-dark hover:opacity-90 relative group">
              <img src={cover} alt={mandat.nom} className="w-full h-full object-cover" />
              {mandatPhotos.length > 1 && (
                <div className="absolute bottom-1.5 right-1.5 bg-stone-900/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">+{mandatPhotos.length - 1}</div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Voir la galerie</span>
              </div>
            </button>
          ) : (
            <button onClick={() => setOpenModal('medias')} className="flex-shrink-0 w-48 h-32 rounded-lg bg-cream-100 border border-dashed border-cream-dark hover:bg-cream-200 flex flex-col items-center justify-center text-stone-400 text-xs gap-1">
              <ImageIcon className="w-6 h-6" />
              <span>Ajouter photos</span>
            </button>
          );
        })()}

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
        <button onClick={() => setOpenModal('medias')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-cream-50">
          <ImageIcon className="w-3.5 h-3.5" /> Photos {getPhotos(mandat).length > 0 && <span className="text-[10px] bg-sage-100 text-sage-dark px-1.5 py-0.5 rounded-full">{getPhotos(mandat).length}</span>}
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
        <button onClick={() => onOpenEmailDrafts?.(mandat.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-sage-50 border border-sage-light text-sage-darker rounded-lg hover:bg-sage-100">
          <Mail className="w-3.5 h-3.5" /> Pr&eacute;parer mails clients
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
              <DetailItem label="Rendement" value={(() => {
                const rPresent = parseFloat(mandat.rendement) > 0 ? mandat.rendement : null;
                const rOpt = parseFloat(mandat.rendementOptimise) > 0 ? mandat.rendementOptimise : null;
                if (!rPresent && !rOpt) return <span>&mdash;</span>;
                return (
                  <div className="flex flex-col gap-0.5">
                    {rPresent && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-display font-semibold text-emerald-700">{rPresent}%</span>
                        <span className="text-[10px] text-stone-500">pr&eacute;sent</span>
                      </div>
                    )}
                    {rOpt && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-display font-semibold text-amber-700">{rOpt}%</span>
                        <span className="text-[10px] text-stone-500">optimis&eacute;</span>
                      </div>
                    )}
                  </div>
                );
              })()} highlight />
            </div>
            <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-cream">
              <DetailItem label="Surface" value={mandat.surface ? `${mandat.surface} m²` : '—'} />
              <DetailItem label="Type" value={mandat.sousType ? `${mandat.type} · ${mandat.sousType}` : mandat.type} />
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
              <button onClick={() => onOpenMatching?.(mandat.id)} className="text-left transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sage-dark rounded-xl">
                <KpiBox label="Rapprochements" value={nbRapprochements} icon={Handshake} />
              </button>
              <button onClick={() => onOpenMatching?.(mandat.id)} className="text-left transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sage-dark rounded-xl">
                <KpiBox label="Clients potentiels" value={nbMatching} icon={Users} sublabel="(matching)" />
              </button>
              <button onClick={() => onOpenMatching?.(mandat.id)} className="text-left transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sage-dark rounded-xl">
                <KpiBox label="Offres" value={nbOffres} icon={CheckCircle2} />
              </button>
              <button onClick={() => onOpenMatching?.(mandat.id)} className="text-left transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sage-dark rounded-xl">
                <KpiBox label="Visites" value={nbVisites} icon={Eye} />
              </button>
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
      {openModal === 'visite' && (
        <VisiteModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
      {openModal === 'mandant' && (
        <MandantModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
      {openModal === 'documents' && (
        <DocumentsModal mandat={mandat} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'medias' && (
        <MediasModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
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
      {lightboxOpen && (
        <PhotoLightbox
          photos={getPhotos(mandat)}
          initialIndex={0}
          mandatNom={mandat.nom || mandat.adresse}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

// Composant : sélecteur de responsable (dropdown réassignable)
// Fonctionne pour mandats ET clients via la prop `entity` ('mandat' | 'client')
function OwnerSelector({ mandat, client, entity = 'mandat', reload }) {
  const target = entity === 'client' ? client : mandat;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const ownerInitials = (target?.owner || '?').toUpperCase().slice(0, 2);

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

  const reassign = async (newInitials, profile) => {
    if (newInitials === target?.owner) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const table = entity === 'client' ? 'clients' : 'mandats';
      await supabase.from(table).update({ owner: newInitials }).eq('id', target.id);

      // Notification au nouveau propriétaire (si différent de soi-même)
      if (profile && profile.id && profile.id !== user?.id) {
        const targetName = entity === 'client'
          ? `${target.prenom || ''} ${target.nom || ''}`.trim() || 'un client'
          : target.nom || 'un mandat';
        const titreEntity = entity === 'client' ? 'client' : 'mandat';

        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: entity === 'client' ? 'client_assigned' : 'mandat_assigned',
          titre: `Nouveau ${titreEntity} assigné : ${targetName}`,
          message: `Tu as été désigné responsable de ce ${titreEntity}. Pense à le contacter rapidement.`,
          lue: false,
          created_by: user?.id
        });
      }

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
        title={`Responsable : ${target?.owner || '—'} — clic pour réassigner`}>
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
            const isCurrent = initials === target?.owner;
            return (
              <button key={p.id} onClick={() => reassign(initials, p)}
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

// === FICHE DETAIL CLIENT ===
function ClientDetail({ client, reload, interactions = [], onBack, onEdit, deals = [], mandats = [], onOpenMandat }) {
  const { user, profile } = useAuth();
  const allProfilesCache = [];

  if (!client) return null;

  // Helpers
  const fullName = [client.prenom, client.nom].filter(Boolean).join(' ') || 'Client sans nom';
  const initials = [(client.prenom || '').charAt(0), (client.nom || '').charAt(0)].join('').toUpperCase() || '??';

  // Calcul des mandats matchant ce client
  const matches = matchMandatsForClient(client, mandats) || [];

  // Interactions filtrees pour ce client uniquement
  const clientInteractions = (interactions || [])
    .filter(i => i.client_id === client.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  // Format budget
  const formatBudget = () => {
    const min = client.budget_min;
    const max = client.budget_max;
    if (!min && !max) return 'Non defini';
    const fmt = (n) => {
      if (!n) return '?';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M€';
      if (n >= 1e3) return Math.round(n / 1e3) + 'k€';
      return n + '€';
    };
    if (min && max) return `${fmt(min)} - ${fmt(max)}`;
    if (min) return `> ${fmt(min)}`;
    return `< ${fmt(max)}`;
  };

  // Badge marché
  const marcheBadge = client.marche === 'b2b'
    ? { label: 'B2B - Investisseur', bg: 'bg-sage-50', text: 'text-sage-dark' }
    : client.marche === 'b2c'
    ? { label: 'B2C - Habitation', bg: 'bg-emerald-50', text: 'text-emerald-700' }
    : null;

  // Badge maturité
  const maturiteBadge = client.maturite ? {
    label: client.maturite,
    bg: client.maturite === 'Chaud' ? 'bg-amber-50' : client.maturite === 'Tiede' ? 'bg-cream-200' : 'bg-stone-50',
    text: client.maturite === 'Chaud' ? 'text-amber-700' : 'text-stone-700',
  } : null;

  return (
    <div className="p-6 max-w-6xl">
      {/* Bouton retour */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour aux clients
      </button>

      {/* HEADER */}
      <div className="bg-white rounded-xl border border-cream-dark p-6 mb-4 shadow-luxe">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-sage-50 flex items-center justify-center text-sage-dark text-xl font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-2xl font-semibold text-stone-900">{fullName}</h1>
                {marcheBadge && (
                  <span className={`${marcheBadge.bg} ${marcheBadge.text} text-xs px-2 py-0.5 rounded-md font-medium`}>{marcheBadge.label}</span>
                )}
                {maturiteBadge && (
                  <span className={`${maturiteBadge.bg} ${maturiteBadge.text} text-xs px-2 py-0.5 rounded-md font-medium`}>{maturiteBadge.label}</span>
                )}
              </div>
              <div className="text-sm text-stone-500 flex gap-4 flex-wrap">
                {client.societe && (
                  <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{client.societe}</span>
                )}
                {client.owner && (
                  <span className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" />{client.owner}</span>
                )}
                {client.source && (
                  <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{client.source}</span>
                )}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg hover:bg-cream-50 text-stone-700">
                <Mail className="w-3.5 h-3.5" /> Email
              </a>
            )}
            {client.tel && (
              <a href={`tel:${client.tel}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg hover:bg-cream-50 text-stone-700">
                <Phone className="w-3.5 h-3.5" /> Appel
              </a>
            )}
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink-deep text-white rounded-lg hover:bg-stone-800">
              <Edit className="w-3.5 h-3.5" /> Modifier
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-cream-50 p-3 rounded-lg">
          <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">Budget</div>
          <div className="text-lg font-semibold text-stone-900">{formatBudget()}</div>
        </div>
        <div className="bg-cream-50 p-3 rounded-lg">
          <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">Rendement min</div>
          <div className="text-lg font-semibold text-stone-900">{client.rendement_min ? `${client.rendement_min}%` : 'Non defini'}</div>
        </div>
        <div className="bg-cream-50 p-3 rounded-lg">
          <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">Mandats matches</div>
          <div className="text-lg font-semibold text-stone-900">{matches.length}</div>
        </div>
      </div>

      {/* Coordonnees */}
      <div className="bg-white rounded-xl border border-cream-dark p-4 mb-4">
        <div className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-1.5">
          <Inbox className="w-4 h-4 text-sage-dark" /> Coordonnees
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {client.email && (
            <div>
              <div className="text-xs text-stone-500 mb-0.5">Email</div>
              <div className="text-stone-900">{client.email}</div>
            </div>
          )}
          {client.tel && (
            <div>
              <div className="text-xs text-stone-500 mb-0.5">Telephone</div>
              <div className="text-stone-900">{client.tel}</div>
            </div>
          )}
          {client.societe && (
            <div>
              <div className="text-xs text-stone-500 mb-0.5">Societe</div>
              <div className="text-stone-900">{client.societe}</div>
            </div>
          )}
          {client.source && (
            <div>
              <div className="text-xs text-stone-500 mb-0.5">Source</div>
              <div className="text-stone-900">{client.source}</div>
            </div>
          )}
        </div>
      </div>

      {/* Recherche / Criteres */}
      <div className="bg-white rounded-xl border border-cream-dark p-4 mb-4">
        <div className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-sage-dark" /> Recherche
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-stone-500 mb-1">Typologies recherchees</div>
            <div className="flex gap-1.5 flex-wrap">
              {Array.isArray(client.typologies_recherchees) && client.typologies_recherchees.length > 0 ? (
                client.typologies_recherchees.map((t, i) => (
                  <span key={i} className="bg-sage-50 text-sage-dark text-[11px] px-2 py-0.5 rounded-md">{t}</span>
                ))
              ) : (
                <span className="text-stone-400 text-xs">Aucune</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-stone-500 mb-1">Zones</div>
            <div className="flex gap-1.5 flex-wrap">
              {Array.isArray(client.zones) && client.zones.length > 0 ? (
                client.zones.map((z, i) => (
                  <span key={i} className="bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 rounded-md">{z}</span>
                ))
              ) : (
                <span className="text-stone-400 text-xs">Aucune</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mandats compatibles */}
      <div className="bg-white rounded-xl border border-cream-dark p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-stone-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sage-dark" /> Mandats compatibles
          </div>
          <span className="bg-sage-50 text-sage-dark text-xs px-2 py-0.5 rounded-md">{matches.length} match{matches.length > 1 ? 'es' : ''}</span>
        </div>
        {matches.length === 0 ? (
          <div className="text-center text-stone-400 text-sm py-6">Aucun mandat compatible pour le moment</div>
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 5).map(({ mandat: m, score, raisons }) => (
              <div
                key={m.id}
                onClick={() => onOpenMandat?.(m.id)}
                className="border border-cream-dark rounded-lg p-3 cursor-pointer hover:bg-cream-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="font-medium text-sm text-stone-900">{m.nom || m.adresse || 'Mandat sans nom'}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                    score >= 80 ? 'bg-emerald-50 text-emerald-700' :
                    score >= 60 ? 'bg-amber-50 text-amber-700' :
                    'bg-stone-50 text-stone-600'
                  }`}>{score}%</span>
                </div>
                <div className="text-xs text-stone-500 mb-1.5">
                  {[
                    m.prix ? `${(m.prix / 1e6).toFixed(1)}M€` : null,
                    m.surface ? `${m.surface} m²` : null,
                    m.rendement ? `Rdt ${m.rendement}%` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {Array.isArray(raisons) && raisons.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {raisons.slice(0, 3).map((r, i) => (
                      <span key={i} className="bg-cream-100 text-stone-600 text-[10px] px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactions */}
      <div className="bg-white rounded-xl border border-cream-dark p-4">
        <div className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-sage-dark" /> Interactions ({clientInteractions.length})
        </div>
        {clientInteractions.length === 0 ? (
          <div className="text-center text-stone-400 text-sm py-6">Aucune interaction pour le moment</div>
        ) : (
          <div className="space-y-2.5">
            {clientInteractions.map(i => {
              const date = i.created_at ? new Date(i.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
              const TypeIcon = i.type === 'email_sortant' || i.type === 'email_entrant' ? Mail : i.type === 'appel' ? Phone : MessageSquare;
              return (
                <div key={i.id} className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="w-3.5 h-3.5 text-sage-dark" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-800">{i.resume || i.type || 'Interaction'}</div>
                    <div className="text-[11px] text-stone-500">{date}{i.created_by ? ` · ${i.created_by}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// === CLIENTS ===
function ClientsTab({ clients, reload, mandats, deals, interactions, pendingClientId, onPendingClientConsumed, onOpenMandat }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTypo, setFilterTypo] = useState('Tous');
  const [filterMarche, setFilterMarche] = useState('Tous'); // Tous | b2b | b2c
  const [editingClient, setEditingClient] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Si on arrive ici avec un client à ouvrir (depuis l'Inbox), on l'ouvre direct
  useEffect(() => {
    if (pendingClientId && clients.length > 0) {
      const c = clients.find(x => x.id === pendingClientId);
      if (c) {
        setSelectedClient(c);
        onPendingClientConsumed?.();
      }
    }
  }, [pendingClientId, clients, onPendingClientConsumed]);
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

    // Filtre marché (b2b/b2c) — utilise client.marche, sinon déduit de la typologie
    if (filterMarche !== 'Tous') {
      let mMarche = m.marche;
      if (!mMarche) {
        if (TYPES_HABITATION_B2C.includes(m.type)) mMarche = 'b2c';
        else if (Object.keys(TYPES_ACTIF_B2B_TREE).includes(m.type)) mMarche = 'b2b';
        else if (Object.values(TYPES_ACTIF_B2B_TREE).flat().includes(m.type)) mMarche = 'b2b';
      }
      if (mMarche !== filterMarche) return false;
    }
    return true;
  }).sort((a, b) => {
    // Tri par défaut : prix croissant (mandats sans prix en dernier)
    const pa = parseFloat(a.prix) || Number.MAX_SAFE_INTEGER;
    const pb = parseFloat(b.prix) || Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  const handleSave = async (client) => {
    const snakeData = toSnake(client);
    delete snakeData.created_at;
    delete snakeData.updated_at;
    let savedClientId = client.id;
    if (client.id) {
      snakeData.updated_by = user?.id;
      await supabase.from('clients').update(snakeData).eq('id', client.id);
    } else {
      delete snakeData.id;
      snakeData.created_by = user?.id;
      const { data: created } = await supabase.from('clients').insert(snakeData).select().single();
      if (created) savedClientId = created.id;
    }
    setEditingClient(null);
    setShowNew(false);
    reload();
    // Trigger matching auto batch (fire-and-forget)
    if (savedClientId) triggerMatchingBatch({ clientId: savedClientId });
  };

  if (selectedClient) {
    const current = clients.find(c => c.id === selectedClient.id) || selectedClient;
    return <ClientDetail client={current} reload={reload} interactions={interactions} onBack={() => setSelectedClient(null)} onEdit={() => { setEditingClient(current); setSelectedClient(null); }} deals={deals} mandats={mandats} onOpenMandat={onOpenMandat} />;
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
        {/* Toggle marché B2B / B2C */}
        <div className="flex bg-white border border-stone-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setFilterMarche('Tous')}
            className={`px-3 py-2.5 text-xs font-medium ${filterMarche === 'Tous' ? 'bg-ink-deep text-white' : 'text-stone-600 hover:bg-stone-50'}`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterMarche('b2b')}
            className={`px-3 py-2.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2b' ? 'bg-sage-100 text-sage-darker' : 'text-stone-600 hover:bg-stone-50'}`}
            title="Investissement (B2B)"
          >
            B2B
          </button>
          <button
            onClick={() => setFilterMarche('b2c')}
            className={`px-3 py-2.5 text-xs font-medium border-l border-stone-200 ${filterMarche === 'b2c' ? 'bg-blue-100 text-blue-900' : 'text-stone-600 hover:bg-stone-50'}`}
            title="Habitation (B2C)"
          >
            B2C
          </button>
        </div>

        {/* Select typologie avec optgroups */}
        <select value={filterTypo} onChange={e => setFilterTypo(e.target.value)} className="px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
          <option value="Tous">Toutes typologies</option>
          <optgroup label="Investissement (B2B)">
            <option value="Foncières">Foncières (toutes)</option>
            <option value="Foncières · Privées">Foncières · Privées</option>
            <option value="Foncières · Publiques">Foncières · Publiques</option>
            <option value="Marchands de biens">Marchands de biens</option>
            <option value="Fonds">Fonds</option>
            <option value="Promoteurs">Promoteurs</option>
            <option value="Family Office">Family Office</option>
          </optgroup>
          <optgroup label="Habitation (B2C)">
            <option value="Particuliers">Particuliers</option>
          </optgroup>
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
                {(() => {
                  const cMarche = c.marche || getMarcheFromTypologieClient(c.typologie);
                  const cSousTypo = c.sous_typologie;
                  const typoLabel = cSousTypo ? `${c.typologie} \u00b7 ${cSousTypo}` : c.typologie;
                  const filterValue = cSousTypo ? `${c.typologie} \u00b7 ${cSousTypo}` : c.typologie;
                  const badgeClass = cMarche === 'b2c'
                    ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    : 'bg-sage-50 text-sage-darker hover:bg-sage-100';
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFilterTypo(filterValue); }}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${badgeClass}`}
                      title={`Filtrer par ${typoLabel}`}
                    >
                      {typoLabel}
                    </button>
                  );
                })()}
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
    marche: 'b2b',
    typologie: 'Foncières', sous_typologie: '',
    nature: 'Privée',
    budgetMin: 0, budgetMax: 0,
    rendementMin: 0, zones: [], typologiesRecherchees: [],
    statut: 'Actif', maturite: 'Moyen', origine: 'Apporteur', owner: 'TB'
  });

  // Si on édite un client existant sans `marche`, on le déduit de la typologie
  useEffect(() => {
    if (client && !data.marche) {
      const inferred = getMarcheFromTypologieClient(data.typologie) || 'b2b';
      setData(d => ({ ...d, marche: inferred }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (k, v) => setData({ ...data, [k]: v });
  const toggleArray = (key, value) => {
    const arr = data[key] || [];
    update(key, arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  const marche = data.marche || 'b2b';

  // Liste des typologies dispos selon le marché
  const TYPOLOGIES_B2C = ['Particuliers'];
  const TYPOLOGIES_B2B = ['Foncières', 'Marchands de biens', 'Fonds', 'Promoteurs', 'Family Office'];
  const typologiesAvailable = marche === 'b2c' ? TYPOLOGIES_B2C : TYPOLOGIES_B2B;

  const showSousTypologie = clientHasSousTypologie(data.typologie);
  const sousTypologiesOptions = getSousTypologiesForClient(data.typologie);

  // Switch marché : reset typologie + typologies recherchées (catalogue différent)
  const handleMarcheChange = (newMarche) => {
    if (newMarche === marche) return;
    const defaultTypologie = newMarche === 'b2c' ? 'Particuliers' : 'Foncières';
    setData({
      ...data,
      marche: newMarche,
      typologie: defaultTypologie,
      sous_typologie: '',
      typologiesRecherchees: []
    });
  };

  // Switch typologie (à l'intérieur d'un même marché)
  const handleTypologieChange = (newTypologie) => {
    const newSousTypologies = getSousTypologiesForClient(newTypologie);
    setData({
      ...data,
      typologie: newTypologie,
      sous_typologie: newSousTypologies.length > 0 ? (newSousTypologies.includes(data.sous_typologie) ? data.sous_typologie : '') : '',
    });
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-luxe-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-cream-dark">
          <h2 className="font-display text-2xl font-semibold text-stone-900">{client ? 'Modifier' : 'Nouveau'} client</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-stone-500" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* TOGGLE MARCHÉ — toujours en haut, pilote le reste du formulaire */}
          <Field label="Marché">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMarcheChange('b2b')}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${marche === 'b2b' ? 'bg-sage-100 border-sage-dark text-sage-darker' : 'bg-white border-stone-200 text-stone-600 hover:border-sage-light'}`}
              >
                <div className="font-semibold">Investissement</div>
                <div className="text-[11px] opacity-70 mt-0.5">B2B &middot; Foncières, Fonds, Promoteurs...</div>
              </button>
              <button
                type="button"
                onClick={() => handleMarcheChange('b2c')}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${marche === 'b2c' ? 'bg-blue-100 border-blue-600 text-blue-900' : 'bg-white border-stone-200 text-stone-600 hover:border-blue-300'}`}
              >
                <div className="font-semibold">Habitation</div>
                <div className="text-[11px] opacity-70 mt-0.5">B2C &middot; Particuliers</div>
              </button>
            </div>
          </Field>

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
              <select
                value={data.typologie || ''}
                onChange={e => handleTypologieChange(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900"
              >
                {typologiesAvailable.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {showSousTypologie ? (
              <Field label="Sous-typologie">
                <select value={data.sous_typologie || ''} onChange={e => update('sous_typologie', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                  <option value="">&mdash; Choisir &mdash;</option>
                  {sousTypologiesOptions.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Maturité">
                <select value={data.maturite} onChange={e => update('maturite', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                  <option>Haute</option><option>Moyen</option><option>Basse</option>
                </select>
              </Field>
            )}
          </div>

          {showSousTypologie && (
            <Field label="Maturité">
              <select value={data.maturite} onChange={e => update('maturite', e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-900">
                <option>Haute</option><option>Moyen</option><option>Basse</option>
              </select>
            </Field>
          )}

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

          {marche === 'b2b' && (
            <Field label="Typologies recherchées (Investissement)">
              <CascadeSelectMulti
                value={data.typologiesRecherchees || []}
                onChange={(arr) => update('typologiesRecherchees', arr)}
              />
            </Field>
          )}

          {marche === 'b2c' && (
            <>
              <Field label="Types d'habitation recherchés">
                <div className="flex flex-wrap gap-2">
                  {TYPES_HABITATION_B2C.map(t => (
                    <button key={t} type="button" onClick={() => toggleArray('typologiesRecherchees', t)}
                      className={`px-3 py-1 text-xs rounded-full border ${(data.typologiesRecherchees || []).includes(t) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Nombre de pièces recherchées">
                <div className="flex flex-wrap gap-2">
                  {NB_PIECES.map(p => (
                    <button key={p} type="button" onClick={() => toggleArray('typologiesRecherchees', p)}
                      className={`px-3 py-1 text-xs rounded-full border ${(data.typologiesRecherchees || []).includes(p) ? 'bg-ink-deep text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{p}</button>
                  ))}
                </div>
              </Field>
            </>
          )}

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
