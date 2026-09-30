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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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

// ==========================================
// MODO ADMINISTRADOR: DISPARO Y SEGUIMIENTO EN VIVO
// ==========================================
const REPO_OWNER = 'gonzapetreigne';
const REPO_NAME = 'super-comparador';
const WORKFLOW_NAME = 'update-catalogs.yml';
const DEFAULT_ADMIN_PIN = process.env.ADMIN_PIN || '2026';

// Verificar PIN de administrador
app.post('/api/admin/verify-pin', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const { pin } = req.body || {};
  if (pin && String(pin).trim() === DEFAULT_ADMIN_PIN) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false, error: 'PIN de Administrador incorrecto.' });
});

// Lanzar actualización de catálogos
app.post('/api/admin/trigger-update', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const { pin, token } = req.body || {};

  if (!pin || String(pin).trim() !== DEFAULT_ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN de Administrador incorrecto.' });
  }

  const ghToken = (token || process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || '').trim();

  if (!ghToken) {
    return res.status(400).json({
      error: 'Se necesita un Token de GitHub (PAT) para autorizar el inicio de la actualización en la nube. Podés ingresarlo en el panel.'
    });
  }

  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_NAME}/dispatches`;
    const ghRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${ghToken}`,
        'User-Agent': 'Super-Comparador-App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    });

    if (ghRes.status === 204) {
      return res.json({
        success: true,
        message: '¡Actualización iniciada exitosamente en GitHub Actions! El servidor en la nube ya está procesando los catálogos.'
      });
    }

    const errData = await ghRes.json().catch(() => ({}));
    return res.status(ghRes.status).json({
      error: errData.message || `GitHub respondió con error (${ghRes.status}). Verificá que el token tenga permiso 'repo' o 'workflow'.`
    });
  } catch (err) {
    return res.status(500).json({ error: `Error conectando con GitHub: ${err.message}` });
  }
});

// Consultar progreso y estado en vivo del workflow
app.get('/api/admin/workflow-status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const token = (req.query.token || process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || '').trim();

  const headers = {
    'User-Agent': 'Super-Comparador-App',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const runsUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_NAME}/runs?per_page=1`;
    const runsRes = await fetch(runsUrl, { headers });

    if (!runsRes.ok) {
      const errData = await runsRes.json().catch(() => ({}));
      return res.status(runsRes.status).json({
        error: errData.message || 'Error consultando GitHub Actions.'
      });
    }

    const data = await runsRes.json();
    const latestRun = data.workflow_runs?.[0] || null;

    if (!latestRun) {
      return res.json({ hasRun: false, run: null });
    }

    const now = Date.now();
    const startedAt = new Date(latestRun.run_started_at || latestRun.created_at).getTime();
    const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));

    // Consultar detalles de los pasos si está en curso
    let steps = [];
    if (latestRun.id && (latestRun.status === 'in_progress' || latestRun.status === 'queued')) {
      try {
        const jobsRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${latestRun.id}/jobs`, { headers });
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          const mainJob = jobsData.jobs?.[0];
          steps = mainJob?.steps || [];
        }
      } catch (e) {}
    }

    // Calcular porcentaje y etapa amigable para el usuario
    let percent = 0;
    let stepDescription = 'Preparando ejecución...';

    if (latestRun.status === 'queued') {
      percent = 8;
      stepDescription = 'En cola en los servidores de GitHub...';
    } else if (latestRun.status === 'in_progress') {
      const updateStep = steps.find(s => s.name?.includes('Ejecutar actualización'));
      if (!updateStep || updateStep.status === 'queued') {
        percent = 18;
        stepDescription = 'Iniciando máquina virtual y configurando dependencias...';
      } else if (updateStep.status === 'in_progress') {
        if (elapsedSec < 45) {
          percent = Math.min(42, 22 + Math.floor(elapsedSec * 0.45));
          stepDescription = 'Descargando catálogos de Supermercado Actual y Golópolis...';
        } else if (elapsedSec < 120) {
          percent = Math.min(76, 42 + Math.floor((elapsedSec - 45) * 0.45));
          stepDescription = 'Auditando y validando 100% de precios contra las webs oficiales...';
        } else {
          percent = Math.min(92, 76 + Math.floor((elapsedSec - 120) * 0.2));
          stepDescription = 'Guardando cambios y sincronizando despliegue en Vercel...';
        }
      } else if (updateStep.status === 'completed') {
        percent = 95;
        stepDescription = 'Publicando nueva versión en producción de Vercel...';
      }
    } else if (latestRun.status === 'completed') {
      percent = 100;
      if (latestRun.conclusion === 'success') {
        stepDescription = '¡Actualización y validación finalizadas con éxito!';
      } else {
        stepDescription = `Finalizado con estado: ${latestRun.conclusion || 'desconocido'}.`;
      }
    }

    return res.json({
      hasRun: true,
      run: {
        id: latestRun.id,
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        htmlUrl: latestRun.html_url,
        startedAt: latestRun.run_started_at || latestRun.created_at,
        updatedAt: latestRun.updated_at,
        elapsedSec,
        percent,
        stepDescription
      }
    });
  } catch (err) {
    return res.status(500).json({ error: `Error: ${err.message}` });
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
