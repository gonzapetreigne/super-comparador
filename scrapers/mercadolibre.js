/**
 * Mercado Libre Scraper (Supermercado / Envíos Full)
 * https://www.mercadolibre.com.ar/supermercado
 */

let meliTokenCache = { token: null, expiresAt: 0 };

async function getMeliAccessToken() {
  if (process.env.MELI_ACCESS_TOKEN) return process.env.MELI_ACCESS_TOKEN;
  if (!process.env.MELI_CLIENT_ID || !process.env.MELI_CLIENT_SECRET) return null;

  if (meliTokenCache.token && Date.now() < meliTokenCache.expiresAt) {
    return meliTokenCache.token;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MELI_CLIENT_ID,
      client_secret: process.env.MELI_CLIENT_SECRET
    });
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    if (!res.ok) {
      console.warn('[Mercado Libre OAuth] Error obteniendo token:', res.status);
      return null;
    }
    const data = await res.json();
    meliTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + ((data.expires_in || 21600) - 300) * 1000
    };
    return meliTokenCache.token;
  } catch (err) {
    console.error('[Mercado Libre OAuth] Fallo:', err.message);
    return null;
  }
}

function slugify(term) {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function searchMercadoLibre(searchTerm) {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const slug = slugify(searchTerm);
  if (!slug) return [];

  try {
    // 1. Primary Strategy: Fast Search Crawler (Bypasses Akamai Bot Protection in ~1-1.5s)
    try {
      const targetUrl = `https://listado.mercadolibre.com.ar/${slug}`;
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(4500)
      });

      if (response.ok) {
        const finalUrl = response.url || '';
        const html = await response.text();
        if (!finalUrl.includes('account-verification') && !html.includes('account-verification') && !html.includes('px-captcha')) {
          const prods = parseMeliHtml(html, searchTerm);
          if (prods.length > 0) return prods;
        }
      }
    } catch (crawlerErr) {
      console.warn('[Mercado Libre Crawler] Intento crawler falló o timeout:', crawlerErr.message);
    }

    // 2. Secondary Strategy: ScraperAPI Proxy (if API key is present)
    if (process.env.SCRAPER_API_KEY) {
      try {
        const targetUrl = `https://listado.mercadolibre.com.ar/${slug}`;
        const scraperUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&device_type=desktop`;
        
        const response = await fetch(scraperUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-AR,es;q=0.9'
          },
          signal: AbortSignal.timeout(4500)
        });

        if (response.ok) {
          const html = await response.text();
          const prods = parseMeliHtml(html, searchTerm);
          if (prods.length > 0) return prods;
        }
      } catch (scraperErr) {
        console.warn('[Mercado Libre ScraperAPI] Timeout o error:', scraperErr.message);
      }
    }

    // 3. Tertiary Strategy: Official authenticated API if credentials are provided
    const token = await getMeliAccessToken();
    if (token) {
      try {
        const apiUrl = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(searchTerm)}&category=MLA1403&limit=50`;
        const apiRes = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(4000)
        });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const items = apiData.results || [];
          const apiProducts = items.map(item => {
            const brandAttr = (item.attributes || []).find(a => a.id === 'BRAND');
            const isFull = item.shipping?.logistic_type === 'fulfillment';
            return {
              id: `meli_${item.id}`,
              store: 'Mercado Libre',
              storeId: 'mercadolibre',
              branch: 'Full Súper ⚡',
              title: item.title,
              brand: brandAttr ? brandAttr.value_name.toUpperCase() : '',
              price: item.price,
              originalPrice: item.original_price || null,
              discountPercent: item.original_price && item.original_price > item.price
                ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
                : null,
              promotionText: isFull ? 'Envío Full ⚡' : 'Mercado Libre',
              ean: null,
              image: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : '',
              available: true,
              isFull: isFull,
              url: item.permalink
            };
          });
          if (apiProducts.length > 0) return apiProducts;
        }
      } catch (apiErr) {
        console.warn('[Mercado Libre API] Error al consultar API, intentando scraping:', apiErr.message);
      }
    }

    // 4. Fallback to direct HTML Scraping (standard desktop user agent)
    const targetUrl = `https://listado.mercadolibre.com.ar/${slug}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      console.warn(`[Mercado Libre] Error HTTP ${response.status}`);
      return [];
    }

    const finalUrl = response.url || '';
    const html = await response.text();

    // Detect Akamai bot checkpoint redirection
    if (finalUrl.includes('account-verification') || html.includes('account-verification') || html.includes('px-captcha')) {
      console.warn('[Mercado Libre] Solicitud redirigida a verificación de cuenta / anti-bot.');
      const emptyBlocked = [];
      emptyBlocked.blockedByBot = true;
      return emptyBlocked;
    }

    return parseMeliHtml(html, searchTerm);
  } catch (error) {
    console.error('[Mercado Libre] Fallo de búsqueda:', error.message);
    return [];
  }
}

function parseMeliHtml(html, searchTerm) {
  // Extract individual product items from the search layout
  const itemRegex = /<li[^>]*class="[^"]*ui-search-layout__item[^"]*"[\s\S]*?<\/li>/gi;
  const rawItems = [...html.matchAll(itemRegex)].map(m => m[0]);

  const products = [];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    // Skip promotional intervention banners
    if (item.includes('ui-search-layout__item--intervention')) continue;

    // Title
    const titleMatch = item.match(/class="[^"]*(?:poly-component__title|ui-search-item__title)[^"]*"[^>]*>(?:<a[^>]*>)?([^<]+)/i)
      || item.match(/<h2[^>]*class="[^"]*ui-search-item__title[^"]*"[^>]*>([^<]+)<\/h2>/i)
      || item.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // Product link (must be a real URL, ignore fragment links)
    const urlMatch = item.match(/href="([^"]*mercadolibre\.com\.ar\/[^"]+)"/i)
      || item.match(/href="([^"#][^"]*)"/i);
    const link = urlMatch ? urlMatch[1].replace(/&amp;/g, '&') : 'https://www.mercadolibre.com.ar/supermercado';

    // Original price if on sale
    const origPriceMatch = item.match(/andes-money-amount--previous[\s\S]*?class="andes-money-amount__fraction"[^>]*>([^<]+)/i);
    const originalPrice = origPriceMatch ? parseFloat(origPriceMatch[1].replace(/\./g, '').replace(/,/g, '.')) : null;

    // Current price
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

    // Brand detection
    const cleanTitle = title.replace(/^(?:combo|pack\s*x\s*\d+|oferta!?\s*)?/i, '').trim();
    const withoutCat = cleanTitle
      .replace(/^(?:yerba\s+mate|yerba|aceite\s+de\s+girasol|aceite\s+de\s+oliva|aceite|leche\s+entera|leche\s+descremada|leche|fideos|arroz|galletitas|vino|cerveza|detergente|jabon|pure\s+de\s+tomate|harina)\s+/i, '')
      .replace(/^(?:de\s+la|de\s+los|de\s+campo\s+|de\s+|del\s+|la\s+|el\s+|los\s+|las\s+)/i, '')
      .trim();
    const words = withoutCat.split(/\s+/);
    const brand = words.length > 0 && words[0].length >= 3 ? words[0].toUpperCase() : '';

    const isFull = item.includes('andes-badge--shipping') || item.includes('Envío Full') || item.includes('ui-search-item__shipping--full') || item.includes('full') || item.includes('⚡');

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
      promotionText: isFull ? ('Envío Full ⚡' + (discountPercent ? ` (${discountPercent}% OFF)` : '')) : (discountPercent ? `${discountPercent}% OFF` : null),
      ean: null,
      image: image,
      available: true,
      isFull: isFull,
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
}
