/**
 * Actual Supermercados Scraper (Sucursal Las Flores - ID 10)
 * https://actualonline.com.ar/inicio
 */

// Category map to bridge Actual's backend categorization
const CATEGORY_MAP = {
  'yerba': ['Infusiones', 1523],
  'mate': ['Infusiones', 1523],
  'leche': ['Lácteos', 97],
  'yogur': ['Lácteos'],
  'crema': ['Lácteos'],
  'fideo': ['Pastas-Secas', 'Fideos'],
  'pasta': ['Pastas-Secas', 'PASTAS FRESCAS'],
  'arroz': ['ARROZ', 'Almacén'],
  'aceite': ['Aceites-y-Vinagres'],
  'vinagre': ['Aceites-y-Vinagres'],
  'azucar': ['Azúcar y Edulcorantes'],
  'galletita': ['Galletitas-y-Tostadas'],
  'coca': ['GASEOSAS', 'Bebidas'],
  'gaseosa': ['GASEOSAS', 'Bebidas'],
  'cerveza': ['Cervezas', 'Bebidas'],
  'vino': ['Vinos', 'Bebidas'],
  'jabon': ['Jabones de Tocador', 'Limpieza'],
  'lavandina': ['LAVANDINAS', 'Limpieza'],
  'detergente': ['DETERGENTES', 'Limpieza'],
  'papel': ['Papeles', 'Limpieza']
};

async function fetchActualPage(payload) {
  try {
    const url = 'https://actualonline.com.ar/api/products/10';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        page: 1,
        tags: [],
        categoria: 0,
        search: '',
        sortBy: '',
        ...payload
      }),
      signal: AbortSignal.timeout(9000)
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
    const termLower = searchTerm.toLowerCase().trim();
    const words = termLower.split(/\s+/).filter(w => w.length > 2);

    // Collect query candidates
    const payloads = [{ search: searchTerm }];

    for (const [key, cats] of Object.entries(CATEGORY_MAP)) {
      if (termLower.includes(key)) {
        cats.forEach(c => payloads.push({ categoria: c }));
      }
    }

    const allRaw = [];
    const seenIds = new Set();

    for (const p of payloads) {
      const prods = await fetchActualPage(p);
      for (const prod of prods) {
        if (!seenIds.has(prod.id)) {
          seenIds.add(prod.id);
          allRaw.push(prod);
        }
      }
      if (allRaw.length >= 40) break;
    }

    // Relevance filtering: title or brand must match search terms
    const filtered = allRaw.filter(p => {
      const title = (p.title || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return words.some(w => title.includes(w) || brand.includes(w) || cat.includes(w));
    });

    return filtered.map(p => {
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
