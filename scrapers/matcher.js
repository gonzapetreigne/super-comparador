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
    .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2') // split 1kg -> 1 kg, 500g -> 500 g
    .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')    // remove punctuation
    .replace(/\s+/g, ' ')            // normalize whitespace
    .trim();
}

function isKitOrCombo(title) {
  const str = cleanString(title);
  return str.includes('kit') || str.includes('combo') || str.includes('bombilla') || str.includes('lata yerbera') || str.includes('termo');
}

// Extract measure/quantity from product title (e.g. "1kg", "900 ml", "1.5 l", "500gr", "pack x 10", "x 36 unidades")
function extractQuantity(title) {
  if (!title) return null;
  const str = title.toLowerCase().replace(/,/g, '.');

  // Multi-pack detection (e.g. "pack x 6", "pack de 12", "combo x 2", "pack de 3")
  let multiplier = 1;
  const packMatch = str.match(/\b(?:pack|combo|promo)\s*(?:de|x)?\s*(\d+)\b/i) ||
                    str.match(/\b(\d+)\s*(?:pack|unidades\s*x|latas\s*x|botellas\s*x)\b/i);
  if (packMatch) {
    const pVal = parseInt(packMatch[1], 10);
    if (pVal > 1 && pVal <= 48) multiplier = pVal;
  }

  // Match liters (e.g. 1.5l, 1l, 500ml, 750 cc)
  const mlMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ml|cc)\b/);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1]) * multiplier;
    return { value: val, unit: 'ml', standardUnit: 'l', standardRatio: val / 1000, isPack: multiplier > 1, multiplier };
  }

  const lMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|lts|litro|litros)\b/);
  if (lMatch) {
    const val = parseFloat(lMatch[1]) * multiplier;
    return { value: val, unit: 'l', standardUnit: 'l', standardRatio: val, isPack: multiplier > 1, multiplier };
  }

  // Match grams/kilos (e.g. 1kg, 500g, 400 grs)
  const kgMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgr|kilo|kilos|1k|2k)\b/);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1]) * multiplier;
    return { value: val, unit: 'kg', standardUnit: 'kg', standardRatio: val, isPack: multiplier > 1, multiplier };
  }

  const gMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|grs|gramos)\b/);
  if (gMatch) {
    const val = parseFloat(gMatch[1]) * multiplier;
    return { value: val, unit: 'g', standardUnit: 'kg', standardRatio: val / 1000, isPack: multiplier > 1, multiplier };
  }

  // Match count / tea bags / diapers / units:
  // e.g. "x 36 unidades", "x36u", "x36", "36 ud", "36 unidades", "25 saquitos", "50 sobres"
  const uMatch = str.match(/(?:x|\*)\s*(\d+)\s*(?:u|un|ud|unid|unidades)?\b/) ||
                 str.match(/(\d+)\s*(?:saquitos|saq|sobres|ud|unidades|unid|panales|toallitas)\b/);
  if (uMatch) {
    const count = parseInt(uMatch[1], 10);
    if (count > 0 && count < 500) {
      const val = count * (multiplier > 1 ? multiplier : 1);
      return { value: val, unit: 'ud', standardUnit: 'ud', standardRatio: val, isPack: multiplier > 1, multiplier };
    }
  }

  return null;
}

