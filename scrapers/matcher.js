/**
 * Product Matcher and Normalizer Engine
 * Groups identical products across Golópolis, Actual, Día%, and Mercado Libre (Full),
 * calculates price differences, unit prices, and suggests cheaper alternatives.
 */

// Helper to normalize strings for comparison
function cleanString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')    // remove punctuation
    .replace(/\s+/g, ' ')            // normalize whitespace
    .trim();
}

// Extract measure/quantity from product title (e.g. "1kg", "900 ml", "1.5 l", "500gr")
function extractQuantity(title) {
  if (!title) return null;
  const str = title.toLowerCase().replace(/,/g, '.');

  // Match liters (e.g. 1.5l, 1l, 500ml, 750 cc)
  const mlMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ml|cc)/);
  if (mlMatch) return { value: parseFloat(mlMatch[1]), unit: 'ml', standardUnit: 'l', standardRatio: parseFloat(mlMatch[1]) / 1000 };

  const lMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litro|litros)/);
  if (lMatch) return { value: parseFloat(lMatch[1]), unit: 'l', standardUnit: 'l', standardRatio: parseFloat(lMatch[1]) };

  // Match grams/kilos (e.g. 1kg, 500g, 400 grs)
  const gMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|grs|gramos)/);
  if (gMatch) return { value: parseFloat(gMatch[1]), unit: 'g', standardUnit: 'kg', standardRatio: parseFloat(gMatch[1]) / 1000 };

  const kgMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgr|kilo|kilos)/);
  if (kgMatch) return { value: parseFloat(kgMatch[1]), unit: 'kg', standardUnit: 'kg', standardRatio: parseFloat(kgMatch[1]) };

  return null;
}

// Calculate similarity score between two strings (tokens overlap)
function calculateSimilarity(str1, str2) {
  const words1 = cleanString(str1).split(' ').filter(w => w.length > 2);
  const words2 = cleanString(str2).split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const common = words1.filter(w => words2.includes(w));
  return (2 * common.length) / (words1.length + words2.length);
}

const STOPWORDS = new Set(['de', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'con', 'sin', 'en', 'para', 'por', 'del', 'al', 'y', 'o', 'que']);

