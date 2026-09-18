// Confronto di nomi tollerante: nessuno scrive "Martínez" con l'accento
// giusto quando incolla la propria rosa, e "Leao" deve trovare "Leão".

export function foldAccents(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Confronto ridotto all'osso: senza accenti, punteggiatura e spazi doppi. */
export function normalizeName(value) {
  return foldAccents(value)
    .replace(/[.'`´’-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