// Extract diaper size (RN, P, M, G, XG, XXG, XXXG)
function extractDiaperSize(str) {
  const s = cleanString(str);
  if (!s.includes('panal') && !s.includes('huggies') && !s.includes('pampers') && !s.includes('babysec')) return null;
  const m = s.match(/\b(rn|recien nacido|xxxg|xxg|xg|g|m|p)\b/);
  if (m) {
    let size = m[1];
    if (size === 'recien nacido') size = 'rn';
    return size;
  }
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

function matchTwoProducts(p1, p2) {
  if (isKitOrCombo(p1.title) !== isKitOrCombo(p2.title)) return false;

  const q1 = extractQuantity(p1.title);
  const q2 = extractQuantity(p2.title);
  let qtyMatch = false;
  if (q1 && q2) {
    if (q1.standardUnit !== q2.standardUnit) return false;
    if (Math.abs(q1.standardRatio - q2.standardRatio) > 0.05) return false;
    if (q1.isPack !== q2.isPack) return false;
    qtyMatch = true;
  }

  // Diaper size matching: do not match Talle M with Talle XG
  const size1 = extractDiaperSize(p1.title);
  const size2 = extractDiaperSize(p2.title);
  if (size1 && size2 && size1 !== size2) return false;

  const t1 = cleanString(p1.title);
  const t2 = cleanString(p2.title);

  // Do not mix mate cocido / saquitos with loose yerba
  const isCocido1 = t1.includes('cocido') || t1.includes('saquito') || t1.includes('sobre');
  const isCocido2 = t2.includes('cocido') || t2.includes('saquito') || t2.includes('sobre');
  if (isCocido1 !== isCocido2) return false;

  // Do not mix despalada (sin palo) with tradicional / suave (con palo)
  const isSinPalo1 = t1.includes('despalada') || t1.includes('sin palo');
  const isSinPalo2 = t2.includes('despalada') || t2.includes('sin palo');
  if (isSinPalo1 !== isSinPalo2) return false;

  // Do not mix leche descremada with leche entera
  const isDesc1 = t1.includes('descremada') || t1.includes('desnatada');
  const isDesc2 = t2.includes('descremada') || t2.includes('desnatada');
  if (isDesc1 !== isDesc2) return false;

  // Tuna: do not mix atun al natural with atun en aceite
  const isAceite1 = t1.includes('aceite');
  const isNatural1 = t1.includes('natural') || t1.includes('agua');
  const isAceite2 = t2.includes('aceite');
  const isNatural2 = t2.includes('natural') || t2.includes('agua');
  if (isAceite1 && !isNatural1 && isNatural2 && !isAceite2) return false;
  if (isNatural1 && !isAceite1 && isAceite2 && !isNatural2) return false;

  const b1 = cleanString(p1.brand);
  const b2 = cleanString(p2.brand);

  const brandMatch = (b1 && b2 && (b1.includes(b2) || b2.includes(b1))) ||
                     (b1 && t2.includes(b1)) ||
                     (b2 && t1.includes(b2)) ||
                     (!b1 && !b2);

  const full1 = t1.includes(b1) ? t1 : `${b1} ${t1}`;
  const full2 = t2.includes(b2) ? t2 : `${b2} ${t2}`;
  const sim = calculateSimilarity(full1, full2);

  const requiredSim = (brandMatch && qtyMatch) ? 0.38 : 0.50;
  return sim >= requiredSim && brandMatch;
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

  // Second pass A: Merge remaining products into existing groups from Pass 1
  const remaining = allProducts.filter(p => !visited.has(p.id));
  for (const current of remaining) {
    if (visited.has(current.id)) continue;
    for (const group of matchedGroups) {
      if (group.products.some(p => p.storeId === current.storeId)) continue;
      if (group.products.some(p => matchTwoProducts(current, p))) {
        group.products.push(current);
        visited.add(current.id);
        break;
      }
    }
  }

  // Second pass B: Group remaining unvisited products together
  const stillRemaining = allProducts.filter(p => !visited.has(p.id));
  for (let i = 0; i < stillRemaining.length; i++) {
    const current = stillRemaining[i];
    if (visited.has(current.id)) continue;

    const group = {
      id: `group_text_${current.id}`,
      matchedBy: 'text',
      ean: current.ean,
      products: [current]
    };
    visited.add(current.id);

    for (let j = i + 1; j < stillRemaining.length; j++) {
      const other = stillRemaining[j];
      if (visited.has(other.id)) continue;
      if (group.products.some(p => p.storeId === other.storeId)) continue;

      if (group.products.some(p => matchTwoProducts(other, p))) {
        group.products.push(other);
        visited.add(other.id);
      }
    }

    matchedGroups.push(group);
  }

  // Build unified comparison cards
  let cards = matchedGroups.map(group => {
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
    const validEntries = Object.entries(prices).filter(([_, info]) => info && info.price > 0 && info.available !== false);
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

  // Filter out any card that has zero available stores
  cards = cards.filter(card => card.storeCount > 0);

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
