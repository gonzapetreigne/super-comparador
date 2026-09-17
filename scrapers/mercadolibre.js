/**
 * Mercado Libre Scraper (Supermercado / Envíos Full)
 * https://www.mercadolibre.com.ar/supermercado
 */

export async function searchMercadoLibre(searchTerm) {
  try {
    const url = `https://listado.mercadolibre.com.ar/alimentos-bebidas/${encodeURIComponent(searchTerm)}_Envio_Full`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9'
      },
      signal: AbortSignal.timeout(9000)
    });

    if (!response.ok) {
      console.warn(`[Mercado Libre] Error HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Extract individual product items from the search layout
    const itemRegex = /<li[^>]*class="[^"]*ui-search-layout__item[^"]*"[\s\S]*?<\/li>/gi;
    const rawItems = [...html.matchAll(itemRegex)].map(m => m[0]);

    const products = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];

      // Title
      const titleMatch = item.match(/class="[^"]*(?:poly-component__title|ui-search-item__title)[^"]*"[^>]*>(?:<a[^>]*>)?([^<]+)/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();

      // Product link
      const urlMatch = item.match(/href="([^"]+)"/i);
      const link = urlMatch ? urlMatch[1].replace(/&amp;/g, '&') : 'https://www.mercadolibre.com.ar/supermercado';

      // Original price if on sale (marked with andes-money-amount--previous)
      const origPriceMatch = item.match(/andes-money-amount--previous[\s\S]*?class="andes-money-amount__fraction"[^>]*>([^<]+)/i);
      const originalPrice = origPriceMatch ? parseFloat(origPriceMatch[1].replace(/\./g, '').replace(/,/g, '.')) : null;

      // Current price (must not match previous price)
      let price = null;
      const currentPriceMatch = item.match(/class="[^"]*poly-price__current[^"]*"[\s\S]*?class="andes-money-amount__fraction"[^>]*>([^<]+)/i);
      if (currentPriceMatch) {
        price = parseFloat(currentPriceMatch[1].replace(/\./g, '').replace(/,/g, '.'));
      } else {
        const allPrices = [...item.matchAll(/class="andes-money-amount\s*([^"]*)"[\s\S]*?class="andes-money-amount__fraction"[^>]*>([^<]+)/gi)];
        const nonPrev = allPrices.find(p => !p[1].includes('andes-money-amount--previous'));
        if (nonPrev) {
          price = parseFloat(nonPrev[2].replace(/\./g, '').replace(/,/g, '.'));
        }
      }
      if (!price || isNaN(price) || price <= 0) continue;

      // Discount percentage
      const discountMatch = item.match(/class="[^"]*(?:poly-price__discount|andes-money-amount__discount|ui-search-price__discount)[^"]*"[^>]*>([^<%]+)%/i);
      const discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : (originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null);

      // Image URL
      const imgMatch = item.match(/(?:data-src|src)="([^"]*mlstatic\.com[^"]*)"/i);
      const image = imgMatch ? imgMatch[1] : '';

      // ID from link or index
      const idMatch = link.match(/MLA-?(\d+)/i) || link.match(/\/p\/(MLA\d+)/i);
      const productId = idMatch ? idMatch[1] : `meli_${i}`;

      // Detect brand from title (strip common category words so "Yerba Mate Playadito" yields brand "PLAYADITO")
      const cleanTitle = title.replace(/^(?:combo|pack\s*x\s*\d+|oferta!?\s*)?/i, '').trim();
      const withoutCat = cleanTitle
        .replace(/^(?:yerba\s+mate|yerba|aceite\s+de\s+girasol|aceite\s+de\s+oliva|aceite|leche\s+entera|leche\s+descremada|leche|fideos|arroz|galletitas|vino|cerveza|detergente|jabon|pure\s+de\s+tomate|harina)\s+/i, '')
        .replace(/^(?:de\s+la|de\s+los|de\s+campo\s+|de\s+|del\s+|la\s+|el\s+|los\s+|las\s+)/i, '')
        .trim();
      const words = withoutCat.split(/\s+/);
      const brand = words.length > 0 && words[0].length >= 3 ? words[0].toUpperCase() : '';

      products.push({
        id: `meli_${productId}`,
        store: 'Mercado Libre',
        storeId: 'mercadolibre',
        branch: 'Full Súper ⚡',
        title: title,
        brand: brand,
        price: Math.round(price * 100) / 100,
        originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : null,
        discountPercent: discountPercent,
        promotionText: 'Envío Full ⚡' + (discountPercent ? ` (${discountPercent}% OFF)` : ''),
        ean: null,
        image: image,
        available: true,
        isFull: true,
        url: link
      });
    }

    // Filter products by query relevance
    const stopWords = new Set(['de', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'con', 'sin', 'en', 'para', 'por', 'del', 'al', 'y', 'o']);
    const queryTokens = searchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    if (queryTokens.length > 0) {
      return products.filter(p => {
        const titleNorm = p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return queryTokens.some(tok => titleNorm.includes(tok));
      });
    }

    return products;
  } catch (error) {
    console.error('[Mercado Libre] Fallo de búsqueda:', error.message);
    return [];
  }
}
