/**
 * Supermercados Día% Scraper (Día Online)
 * https://diaonline.supermercadosdia.com.ar/
 */

import { cleanNorm, getWordVariations } from './catalogEngine.js';

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'sin', 'en',
  'para', 'por', 'y', 'o', 'al', 'x', 'gr', 'grs', 'g', 'kg', 'ml', 'cc', 'l', 'lt', 'lts'
]);

export async function searchDia(searchTerm) {
  try {
    const rawClean = cleanNorm(searchTerm);
    if (!rawClean) return [];

    // VTEX Catalog System Search Endpoint
    const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search?ft=${encodeURIComponent(rawClean)}&_from=0&_to=35`;

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

    // Filter using accent-normalized tokens & variations
    const rawWords = rawClean.split(/\s+/).filter(w => w.length > 0);
    const searchWords = rawWords.filter(w => w.length > 1 && !STOP_WORDS.has(w));
    const finalWords = searchWords.length > 0 ? searchWords : rawWords;

    const wordGroups = finalWords.map(w => ({
      original: w,
      variations: getWordVariations(w)
    }));

    const filtered = rawProducts.filter(p => {
      const name = cleanNorm(p.productName);
      const brand = cleanNorm(p.brand);
      const categories = Array.isArray(p.categories) ? cleanNorm(p.categories.join(' ')) : '';

      return wordGroups.some(wg => {
        return wg.variations.some(v => name.includes(v) || brand.includes(v) || categories.includes(v));
      });
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
