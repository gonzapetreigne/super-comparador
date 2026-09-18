import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

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
    // Run the 3 fast local scrapers in parallel
    const [golopolisRes, actualRes, diaRes] = await Promise.allSettled([
      searchGolopolis(query),
      searchActual(query),
      searchDia(query)
    ]);

    const golopolisProds = golopolisRes.status === 'fulfilled' ? golopolisRes.value : [];
    const actualProds = actualRes.status === 'fulfilled' ? actualRes.value : [];
    const diaProds = diaRes.status === 'fulfilled' ? diaRes.value : [];

    console.log(`[Search Fast] Resultados locales: Golópolis (${golopolisProds.length}), Actual (${actualProds.length}), Día (${diaProds.length}) en ${Date.now() - startTime}ms`);

    // Match across the 3 local stores
    const matchedResult = matchProducts(golopolisProds, actualProds, diaProds, [], query);
    const elapsedMs = Date.now() - startTime;

    const responseData = {
      query: query,
      elapsedMs: elapsedMs,
      cards: matchedResult.cards,
      totalCards: matchedResult.totalCards,
      counts: {
        golopolis: golopolisProds.length,
        actual: actualProds.length,
        dia: diaProds.length,
        mercadolibre: 0
      },
      stores: {
        golopolis: { name: 'Golópolis', branch: 'Las Flores', count: golopolisProds.length },
        actual: { name: 'Actual', branch: 'Las Flores', count: actualProds.length },
        dia: { name: 'Día%', branch: 'Día Online', count: diaProds.length },
        mercadolibre: {
          name: 'Mercado Libre',
          branch: 'Full Súper ⚡',
          count: 0,
          pending: true
        }
      },
      meliPending: true,
      timestamp: new Date().toISOString()
    };

    // Cache local data for subsequent Meli merge
    searchCache.set(cacheKey, {
      golo: golopolisProds,
      actual: actualProds,
      dia: diaProds,
      hasFullResult: false,
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
    const golo = cached.golo || [];
    const actual = cached.actual || [];
    const dia = cached.dia || [];

    // Re-match all 4 stores together
    const matchedResult = matchProducts(golo, actual, dia, meliProds, query);
    const meliBlocked = meliProds.blockedByBot === true;

    const responseData = {
      query: query,
      elapsedMs: elapsedMs,
      cards: matchedResult.cards,
      totalCards: matchedResult.totalCards,
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
