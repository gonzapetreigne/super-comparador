/**
 * Golópolis Scraper (Sucursal Las Flores - ID 227)
 * https://golopolis.com.ar/app/?action=shop
 */

async function fetchGolopolisQuery(term) {
  const url = `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(term)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': 'suite-company-id=227; PHPSESSID=comparador_las_flores_session'
    },
    signal: AbortSignal.timeout(9000)
  });

  if (!response.ok) return [];

  const html = await response.text();
  const match = html.match(/aProducts\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];

  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return [];
  }
}

export async function searchGolopolis(searchTerm) {
  try {
    let rawProducts = await fetchGolopolisQuery(searchTerm);

    // If multi-word search returned very few results (e.g. "yerba mate"), try the individual words
    const words = searchTerm.trim().split(/\s+/).filter(w => w.length > 2);
    if (rawProducts.length < 5 && words.length > 1) {
      for (const word of words) {
        const moreProds = await fetchGolopolisQuery(word);
        if (moreProds.length > 0) {
          const existingIds = new Set(rawProducts.map(p => p.id));
          for (const p of moreProds) {
            if (!existingIds.has(p.id)) {
              existingIds.add(p.id);
              rawProducts.push(p);
            }
          }
        }
      }
    }

    // Strict relevance filter: ensure product name or brand or category matches search terms
    const filtered = rawProducts.filter(p => {
      const name = (p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const item = (p.item || '').toLowerCase();
      return words.some(w => name.includes(w) || brand.includes(w) || cat.includes(w) || item.includes(w));
    });

    return filtered.map(p => {
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

      return {
        id: `golo_${p.id || p.foreign_id}`,
        store: 'Golópolis',
        storeId: 'golopolis',
        branch: 'Las Flores',
        title: title,
        brand: (p.brand || '').trim(),
        price: Math.round(price * 100) / 100,
        originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : null,
        discountPercent: discount,
        promotionText: p.promotion || (discount ? `${discount}% OFF` : null),
        ean: ean,
        image: imageUrl,
        available: parseInt(p.availables || '1', 10) > 0,
        url: `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(p.name || searchTerm)}`
      };
    });
  } catch (error) {
    console.error('[Golópolis] Fallo de búsqueda:', error.message);
    return [];
  }
}
