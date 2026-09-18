import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

import { searchGolopolis } from './scrapers/golopolis.js';
import { searchActual } from './scrapers/actual.js';
import { searchDia } from './scrapers/dia.js';
import { searchMercadoLibre } from './scrapers/mercadolibre.js';
import { matchProducts } from './scrapers/matcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read catalog metadata and last update date
function getCatalogInfo() {
  try {
    const infoPath = path.join(__dirname, 'data', 'catalog-info.json');
    if (fs.existsSync(infoPath)) {
      return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    }
  } catch (e) {
    // fallback
  }
  return {
    lastUpdated: '2026-09-18T09:00:00.000Z',
    formattedDate: '18 de septiembre de 2026',
    displayDate: '18/09/2026'
  };
}

// Metadata endpoint
app.get('/api/info', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(getCatalogInfo());
});

// In-memory cache for fast repeated searches (TTL: 5 minutes)
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

app.get('/api/search', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Debes ingresar un término de búsqueda válido (mínimo 2 caracteres).' });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);

  // If full 4-store result is already cached, return it directly!
  if (cached && cached.hasFullResult && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return res.json({ ...cached.data, fromCache: true });
  }

  console.log(`[Search Fast] Consultando supermercados locales: "${query}"...`);
  const startTime = Date.now();

  try {
    // Run all 4 store scrapers/catalogs in parallel (Golópolis, Actual, Día%, MELI Full)
    const [golopolisRes, actualRes, diaRes, meliRes] = await Promise.allSettled([
      searchGolopolis(query),
      searchActual(query),
      searchDia(query),
      searchMercadoLibre(query)
    ]);

    const golopolisProds = golopolisRes.status === 'fulfilled' ? golopolisRes.value : [];
    const actualProds = actualRes.status === 'fulfilled' ? actualRes.value : [];
    const diaProds = diaRes.status === 'fulfilled' ? diaRes.value : [];
    const meliProds = meliRes.status === 'fulfilled' ? meliRes.value : [];

    console.log(`[Search Fast] Resultados: Golópolis (${golopolisProds.length}), Actual (${actualProds.length}), Día (${diaProds.length}), MELI (${meliProds.length}) en ${Date.now() - startTime}ms`);

    // Match across all stores
    const matchedResult = matchProducts(golopolisProds, actualProds, diaProds, meliProds, query);
    const elapsedMs = Date.now() - startTime;

    const responseData = {
      query: query,
      elapsedMs: elapsedMs,
      cards: matchedResult.cards,
      totalCards: matchedResult.totalCards,
      lastPriceUpdate: getCatalogInfo(),
      lastUpdatedDate: getCatalogInfo().formattedDate,
      counts: {
        golopolis: golopolisProds.length,
        actual: actualProds.length,
        dia: diaProds.length,
        mercadolibre: meliProds.length
      },
      stores: {
        golopolis: { name: 'Golópolis', branch: 'Las Flores', count: golopolisProds.length },
        actual: { name: 'Actual', branch: 'Las Flores', count: actualProds.length },
        dia: { name: 'Día%', branch: 'Día Online', count: diaProds.length },
        mercadolibre: {
          name: 'Mercado Libre',
          branch: 'Full Súper ⚡',
          count: meliProds.length,
          pending: false
        }
      },
      meliPending: false,
      timestamp: new Date().toISOString()
    };

    // Cache full data
    searchCache.set(cacheKey, {
      golo: golopolisProds,
      actual: actualProds,
      dia: diaProds,
      meli: meliProds,
      hasFullResult: true,
      data: responseData,
      timestamp: Date.now()
    });

    return res.json(responseData);
  } catch (error) {
    console.error('[Search Fast] Error general:', error);
    return res.status(500).json({ error: 'Error al consultar las tiendas', details: error.message });
  }
});

