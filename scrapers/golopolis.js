/**
 * Golópolis Scraper & Pre-mapped Catalog Engine (Sucursal Las Flores - ID 227)
 * https://golopolis.com.ar/app/?action=shop
 */

import { searchInCatalog, loadGolopolisCatalog } from './catalogEngine.js';

async function fetchGolopolisLive(term, timeoutMs = 2500) {
  const url = `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(term)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': 'suite-company-id=227; PHPSESSID=comparador_las_flores_session'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) return [];

  const html = await response.text();
  const match = html.match(/aProducts\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];

  try {
    const raw = JSON.parse(match[1]);
    return raw.map(p => {
      const price = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
      const originalPrice = p.originalPrice ? parseFloat(p.originalPrice) : null;
      const discount = p.discount && parseFloat(p.discount) > 0 ? parseFloat(p.discount) : null;

      let imageUrl = '';
      if (p.imagesList && p.imagesList.length > 0 && p.imagesList[0].name) {
        imageUrl = `https://golopolis.com.ar/app/${p.imagesList[0].name}`;
      } else if (p.image) {
        imageUrl = `https://golopolis.com.ar/app/files/company_${p.company_id || '21'}/products/${p.image}`;
      }

      const ean = (p.ean && p.ean !== '0' && p.ean.length >= 7) ? String(p.ean).trim() : null;

      let title = (p.name || '').trim();
      const itemStr = (p.item || '').trim();
      if (itemStr && !title.toLowerCase().includes(itemStr.toLowerCase()) && itemStr.toLowerCase() !== 'varios') {
        title = `${itemStr} ${title}`;
      }

      const category = (p.category || '').trim();
      if (category.toLowerCase() === 'aceites' && !title.toLowerCase().includes('aceite') && !title.toLowerCase().includes('a.oliva')) {
        title = `ACEITE ${title}`;
      }

      return {
        id: `golo_${p.id || p.foreign_id}`,
        store: 'Golópolis',
        storeId: 'golopolis',
        branch: 'Las Flores',
        title: title,
        brand: (p.brand || '').trim(),
        category: category,
        price: Math.round(price * 100) / 100,
        originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : null,
        discountPercent: discount,
        promotionText: p.promotion || (discount ? `${discount}% OFF` : null),
        ean: ean,
        image: imageUrl,
        available: parseInt(p.availables || '1', 10) > 0,
        url: `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(p.name || term)}`
      };
    });
  } catch (e) {
    return [];
  }
}

export async function searchGolopolis(searchTerm) {
  try {
    const catalog = loadGolopolisCatalog();
    const catalogResults = searchInCatalog(catalog, searchTerm);

    // If running in local environment (Argentine residential IP), optionally attempt live query
    if (!process.env.VERCEL) {
      try {
        const liveResults = await fetchGolopolisLive(searchTerm, 2000);
        if (liveResults && liveResults.length > 0) {
          return liveResults;
        }
      } catch (e) {
        // Fallback to catalog
      }
    }

    // In Vercel or cloud (or if live returned 0 / timed out):
    // Return high-accuracy catalog results instantly
    if (catalogResults.length > 0) {
      return catalogResults;
    }

    // Fallback: If catalog had 0 results for an unusual term, try live fetch
    const fallbackLive = await fetchGolopolisLive(searchTerm, 2500);
    return fallbackLive;
  } catch (error) {
    console.error('[Golópolis] Fallo de búsqueda:', error.message);
    const catalog = loadGolopolisCatalog();
    return searchInCatalog(catalog, searchTerm);
  }
}
