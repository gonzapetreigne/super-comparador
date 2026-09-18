import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'sin', 'en',
  'para', 'por', 'y', 'o', 'al', 'x', 'gr', 'grs', 'g', 'kg', 'ml', 'cc', 'l', 'lt', 'lts'
]);

let cachedGolopolis = null;
let cachedActual = null;

function resolveDataPath(filename) {
  const possiblePaths = [
    path.join(process.cwd(), 'data', filename),
    path.resolve(__dirname, '../data', filename),
    path.join('/var/task', 'data', filename)
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
      // Ignore
    }
  }
  return path.join(process.cwd(), 'data', filename);
}

export function loadGolopolisCatalog() {
  if (cachedGolopolis && cachedGolopolis.length > 0) return cachedGolopolis;
  try {
    const filePath = resolveDataPath('golopolis.json');
    if (fs.existsSync(filePath)) {
      cachedGolopolis = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`[Catalog Engine] Golópolis catálogo cargado: ${cachedGolopolis.length} productos.`);
      return cachedGolopolis;
    }
  } catch (err) {
    console.error('[Catalog Engine] Error cargando data/golopolis.json:', err.message);
  }
  return [];
}

export function loadActualCatalog() {
  if (cachedActual && cachedActual.length > 0) return cachedActual;
  try {
    const filePath = resolveDataPath('actual.json');
    if (fs.existsSync(filePath)) {
      cachedActual = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`[Catalog Engine] Actual catálogo cargado: ${cachedActual.length} productos.`);
      return cachedActual;
    }
  } catch (err) {
    console.error('[Catalog Engine] Error cargando data/actual.json:', err.message);
  }
  return [];
}

let cachedMeli = null;

export function loadMeliCatalog() {
  if (cachedMeli && cachedMeli.length > 0) return cachedMeli;
  try {
    const filePath = resolveDataPath('mercadolibre.json');
    if (fs.existsSync(filePath)) {
      cachedMeli = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`[Catalog Engine] Mercado Libre catálogo cargado: ${cachedMeli.length} productos.`);
      return cachedMeli;
    }
  } catch (err) {
    console.error('[Catalog Engine] Error cargando data/mercadolibre.json:', err.message);
  }
  return [];
}

export function reloadCatalogs() {
  cachedGolopolis = null;
  cachedActual = null;
  cachedMeli = null;
  loadGolopolisCatalog();
  loadActualCatalog();
  loadMeliCatalog();
}

export function cleanNorm(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

export function getWordVariations(w) {
  const set = new Set([w]);
  if (w.endsWith('es') && w.length > 4) {
    set.add(w.slice(0, -2)); // e.g. atunes -> atun, limones -> limon
    set.add(w.slice(0, -1)); // e.g. aceites -> aceite
  } else if (w.endsWith('s') && w.length > 3) {
    set.add(w.slice(0, -1)); // e.g. galletitas -> galletita, fideos -> fideo
  } else {
    set.add(w + 's');
    set.add(w + 'es');
  }
  return Array.from(set);
}

export function searchInCatalog(catalog, query, maxResults = 40) {
  if (!catalog || !Array.isArray(catalog) || catalog.length === 0) return [];
  const rawClean = cleanNorm(query);
  if (!rawClean) return [];

  const rawWords = rawClean.split(/\s+/).filter(w => w.length > 0);
  const words = rawWords.filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const finalWords = words.length > 0 ? words : rawWords;
  if (finalWords.length === 0) return [];

  // 1. Direct barcode / EAN search
  const trimmed = query.trim();
  if (/^\d{7,14}$/.test(trimmed)) {
    const eanMatches = catalog.filter(p => p.ean && p.ean === trimmed);
    if (eanMatches.length > 0) return eanMatches;
  }

  const wordGroups = finalWords.map(w => ({
    original: w,
    variations: getWordVariations(w)
  }));

  const scored = [];

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const titleNorm = cleanNorm(item.title);
    const brandNorm = cleanNorm(item.brand);
    const catNorm = cleanNorm(item.category);

    const titleTokens = new Set(titleNorm.split(/\s+/));
    const brandTokens = new Set(brandNorm.split(/\s+/));
    const catTokens = new Set(catNorm.split(/\s+/));

    let matchedWordCount = 0;
    let score = 0;

    for (const wg of wordGroups) {
      let wordMatched = false;

      // Exact token match in title
      for (const v of wg.variations) {
        if (titleTokens.has(v)) {
          score += 35;
          wordMatched = true;
          break;
        }
      }

      // Exact token match in brand
      if (!wordMatched) {
        for (const v of wg.variations) {
          if (brandTokens.has(v)) {
            score += 25;
            wordMatched = true;
            break;
          }
        }
      }

      // Exact token match in category
      if (!wordMatched) {
        for (const v of wg.variations) {
          if (catTokens.has(v)) {
            score += 20;
            wordMatched = true;
            break;
          }
        }
      }

      // Substring match
      if (!wordMatched) {
        for (const v of wg.variations) {
          if (titleNorm.includes(v)) {
            score += 15;
            wordMatched = true;
            break;
          } else if (brandNorm.includes(v)) {
            score += 10;
            wordMatched = true;
            break;
          } else if (catNorm.includes(v)) {
            score += 8;
            wordMatched = true;
            break;
          }
        }
      }

      if (wordMatched) {
        matchedWordCount++;
      }
    }

    if (matchedWordCount === 0) continue;

    // Phrase match bonus
    if (titleNorm.includes(rawClean)) {
      score += 60;
    }

    // All words matched bonus
    if (matchedWordCount === finalWords.length) {
      score += 100;
    }

    // Title starts with first word
    if (wordGroups.length > 0) {
      const firstW = wordGroups[0].original;
      if (titleNorm.startsWith(firstW)) {
        score += 25;
      }
    }

    scored.push({ item, score, matchedWordCount });
  }

  // Prioritize candidates that match ALL query words if any exist
  const allMatched = scored.filter(s => s.matchedWordCount === finalWords.length);
  const candidates = allMatched.length > 0 ? allMatched : scored;

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxResults).map(c => c.item);
}