// Progressive async endpoint for Mercado Libre
app.get('/api/search/meli', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Debes ingresar un término de búsqueda válido.' });
  }

  const cacheKey = query.toLowerCase();
  console.log(`[Search Meli Async] Consultando Mercado Libre para: "${query}"...`);
  const startTime = Date.now();

  try {
    const meliProds = await searchMercadoLibre(query);
    const elapsedMs = Date.now() - startTime;
    console.log(`[Search Meli Async] Mercado Libre respondió en ${elapsedMs}ms: ${meliProds.length} productos (bloqueado: ${meliProds.blockedByBot || false})`);

    const cached = searchCache.get(cacheKey) || {};
    let golo = cached.golo;
    let actual = cached.actual;
    let dia = cached.dia;

    if (!golo || !actual || !dia) {
      const [goloRes, actualRes, diaRes] = await Promise.allSettled([
        searchGolopolis(query),
        searchActual(query),
        searchDia(query)
      ]);
      golo = goloRes.status === 'fulfilled' ? goloRes.value : [];
      actual = actualRes.status === 'fulfilled' ? actualRes.value : [];
      dia = diaRes.status === 'fulfilled' ? diaRes.value : [];
    }

    // Re-match all 4 stores together
    const matchedResult = matchProducts(golo, actual, dia, meliProds, query);
    const meliBlocked = meliProds.blockedByBot === true;

    const responseData = {
      query: query,
      elapsedMs: elapsedMs,
      cards: matchedResult.cards,
      totalCards: matchedResult.totalCards,
      lastPriceUpdate: getCatalogInfo(),
      lastUpdatedDate: getCatalogInfo().formattedDate,
      counts: {
        golopolis: golo.length,
        actual: actual.length,
        dia: dia.length,
        mercadolibre: meliProds.length
      },
      stores: {
        golopolis: { name: 'Golópolis', branch: 'Las Flores', count: golo.length },
        actual: { name: 'Actual', branch: 'Las Flores', count: actual.length },
        dia: { name: 'Día%', branch: 'Día Online', count: dia.length },
        mercadolibre: {
          name: 'Mercado Libre',
          branch: 'Full Súper ⚡',
          count: meliProds.length,
          blockedByBot: meliBlocked,
          pending: false
        }
      },
      meliProducts: meliProds,
      timestamp: new Date().toISOString()
    };

    // Update cache with full 4-store result
    searchCache.set(cacheKey, {
      ...cached,
      meli: meliProds,
      hasFullResult: true,
      data: responseData,
      timestamp: Date.now()
    });

    return res.json(responseData);
  } catch (error) {
    console.error('[Search Meli Async] Error:', error);
    return res.status(500).json({ error: 'Error al consultar Mercado Libre', details: error.message });
  }
});

// Temporary diagnostic endpoint for Golopolis
app.get('/api/test-golo', async (req, res) => {
  const q = req.query.q || 'atun';
  try {
    const url = `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(q)}`;
    const t0 = Date.now();
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': 'suite-company-id=227; PHPSESSID=comparador_las_flores_session'
      },
      signal: AbortSignal.timeout(8000)
    });
    const html = await r.text();
    const match = html.match(/aProducts\s*=\s*(\[[\s\S]*?\]);/);
    let parsedCount = 0;
    if (match) {
      try { parsedCount = JSON.parse(match[1]).length; } catch (e) {}
    }
    res.json({
      status: r.status,
      timeMs: Date.now() - t0,
      len: html.length,
      hasAProducts: Boolean(match),
      parsedCount,
      preview: html.substring(0, 500)
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    app: 'Comparador de Supermercados Las Flores + Mercado Libre Full',
    version: '1.2.0',
    deployment: process.env.VERCEL ? 'vercel-serverless' : 'standalone-node',
    stores: [
      { name: 'Golópolis', branch: 'Las Flores', id: 227 },
      { name: 'Actual Supermercados', branch: 'Las Flores', id: 10 },
      { name: 'Día%', branch: 'Día Online' },
      { name: 'Mercado Libre', branch: 'Full Súper ⚡' }
    ]
  });
});

function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start standalone server only when NOT running as a Vercel Serverless Function
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalNetworkIp();
    console.log(`\n================================================================`);
    console.log(`🛒 Comparador de Precios (Las Flores + Mercado Libre Full)`);
    console.log(`================================================================`);
    console.log(`PC (Navegador):       http://localhost:${PORT}`);
    console.log(`Celular (Misma Wi-Fi): http://${localIp}:${PORT}`);
    console.log(`================================================================\n`);
  });
}

export default app;
