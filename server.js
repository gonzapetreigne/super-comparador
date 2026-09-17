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
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Debes ingresar un término de búsqueda válido (mínimo 2 caracteres).' });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return res.json({ ...cached.data, fromCache: true });
  }

  console.log(`[Search] Consultando en tiempo real: "${query}" en 4 tiendas...`);
  const startTime = Date.now();

  try {
    // Run all 4 scrapers in parallel
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

    console.log(`[Search] Resultados: Golópolis (${golopolisProds.length}), Actual (${actualProds.length}), Día (${diaProds.length}), Mercado Libre (${meliProds.length})`);

    // Match and normalize across all 4 stores
    const matchedResult = matchProducts(golopolisProds, actualProds, diaProds, meliProds, query);
    const elapsedMs = Date.now() - startTime;

    const meliBlocked = meliProds.blockedByBot === true;

    const responseData = {
      query: query,
      elapsedMs: elapsedMs,
      cards: matchedResult.cards,
      totalCards: matchedResult.totalCards,
      counts: matchedResult.counts,
      stores: {
        golopolis: { name: 'Golópolis', branch: 'Las Flores', count: golopolisProds.length },
        actual: { name: 'Actual', branch: 'Las Flores', count: actualProds.length },
        dia: { name: 'Día%', branch: 'Día Online', count: diaProds.length },
        mercadolibre: {
          name: 'Mercado Libre',
          branch: 'Full Súper ⚡',
          count: meliProds.length,
          blockedByBot: meliBlocked
        }
      },
      timestamp: new Date().toISOString()
    };

    searchCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

    return res.json(responseData);
  } catch (error) {
    console.error('[Search] Error general:', error);
    return res.status(500).json({ error: 'Error al consultar las tiendas', details: error.message });
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