function getTokens(str) {
  if (!str) return [];
  return cleanString(str)
    .split(' ')
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

export function matchProducts(golopolisProducts = [], actualProducts = [], diaProducts = [], meliProducts = [], query = '') {
  let allProducts = [
    ...golopolisProducts,
    ...actualProducts,
    ...diaProducts,
    ...meliProducts
  ];

  const queryTokens = getTokens(query);

  // If query is provided, discard products that do not contain any query token
  if (queryTokens.length > 0) {
    allProducts = allProducts.filter(p => {
      const fullText = cleanString(`${p.title} ${p.brand || ''}`);
      return queryTokens.some(tok => fullText.includes(tok));
    });
  }

  const matchedGroups = [];
  const visited = new Set();

  // First pass: Match by exact EAN / Barcode (when available)
  const eanMap = new Map();
  for (const prod of allProducts) {
    if (prod.ean) {
      if (!eanMap.has(prod.ean)) eanMap.set(prod.ean, []);
      eanMap.get(prod.ean).push(prod);
    }
  }

  for (const [ean, prods] of eanMap.entries()) {
    const storesRepresented = new Set(prods.map(p => p.storeId));
    if (storesRepresented.size > 1) {
      const group = {
        id: `group_ean_${ean}`,
        matchedBy: 'ean',
        ean: ean,
        products: []
      };

      for (const p of prods) {
        if (!visited.has(p.id)) {
          group.products.push(p);
          visited.add(p.id);
        }
      }

      if (group.products.length > 0) {
        matchedGroups.push(group);
      }
    }
  }

  // Second pass: Match remaining products by brand, quantity and high text similarity
  const remaining = allProducts.filter(p => !visited.has(p.id));

  for (let i = 0; i < remaining.length; i++) {
    const current = remaining[i];
    if (visited.has(current.id)) continue;

    const group = {
      id: `group_text_${current.id}`,
      matchedBy: 'text',
      ean: current.ean,
      products: [current]
    };
    visited.add(current.id);

    const currentQty = extractQuantity(current.title);

    for (let j = i + 1; j < remaining.length; j++) {
      const other = remaining[j];
      if (visited.has(other.id)) continue;
      // Must not already have a product from the same store in this group
      if (group.products.some(p => p.storeId === other.storeId)) continue;

      const otherQty = extractQuantity(other.title);
      // If both have detectable quantities, standard ratios must match closely
      if (currentQty && otherQty) {
        if (currentQty.standardUnit !== otherQty.standardUnit) continue;
        if (Math.abs(currentQty.standardRatio - otherQty.standardRatio) > 0.05) continue;
      }

      // Check brand match if present
      const brand1 = cleanString(current.brand);
      const brand2 = cleanString(other.brand);
      const brandMatch = (brand1 && brand2 && (brand1.includes(brand2) || brand2.includes(brand1))) ||
                         (!brand1 || !brand2);

      const sim = calculateSimilarity(current.title, other.title);

      if (sim >= 0.52 && brandMatch) {
        group.products.push(other);
        visited.add(other.id);
      }
    }

    matchedGroups.push(group);
  }

  // Build unified comparison cards
  const cards = matchedGroups.map(group => {
    // Pick the most descriptive title & image
    const mainProduct = group.products[0];
    const title = mainProduct.title;
    const brand = group.products.find(p => p.brand)?.brand || mainProduct.brand || '';
    const image = group.products.find(p => p.image)?.image || '';
    const qty = extractQuantity(title);

    // Map store prices
    const prices = {
      golopolis: null,
      actual: null,
      dia: null,
      mercadolibre: null
    };

    group.products.forEach(p => {
      if (!prices[p.storeId] || p.price < prices[p.storeId].price) {
        let unitPriceStr = null;
        if (qty && qty.standardRatio > 0 && p.price > 0) {
          const unitPrice = Math.round(p.price / qty.standardRatio);
          unitPriceStr = `$${unitPrice.toLocaleString('es-AR')} / ${qty.standardUnit}`;
        }

        prices[p.storeId] = {
          productId: p.id,
          store: p.store,
          branch: p.branch,
          title: p.title,
          price: p.price,
          originalPrice: p.originalPrice,
          discountPercent: p.discountPercent,
          promotionText: p.promotionText,
          unitPriceText: unitPriceStr,
          available: p.available,
          url: p.url,
          image: p.image,
          isFull: p.isFull || false
        };
      }
    });

    // Determine cheapest store among available prices
    const validEntries = Object.entries(prices).filter(([_, info]) => info && info.price > 0);
    validEntries.sort((a, b) => a[1].price - b[1].price);

    const minPrice = validEntries.length > 0 ? validEntries[0][1].price : 0;
    const maxPrice = validEntries.length > 0 ? validEntries[validEntries.length - 1][1].price : 0;
    const cheapestStoreId = validEntries.length > 0 ? validEntries[0][0] : null;
    const diffAmount = maxPrice - minPrice;
    const diffPercent = minPrice > 0 ? Math.round((diffAmount / minPrice) * 100) : 0;

    // Calculate relevance score: how many query tokens match this card's title/brand
    let relevanceScore = 0;
    if (queryTokens.length > 0) {
      const cardText = cleanString(`${title} ${brand}`);
      for (const tok of queryTokens) {
        if (cardText.includes(tok)) relevanceScore++;
      }
    }

    return {
      id: group.id,
      title: title,
      brand: brand,
      image: image,
      ean: group.ean,
      quantityInfo: qty ? `${qty.value} ${qty.unit}` : null,
      prices: prices,
      storeCount: validEntries.length,
      cheapestStore: cheapestStoreId,
      minPrice: minPrice,
      maxPrice: maxPrice,
      diffAmount: Math.round(diffAmount * 100) / 100,
      diffPercent: diffPercent,
      relevanceScore: relevanceScore,
      cheaperAlternatives: []
    };
  });

  // Calculate cheaper alternatives for cards that are missing stores or have higher prices
  for (const card of cards) {
    if (card.minPrice > 0) {
      const candidates = cards.filter(other =>
        other.id !== card.id &&
        other.minPrice < card.minPrice &&
        calculateSimilarity(card.title, other.title) >= 0.3
      );
      candidates.sort((a, b) => a.minPrice - b.minPrice);
      card.cheaperAlternatives = candidates.slice(0, 2).map(c => ({
        id: c.id,
        title: c.title,
        brand: c.brand,
        minPrice: c.minPrice,
        cheapestStore: c.cheapestStore,
        savingAmount: Math.round((card.minPrice - c.minPrice) * 100) / 100
      }));
    }
  }

  // Sort cards:
  // 1. Higher relevance score (matches more search tokens)
  // 2. More stores compared (best side-by-side comparison)
  // 3. Largest saving difference percentage
  // 4. Lowest minimum price
  cards.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (b.storeCount !== a.storeCount) return b.storeCount - a.storeCount;
    if (b.diffPercent !== a.diffPercent) return b.diffPercent - a.diffPercent;
    return a.minPrice - b.minPrice;
  });

  return {
    cards,
    totalCards: cards.length,
    counts: {
      golopolis: golopolisProducts.length,
      actual: actualProducts.length,
      dia: diaProducts.length,
      mercadolibre: meliProducts.length
    }
  };
}
