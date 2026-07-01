'use client'; import { useSearchParams } from 'next/navigation';
// redeploy pour activer Google Maps API key
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, Users, Handshake, CheckSquare, Megaphone, FileQuestion, 
  Mail, Plus, Search, Calendar, Phone, MessageSquare, 
  MapPin, FileText, Trash2, Edit2, X, Check, 
  LayoutGrid, List, QrCode, Clock, AlertCircle,
  ChevronRight, Home, Send, Upload, Download,
  Circle, CheckCircle2, Eye, EyeOff, Copy, Sparkles,
  FileUp, Loader2, AlertTriangle, Info, Wand2, Mic,
  User as UserIcon, LogOut, Shield, Menu,
  Image as ImageIcon, Camera, Plug, FolderOpen, Trophy, TrendingUp, Inbox, Video,
  Bed, Trees, ParkingSquare, Store
} from 'lucide-react';
import { ArrowLeft, Edit, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { withContactIdentity } from '@/lib/client-identity';
import { useAuth, isAdmin, getCurrentUserName, getCurrentUserInitials } from '@/lib/auth';
import { matchMandatsForClient } from '@/lib/matching';
import { computeRendements, computeRendementsAuto, totalLoyerMensuel, totalLoyerMensuelOptimise, totalSurface, comptageStatuts } from '@/lib/rendements';
import { getPriceTTC, getPriceNV, isNVEstimated, getCommission, isCommissionEstimated } from '@/lib/priceDisplay';
import AIAssistantChat from './AIAssistantChat';
import MarkAsSoldModal from './MarkAsSoldModal';
import CascadeSelectMulti from './CascadeSelectMulti';
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
import ClientAnalysisPanel from './ClientAnalysisPanel';
import InboxTab from './InboxTab'; 
import QuestionnaireResponseModal from './QuestionnaireResponseModal'; 
import ClientMatches from './ClientMatches';
import MandatMatches from './MandatMatches';
import ContactsImportModal from './ContactsImportModal';
import PdfExportButtons from '@/components/PdfExportButtons';
import DiffusionInline from './DiffusionInline';
import MandatStatsInline from './MandatStatsInline';
import AssetsMandatInline from './AssetsMandatInline';
import RapportMandantModal from './RapportMandantModal';
import { VisiteModal } from './MandatModals';
import CascadeSelect from './CascadeSelect';
import MediasModal from './MediasModal'; 
import MediasInline from './MediasInline'; 
import ContactSelector from './ContactSelector';
import DocumentsInline from './DocumentsInline';
import ReferencesView from './ReferencesView';
import AvisDeValeurEditor from './AvisDeValeurEditor';
import ClientsTab, { OwnerSelector } from './ClientsView';
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

// ─────────────────────────────────────────────────────────
// Helper : icône Lucide pour une famille
// ─────────────────────────────────────────────────────────
function getFamilleIcon(famille) {
  switch (famille) {
    case 'Immeubles': return Building2;
    case 'Hôtels': return Bed;
    case 'Résidentiel': return Home;
    case 'Terrains': return Trees;
    case 'Parking': return ParkingSquare;
    case 'Locaux commerciaux': return Store;
    default: return null;
  }
}
// === COMPOSANT PRINCIPAL ===
// Helper : déclenche le matching auto batch en fire-and-forget après save d'un mandat ou client
async function triggerMatchingBatch({ mandatId, clientId }) {
  // (QW2) Batch de matching désactivé : le matching est calculé en mémoire
  // dans les fiches client/mandat (lib/matching.js, instantané, sans réseau ni IA).
  // Ce batch ne servait qu'aux notifications de fond — réactivable plus tard si besoin.
  return;
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
  const [assistantOpen, setAssistantOpen] = useState(false);
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

  // ─── Écoute les actions exécutées par l'AI Assistant pour rediriger automatiquement ───
  useEffect(() => {
    function onActionExecuted(e) {
      const { type, result } = e.detail || {};
      if (!result?.id) return;
      // Recharge les données pour avoir le nouveau client/mandat
      loadAll();
      // Ferme l'AI Assistant pour ne pas masquer la fiche
      setAssistantOpen(false);
      // Redirige vers la fiche selon le type
      setTimeout(() => {
        if (type === 'create_client' || type === 'update_client') {
          navigateToClient(result.id);
        } else if (type === 'create_mandat' || type === 'update_mandat') {
          navigateToMandat(result.id);
        }
      }, 100);
    }
    window.addEventListener('patrimonia:action-executed', onActionExecuted);
    return () => window.removeEventListener('patrimonia:action-executed', onActionExecuted);
  }, []);
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
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
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
    loadContacts();
  }, []);

  // Recharge UN SEUL mandat depuis Supabase et met \u00e0 jour le state local
  // \u00c9vite un reload global qui peut casser la navigation (perte de selectedMandat)
  async function updateMandatLocal(mandatId) {
    if (!mandatId) return;
    try {
      const { data, error } = await supabase.from('mandats').select('*').eq('id', mandatId).maybeSingle();
      if (error || !data) return;
      const updated = toCamel(data);
      setMandats(prev => prev.map(m => m.id === mandatId ? updated : m));
    } catch (e) {
      console.warn('[updateMandatLocal] error:', e.message);
    }
  }

  // Recharge UN SEUL client depuis Supabase et met à jour le state local
  // (évite loadAll qui recharge tout et casse la navigation / ralentit)
  async function updateClientLocal(clientId) {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.from('clients').select('*, contact:contacts(prenom, nom, societe, email, tel)').eq('id', clientId).maybeSingle();
      if (error || !data) return;
      const updated = withContactIdentity(toCamel(data));
      setClients(prev => {
        const exists = prev.some(c => c.id === clientId);
        return exists ? prev.map(c => c.id === clientId ? updated : c) : [updated, ...prev];
      });
    } catch (e) {
      console.warn('[updateClientLocal] error:', e.message);
    }
  }
  
  // Charge les contacts (gardés en mémoire au niveau CRM pour éviter les rechargements à chaque onglet)
  async function loadContacts(searchTerm = '') {
    setContacts(prev => { if (prev.length === 0) setLoadingContacts(true); return prev; });
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('q', searchTerm.trim());
      params.set('limit', '500');
      const res = await apiFetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      setContacts(data?.contacts || []);
    } catch (e) {
      console.error('[CRM loadContacts] error:', e);
    } finally {
      setLoadingContacts(false);
    }
  }

  // (QW1) Listener 'patrimonia:action-executed' redondant supprimé :
  // le premier useEffect (onActionExecuted) recharge déjà via loadAll() puis redirige.
  
  async function loadAll() {
    setLoading(true);
    try {
      const [m, c, d, t, a, cp, q, i] = await Promise.all([
        supabase.from('mandats').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*, contact:contacts(prenom, nom, societe, email, tel)').order('created_at', { ascending: false }),
        supabase.from('deals').select('*'),
        supabase.from('todos').select('*'),
        supabase.from('annonces').select('*'),
        supabase.from('campagnes').select('*'),
        supabase.from('questionnaires').select('*'),
        supabase.from('interactions').select('*').order('date', { ascending: false }),
      ]);
      setMandats((m.data || []).map(toCamel));
      setClients((c.data || []).map(toCamel).map(withContactIdentity));
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

  // Listener global : recharge les todos quand un composant émet l'event
  useEffect(() => {
    async function reloadTodos() {
      const { data } = await supabase.from('todos').select('*');
      if (data) setTodos(data.map(toCamel));
    }
    window.addEventListener('todos-changed', reloadTodos);
    return () => window.removeEventListener('todos-changed', reloadTodos);
  }, []);
  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'mandats', label: 'Mandats', icon: Building2 },
    { id: 'clients', label: 'Contacts', icon: Users },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'deals', label: 'Deals', icon: Handshake },
    { id: 'matching', label: 'Matching auto', icon: Sparkles },
    { id: 'todos', label: 'To-do perso', icon: CheckSquare },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'annonces', label: 'Annonces', icon: Megaphone },
    { id: 'emailings', label: 'Emailings & Sourcing', icon: Mail },
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
              onClick={() => { setAssistantOpen(true); setSidebarOpen(false); }}
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
            {activeTab === 'mandats' && <MandatsTab mandats={mandats} reload={loadAll} updateMandatLocal={updateMandatLocal} clients={clients} deals={deals} interactions={interactions} todos={todos} annonces={annonces} allProfiles={allProfiles} pendingMandatId={pendingMandatToOpen} onPendingMandatConsumed={() => setPendingMandatToOpen(null)} onOpenMatching={navigateToMatching} onOpenEmailDrafts={openEmailDrafts} initialFilterMine={pendingMandatFilterMine} />}
            {activeTab === 'clients' && <ClientsTab clients={clients} contacts={contacts} loadingContacts={loadingContacts} loadContacts={loadContacts} reload={loadAll} updateClientLocal={updateClientLocal} mandats={mandats} deals={deals} interactions={interactions} allProfiles={allProfiles} pendingClientId={pendingClientToOpen} onPendingClientConsumed={() => setPendingClientToOpen(null)} onOpenMandat={navigateToMandat} />}
            {activeTab === 'inbox' && <InboxTab onUnreadCountChange={setInboxUnreadCount} reload={loadAll} onOpenClient={navigateToClient} />}
            {activeTab === 'deals' && <DealsTab deals={deals} reload={loadAll} mandats={mandats} clients={clients} />}
            {activeTab === 'matching' && <MatchingTab mandats={mandats} clients={clients} deals={deals} reload={loadAll} initialMandatId={pendingMatchingMandatId} onInitialMandatConsumed={() => setPendingMatchingMandatId(null)} />}
            {activeTab === 'todos' && <TodosTab todos={todos} reload={loadAll} mandats={mandats} clients={clients} deals={deals} allProfiles={allProfiles} />}
            {activeTab === 'direction' && <DashboardDirection mandats={mandats} deals={deals} clients={clients} todos={todos} allProfiles={allProfiles} />}
            {activeTab === 'myprofile' && <MyProfile mandats={mandats} todos={todos} clients={clients} deals={deals} allProfiles={allProfiles} RemunerationComponent={RemunerationTab} DirectionComponent={DashboardDirection} onNavigate={(t) => { setActiveTabWithHistory(t); setTabKey(k => k + 1); }} />}
            {activeTab === 'integrations' && <IntegrationsTab />}
            {activeTab === 'agenda' && <AgendaTab />}
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
      <AIAssistantChat open={assistantOpen} onOpenChange={setAssistantOpen} />
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
  
  const myFullNameForToday = profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : '';
  const myTodayTasks = todos.filter(t => {
    if (t.statut === 'Terminé' || t.statut === 'Termine') return false;
    if (!isToday(t.echeance)) return false;
    if (t.assignedToUserId === user?.id || t.assigned_to_user_id === user?.id) return true;
    if (myFullNameForToday && t.assignee === myFullNameForToday) return true;
    if (!t.assignedToUserId && !t.assigned_to_user_id && !t.assignee) return true;
    return false;
  });

  // Affaires en cours = à partir de la signature de l'offre (Offre, Promesse, Acte)
  const affairesEnCours = mandats.filter(m => 
    ['Offre', 'Promesse', 'Acte'].includes(m.statut)
  );

  // Honoraires prévisionnels = uniquement mandats en Promesse (signée mais pas encore vendue)
  const honorairesPrevisionnels = mandats
    .filter(m => m.statut === 'Promesse')
    .reduce((sum, m) => sum + (parseFloat(m.honorairesMontant) || 0), 0);

  // ─── Tâches par priorité ───
  const myFullName = profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : '';
  const myTasks = todos.filter(t => {
    if (t.statut === 'Terminé' || t.statut === 'Termine') return false;
    if (t.assignedToUserId === user?.id || t.assigned_to_user_id === user?.id) return true;
    if (myFullName && t.assignee === myFullName) return true;
    if (!t.assignedToUserId && !t.assigned_to_user_id && !t.assignee) return true;
    return false;
  });

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

  // ─── RDV du jour depuis Outlook ───
  const [todayEvents, setTodayEvents] = useState([]);
  const [outlookConnectedDash, setOutlookConnectedDash] = useState(null);

  useEffect(() => {
    if (!user) return;
    async function loadTodayEvents() {
      try {
        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59);
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `/api/microsoft/events?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`,
          { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        );
        if (!res.ok) {
          const err = await res.json();
          if (err.code === 'NOT_CONNECTED') {
            setOutlookConnectedDash(false);
          }
          return;
        }
        const { events } = await res.json();
        setTodayEvents(events || []);
        setOutlookConnectedDash(true);
      } catch (e) {
        console.warn('[Dashboard] Échec chargement RDV jour:', e.message);
      }
    }
    loadTodayEvents();
  }, [user]);

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
    const mediasPhotos = Array.isArray(m.medias) ? m.medias.filter(x => x && x.type === 'photo') : [];
    if (mediasPhotos.length > 0) return false;
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

      {/* ═══ Tâches + RDV en grid 2 colonnes ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        
        {/* Colonne DROITE : RDV du jour (1/3) */}
        <div className="lg:col-span-1 lg:order-2 bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
          <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sage-dark" />
            Mes RDV aujourd'hui
            {todayEvents.length > 0 && (
              <span className="text-xs text-stone-500 font-normal">({todayEvents.length})</span>
            )}
          </h2>

          {outlookConnectedDash === false && (
            <div className="text-center py-6 text-stone-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              <p className="text-sm">Outlook non connecté</p>
              <button onClick={() => onNavigate?.('integrations')} className="text-xs text-sage-dark hover:underline mt-1">
                Connecter dans Intégrations
              </button>
            </div>
          )}

          {outlookConnectedDash === true && todayEvents.length === 0 && (
            <div className="text-center py-8 text-stone-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm">Aucun RDV aujourd'hui</p>
            </div>
          )}

          {todayEvents.length > 0 && (
            <div className="space-y-2">
              {todayEvents.map(ev => {
                const start = new Date(ev.start.dateTime);
                const end = new Date(ev.end.dateTime);
                const heureDeb = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
                const heureFin = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <div key={ev.id} className="flex items-start gap-3 p-2.5 bg-sage-50/40 border border-sage-light/50 rounded-lg">
                    <div className="text-xs font-medium text-sage-darker font-mono whitespace-nowrap pt-0.5">
                      {heureDeb}
                      <div className="text-stone-400 text-[10px]">{heureFin}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">{ev.subject || '(Sans titre)'}</div>
                      {ev.location?.displayName && (
                        <div className="text-[11px] text-stone-500 truncate">📍 {ev.location.displayName}</div>
                      )}
                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="text-[11px] text-stone-500 truncate">
                          👥 {ev.attendees.slice(0, 2).map(a => a.emailAddress?.name || a.emailAddress?.address).join(', ')}
                          {ev.attendees.length > 2 && ` +${ev.attendees.length - 2}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonne GAUCHE : Tâches (2/3) */}
        <div className="lg:col-span-2 lg:order-1 bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
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
                {tasksRetard.slice(0, 10).map(t => (
                  <TaskRow key={t.id} task={t} mandats={mandats} clients={clients} reload={reload} variant="late" />
                ))}
                {tasksRetard.length > 10 && (
                  <div className="text-xs text-stone-500 italic px-2.5 pt-1">
                    + {tasksRetard.length - 10} autres tâches en retard...
                  </div>
                )}
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
                  <TaskRow key={t.id} task={t} mandats={mandats} clients={clients} reload={reload} variant="today" />
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
                  <TaskRow key={t.id} task={t} mandats={mandats} clients={clients} reload={reload} variant="week" />
                ))}
              </div>
            </div>
          )}
        </div>

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
function MandatsTab({ mandats, reload, updateMandatLocal, clients, deals, interactions, todos, annonces, allProfiles = [], pendingMandatId, onPendingMandatConsumed, onOpenMatching, onOpenEmailDrafts, initialFilterMine }) {
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
    return (
      <>
        <MandatDetail mandat={currentMandat} onBack={() => { setSelectedMandat(null); const url = new URL(window.location.href); url.searchParams.set('tab', 'mandats'); url.searchParams.delete('open'); window.history.pushState({ tab: 'mandats' }, '', url.toString()); }} onEdit={() => { setEditingMandat(currentMandat); }} deals={deals} clients={clients} reload={() => updateMandatLocal?.(currentMandat.id) || reload()} todos={todos} annonces={annonces} allProfiles={allProfiles} onOpenMatching={onOpenMatching} onOpenEmailDrafts={onOpenEmailDrafts} />
        {editingMandat && (
          <MandatForm
            mandat={editingMandat}
            onSave={handleSave}
            onClose={() => setEditingMandat(null)}
            clients={clients}
            mandats={mandats}
          />
        )}
      </>
    );
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
          {/* Toggle Liste / Kanban / Références */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${view === 'list' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Liste
            </button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${view === 'kanban' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Kanban
            </button>
            <button onClick={() => setView('references')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${view === 'references' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`} title="Bibliothèque de ventes historiques">
              ⭐ Références
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

      {view === 'references' ? (
        <ReferencesView />
      ) : view === 'kanban' ? (
        <MandatsKanban mandats={filtered} onSelectMandat={setSelectedMandat} reload={reload} secondaryDisplay={secondaryDisplay} />
      ) : (
        <div className="bg-white rounded-xl shadow-luxe border border-stone-200 overflow-x-auto">
        <table className="w-full min-w-[1000px]">
              <colgroup>
                <col style={{ width: '100px' }} />
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
                <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group" onClick={() => { setSelectedMandat(m); const url = new URL(window.location.href); url.searchParams.set('tab', 'mandats'); url.searchParams.set('open', m.id); window.history.pushState({ tab: 'mandats', open: m.id }, '', url.toString()); }}>
                  <td className="px-3 py-2">
                    <div className="w-44 h-28 rounded-lg overflow-hidden bg-cream-100 flex-shrink-0">
                      {photoUrl ? (
                        <img src={photoUrl} alt={m.nom} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
                          <Building2 className="w-6 h-6 text-stone-400" />
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

                      // Affichage : on n'affiche QUE le sous-type. Si pas de sous-type → tiret.
                        const typeLabel = cleanSousType || '—';
                        const tooltipFullPath = cleanSousType ? `${cleanType} \u2192 ${cleanSousType}` : (cleanType || 'Type non d\u00e9fini');
                        const filterValue = cleanSousType || cleanType;
                      const badgeClass = mMarche === 'b2c'
                        ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        : 'bg-sage-50 text-sage-darker hover:bg-sage-100';
                      const FamilleIcon = getFamilleIcon(cleanType);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFilterType(filterValue); }}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${badgeClass}`}
                          title={`Filtrer par ${tooltipFullPath}`}
                        >
                          {FamilleIcon && <FamilleIcon className="w-3 h-3 flex-shrink-0" />}
                          <span>{typeLabel}</span>
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
                      const _rdt = computeRendements(m);
                      const rP = _rdt.actuel;
                      const rO = _rdt.optimise;
                      const hasP = rP !== null && rP !== undefined && !isNaN(rP);
                      const hasO = rO !== null && rO !== undefined && !isNaN(rO);
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
                  <td className="px-3 py-2 whitespace-nowrap w-[120px]">
                    <div className="flex gap-1 items-center justify-end opacity-100" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingMandat(m)} className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded" title="Modifier"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setSellingMandat(m); }} className="p-1.5 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded" title="Marquer comme vendu (par autres)"><Trophy className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
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
        <MandatForm
          mandat={editingMandat}
          onSave={handleSave}
          onClose={() => {
            // Apr\u00e8s save/fermeture : on revient sur la fiche du mandat qu'on \u00e9ditait
            const editedMandat = editingMandat;
            setEditingMandat(null);
            setShowNew(false);
            // setSelectedMandat APR\u00c8S pour que le rendu se fasse sur la fiche
            if (editedMandat) {
              setTimeout(() => {
                setSelectedMandat(editedMandat);
                const url = new URL(window.location.href);
                url.searchParams.set('tab', 'mandats');
                url.searchParams.set('open', editedMandat.id);
                window.history.pushState({ tab: 'mandats', open: editedMandat.id }, '', url.toString());
                // Reload BDD après 1.5s (laisse le webhook finir)
                // updateMandatLocal met juste à jour le mandat sans casser selectedMandat
                setTimeout(() => {
                  if (updateMandatLocal) {
                    updateMandatLocal(editedMandat.id);
                  }
                }, 1500);
              }, 0);
            }
          }}
          clients={clients}
          mandats={mandats}
        />
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
// Sprint 4 — C1 : pièces du dossier nécessaires à la constitution d'un mandat.
// category = catégorie de doc utilisée pour ranger la pièce (cf. import-folder).
const PIECES_DOSSIER = [
  { key: 'fiche',        label: 'Fiche / mandat',            obligatoire: true,  category: 'mandat',       emoji: '📄' },
  { key: 'etat_locatif', label: 'État locatif + descriptif', obligatoire: true,  category: 'notes',        emoji: '🏢' },
  { key: 'dpe',          label: 'DPE',                       obligatoire: true,  category: 'diagnostics',  emoji: '⚡' },
  { key: 'taxe',         label: 'Taxe foncière',             obligatoire: true,  category: 'autre',        emoji: '🧾' },
  { key: 'diagnostics',  label: 'Diagnostics (amiante, plomb…)', obligatoire: true, category: 'diagnostics', emoji: '🔬' },
  { key: 'photos',       label: 'Photos',                    obligatoire: false, category: 'plans_photos', emoji: '🖼️' },
  { key: 'plans',        label: 'Plans',                     obligatoire: false, category: 'plans_photos', emoji: '📐' },
];

function MandatForm({ mandat, onSave, onClose, clients = [], mandats = [] }) {
  const { profile } = useAuth();
  const userInitials = (profile?.prenom && profile?.nom) ? getCurrentUserInitials(profile) : 'TB';
  const [data, setData] = useState((mandat && {
    ...mandat,
    type: mandat.type || mandat.sousType || '',
    sousType: mandat.sousType || '',
    marche: mandat.marche || (['Appartement', 'Maison', 'Hôtel particulier'].includes(mandat.type) ? 'b2c' : 'b2b'),
  }) || {
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
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [merging, setMerging] = useState(false);
  const folderInputRef = React.useRef(null);
  // Sprint 4 — C1 : check-list des pièces du dossier
  const [piecesPresent, setPiecesPresent] = useState(new Set());
  const pieceInputRef = React.useRef(null);
  const pendingPieceRef = React.useRef(null);
  // Sprint 4 — import Dropbox par lien
  const [dropboxUrl, setDropboxUrl] = useState('');

  const update = (k, v) => setData({ ...data, [k]: v });

  // ═══ Suppression du mandat ═══
  async function handleDeleteMandat() {
    if (!mandat?.id) return;
    if (!confirm(`Supprimer définitivement le mandat "${mandat.nom}" ?\n\nCette action est irréversible (interactions et documents liés seront aussi supprimés).`)) return;
    setDeleting(true);
    try {
      // Supprime les dépendances d'abord
      await supabase.from('mandat_contacts').delete().eq('mandat_id', mandat.id);
      await supabase.from('mandat_documents').delete().eq('mandat_id', mandat.id);
      await supabase.from('interactions').delete().eq('mandat_id', mandat.id);
      await supabase.from('todos').delete().eq('lien_type', 'mandat').eq('lien_id', mandat.id);
      // Puis le mandat
      const { error } = await supabase.from('mandats').delete().eq('id', mandat.id);
      if (error) throw error;
      alert('Mandat supprimé.');
      onClose();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mandats-changed'));
      // Redirige proprement vers la liste
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.pushState({ tab: 'mandats' }, '', url.toString());
      window.location.reload();
    } catch (e) {
      alert('Erreur suppression : ' + e.message);
    } finally {
      setDeleting(false);
    }
  }

  // ═══ Fusion : transfère tout du mandat courant (source) vers la cible, puis supprime la source ═══
  async function handleMergeMandat() {
    if (!mandat?.id || !mergeTargetId) { alert('Choisis un mandat cible.'); return; }
    if (mergeTargetId === mandat.id) { alert('Impossible de fusionner un mandat avec lui-même.'); return; }
    const target = mandats.find(m => m.id === mergeTargetId);
    if (!confirm(`Fusionner "${mandat.nom}" DANS "${target?.nom || 'cible'}" ?\n\nTous les documents, interactions, contacts et tâches du mandat courant seront transférés vers la cible. Le mandat courant sera ensuite supprimé.`)) return;
    setMerging(true);
    try {
      // Transfère les dépendances vers la cible
      await supabase.from('mandat_documents').update({ mandat_id: mergeTargetId }).eq('mandat_id', mandat.id);
      await supabase.from('interactions').update({ mandat_id: mergeTargetId }).eq('mandat_id', mandat.id);
      await supabase.from('todos').update({ lien_id: mergeTargetId }).eq('lien_type', 'mandat').eq('lien_id', mandat.id);
      // Pour mandat_contacts : on tente le transfert, en ignorant les doublons éventuels
      const { data: srcContacts } = await supabase.from('mandat_contacts').select('*').eq('mandat_id', mandat.id);
      for (const mc of (srcContacts || [])) {
        await supabase.from('mandat_contacts').update({ mandat_id: mergeTargetId }).eq('id', mc.id);
      }
      // Supprime le mandat source
      const { error } = await supabase.from('mandats').delete().eq('id', mandat.id);
      if (error) throw error;
      alert('Fusion terminée. Le mandat a été fusionné dans la cible.');
      onClose();
      const url = new URL(window.location.href);
      url.searchParams.set('open', mergeTargetId);
      window.history.pushState({ tab: 'mandats', open: mergeTargetId }, '', url.toString());
      window.location.reload();
    } catch (e) {
      alert('Erreur fusion : ' + e.message);
    } finally {
      setMerging(false);
    }
  }  
  
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

async function handleFolderImport(event, opts = {}) {
  const { pieceKey = null, forcedCategory = null } = opts;
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
            category: forcedCategory || category,
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
    if (pieceInputRef.current) pieceInputRef.current.value = '';
    if (pieceKey) {
      setPiecesPresent(prev => { const s = new Set(prev); s.add(pieceKey); return s; });
    } else {
      // Import en vrac : on coche au mieux la check-list selon les catégories détectées
      const labelToPieces = { 'Mandat': ['fiche'], 'Diagnostics': ['dpe', 'diagnostics'], 'Plans & photos': ['photos', 'plans'], 'Notes': ['etat_locatif'], 'Autre': ['taxe'] };
      const found = Object.keys(categoriesByLabel).flatMap(l => labelToPieces[l] || []);
      if (found.length) setPiecesPresent(prev => { const s = new Set(prev); found.forEach(k => s.add(k)); return s; });
    }
  } catch (e) {
    console.error('[FolderImport] Erreur:', e);
    alert('Erreur : ' + e.message);
    setImportProgress(null);
  }
}

  // Sprint 4 — Import d'un dossier Dropbox par lien : télécharge+dépose les fichiers
  // (route import-dropbox) puis enchaîne l'analyse IA de chaque fichier (import-folder),
  // comme l'import local. Crée le mandat si besoin.
  async function handleDropboxImport() {
    const url = (dropboxUrl || '').trim();
    if (!url) { alert('Colle d\'abord le lien Dropbox du dossier.'); return; }
    setImportResult(null);
    setImportProgress({ current: 0, total: 0, fileName: 'Connexion à Dropbox…' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('Session expirée'); setImportProgress(null); return; }

      // 1) Mandat (créé si nécessaire)
      let mandatId = mandat?.id || data.id;
      if (!mandatId) {
        const { data: created, error: createErr } = await supabase.from('mandats').insert({
          nom: data.nom || 'Nouveau mandat (import Dropbox)',
          type: data.type || "Immeuble d'habitation",
          statut: 'Sourcing',
          owner: data.owner || userInitials,
          pourvoyeur_id: data.pourvoyeurId || null,
          vendeur_id: data.vendeurId || null,
          commercialisation: data.commercialisation || 'Off-market',
        }).select().single();
        if (createErr || !created) { alert('Erreur création mandat : ' + (createErr?.message || 'inconnue')); setImportProgress(null); return; }
        mandatId = created.id;
        setData(d => ({ ...d, id: mandatId }));
      }

      // 2) Récupérer les fichiers du dossier Dropbox.
      // D'abord via le COMPTE connecté (sans limite de taille, fichier par fichier).
      // Si aucun compte n'est connecté, repli sur le lien public ZIP (<= 100 Mo).
      async function callDropbox(route) {
        const r = await fetch('/api/mandats/' + mandatId + route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, dropbox_url: url }),
        });
        const t = await r.text();
        try { return JSON.parse(t); }
        catch { return { ok: false, error: (t || '').slice(0, 200).trim() || `Erreur serveur (HTTP ${r.status})` }; }
      }
      let dbData = await callDropbox('/import-dropbox-account');
      if (dbData.needsConnect) {
        dbData = await callDropbox('/import-dropbox');
      }
      if (!dbData.ok) { alert('Dropbox : ' + (dbData.error || 'échec')); setImportProgress(null); return; }
      const files = dbData.files || [];
      if (files.length === 0) { alert('Aucun fichier exploitable dans ce dossier Dropbox.'); setImportProgress(null); return; }

      // 3) Analyse IA fichier par fichier (même pipeline que l'import local)
      let totalFilled = 0, errors = 0;
      const allExtracted = {};
      const categoriesByLabel = {};
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setImportProgress({ current: i + 1, total: files.length, fileName: f.nom });
        let category = 'autre', extractedData = {};
        const isImage = (f.mime_type || '').startsWith('image/');
        if (isImage) {
          // Photo : pas d'analyse IA (inutile pour remplir les champs, et lent). On la range simplement.
          category = 'plans_photos';
        } else {
          try {
            const aiRes = await fetch('/api/mandats/' + mandatId + '/import-folder', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, storage_path: f.storage_path, applyToMandat: true }),
            });
            const aiText = await aiRes.text();
            let aiData; try { aiData = JSON.parse(aiText); } catch { aiData = { ok: false }; }
            if (aiData.ok) {
              category = aiData.category || 'autre';
              extractedData = aiData.data || {};
              totalFilled += (aiData.filled?.length || 0);
            } else { errors++; }
          } catch (e) { errors++; }
        }

        await fetch('/api/mandats/' + mandatId + '/documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, type: 'file_meta', category, nom: f.nom, storage_path: f.storage_path, taille_bytes: f.taille, mime_type: f.mime_type }),
        });

        const label = ({ mandat: 'Mandat', diagnostics: 'Diagnostics', plans_photos: 'Plans & photos', notes: 'Notes', mandant: 'Mandant', autre: 'Autre' })[category] || 'Autre';
        categoriesByLabel[label] = (categoriesByLabel[label] || 0) + 1;
        for (const [k, v] of Object.entries(extractedData || {})) {
          if (v !== null && v !== undefined && v !== '') allExtracted[k] = v;
        }
      }

      // 4) Recharger le mandat dans le formulaire
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
        if (newData.prix && newData.surface && !newData.prixM2) { newData.prixM2 = Math.round(newData.prix / newData.surface); newFilled.add('prixM2'); }
        setData(newData);
        setFilledFields(newFilled);
      }

      // 5) Cocher la check-list au mieux selon les catégories détectées
      const labelToPieces = { 'Mandat': ['fiche'], 'Diagnostics': ['dpe', 'diagnostics'], 'Plans & photos': ['photos', 'plans'], 'Notes': ['etat_locatif'], 'Autre': ['taxe'] };
      const found = Object.keys(categoriesByLabel).flatMap(l => labelToPieces[l] || []);
      if (found.length) setPiecesPresent(prev => { const s = new Set(prev); found.forEach(k => s.add(k)); return s; });

      setImportProgress(null);
      setImportResult({ total: files.length, success: files.length - errors, errors, totalFilled, categoriesByLabel });
      setDropboxUrl('');
    } catch (e) {
      console.error('[DropboxImport] Erreur:', e);
      alert('Erreur : ' + e.message);
      setImportProgress(null);
    }
  }

  // Sprint 4 — C1 : crée une tâche pour chaque pièce OBLIGATOIRE manquante (ne bloque pas).
  async function createMissingPieceTasks(mandatId) {
    if (!mandatId) return 0;
    const manquantes = PIECES_DOSSIER.filter(p => p.obligatoire && !piecesPresent.has(p.key));
    if (manquantes.length === 0) return 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const echeance = new Date();
      echeance.setDate(echeance.getDate() + 7);
      const rows = manquantes.map(p => ({
        titre: `Pièce manquante au dossier : ${p.label}`,
        priorite: 'Haute',
        statut: 'À faire',
        echeance: echeance.toISOString().split('T')[0],
        assignee: getCurrentUserName(profile),
        assigned_to_user_id: user?.id || null,
        created_by: user?.id || null,
        lien_type: 'mandat',
        lien_id: mandatId,
      }));
      await supabase.from('todos').insert(rows);
      return manquantes.length;
    } catch (e) {
      console.warn('[pieces] création tâches manquantes:', e.message);
      return 0;
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

       {/* Documents : import + lien + Dropbox (composant unifié avec validation IA) */}
        <div className="p-6 border-b border-stone-200 bg-gradient-to-br from-sage-50/70 to-cream-50">
          {mandat ? (
            <DocumentsInline mandat={data} onUpdate={() => {}} />
          ) : (
            <div>
              {/* Sprint 4 — C1 : check-list des pièces du dossier (création du mandat) */}
              <input ref={pieceInputRef} type="file" multiple className="hidden" onChange={e => handleFolderImport(e, { pieceKey: pendingPieceRef.current?.key, forcedCategory: pendingPieceRef.current?.category })} />
              <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolderImport} />

              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">Constituez le dossier — l'IA crée le mandat</p>
                  <p className="text-xs text-stone-500">Déposez chaque pièce (ou tout en vrac, l'IA range). Une pièce obligatoire manquante deviendra une tâche.</p>
                </div>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={!!importProgress}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-sage-light text-sage-darker rounded-lg text-xs hover:bg-sage-50 disabled:opacity-50 font-medium flex-shrink-0"
                >
                  {importProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  Tout déposer en vrac
                </button>
              </div>

              {/* Sprint 4 — import par lien Dropbox public */}
              <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50/60 border border-amber-200 rounded-lg flex-wrap">
                <span className="text-xs text-amber-800 font-medium flex items-center gap-1 flex-shrink-0">📁 Dropbox</span>
                <input
                  type="url"
                  value={dropboxUrl}
                  onChange={e => setDropboxUrl(e.target.value)}
                  placeholder="Coller le lien public du dossier Dropbox…"
                  className="flex-1 min-w-[160px] px-2 py-1.5 border border-amber-200 rounded text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleDropboxImport}
                  disabled={!!importProgress || !dropboxUrl.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex-shrink-0"
                >
                  Importer
                </button>
              </div>

              <div className="space-y-2">
                {PIECES_DOSSIER.map(p => {
                  const present = piecesPresent.has(p.key);
                  return (
                    <div key={p.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${present ? 'border-emerald-200 bg-emerald-50/50' : (p.obligatoire ? 'border-stone-200 bg-white' : 'border-dashed border-stone-300 bg-white')}`}>
                      <span className="text-lg flex-shrink-0">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-stone-800">{p.label}</span>
                        {p.obligatoire
                          ? <span className="text-[10px] text-red-500 ml-1">· obligatoire</span>
                          : <span className="text-[10px] text-stone-400 ml-1">· recommandé</span>}
                      </div>
                      {present ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 flex-shrink-0"><Check className="w-3.5 h-3.5" /> déposé</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { pendingPieceRef.current = p; pieceInputRef.current?.click(); }}
                          disabled={!!importProgress}
                          className="px-3 py-1 text-xs text-sage-darker border border-sage-light rounded-lg hover:bg-sage-50 disabled:opacity-50 flex-shrink-0"
                        >
                          Déposer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {importProgress && (
                <div className="mt-3 text-xs text-stone-600">
                  {importProgress.current}/{importProgress.total} — {importProgress.fileName}
                </div>
              )}

              {(() => {
                const oblig = PIECES_DOSSIER.filter(p => p.obligatoire);
                const okCount = oblig.filter(p => piecesPresent.has(p.key)).length;
                return (
                  <div className="mt-2 text-[11px] text-stone-500">
                    {okCount}/{oblig.length} pièces obligatoires déposées · les manquantes deviendront des tâches à l'enregistrement.
                  </div>
                );
              })()}
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
                <Field label="Code postal"><input type="text" value={data.code_postal || ''} onChange={e => update('code_postal', e.target.value)} className={fieldClass('code_postal')} /></Field>
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
                  familleValue={data.type || ''}
                  sousTypeValue={data.sousType || ''}
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
              {(() => {
                const auto = computeRendementsAuto(data);
                const placeholderActuel = auto.actuel != null ? `${auto.actuel} (calculé)` : 'À ce jour';
                const placeholderOpt = auto.optimise != null ? `${auto.optimise} (calculé)` : 'Potentiel';
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Rendement présent (%)">
                      <input
                        type="number" step="0.01"
                        value={data.rendement || ''}
                        onChange={e => update('rendement', e.target.value === '' ? null : +e.target.value)}
                        placeholder={placeholderActuel}
                        className={fieldClass('rendement')}
                      />
                      <span className="block text-[10px] text-stone-400 mt-1">
                        {auto.actuel != null ? `Auto : ${auto.actuel}% — saisir une valeur pour forcer` : 'À ce jour, locataires en place'}
                      </span>
                    </Field>
                    <Field label="Rendement optimisé (%)">
                      <input
                        type="number" step="0.01"
                        value={data.rendementOptimise || ''}
                        onChange={e => update('rendementOptimise', e.target.value === '' ? null : +e.target.value)}
                        placeholder={placeholderOpt}
                        className={fieldClass('rendementOptimise')}
                      />
                      <span className="block text-[10px] text-stone-400 mt-1">
                        {auto.optimise != null ? `Auto : ${auto.optimise}% — saisir une valeur pour forcer` : 'Potentiel après travaux ou relocation'}
                      </span>
                    </Field>
                  </div>
                );
              })()}
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

          {/* SECTION 3 : ÉTAT LOCATIF */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>🏢 État locatif</h3>
            <p className="text-xs text-stone-500 mb-3">
              Détaille chaque lot du bien. Les rendements seront recalculés automatiquement à partir des loyers (override possible dans la section Finances).
            </p>
            <EtatLocatifEditor
              lots={data.etatLocatif || []}
              onChange={(newLots) => update('etatLocatif', newLots)}
              prixNet={parseFloat(data.prixNetVendeur || data.prix || 0)}
              mandatId={data.id || null}
            />
          </div>

          {/* SECTION 4 : CARACTÉRISTIQUES TECHNIQUES */}
          <div className={sectionClass}>
            <h3 className={sectionTitleClass}>🔧 Caractéristiques techniques</h3>
            <div className="space-y-3">
              {/* Champs B2C uniquement : pièces, chambres, étage */}
                {data.marche === 'b2c' && (
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Pièces"><input type="number" value={data.nbPieces || 0} onChange={e => update('nbPieces', +e.target.value)} className={fieldClass('nbPieces')} /></Field>
                    <Field label="Chambres"><input type="number" value={data.nbChambres || 0} onChange={e => update('nbChambres', +e.target.value)} className={fieldClass('nbChambres')} /></Field>
                    <Field label="Étage"><input type="number" value={data.etage || 0} onChange={e => update('etage', +e.target.value)} className={fieldClass('etage')} /></Field>
                  </div>
                )}
                {/* Champs B2B uniquement : nombre de lots */}
                {data.marche === 'b2b' && (
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Nombre de lots total">
                      <input type="number" value={data.nbLots || 0} onChange={e => update('nbLots', +e.target.value)} className={fieldClass('nbLots')} placeholder="ex: 12" />
                    </Field>
                    <div className="col-span-2 flex items-end">
                      <p className="text-[11px] text-stone-500 italic pb-2">💡 Détaille chaque lot dans la section "État locatif" ci-dessus.</p>
                    </div>
                  </div>
                )}
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

        <div className="flex gap-2 items-center p-6 border-t border-stone-200 bg-stone-50 sticky bottom-0">
          {/* Actions destructives à gauche (uniquement en édition) */}
          {mandat?.id && (
            <div className="flex gap-2 mr-auto">
              <button
                onClick={handleDeleteMandat}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer
              </button>
              <button
                onClick={() => setShowMergeModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-lg"
              >
                <FolderOpen className="w-4 h-4" />
                Fusionner
              </button>
            </div>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-200 rounded-lg">Annuler</button>
          <button onClick={async () => { if (!mandat && data.id) await createMissingPieceTasks(data.id); onSave(data, []); }} className="px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink">Enregistrer</button>
        </div>

        {/* Modale de fusion */}
        {showMergeModal && (
          <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-[70] p-4" onClick={() => setShowMergeModal(false)}>
            <div className="bg-white rounded-xl shadow-luxe-hover max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Fusionner ce mandat</h3>
              <p className="text-sm text-stone-600 mb-4">
                Tout le contenu de <strong>{mandat?.nom}</strong> (documents, interactions, contacts, tâches) sera transféré vers le mandat cible, puis ce mandat sera supprimé.
              </p>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Mandat cible (à conserver)</label>
              <select
                value={mergeTargetId}
                onChange={e => setMergeTargetId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white mb-4"
              >
                <option value="">— Choisir un mandat —</option>
                {mandats.filter(m => m.id !== mandat?.id).map(m => (
                  <option key={m.id} value={m.id}>{m.nom}{m.adresse ? ' — ' + m.adresse : ''}</option>
                ))}
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Annuler</button>
                <button
                  onClick={handleMergeMandat}
                  disabled={merging || !mergeTargetId}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                  Fusionner
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EtatLocatifEditor — Tableau de saisie des lots (version enrichie)
// Tableau large avec scroll horizontal
// Champs : Lot, Type, Surface, Locataire, Loyer mois/an, Loyer optimisé mois (= potentiel),
//          Charges récup mois, Charges non récup an, Début bail, Durée, Échéance (auto), Statut
// ═══════════════════════════════════════════════════════════════════
function EtatLocatifEditor({ lots = [], onChange, prixNet = 0, mandatId = null }) {
  const safeLots = Array.isArray(lots) ? lots : [];

  // Sprint 4 — Étape B : importer les lots depuis un document (PDF/scan d'état locatif)
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  function mapAiLot(l, idx) {
    const debut = l.bail_debut || '';
    const duree = parseInt(l.bail_duree) || 0;
    let echeance = '';
    if (debut && duree > 0) {
      try {
        const d = new Date(debut);
        d.setFullYear(d.getFullYear() + duree);
        echeance = d.toISOString().split('T')[0];
      } catch { echeance = ''; }
    }
    return {
      numero: l.numero != null && l.numero !== '' ? String(l.numero) : String(idx + 1),
      type: l.type || '',
      surface: parseFloat(l.surface) || 0,
      locataire: l.locataire || '',
      loyer: parseFloat(l.loyer) || 0,
      charges_recup: 0,
      charges_non_recup: 0,
      bail_debut: debut,
      bail_duree: duree || 9,
      bail_echeance: echeance,
      loyer_potentiel: 0,
      statut: l.statut === 'libre' ? 'libre' : (l.statut === 'vacant' ? 'vacant' : 'loué'),
    };
  }

  async function handleImportDoc(file) {
    if (!file || !mandatId) return;
    setImporting(true);
    setImportMsg(null);
    let storagePath = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée — reconnecte-toi.');
      const cleanName = (file.name || 'etat-locatif').replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = mandatId + '/etat-locatif-temp/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + cleanName;
      const { error: upErr } = await supabase.storage.from('mandat-docs').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (upErr) throw new Error('Envoi du fichier échoué : ' + upErr.message);

      const res = await fetch('/api/mandats/' + mandatId + '/extract-etat-locatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, storage_path: storagePath }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Lecture du document échouée');

      const newLots = (data.lots || []).map(mapAiLot);
      if (newLots.length === 0) {
        setImportMsg({ type: 'warn', text: "Aucun lot détecté. Vérifie que c'est bien un état locatif, ou saisis les lots à la main." });
      } else {
        onChange([...safeLots, ...newLots]);
        const n = newLots.length;
        setImportMsg({ type: 'ok', text: `${n} lot${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}. Vérifie les valeurs, puis ajoute le loyer optimisé.` });
      }
    } catch (e) {
      setImportMsg({ type: 'err', text: e.message || 'Erreur' });
    } finally {
      if (storagePath) { try { await supabase.storage.from('mandat-docs').remove([storagePath]); } catch { /* nettoyage best-effort */ } }
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function addLot() {
    onChange([...safeLots, {
      numero: safeLots.length + 1,
      type: '',
      surface: 0,
      locataire: '',
      loyer: 0,
      charges_recup: 0,
      charges_non_recup: 0,
      bail_debut: '',
      bail_duree: 9,
      bail_echeance: '',
      loyer_potentiel: 0,
      statut: 'loué'
    }]);
  }

  function removeLot(index) {
    onChange(safeLots.filter((_, i) => i !== index));
  }

  function updateLot(index, field, value) {
    const updated = [...safeLots];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  // Totaux
  const sumSurface = safeLots.reduce((s, l) => s + (parseFloat(l.surface) || 0), 0);
  const sumLoyer = safeLots.reduce((s, l) => s + (parseFloat(l.loyer) || 0), 0);
  const sumChargesRecup = safeLots.reduce((s, l) => s + (parseFloat(l.charges_recup) || 0), 0);
  const sumChargesNonRecup = safeLots.reduce((s, l) => s + (parseFloat(l.charges_non_recup) || 0), 0);
  const sumLoyerPotentiel = safeLots.reduce((s, l) => {
    const pot = parseFloat(l.loyer_potentiel) || 0;
    return s + (pot > 0 ? pot : (parseFloat(l.loyer) || 0));
  }, 0);
  const nbLoues = safeLots.filter(l => l.statut === 'loué' || l.statut === 'loue').length;
  const nbLibres = safeLots.length - nbLoues;

  // Rendements en % à 2 décimales (ex: 5.85%)
  const rdtCalcule = prixNet > 0 && sumLoyer > 0
    ? Math.round((sumLoyer * 12 / prixNet) * 10000) / 100
    : null;
  const rdtPotentiel = prixNet > 0 && sumLoyerPotentiel > 0
    ? Math.round((sumLoyerPotentiel * 12 / prixNet) * 10000) / 100
    : null;

  return (
    <div className="space-y-3">
      {/* Sprint 4 — Étape B : import des lots depuis un document */}
      {mandatId && (
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => handleImportDoc(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sage-50 text-sage-darker border border-sage-light rounded-lg hover:bg-sage-100 disabled:opacity-50"
            title="L'IA lit un document d'état locatif (PDF ou scan) et pré-remplit les lots"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
            {importing ? 'Lecture du document…' : '📄 Importer depuis un document'}
          </button>
          {importMsg && (
            <span className={`text-xs ${importMsg.type === 'ok' ? 'text-emerald-700' : importMsg.type === 'warn' ? 'text-amber-700' : 'text-red-600'}`}>{importMsg.text}</span>
          )}
        </div>
      )}
      {safeLots.length === 0 ? (
        <div className="text-center py-6 bg-white border border-dashed border-stone-300 rounded-lg">
          <div className="text-sm text-stone-500 mb-2">Aucun lot pour ce mandat</div>
          <button type="button" onClick={addLot} className="text-xs text-sage-dark hover:underline flex items-center gap-1 mx-auto">
            <Plus className="w-3 h-3" /> Ajouter un premier lot
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white border border-stone-200 rounded-lg" style={{ maxWidth: '100%' }}>
            <table className="text-sm" style={{ minWidth: '1600px' }}>
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Lot</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Type / Description</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Surf. m²</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Locataire</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Loyer €/mois</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Loyer €/an</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-amber-700 uppercase whitespace-nowrap bg-amber-50/50" title="Loyer optimisé : potentiel après revalorisation ou relocation. Sert au calcul du rendement optimisé.">Loyer optimisé €/mois</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap" title="Charges récupérables (refacturées au locataire)">Ch. récup. €/mois</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap" title="Charges non récupérables (à la charge du propriétaire)">Ch. non récup. €/an</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Début bail</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Durée (ans)</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap" title="Calculée automatiquement depuis début + durée. Modifiable.">Échéance</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Statut</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {safeLots.map((lot, i) => (
                  <LotRow key={i} lot={lot} index={i} onUpdate={updateLot} onRemove={removeLot} />
                ))}
              </tbody>
              <tfoot className="bg-stone-50 border-t border-stone-200">
                <tr>
                  <td colSpan={2} className="px-2 py-2 text-xs font-semibold text-stone-700 whitespace-nowrap">
                    TOTAL · {safeLots.length} lot{safeLots.length > 1 ? 's' : ''}
                    {nbLoues > 0 && <span className="ml-1 text-emerald-600">({nbLoues} loué{nbLoues > 1 ? 's' : ''})</span>}
                    {nbLibres > 0 && <span className="ml-1 text-amber-600">({nbLibres} libre{nbLibres > 1 ? 's' : ''})</span>}
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-right whitespace-nowrap">{sumSurface > 0 ? `${sumSurface} m²` : '—'}</td>
                  <td></td>
                  <td className="px-2 py-2 text-xs font-semibold text-right whitespace-nowrap">{sumLoyer > 0 ? `${sumLoyer.toLocaleString('fr-FR')} €` : '—'}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-right whitespace-nowrap">{sumLoyer > 0 ? `${(sumLoyer * 12).toLocaleString('fr-FR')} €` : '—'}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-right text-amber-700 whitespace-nowrap bg-amber-50/50">{sumLoyerPotentiel > 0 ? `${sumLoyerPotentiel.toLocaleString('fr-FR')} €` : '—'}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-right whitespace-nowrap">{sumChargesRecup > 0 ? `${sumChargesRecup.toLocaleString('fr-FR')} €` : '—'}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-right whitespace-nowrap">{sumChargesNonRecup > 0 ? `${sumChargesNonRecup.toLocaleString('fr-FR')} €` : '—'}</td>
                  <td colSpan={3}></td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <button type="button" onClick={addLot} className="text-xs text-sage-dark hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Ajouter un lot
            </button>
            <div className="flex gap-4 text-xs">
              {rdtCalcule != null && (
                <span className="text-stone-600">
                  Rdt actuel : <span className="font-semibold text-emerald-700">{rdtCalcule}%</span>
                </span>
              )}
              {rdtPotentiel != null && rdtPotentiel !== rdtCalcule && (
                <span className="text-stone-600">
                  Rdt potentiel : <span className="font-semibold text-amber-700">{rdtPotentiel}%</span>
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-stone-400 italic">
            💡 Astuce : tu peux saisir le loyer au mois OU à l'année — l'autre se calcule automatiquement. L'échéance se calcule depuis le début de bail + durée.
          </p>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LotRow — saisie d'un lot (avec bidirectionnel mois/an, et échéance auto)
// ═══════════════════════════════════════════════════════════════════
function LotRow({ lot, index, onUpdate, onRemove }) {
  // States locaux pour saisie libre des montants
  const [loyerMois, setLoyerMois] = useState(lot.loyer ? String(lot.loyer) : '');
  const [loyerAn, setLoyerAn] = useState(lot.loyer ? String(lot.loyer * 12) : '');
  const [potMois, setPotMois] = useState(lot.loyer_potentiel ? String(lot.loyer_potentiel) : '');

  // Sync depuis l'extérieur (ex: IA, ou nouvelle ligne)
  useEffect(() => {
    setLoyerMois(lot.loyer ? String(lot.loyer) : '');
    setLoyerAn(lot.loyer ? String(lot.loyer * 12) : '');
  }, [lot.loyer]);

  useEffect(() => {
    setPotMois(lot.loyer_potentiel ? String(lot.loyer_potentiel) : '');
  }, [lot.loyer_potentiel]);

  function commitLoyerMois() {
    const mensuel = parseFloat(loyerMois) || 0;
    setLoyerAn(mensuel > 0 ? String(mensuel * 12) : '');
    onUpdate(index, 'loyer', mensuel);
  }
  function commitLoyerAn() {
    const annuel = parseFloat(loyerAn) || 0;
    const mensuel = annuel > 0 ? annuel / 12 : 0;
    setLoyerMois(mensuel > 0 ? String(mensuel) : '');
    onUpdate(index, 'loyer', mensuel);
  }
  function commitPotMois() {
    const mensuel = parseFloat(potMois) || 0;
    onUpdate(index, 'loyer_potentiel', mensuel);
  }

  // Calcul auto de l'échéance depuis début + durée
  function handleBailDebutChange(value) {
    onUpdate(index, 'bail_debut', value);
    if (value && lot.bail_duree) {
      const start = new Date(value);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + parseInt(lot.bail_duree));
      const iso = end.toISOString().split('T')[0];
      onUpdate(index, 'bail_echeance', iso);
    }
  }
  function handleBailDureeChange(value) {
    const duree = parseInt(value) || 0;
    onUpdate(index, 'bail_duree', duree);
    if (lot.bail_debut && duree > 0) {
      const start = new Date(lot.bail_debut);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + duree);
      const iso = end.toISOString().split('T')[0];
      onUpdate(index, 'bail_echeance', iso);
    }
  }

  return (
    <tr className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
      <td className="px-2 py-1.5">
        <input type="text" value={lot.numero || (index + 1)} onChange={e => onUpdate(index, 'numero', e.target.value)} className="w-12 px-1.5 py-1 border border-stone-200 rounded text-xs" />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" value={lot.type || ''} onChange={e => onUpdate(index, 'type', e.target.value)} placeholder="ex: RDC commerce" className="w-32 px-1.5 py-1 border border-stone-200 rounded text-xs" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="any" value={lot.surface || ''} onChange={e => onUpdate(index, 'surface', parseFloat(e.target.value) || 0)} className="w-16 px-1.5 py-1 border border-stone-200 rounded text-xs text-right" />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" value={lot.locataire || ''} onChange={e => onUpdate(index, 'locataire', e.target.value)} placeholder="Nom du locataire" className="w-32 px-1.5 py-1 border border-stone-200 rounded text-xs" />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          step="any"
          value={loyerMois}
          onChange={e => setLoyerMois(e.target.value)}
          onBlur={commitLoyerMois}
          className="w-24 px-1.5 py-1 border border-stone-200 rounded text-xs text-right"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          step="any"
          value={loyerAn}
          onChange={e => setLoyerAn(e.target.value)}
          onBlur={commitLoyerAn}
          className="w-28 px-1.5 py-1 border border-stone-200 rounded text-xs text-right bg-stone-50"
        />
      </td>
      <td className="px-2 py-1.5 bg-amber-50/40">
        <input
          type="number"
          step="any"
          value={potMois}
          onChange={e => setPotMois(e.target.value)}
          onBlur={commitPotMois}
          placeholder={loyerMois || '0'}
          className="w-24 px-1.5 py-1 border border-amber-200 rounded text-xs text-right bg-white"
          title="Loyer optimisé visé (après travaux ou relocation). Laisser vide = on reprend le loyer actuel."
        />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="any" value={lot.charges_recup || ''} onChange={e => onUpdate(index, 'charges_recup', parseFloat(e.target.value) || 0)} className="w-24 px-1.5 py-1 border border-stone-200 rounded text-xs text-right" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="any" value={lot.charges_non_recup || ''} onChange={e => onUpdate(index, 'charges_non_recup', parseFloat(e.target.value) || 0)} className="w-24 px-1.5 py-1 border border-stone-200 rounded text-xs text-right" />
      </td>
      <td className="px-2 py-1.5">
        <input type="date" value={lot.bail_debut || ''} onChange={e => handleBailDebutChange(e.target.value)} className="px-1.5 py-1 border border-stone-200 rounded text-xs" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" min="0" value={lot.bail_duree || ''} onChange={e => handleBailDureeChange(e.target.value)} placeholder="9" className="w-14 px-1.5 py-1 border border-stone-200 rounded text-xs text-right" />
      </td>
      <td className="px-2 py-1.5">
        <input type="date" value={lot.bail_echeance || ''} onChange={e => onUpdate(index, 'bail_echeance', e.target.value)} className="px-1.5 py-1 border border-stone-200 rounded text-xs bg-stone-50" title="Calculée automatiquement, modifiable" />
      </td>
      <td className="px-2 py-1.5 text-center">
        <select value={lot.statut || 'loué'} onChange={e => onUpdate(index, 'statut', e.target.value)} className="px-1.5 py-1 border border-stone-200 rounded text-xs">
          <option value="loué">Loué</option>
          <option value="libre">Libre</option>
          <option value="vacant">Vacant</option>
        </select>
      </td>
      <td className="px-1 py-1.5">
        <button type="button" onClick={() => onRemove(index)} className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded">
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
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

// ═══════════════════════════════════════════════════════════════════
// MandatContactsSection — Contacts du mandat (5 rôles)
// ═══════════════════════════════════════════════════════════════════

const MANDAT_CONTACT_ROLES = [
  { key: 'mandant', label: 'Mandant', description: 'Propriétaire du bien', categorie: null },
  { key: 'apporteur_mandat', label: 'Apporteur du mandat', description: 'Qui nous a apporté le bien', categorie: null },
  { key: 'apporteur_acquereur', label: 'Apporteur d\'acquéreur', description: 'Qui nous apporte des acheteurs', categorie: null },
  { key: 'notaire_vendeur', label: 'Notaire vendeur', description: 'Côté vendeur', categorie: 'notaire' },
  { key: 'notaire_acquereur', label: 'Notaire acquéreur', description: 'Côté acquéreur', categorie: 'notaire' },
];

function MandatContactsSection({ mandatContacts, onAdd, onRemove }) {
  return (
    <div id="mandant" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
      <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <UserIcon className="w-5 h-5 text-sage-dark" />
        Contacts du mandat
      </h2>
      <div className="space-y-4">
        {MANDAT_CONTACT_ROLES.map(role => {
          const link = mandatContacts.find(mc => mc.role === role.key);
          const contact = link?.contact;
          return (
            <div key={role.key} className="border-b border-cream-dark last:border-0 pb-4 last:pb-0">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-stone-900">{role.label}</div>
                  <div className="text-xs text-stone-500">{role.description}</div>
                </div>
              </div>
              {contact ? (
                <div className="flex items-start gap-3 bg-cream-50 px-3 py-2 rounded-lg">
                  <UserIcon className="w-4 h-4 text-sage-dark flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">
                      {[contact.prenom, contact.nom].filter(Boolean).join(' ') || contact.societe || '(sans nom)'}
                      {contact.societe && [contact.prenom, contact.nom].filter(Boolean).length > 0 && (
                        <span className="text-stone-500 font-normal"> · {contact.societe}</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2 flex-wrap mt-0.5">
                      {contact.email && <span>{contact.email}</span>}
                      {contact.email && contact.tel && <span>·</span>}
                      {contact.tel && <span>{contact.tel}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(link.id)}
                    className="p-1 text-stone-400 hover:text-red-600 flex-shrink-0"
                    title="Retirer ce contact"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <ContactSelector
                  value={null}
                  onChange={(contactId) => onAdd(role.key, contactId)}
                  categorie={role.categorie}
                  placeholder={`Ajouter ${role.label.toLowerCase()}...`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function MandatDetail({ mandat, onBack, onEdit, deals, clients, reload, todos, annonces, allProfiles = [], onOpenMatching, onOpenEmailDrafts }) {
  const [openModal, setOpenModal] = useState(null); // 'photos' | 'visite' | 'mandant' | null
  const [aiAnalyzeOpen, setAiAnalyzeOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showAvisValeur, setShowAvisValeur] = useState(false);
  const [showRapportMandant, setShowRapportMandant] = useState(false);
  const [mandatContacts, setMandatContacts] = useState([]);
  // Sprint 4 — bouton pour masquer/afficher les honoraires (commission + net vendeur)
  const [showHonoraires, setShowHonoraires] = useState(true);

  // Charge les contacts liés au mandat (pivot mandat_contacts)
  async function reloadMandatContacts() {
    if (!mandat?.id) return;
    const { data, error } = await supabase
      .from('mandat_contacts')
      .select('id, role, est_principal, notes, contact:contacts(id, prenom, nom, societe, email, tel, categorie)')
      .eq('mandat_id', mandat.id);
    if (error) {
      console.error('[MandatDetail] load mandat_contacts', error);
      return;
    }
    setMandatContacts(data || []);
  }
  useEffect(() => {
    reloadMandatContacts();
  }, [mandat?.id]);

  // Helpers pour ajouter / supprimer un contact lié
  async function addMandatContact(role, contactId) {
    if (!contactId) return;
    const { error } = await supabase.from('mandat_contacts').insert({
      mandat_id: mandat.id,
      contact_id: contactId,
      role,
    });
    if (error) {
      alert('Erreur ajout contact : ' + error.message);
      return;
    }
    // Recharge
    const { data } = await supabase
      .from('mandat_contacts')
      .select('id, role, est_principal, notes, contact:contacts(id, prenom, nom, societe, email, tel, categorie)')
      .eq('mandat_id', mandat.id);
    setMandatContacts(data || []);
  }

  async function removeMandatContact(linkId) {
    if (!confirm('Retirer ce contact du mandat ?')) return;
    const { error } = await supabase.from('mandat_contacts').delete().eq('id', linkId);
    if (error) {
      alert('Erreur suppression contact : ' + error.message);
      return;
    }
    setMandatContacts(prev => prev.filter(mc => mc.id !== linkId));
  }
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

  // Sprint 4 — les helpers prix (lib/priceDisplay) lisent du snake_case ;
  // le mandat est en camelCase → on normalise pour que net vendeur / commission
  // soient corrects (sinon ils retombaient toujours sur l'estimation 5%).
  const mandatPrix = {
    prix: mandat.prix,
    prix_net_vendeur: mandat.prixNetVendeur ?? mandat.prix_net_vendeur,
    honoraires_montant: mandat.honorairesMontant ?? mandat.honoraires_montant,
  };

  return (
    <div className="p-8 max-w-7xl">

      {/* ═══ EN-TÊTE ═══ */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl font-semibold text-stone-900 mb-1">{mandat.nom}</h1>
          <p className="text-stone-500 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4" />{mandat.adresse}
          </p>
          {/* Type de mandat + responsable commercial (remontés dans l'en-tête — Sprint 4 A3) */}
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${commColor}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} title={isPublished ? 'Publié' : 'Non publié'} />
              <span>{mandat.commercialisation}</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Resp.</span>
            <OwnerSelector mandat={mandat} reload={reload} />
          </div>
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
            <button onClick={() => setLightboxOpen(true)} className="flex-shrink-0 w-64 h-44 rounded-lg overflow-hidden bg-cream-100 border border-cream-dark hover:opacity-90 relative group">
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

      {/* ═══ STICKY BAR 1 : NAVIGATION DES DONNÉES ═══ */}
      <div className="sticky top-0 z-30 bg-cream-50/95 backdrop-blur-sm border-b border-cream-dark -mx-8 px-8 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-sage-dark font-semibold pr-2 border-r border-cream-dark mr-1">📌 Données</span>
          
          <button onClick={() => document.getElementById('technique')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">🔧 Technique</button>
          <button onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">📊 Stats</button>
          <button onClick={() => document.getElementById('locatif')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">🏢 Locatif</button>
          <button onClick={() => document.getElementById('mandant')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">👤 Mandant</button>
          <button onClick={() => document.getElementById('diffusion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">📡 Diffusion</button>
          <button onClick={() => document.getElementById('assets')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">🗺️ Vues</button>
          <button onClick={() => setOpenModal('visite')} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors flex items-center gap-1">
            👁️ Visite
            {(mandat.visiteInfo || mandat.visite_info) && Object.values(mandat.visiteInfo || mandat.visite_info).some(v => v) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
          </button>
          <button onClick={() => document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">📷 Médias</button>
          <button onClick={() => document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-3 py-1.5 rounded-md text-xs font-medium text-stone-600 hover:bg-cream-100 hover:text-ink transition-colors">📂 Documents</button>
        </div>
      </div>

      {/* ═══ STICKY BAR 2 : DOCUMENTS À GÉNÉRER ═══ */}
      <div className="sticky top-[42px] z-20 bg-cream-50/95 backdrop-blur-sm border-b border-cream-dark -mx-8 px-8 py-2.5 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-sage-dark font-semibold pr-2 border-r border-cream-dark mr-1">📤 Générer</span>
          <PdfExportButtons mandatId={mandat.id} mandatNom={mandat.nom} isOffMarket={mandat.isOffMarket} plaquetteCachedAt={mandat.plaquetteCachedAt} />
          <button onClick={() => setShowAvisValeur(true)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-sage-darker border border-sage-light hover:bg-sage-dark hover:text-white transition-colors flex items-center gap-1.5" title="Avis de valeur PPTX">
            📊 Avis de valeur
          </button>
          <button onClick={() => setShowRapportMandant(true)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-sage-darker border border-sage-light hover:bg-sage-dark hover:text-white transition-colors flex items-center gap-1.5" title="Rapport d'activité mandant">
            📈 Rapport mandant
          </button>
          <button onClick={() => onOpenEmailDrafts?.(mandat.id)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-sage-darker border border-sage-light hover:bg-sage-dark hover:text-white transition-colors flex items-center gap-1.5" title="Préparer mails personnalisés aux acquéreurs">
            📧 Préparer mails clients
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="col-span-3 space-y-4">
          {/* ═══ ANALYSE FINANCIÈRE — REMONTÉE EN PREMIÈRE POSITION ═══ */}
          <div id="finance" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">Analyse financière</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs uppercase tracking-wide text-stone-500">Prix frais d'agence inclus</span>
                  <button
                    type="button"
                    onClick={() => setShowHonoraires(v => !v)}
                    className="text-stone-400 hover:text-stone-700"
                    title={showHonoraires ? 'Masquer les honoraires' : 'Afficher les honoraires'}
                  >
                    {showHonoraires ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-2xl font-display font-semibold text-stone-900">{formatPrix(getPriceTTC(mandatPrix))}</div>
                {showHonoraires && (
                  <div className="text-[11px] text-stone-500 mt-1 leading-tight">
                    Net vendeur : <span className="font-medium">{formatPrix(getPriceNV(mandatPrix))}</span>
                    {isNVEstimated(mandatPrix) && <span className="text-amber-600 ml-1" title="Honoraires non renseignés, estimation à 5%">~ estimé</span>}
                    <br />
                    Commission : <span className="font-medium text-emerald-700">{formatPrix(getCommission(mandatPrix))}</span>
                    {isCommissionEstimated(mandatPrix) && <span className="text-amber-600 ml-1" title="Commission estimée à 5% du TTC">~ estimée</span>}
                  </div>
                )}
              </div>
              <DetailItem label="Prix au m²" value={mandat.prixM2 ? `${parseFloat(mandat.prixM2).toLocaleString('fr')}€` : '—'} />
              <DetailItem label="Loyers annuels" value={(() => {
                const lots = mandat.etat_locatif || mandat.etatLocatif || [];
                const loyerMensuelLots = totalLoyerMensuel(lots);
                const annuel = parseFloat(mandat.loyersAnnuels) > 0
                  ? parseFloat(mandat.loyersAnnuels)
                  : (loyerMensuelLots > 0 ? loyerMensuelLots * 12 : 0);
                return annuel > 0 ? `${annuel.toLocaleString('fr')}€` : '—';
              })()} />
              <DetailItem label="Rendement" value={(() => {
                const _rdt = computeRendements(mandat);
                const rPresent = _rdt.actuel != null && !isNaN(_rdt.actuel) && _rdt.actuel > 0 ? _rdt.actuel : null;
                const rOpt = _rdt.optimise != null && !isNaN(_rdt.optimise) && _rdt.optimise > 0 ? _rdt.optimise : null;
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

          {/* ═══ TÂCHES LIÉES AU MANDAT ═══ */}
          <div id="tasks" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
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
                defaultAssignee={null}
                onAdd={reload}
              />
            </div>
          </div>

          {/* ═══ BLOC IDENTITÉ DU BIEN ═══ */}
            <div id="identite" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <Home className="w-5 h-5 text-sage-dark" />Identité du bien
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <DetailItem label="Adresse" value={mandat.adresse || '—'} />
                  <DetailItem label="Ville" value={mandat.ville || '—'} />
                  <DetailItem label="Marché" value={mandat.marche === 'b2c' ? 'Habitation (B2C)' : 'Investissement (B2B)'} />
                  <DetailItem label="Type" value={mandat.sousType ? `${mandat.type} · ${mandat.sousType}` : (mandat.type || '—')} />
                </div>
                <div className="space-y-2">
                  <DetailItem label="N° mandat" value={mandat.mandatNumero || '—'} />
                  <DetailItem label="Type de mandat" value={mandat.mandatType || '—'} />
                  <DetailItem label="Échéance" value={mandat.mandatDateEcheance ? new Date(mandat.mandatDateEcheance).toLocaleDateString('fr-FR') : '—'} />
                  <DetailItem label="Statut" value={mandat.statut || '—'} />
                </div>
              </div>
            </div>
          {/* ═══ BLOC DIFFUSION ═══ */}
          <DiffusionInline mandat={mandat} reload={reload} />
          {/* ═══ BLOC STATS D'ACTIVITÉ ═══ */}
          <MandatStatsInline mandat={mandat} deals={deals} clients={clients} />
          {/* ═══ BLOC ASSETS EXTERNES ═══ */}
          <AssetsMandatInline mandat={mandat} reload={reload} />
          {/* ═══ BLOC TECHNIQUE ═══ */}
            <div id="technique" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
                🔧 Caractéristiques techniques
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <DetailItem label="Surface totale" value={mandat.surface ? `${mandat.surface} m²` : '—'} />
                <DetailItem label="Nombre de lots" value={mandat.nbLots || '—'} />
                <DetailItem label="Année construction" value={mandat.anneeConstruction || '—'} />
                <DetailItem label="DPE consommation" value={mandat.dpeConsommation ? `${mandat.dpeConsommation} kWh/m²` : '—'} />
                <DetailItem label="DPE émissions" value={mandat.dpeEmissions ? `${mandat.dpeEmissions} kgCO₂/m²` : '—'} />
                <DetailItem label="Date DPE" value={mandat.dpeDate ? new Date(mandat.dpeDate).toLocaleDateString('fr-FR') : '—'} />
                <DetailItem label="Charges annuelles" value={mandat.chargesAnnuelles ? `${parseFloat(mandat.chargesAnnuelles).toLocaleString('fr')} €` : '—'} />
                <DetailItem label="Taxe foncière" value={mandat.taxeFonciere ? `${parseFloat(mandat.taxeFonciere).toLocaleString('fr')} €` : '—'} />
                <DetailItem label="Pièces / Chambres" value={mandat.marche === 'b2c' ? `${mandat.nbPieces || '—'} / ${mandat.nbChambres || '—'}` : '—'} />
              </div>
            </div>

            {/* ═══ CONTACTS DU MANDAT ═══ */}
            <MandatContactsSection
              mandatContacts={mandatContacts}
              onAdd={addMandatContact}
              onRemove={removeMandatContact}
            />

            {/* ═══ DESCRIPTION ═══ */}
            {mandat.description && (
            <div className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-3">Description</h2>
              <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{mandat.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BLOC PHOTOS & MÉDIAS ═══ */}
            <div id="photos" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-sage-dark" />Photos & Médias
              </h2>
              <MediasInline mandat={mandat} onUpdate={reload} />
            </div>    
      {/* ═══ BLOC DOCUMENTS ═══ */}
            <div id="documents" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
              <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-sage-dark" />Documents
              </h2>
              <DocumentsInline mandat={mandat} onUpdate={reload} />
            </div>
      {/* ═══ STATISTIQUES DU DOSSIER ═══ */}
          <div id="stats" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
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

            {/* Liste des clients compatibles (matching au fil de l'eau) */}
            <div className="mt-4 pt-4 border-t border-cream-dark">
              <h3 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sage-dark" /> Clients compatibles
              </h3>
              <MandatMatches mandat={mandat} clients={clients} onOpenClient={(id) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm:openClient', { detail: { clientId: id } })); }} />
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

          {/* ═══ ÉTAT LOCATIF ═══ */}
          <div id="locatif" className="bg-white rounded-xl p-6 shadow-luxe border border-cream-dark scroll-mt-32">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sage-dark" />État locatif
            </h2>
            {(() => {
              const lots = mandat.etatLocatif || mandat.etat_locatif || [];
              if (!Array.isArray(lots) || lots.length === 0) {
                return (
                  <div className="text-center py-8 text-stone-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    <p className="text-sm">Aucun lot saisi pour ce mandat</p>
                    <p className="text-xs text-stone-400 mt-1">Clique sur "Modifier" pour ajouter des lots</p>
                  </div>
                );
              }
                const sumSurface = lots.reduce((s, l) => s + (parseFloat(l.surface) || 0), 0);
                const sumLoyer = lots.reduce((s, l) => s + (parseFloat(l.loyer) || 0), 0);
                const sumChargesRecup = lots.reduce((s, l) => s + (parseFloat(l.charges_recup) || 0), 0);
                const sumChargesNonRecup = lots.reduce((s, l) => s + (parseFloat(l.charges_non_recup) || 0), 0);
                const sumPotentiel = lots.reduce((s, l) => {
                  const p = parseFloat(l.loyer_potentiel) || 0;
                  return s + (p > 0 ? p : (parseFloat(l.loyer) || 0));
                }, 0);
                const nbLoues = lots.filter(l => l.statut === 'loué' || l.statut === 'loue').length;
                const nbLibres = lots.length - nbLoues;
                const prixNet = parseFloat(mandat.prix_net_vendeur || mandat.prixNetVendeur || mandat.prix || 0);
                // Rendements en % à 2 décimales (ex: 5.85%)
                const rdtActuel = prixNet > 0 && sumLoyer > 0 ? Math.round((sumLoyer * 12 / prixNet) * 10000) / 100 : null;
                const rdtPot = prixNet > 0 && sumPotentiel > 0 ? Math.round((sumPotentiel * 12 / prixNet) * 10000) / 100 : null;

                return (
                  <>
                    {/* KPIs revenus locatifs */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-sage-50 rounded-lg p-3 border border-sage-light">
                        <div className="text-[10px] uppercase tracking-wide text-sage-darker mb-0.5">Loyer mensuel</div>
                        <div className="text-lg font-semibold text-sage-darker">{sumLoyer > 0 ? `${sumLoyer.toLocaleString('fr-FR')} €` : '—'}</div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-700 mb-0.5">Revenu annuel</div>
                        <div className="text-lg font-semibold text-emerald-700">{sumLoyer > 0 ? `${(sumLoyer * 12).toLocaleString('fr-FR')} €` : '—'}</div>
                      </div>
                      <div className="bg-cream-100 rounded-lg p-3 border border-cream-dark">
                        <div className="text-[10px] uppercase tracking-wide text-stone-600 mb-0.5">Rdt actuel</div>
                        <div className="text-lg font-semibold text-stone-900">{rdtActuel != null ? `${rdtActuel}%` : '—'}</div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                        <div className="text-[10px] uppercase tracking-wide text-amber-700 mb-0.5">Rdt potentiel</div>
                        <div className="text-lg font-semibold text-amber-700">{rdtPot != null ? `${rdtPot}%` : '—'}</div>
                      </div>
                    </div>

                    {/* Tableau des lots */}
                    <div className="overflow-x-auto bg-cream-50/50 rounded-lg border border-cream-dark">
                      <table className="text-sm" style={{ minWidth: '1100px' }}>
                        <thead className="bg-cream-100 border-b border-cream-dark">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Lot</th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Type</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Surface</th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Locataire</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Loyer/mois</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Loyer/an</th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Échéance bail</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Loyer pot.</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-stone-600 uppercase whitespace-nowrap">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lots.map((lot, i) => {
                            const loyerMois = parseFloat(lot.loyer) || 0;
                            const pot = parseFloat(lot.loyer_potentiel) || 0;
                            const isLoue = lot.statut === 'loué' || lot.statut === 'loue';
                            const echeance = lot.bail_echeance ? new Date(lot.bail_echeance).toLocaleDateString('fr-FR') : null;
                            return (
                              <tr key={i} className="border-b border-cream-dark/30 last:border-0 hover:bg-white">
                                <td className="px-3 py-2 font-medium whitespace-nowrap">{lot.numero || (i + 1)}</td>
                                <td className="px-3 py-2 text-stone-700 whitespace-nowrap">{lot.type || lot.nature || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{lot.surface ? `${lot.surface} m²` : '—'}</td>
                                <td className="px-3 py-2 text-stone-700 whitespace-nowrap">{lot.locataire || (isLoue ? '—' : <span className="text-amber-600 italic">Libre</span>)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{loyerMois > 0 ? `${loyerMois.toLocaleString('fr-FR')} €` : '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-stone-500 whitespace-nowrap">{loyerMois > 0 ? `${(loyerMois * 12).toLocaleString('fr-FR')} €` : '—'}</td>
                                <td className="px-3 py-2 text-stone-600 whitespace-nowrap text-xs">{echeance || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-700 whitespace-nowrap">{pot > 0 ? `${pot.toLocaleString('fr-FR')} €` : '—'}</td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isLoue ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {isLoue ? 'Loué' : (lot.statut === 'libre' ? 'Libre' : 'Vacant')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-cream-100 border-t-2 border-cream-dark">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-stone-700 whitespace-nowrap">
                              TOTAL · {lots.length} lot{lots.length > 1 ? 's' : ''}
                              {nbLoues > 0 && <span className="ml-2 text-emerald-600">({nbLoues} loué{nbLoues > 1 ? 's' : ''})</span>}
                              {nbLibres > 0 && <span className="ml-1 text-amber-600">({nbLibres} libre{nbLibres > 1 ? 's' : ''})</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{sumSurface > 0 ? `${sumSurface} m²` : '—'}</td>
                            <td></td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{sumLoyer > 0 ? `${sumLoyer.toLocaleString('fr-FR')} €` : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{sumLoyer > 0 ? `${(sumLoyer * 12).toLocaleString('fr-FR')} €` : '—'}</td>
                            <td></td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700 whitespace-nowrap">{sumPotentiel > 0 ? `${sumPotentiel.toLocaleString('fr-FR')} €` : '—'}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Charges */}
                    {(sumChargesRecup > 0 || sumChargesNonRecup > 0) && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {sumChargesRecup > 0 && (
                          <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 text-xs">
                            <div className="text-stone-500 uppercase text-[10px] mb-0.5">Charges récupérables totales</div>
                            <div className="font-semibold text-stone-900">{sumChargesRecup.toLocaleString('fr-FR')} €/mois <span className="text-stone-500 font-normal">({(sumChargesRecup * 12).toLocaleString('fr-FR')} €/an)</span></div>
                          </div>
                        )}
                        {sumChargesNonRecup > 0 && (
                          <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 text-xs">
                            <div className="text-stone-500 uppercase text-[10px] mb-0.5">Charges non récupérables totales</div>
                            <div className="font-semibold text-stone-900">{sumChargesNonRecup.toLocaleString('fr-FR')} €/an</div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

          
      {/* ═══ MODALS ═══ */}
      {openModal === 'visite' && (
        <VisiteModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
      {openModal === 'medias' && (
        <MediasModal mandat={mandat} onClose={() => setOpenModal(null)} onUpdate={reload} />
      )}
    {/* Quelque chose */}

      {/* (QW3) AIAssistantChat local retiré : une seule instance globale est montée dans CRM().
          Doublon = deux assistants actifs simultanément sur la fiche. */}
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
      {showAvisValeur && (
        <AvisDeValeurEditor
          mandat={mandat}
          onClose={() => setShowAvisValeur(false)}
          onSaved={(newAvis) => {
            mandat.avisValeur = newAvis;
            mandat.avis_valeur = newAvis;
            reload?.();
          }}
        />
      )}
      {showRapportMandant && (
        <RapportMandantModal mandat={mandat} onClose={() => setShowRapportMandant(false)} />
      )}
    </div>
  );
}
