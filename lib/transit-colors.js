// lib/transit-colors.js
// Source unique des couleurs des lignes de transport (métro, RER, tram) IDFM.
// Référence = le jeu déjà partagé par les PDF clients (plaquette + avis de valeur),
// pour ne PAS modifier l'apparence des documents existants.
//
// Conventions de clé acceptées :
//   - Métro : '1'..'18', '3bis', '7bis'
//   - RER   : 'A'..'E' et 'RER A'..'RER E'
//   - Tram  : 'T1'..'T13', 'T3a', 'T3b'

export const LINE_COLORS = {
  '1': '#FFCE00', '2': '#0064B0', '3': '#9F9825', '3bis': '#98D4E2',
  '4': '#C04191', '5': '#F28E42', '6': '#83C491', '7': '#F3A4BA',
  '7bis': '#83C491', '8': '#CEADD2', '9': '#D5C900', '10': '#E3B32A',
  '11': '#8D5E2A', '12': '#00814F', '13': '#98D4E2', '14': '#662483',
  '15': '#B90845', '16': '#F3A4BA', '17': '#D5C900', '18': '#00A88F',
  'A': '#E2231A', 'B': '#7BA3DC', 'C': '#FFCE00', 'D': '#00A88F', 'E': '#BE418D',
  'RER A': '#E2231A', 'RER B': '#7BA3DC', 'RER C': '#FFCE00', 'RER D': '#00A88F', 'RER E': '#BE418D',
  'T1': '#0055B7', 'T2': '#B7DA4D', 'T3a': '#FF5A00', 'T3b': '#7B388C',
  'T4': '#E5004C', 'T5': '#662F8F', 'T6': '#E5004B', 'T7': '#FBA60D',
  'T8': '#5A0F47', 'T9': '#BB1D58', 'T10': '#6BCBA0', 'T11': '#FFCD00',
  'T12': '#185CAB', 'T13': '#FF5A00',
};

// Lignes à fond clair → texte noir (sinon blanc par défaut).
export const LINE_TEXT_COLORS = { '1': '#000', '6': '#000', '8': '#000', '9': '#000' };

// Couleur de fond d'une ligne. Renvoie un hex ou null.
// (utilisé tel quel par les templates PDF)
export function getLineColor(line, mode) {
  if (!line) return null;
  const clean = String(line).trim().toUpperCase();
  if (LINE_COLORS[clean]) return LINE_COLORS[clean];
  const raw = String(line).trim();
  if (LINE_COLORS[raw]) return LINE_COLORS[raw];
  if (mode === 'bus') return '#5A4A8A';
  return null;
}

// Couleur du texte d'une ligne (noir sur fond clair, blanc sinon).
export function getLineTextColor(line) {
  return LINE_TEXT_COLORS[String(line).trim()] || '#FFF';
}

// Badge complet { bg, fg } pour l'affichage écran (métro/rer/tram).
export function getLineBadge(line, mode) {
  let lookup = line;
  if (mode === 'tram') lookup = String(line).startsWith('T') ? line : `T${line}`;
  const bg = getLineColor(lookup, mode) || '#888';
  const fg = getLineTextColor(lookup);
  return { bg, fg };
}
