export const metadata = {
  title: 'Politique de confidentialité — Immeubles & Patrimoine',
  description: 'Politique de protection des données personnelles d\'Immeubles & Patrimoine'
};

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl font-semibold text-stone-900 mb-2">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-stone-500 mb-10">
          Dernière mise à jour : 8 mai 2026
        </p>

        <div className="prose prose-stone max-w-none space-y-8">

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">1. Responsable du traitement</h2>
            <p className="text-stone-700 leading-relaxed">
              Les données collectées sur ce site sont traitées par <strong>Immeubles & Patrimoine</strong>,
              société par actions simplifiée, dont le siège social est situé à Paris.
              Pour toute question relative à vos données personnelles, vous pouvez nous contacter à
              l'adresse suivante : <a href="mailto:contact@immeubles-patrimoine.fr" className="text-emerald-700 hover:underline">contact@immeubles-patrimoine.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">2. Données collectées</h2>
            <p className="text-stone-700 leading-relaxed mb-3">
              Lorsque vous remplissez l'un de nos questionnaires en ligne, nous collectons les données
              que vous nous transmettez volontairement, notamment :
            </p>
            <ul className="list-disc pl-6 text-stone-700 space-y-1">
              <li>Vos coordonnées (nom, prénom, email, téléphone)</li>
              <li>Les informations relatives à votre projet immobilier (typologie, budget, localisation, etc.)</li>
              <li>Le cas échéant, des informations sur votre société (raison sociale, statut)</li>
              <li>Votre adresse IP et la date de soumission (à des fins de preuve du consentement)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">3. Finalités du traitement</h2>
            <p className="text-stone-700 leading-relaxed mb-3">
              Vos données sont collectées pour les finalités suivantes :
            </p>
            <ul className="list-disc pl-6 text-stone-700 space-y-1">
              <li>Vous recontacter dans le cadre de votre projet immobilier (acheter ou vendre)</li>
              <li>Vous proposer des opportunités d'investissement correspondant à vos critères</li>
              <li>Si vous y avez consenti, vous envoyer des communications commerciales par email</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">4. Base légale</h2>
            <p className="text-stone-700 leading-relaxed">
              Le traitement de vos données repose sur votre <strong>consentement explicite</strong>,
              recueilli au moment de la soumission du formulaire (article 6.1.a du RGPD).
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">5. Durée de conservation</h2>
            <p className="text-stone-700 leading-relaxed">
              Vos données sont conservées pendant <strong>3 ans</strong> à compter de votre dernier
              contact avec nous. Au-delà, elles sont automatiquement supprimées ou archivées sous forme
              anonymisée.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">6. Destinataires</h2>
            <p className="text-stone-700 leading-relaxed">
              Vos données sont accessibles uniquement aux collaborateurs habilités d'Immeubles & Patrimoine
              dans le cadre de leur mission. Elles ne sont ni vendues ni cédées à des tiers à des fins
              commerciales.
            </p>
            <p className="text-stone-700 leading-relaxed mt-3">
              Nous utilisons les sous-traitants techniques suivants, soumis à des engagements de
              confidentialité conformes au RGPD :
            </p>
            <ul className="list-disc pl-6 text-stone-700 space-y-1 mt-2">
              <li><strong>Supabase</strong> (hébergement de la base de données — Union européenne)</li>
              <li><strong>Vercel</strong> (hébergement de l'application — États-Unis, sous clauses contractuelles types)</li>
              <li><strong>Microsoft 365</strong> (envoi d'emails)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">7. Vos droits</h2>
            <p className="text-stone-700 leading-relaxed mb-3">
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez
              des droits suivants sur vos données personnelles :
            </p>
            <ul className="list-disc pl-6 text-stone-700 space-y-1">
              <li><strong>Droit d'accès</strong> : obtenir une copie des données que nous détenons sur vous</li>
              <li><strong>Droit de rectification</strong> : corriger les données inexactes</li>
              <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données</li>
              <li><strong>Droit d'opposition</strong> : vous opposer au traitement à des fins de prospection commerciale</li>
              <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
              <li><strong>Droit de retirer votre consentement</strong> à tout moment</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-3">
              Pour exercer ces droits, contactez-nous à
              <a href="mailto:contact@immeubles-patrimoine.fr" className="text-emerald-700 hover:underline"> contact@immeubles-patrimoine.fr</a>.
              Nous vous répondrons dans un délai maximum d'un mois.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">8. Réclamation</h2>
            <p className="text-stone-700 leading-relaxed">
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation
              auprès de la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés)
              à l'adresse : <a href="https://www.cnil.fr" target="_blank" rel="noopener" className="text-emerald-700 hover:underline">www.cnil.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-3">9. Cookies</h2>
            <p className="text-stone-700 leading-relaxed">
              Notre site n'utilise pas de cookies de traçage publicitaire ou de mesure d'audience tiers.
              Seuls des cookies techniques essentiels au fonctionnement du site (authentification, session)
              peuvent être déposés.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-stone-200 text-sm text-stone-500">
          Pour toute question relative à cette politique, contactez-nous à
          <a href="mailto:contact@immeubles-patrimoine.fr" className="text-emerald-700 hover:underline"> contact@immeubles-patrimoine.fr</a>.
        </div>
      </div>
    </div>
  );
}
