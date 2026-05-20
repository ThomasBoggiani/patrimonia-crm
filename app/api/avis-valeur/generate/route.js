# 🔧 Patch AvisDeValeurEditor.jsx — Lot C : bouton "📄 Générer PPTX"

## Objectif
Ajouter dans la modal Avis de valeur un bouton qui appelle l'API `/api/avis-valeur/generate` et déclenche le téléchargement du PPTX.

⚠️ **3 modifications** dans `components/AvisDeValeurEditor.jsx`.

---

## 🔹 Modification 1 : Ajouter import et state

**Cherche au tout début du fichier** :
```jsx
import {
  X, Save, ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  TrendingUp, Sparkles, AlertTriangle, Cloud,
  Building2, BarChart3, Target, Lightbulb, Tag, MessageCircle,
  MapPin, Key, Repeat, Calculator
} from 'lucide-react';
```

**Remplace par** (ajoute `FileDown` à la liste) :
```jsx
import {
  X, Save, ChevronDown, ChevronRight, Plus, Trash2, Loader2,
  TrendingUp, Sparkles, AlertTriangle, Cloud,
  Building2, BarChart3, Target, Lightbulb, Tag, MessageCircle,
  MapPin, Key, Repeat, Calculator, FileDown
} from 'lucide-react';
```

---

## 🔹 Modification 2 : Ajouter state de génération

**Cherche** :
```jsx
  const [data, setData] = useState(ensureSchema(mandat?.avisValeur || mandat?.avis_valeur));
  const [saving, setSaving] = useState(false);
```

**Remplace par** :
```jsx
  const [data, setData] = useState(ensureSchema(mandat?.avisValeur || mandat?.avis_valeur));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
```

---

## 🔹 Modification 3 : Ajouter la fonction handleGenerate

**Cherche** la fonction `handleSave` :
```jsx
  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mandats')
        .update({ avis_valeur: data })
        .eq('id', mandat.id);
      if (error) {
        alert('Erreur sauvegarde : ' + error.message);
      } else {
        onSaved?.(data);
        onClose();
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setSaving(false);
  }
```

**Ajoute JUSTE APRÈS** cette fonction (avant la déclaration `const fieldClass`) :

```jsx
  async function handleGenerate() {
    // D'abord on sauve l'état actuel
    setGenerating(true);
    try {
      // 1. Sauver les modifications actuelles avant de générer
      const { error: saveErr } = await supabase
        .from('mandats')
        .update({ avis_valeur: data })
        .eq('id', mandat.id);
      
      if (saveErr) {
        alert('Erreur de sauvegarde avant génération : ' + saveErr.message);
        setGenerating(false);
        return;
      }

      // 2. Appeler l'API de génération
      const response = await fetch('/api/avis-valeur/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandatId: mandat.id }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        alert('Erreur génération PPTX : ' + (errData.error || response.statusText) + 
              (errData.details ? '\n' + errData.details : ''));
        setGenerating(false);
        return;
      }

      // 3. Télécharger le blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Récupérer le nom de fichier depuis l'en-tête
      const cd = response.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      link.download = match ? match[1] : `Avis_de_valeur_${mandat.id}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onSaved?.(data);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
    setGenerating(false);
  }
```

---

## 🔹 Modification 4 : Ajouter le bouton dans le footer

**Cherche** le footer de la modal :
```jsx
        {/* FOOTER */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-white">
          <div className="text-xs text-stone-500">
            Document servant à <strong>convaincre le mandant</strong> de confier son bien.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-100 rounded-lg"
            >
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
```

**Remplace par** :
```jsx
        {/* FOOTER */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-white">
          <div className="text-xs text-stone-500">
            Document servant à <strong>convaincre le mandant</strong> de confier son bien.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-stone-700 hover:bg-cream-100 rounded-lg"
            >
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || generating}
              className="flex items-center gap-2 px-4 py-2 bg-ink-deep text-white rounded-lg text-sm hover:bg-ink disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
            <button onClick={handleGenerate} disabled={saving || generating}
              className="flex items-center gap-2 px-4 py-2 bg-sage-dark text-white rounded-lg text-sm hover:bg-sage-darker disabled:opacity-50"
              title="Sauvegarde + génération du PPTX"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {generating ? 'Génération...' : '📄 Générer PPTX'}
            </button>
          </div>
        </div>
```

→ Le bouton "📄 Générer PPTX" apparaît à droite d'"Enregistrer". Il sauvegarde d'abord, puis appelle l'API.

---

## ⚠️ Attention github.dev

Ce patch ne contient pas de balises `<a` ouvrantes, donc pas de risque de suppression silencieuse.

---

## ✅ Test après déploiement

1. SQL Supabase : exécute `05_setup_bucket_templates.sql` (bucket créé)
2. Manuellement dans Supabase → Storage → templates → **Upload** le fichier `template_avis_valeur_generique.pptx` (que je te fournis)
3. Renomme-le dans le bucket en `avis_valeur_generique.pptx` (sans le préfixe `template_`)
4. Commit GitHub : `package.json` mis à jour + nouveau fichier `app/api/avis-valeur/generate/route.js` + `components/AvisDeValeurEditor.jsx` patché
5. Hard refresh sur le CRM
6. Ouvre un mandat, ouvre la modal Avis de valeur
7. Remplis quelques champs (au minimum quelques prix dans Préconisation)
8. Clic **📄 Générer PPTX**
9. Le PPTX se télécharge automatiquement
10. Ouvre le PPTX dans PowerPoint/Keynote → les placeholders sont remplacés
