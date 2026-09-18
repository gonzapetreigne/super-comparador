import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import { updateActualCatalog } from './update-actual.js';
import { updateGolopolisCatalog } from './update-golopolis.js';
import { crawlMercadoLibreCatalog } from './scrape-meli-full.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const INFO_FILE = path.join(DATA_DIR, 'catalog-info.json');

function getFormattedSpanishDate(d = new Date()) {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

export async function runWeeklyUpdatePipeline() {
  console.log('====================================================');
  console.log('[AUTO-UPDATE PIPELINE] INICIANDO ACTUALIZACIÓN SEMANAL');
  console.log(`Fecha: ${new Date().toISOString()} (${getFormattedSpanishDate()})`);
  console.log('====================================================\n');

  const startTime = Date.now();
  const results = {
    actual: 0,
    golopolis: 0,
    mercadolibre: 0,
    errors: []
  };

  // 1. Actualizar Supermercado Actual
  try {
    console.log('\n--- PASO 1/3: Actualizando Supermercado Actual ---');
    results.actual = await updateActualCatalog();
    console.log(`✓ Supermercado Actual finalizado: ${results.actual} productos.`);
  } catch (err) {
    console.error('✗ Error actualizando Actual:', err.message);
    results.errors.push(`Actual: ${err.message}`);
  }

  // 2. Actualizar Supermercado Golópolis
  try {
    console.log('\n--- PASO 2/3: Actualizando Golópolis ---');
    results.golopolis = await updateGolopolisCatalog();
    console.log(`✓ Golópolis finalizado: ${results.golopolis} productos.`);
  } catch (err) {
    console.error('✗ Error actualizando Golópolis:', err.message);
    results.errors.push(`Golópolis: ${err.message}`);
  }

  // 3. Actualizar Mercado Libre Full Super
  try {
    console.log('\n--- PASO 3/3: Actualizando Mercado Libre Full Super ---');
    results.mercadolibre = await crawlMercadoLibreCatalog();
    console.log(`✓ Mercado Libre finalizado: ${results.mercadolibre} productos.`);
  } catch (err) {
    console.error('✗ Error actualizando Mercado Libre:', err.message);
    results.errors.push(`Mercado Libre: ${err.message}`);
  }

  // 4. Actualizar metadata de fecha
  const now = new Date();
  const formattedDate = getFormattedSpanishDate(now);
  const displayDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const infoData = {
    lastUpdated: now.toISOString(),
    formattedDate: formattedDate,
    displayDate: displayDate,
    totalProducts: {
      actual: results.actual,
      golopolis: results.golopolis,
      mercadolibre: results.mercadolibre
    }
  };
  fs.writeFileSync(INFO_FILE, JSON.stringify(infoData, null, 2), 'utf8');
  console.log(`\n✓ Fecha de catálogo actualizada a: "${formattedDate}" en data/catalog-info.json`);

  // 5. Commit y Push a GitHub para auto-deploy en Vercel
  try {
    console.log('\n--- PASO 4: Publicando actualización en GitHub y Vercel ---');
    const projectRoot = path.resolve(__dirname, '..');
    
    execSync('git add data/', { cwd: projectRoot, stdio: 'inherit' });
    
    // Verificar si hay cambios antes de hacer commit
    const status = execSync('git status --porcelain data/', { cwd: projectRoot, encoding: 'utf8' });
    if (status.trim().length > 0) {
      const commitMsg = `chore(data): auto-update supermarket catalogs (${formattedDate})`;
      execSync(`git commit -m "${commitMsg}"`, { cwd: projectRoot, stdio: 'inherit' });
      execSync('git push origin main', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✓ Cambios enviados a GitHub. Vercel iniciará el despliegue automático.');
    } else {
      console.log('ℹ No se detectaron cambios en los catálogos.');
    }
  } catch (gitErr) {
    console.warn('⚠ Advertencia al realizar git push:', gitErr.message);
  }

  const durationMin = Math.round((Date.now() - startTime) / 60000);
  console.log('\n====================================================');
  console.log(`[AUTO-UPDATE PIPELINE] COMPLETADO EN ${durationMin} MINUTOS`);
  console.log(`Resumen: Actual: ${results.actual} | Golópolis: ${results.golopolis} | MELI Full: ${results.mercadolibre}`);
  console.log('====================================================\n');
}

if (process.argv[1] && process.argv[1].endsWith('update-all.js')) {
  runWeeklyUpdatePipeline()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fallo en pipeline:', err);
      process.exit(1);
    });
}
