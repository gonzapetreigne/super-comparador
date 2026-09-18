/**
 * Supermercados Día% Scraper (Día Online)
 * https://diaonline.supermercadosdia.com.ar/
 */

export async function searchDia(searchTerm) {
  try {
    // VTEX Catalog System Search Endpoint (Exact keyword matching without fallback to sponsored items)
    const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search?ft=${encodeURIComponent(searchTerm)}&_from=0&_to=35`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(9000)
    });

    if (!response.ok) {
      console.warn(`[Día] Error HTTP ${response.status}`);
      return [];
    }

    const rawProducts = await response.json();
    if (!Array.isArray(rawProducts)) {
      return [];
    }

    // Strict filter: ensure product title or brand contains at least one significant search term word
    const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const filtered = rawProducts.filter(p => {
      const name = (p.productName || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const categories = Array.isArray(p.categories) ? p.categories.join(' ').toLowerCase() : '';
      return searchTerms.some(term => name.includes(term) || brand.includes(term) || categories.includes(term));
    });

    return filtered.map(p => {
      const item = p.items && p.items[0] ? p.items[0] : {};
      const seller = item.sellers && item.sellers[0] ? item.sellers[0] : {};
      const offer = seller.commertialOffer || {};

      const price = offer.Price || 0;
      const listPrice = offer.ListPrice && offer.ListPrice > price ? offer.ListPrice : null;
      const discount = listPrice ? Math.round(((listPrice - price) / listPrice) * 100) : null;

      let promotionText = discount && discount > 0 ? `${discount}% OFF` : null;
      if (Array.isArray(offer.Teasers) && offer.Teasers.length > 0 && offer.Teasers[0].name) {
        promotionText = offer.Teasers[0].name;
      }

      // Barcode / EAN
      const ean = (item.ean && item.ean !== '0' && item.ean.length >= 7) ? String(item.ean).trim() : null;

      // Image
      const image = item.images && item.images[0] ? item.images[0].imageUrl : '';

      return {
        id: `dia_${p.productId || item.itemId}`,
        store: 'Día%',
        storeId: 'dia',
        branch: 'Día Online',
        title: (p.productName || '').trim(),
        brand: (p.brand || '').trim(),
        price: Math.round(price * 100) / 100,
        originalPrice: listPrice ? Math.round(listPrice * 100) / 100 : null,
        discountPercent: discount && discount > 0 ? discount : null,
        promotionText: promotionText,
        ean: ean,
        image: image,
        available: (offer.AvailableQuantity === undefined || offer.AvailableQuantity > 0),
        url: p.link ? (p.link.startsWith('http') ? p.link : `https://diaonline.supermercadosdia.com.ar${p.link}`) : 'https://diaonline.supermercadosdia.com.ar/'
      };
    });
  } catch (error) {
    console.error('[Día] Fallo de búsqueda:', error.message);
    return [];
  }
}
