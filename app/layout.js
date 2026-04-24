import './globals.css';

export const metadata = {
  title: 'Immeubles & Patrimoine — CRM',
  description: "CRM de l'agence Immeubles & Patrimoine — Transactions immobilières Paris & Île-de-France",
  manifest: '/manifest.json',
  themeColor: '#F9F5ED',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Immeubles & Patrimoine',
  },
};

const DROPBOX_APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || '';

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {DROPBOX_APP_KEY && (
          <script 
            src="https://www.dropbox.com/static/api/2/dropins.js" 
            id="dropboxjs" 
            data-app-key={DROPBOX_APP_KEY}
            async
          />
        )}
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
