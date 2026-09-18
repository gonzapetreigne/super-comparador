import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'actual.json');

export async function updateActualCatalog() {
  console.log('[Actual Updater] Iniciando actualización del catálogo de Supermercado Actual (Las Flores)...');
  const startTime = Date.now();

  const allProducts = [];
  const seenIds = new Set();
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = 'https://actualonline.com.ar/api/products/10';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          page: page,
          tags: [],
          categoria: 0,
          search: '',
          sortBy: ''
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        console.warn(`[Actual Updater] Falló página ${page}: HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      const products = Array.isArray(data.products) ? data.products : [];

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const p of products) {
        const id = `act_${p.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);

          const price = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
          const originalPrice = p.old_price ? parseFloat(p.old_price) : null;
          const discount = p.discount ? parseFloat(p.discount) : null;

          let image = '';
          if (p.image) {
            image = p.image.startsWith('http') ? p.image : `https://actualonline.com.ar/${p.image.replace(/^\//, '')}`;
          }

          let brand = (p.brand || '').trim();
          if (!brand && p.name) {
            const words = p.name.trim().split(/\s+/);
            if (words.length > 1 && words[words.length - 1].length > 2) {
              brand = words[words.length - 1];
            }
          }

          const category = (p.category_name || p.category || '').trim();
          const cleanName = (p.name || '').trim();
          const urlProd = p.slug
            ? `https://actualonline.com.ar/producto/${p.slug}`
            : `https://actualonline.com.ar/inicio?search=${encodeURIComponent(cleanName)}`;

          allProducts.push({
            id: id,
            store: 'Actual',
            storeId: 'actual',
            branch: 'Las Flores',
            title: cleanName,
            brand: brand,
            category: category,
            price: Math.round(price * 100) / 100,
            originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : null,
            discountPercent: discount ? Math.round(discount) : null,
            ean: p.barcode || p.ean || null,
            image: image,
            available: p.status === 1 || p.stock > 0,
            url: urlProd
          });
        }
      }

      console.log(`[Actual Updater] Página ${page + 1}: +${products.length} productos (Total acumulado: ${allProducts.length})`);
      page++;

      // Pequeña pausa de 100ms para cortesía de servidor
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`[Actual Updater] Error en página ${page}:`, err.message);
      break;
    }
  }

  if (allProducts.length > 0) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2), 'utf8');
    console.log(`[Actual Updater] Catálogo guardado en data/actual.json (${allProducts.length} productos en ${(Date.now() - startTime) / 1000}s).`);
  } else {
    console.warn(`[Actual Updater] No se obtuvieron productos; conservando archivo anterior.`);
  }

  return allProducts.length;
}

if (process.argv[1] && process.argv[1].endsWith('update-actual.js')) {
  updateActualCatalog()
    .then(count => {
      console.log(`Actualización finalizada. Total: ${count}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(`Error en actualización de Actual:`, err);
      process.exit(1);
    });
}
