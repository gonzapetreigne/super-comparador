/**
 * Actual Supermercados Scraper & Pre-mapped Catalog Engine (Sucursal Las Flores - ID 10)
 * https://actualonline.com.ar/inicio
 */

import { searchInCatalog, loadActualCatalog, cleanNorm } from './catalogEngine.js';

async function fetchActualPage(searchTerm, page = 0, timeoutMs = 2500) {
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
        search: searchTerm || '',
        sortBy: ''
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.products) ? data.products : [];
  } catch (e) {
    return [];
  }
}

async function fetchActualLive(searchTerm) {
  const rawClean = cleanNorm(searchTerm);
  const words = rawClean.split(/\s+/).filter(w => w.length >= 2);

  const allRaw = [];
  const seenIds = new Set();

  const addProducts = (prods) => {
    for (const prod of prods) {
      if (!seenIds.has(prod.id)) {
        seenIds.add(prod.id);
        allRaw.push(prod);
      }
    }
  };

  let prods = await fetchActualPage(rawClean, 0, 2000);
  addProducts(prods);

  if (allRaw.length === 0 && rawClean !== searchTerm.toLowerCase().trim()) {
    prods = await fetchActualPage(searchTerm.toLowerCase().trim(), 0, 2000);
    addProducts(prods);
  }

  if (allRaw.length === 0 && words.length > 1) {
    const primaryWord = words[0];
    const fallbackProds = await fetchActualPage(primaryWord, 0, 2000);
    const relevantFallback = fallbackProds.filter(p => {
      const title = cleanNorm(p.title);
      const brand = cleanNorm(p.brand);
      return words.some(w => title.includes(w) || brand.includes(w));
    });
    addProducts(relevantFallback);
  }

  return allRaw.map(p => {
    const price = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
    const originalPrice = p.price0 && parseFloat(p.price0) > price ? parseFloat(p.price0) : null;
    const discount = p.discount ? parseFloat(p.discount) : (originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : null);

    let ean = null;
    if (p.barCode && p.barCode.length >= 7) {
      ean = String(p.barCode).trim();
    } else if (Array.isArray(p.cbarras) && p.cbarras.length > 0) {
      const valid = p.cbarras.find(c => c.cbarra && c.cbarra.length >= 7);
      if (valid) ean = String(valid.cbarra).trim();
    }

    let imageUrl = '';
    if (Array.isArray(p.images) && p.images.length > 0 && p.images[0].name) {
      imageUrl = `https://actualonline.com.ar/api/${p.images[0].name}`;
    } else if (typeof p.images === 'string' && p.images.length > 0) {
      imageUrl = p.images.startsWith('http') ? p.images : `https://actualonline.com.ar/api/${p.images}`;
    }

    return {
      id: `act_${p.id || p.barCode}`,
      store: 'Actual',
      storeId: 'actual',
      branch: 'Las Flores',
      title: (p.title || '').trim(),
      brand: (p.brand || '').trim(),
      category: (p.category || '').trim(),
      price: Math.round(price * 100) / 100,
      originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : null,
      discountPercent: discount && discount > 0 ? Math.round(discount) : null,
      promotionText: discount && discount > 0 ? `${Math.round(discount)}% OFF` : null,
      ean: ean,
      image: imageUrl,
      available: (p.stock === undefined || p.stock === null || p.stock > 0),
      url: 'https://actualonline.com.ar/inicio'
    };
  });
}

export async function searchActual(searchTerm) {
  try {
    const catalog = loadActualCatalog();
    const catalogResults = searchInCatalog(catalog, searchTerm);

    // If running in local environment, optionally try live API
    if (!process.env.VERCEL) {
      try {
        const liveResults = await fetchActualLive(searchTerm);
        if (liveResults && liveResults.length > 0) {
          return liveResults;
        }
      } catch (e) {
        // Fallback seamlessly
      }
    }

    // In Vercel or if live returned 0 / timed out:
    if (catalogResults.length > 0) {
      return catalogResults;
    }

    // Fallback: If catalog had 0 results for an uncataloged item, try live fetch
    const fallbackLive = await fetchActualLive(searchTerm);
    return fallbackLive;
  } catch (error) {
    console.error('[Actual] Fallo de búsqueda:', error.message);
    const catalog = loadActualCatalog();
    return searchInCatalog(catalog, searchTerm);
  }
}
