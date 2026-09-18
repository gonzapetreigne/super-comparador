/**
 * Actual Supermercados Scraper (Sucursal Las Flores - ID 10)
 * https://actualonline.com.ar/inicio
 */

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'sin', 'en', 'para', 'por', 'y', 'o', 'al']);

function cleanSearchTerm(term) {
  if (!term) return '';
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

async function fetchActualPage(searchTerm, page = 0) {
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
        page: page, // Actual API is ZERO-INDEXED: page 0 is the first page!
        tags: [],
        categoria: 0,
        search: searchTerm || '',
        sortBy: ''
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.products) ? data.products : [];
  } catch (e) {
    return [];
  }
}

export async function searchActual(searchTerm) {
  try {
    const rawClean = cleanSearchTerm(searchTerm);
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

    // 1. Primary search with cleaned full term (e.g. "aceite girasol")
    let prods = await fetchActualPage(rawClean, 0);
    addProducts(prods);

    // If initial query returned 0 and original term had accents/stopwords, try original term directly
    if (allRaw.length === 0 && rawClean !== searchTerm.toLowerCase().trim()) {
      prods = await fetchActualPage(searchTerm.toLowerCase().trim(), 0);
      addProducts(prods);
    }

    // 2. Intelligent Multi-Word Fallback:
    // If strict multi-word search returned 0 (e.g. "aceite girasol cañuelas"),
    // query the primary noun (e.g. "aceite") and then filter by remaining terms in memory.
    if (allRaw.length === 0 && words.length > 1) {
      const primaryWord = words[0]; // e.g. "aceite", "leche", "yerba"
      const fallbackProds = await fetchActualPage(primaryWord, 0);
      
      // Filter fallback products to ensure they match at least one of the other search words
      const relevantFallback = fallbackProds.filter(p => {
        const title = (p.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const brand = (p.brand || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return words.some(w => title.includes(w) || brand.includes(w));
      });
      addProducts(relevantFallback);
    }

    // 3. If single term query returned 30+ items, fetch page 1 (second page) for completeness
    if (allRaw.length >= 30 && words.length === 1) {
      const page1Prods = await fetchActualPage(rawClean, 1);
      addProducts(page1Prods);
    }

    // Map to normalized comparator format
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
  } catch (error) {
    console.error('[Actual] Fallo de búsqueda:', error.message);
    return [];
  }
}
