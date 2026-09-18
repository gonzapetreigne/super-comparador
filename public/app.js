/**
 * Súper Comparador Las Flores - Frontend Application Logic
 */

// Global State
const state = {
  activeTab: 'search',
  currentResults: [],
  cart: [],
  savedLists: [],
  promos: {
    cuentaDni: false,
    clubDia: false,
    meliFull: true
  }
};

// Format currency ARS
function formatMoney(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  return '$' + Math.round(amount).toLocaleString('es-AR');
}

// Calculate effective price taking promos into account
function getEffectivePrice(storeId, itemPrice) {
  if (!itemPrice || itemPrice <= 0) return 0;
  let finalPrice = itemPrice;

  // If Cuenta DNI is active: 20% discount on supermarkets
  if (state.promos.cuentaDni) {
    if (storeId === 'golopolis' || storeId === 'actual' || storeId === 'dia') {
      finalPrice = finalPrice * 0.8;
    }
  }

  return Math.round(finalPrice * 100) / 100;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadSavedData();
  setupEventListeners();
  updateCartBadge();
});

// Load cart and saved lists from localStorage
function loadSavedData() {
  try {
    const storedCart = localStorage.getItem('super_cart_v1');
    if (storedCart) {
      state.cart = JSON.parse(storedCart);
    }
    const storedLists = localStorage.getItem('super_lists_v1');
    if (storedLists) {
      state.savedLists = JSON.parse(storedLists);
    }
    const storedPromos = localStorage.getItem('super_promos_v1');
    if (storedPromos) {
      state.promos = { ...state.promos, ...JSON.parse(storedPromos) };
      document.getElementById('toggleDNI').checked = state.promos.cuentaDni;
      document.getElementById('toggleClubDia').checked = state.promos.clubDia;
      document.getElementById('toggleMeliFull').checked = state.promos.meliFull;
    }
  } catch (e) {
    console.error('Error cargando datos locales:', e);
  }
}

function saveCart() {
  localStorage.setItem('super_cart_v1', JSON.stringify(state.cart));
  updateCartBadge();
  if (state.activeTab === 'cart') {
    renderCart();
  }
}

function saveLists() {
  localStorage.setItem('super_lists_v1', JSON.stringify(state.savedLists));
  renderSavedLists();
}

function savePromos() {
  localStorage.setItem('super_promos_v1', JSON.stringify(state.promos));
  if (state.currentResults.length > 0) {
    renderCards(state.currentResults);
  }
  if (state.activeTab === 'cart') {
    renderCart();
  }
}

// Event Listeners setup
function setupEventListeners() {
  // Search Form
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  });

  searchInput.addEventListener('input', () => {
    if (searchInput.value.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  });

  const resetToHome = () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    state.currentResults = [];
    document.getElementById('resultsContainer').innerHTML = '';
    document.getElementById('searchStatsBar').classList.add('hidden');
    document.getElementById('noResultsState').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
    const heroBanner = document.getElementById('heroBannerCard');
    if (heroBanner) heroBanner.classList.remove('hidden');
    switchTab('search');
  };

  clearBtn.addEventListener('click', () => {
    resetToHome();
    searchInput.focus();
  });

  const headerHomeBtn = document.getElementById('headerHomeBtn');
  if (headerHomeBtn) {
    headerHomeBtn.addEventListener('click', resetToHome);
  }

  // Quick Chips
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const term = chip.getAttribute('data-term');
      searchInput.value = term;
      clearBtn.classList.remove('hidden');
      performSearch(term);
    });
  });

  // Promo Toggles
  document.getElementById('toggleDNI').addEventListener('change', (e) => {
    state.promos.cuentaDni = e.target.checked;
    savePromos();
  });
  document.getElementById('toggleClubDia').addEventListener('change', (e) => {
    state.promos.clubDia = e.target.checked;
    savePromos();
  });
  document.getElementById('toggleMeliFull').addEventListener('change', (e) => {
    state.promos.meliFull = e.target.checked;
    savePromos();
  });

  // Cart actions
  document.getElementById('clearCartBtn').addEventListener('click', () => {
    if (state.cart.length === 0) return;
    if (confirm('¿Deseas vaciar todos los productos de tu canasta?')) {
      state.cart = [];
      saveCart();
    }
  });

  // Save list modal
  const saveListModal = document.getElementById('saveListModal');
  const listNameInput = document.getElementById('listNameInput');

  document.getElementById('saveListModalBtn').addEventListener('click', () => {
    if (state.cart.length === 0) return;
    listNameInput.value = `Lista del ${new Date().toLocaleDateString('es-AR')}`;
    saveListModal.classList.remove('hidden');
    listNameInput.focus();
  });

  document.getElementById('cancelSaveListBtn').addEventListener('click', () => {
    saveListModal.classList.add('hidden');
  });

  document.getElementById('confirmSaveListBtn').addEventListener('click', () => {
    const name = listNameInput.value.trim() || 'Mi Lista';
    state.savedLists.unshift({
      id: 'list_' + Date.now(),
      name: name,
      date: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
      items: JSON.parse(JSON.stringify(state.cart))
    });
    saveLists();
    saveListModal.classList.add('hidden');
    alert(`¡Lista "${name}" guardada con éxito!`);
  });

  // WhatsApp Share
  document.getElementById('shareWhatsAppBtn').addEventListener('click', shareListWhatsApp);
}

// Perform Live Search
async function performSearch(query) {
  switchTab('search');
  
  const heroBanner = document.getElementById('heroBannerCard');
  if (heroBanner) heroBanner.classList.add('hidden');

  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const resultsContainer = document.getElementById('resultsContainer');
  const noResultsState = document.getElementById('noResultsState');
  const statsBar = document.getElementById('searchStatsBar');

  emptyState.classList.add('hidden');
  noResultsState.classList.add('hidden');
  resultsContainer.innerHTML = '';
  loadingState.classList.remove('hidden');
  statsBar.classList.add('hidden');

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    loadingState.classList.add('hidden');

    if (!res.ok) {
      alert(data.error || 'Error al buscar');
      emptyState.classList.remove('hidden');
      if (heroBanner) heroBanner.classList.remove('hidden');
      return;
    }

    state.currentResults = data.cards || [];

    // Update Stats Bar
    statsBar.classList.remove('hidden');
    document.getElementById('totalCardsCount').textContent = data.totalCards;
    document.getElementById('queryLabel').textContent = query;
    document.getElementById('elapsedTimeBadge').textContent = `${(data.elapsedMs / 1000).toFixed(1)}s`;

    document.getElementById('countGolo').textContent = data.counts?.golopolis || 0;
    document.getElementById('countActual').textContent = data.counts?.actual || 0;
    document.getElementById('countDia').textContent = data.counts?.dia || 0;

    const meliStoreInfo = data.stores?.mercadolibre;
    const countMeliEl = document.getElementById('countMeli');
    const meliNotice = document.getElementById('meliCloudNotice');

    if (meliStoreInfo?.blockedByBot) {
      countMeliEl.innerHTML = '<span class="text-amber-600 font-bold" title="Bloqueado por firewall en la nube">0 ⚠️</span>';
      if (meliNotice) {
        meliNotice.classList.remove('hidden');
        const meliDirectLink = document.getElementById('meliDirectLink');
        if (meliDirectLink) {
          meliDirectLink.href = `https://listado.mercadolibre.com.ar/alimentos-bebidas/${encodeURIComponent(query)}_Envio_Full`;
        }
      }
    } else {
      countMeliEl.textContent = data.counts?.mercadolibre || 0;
      if (meliNotice) {
        meliNotice.classList.add('hidden');
      }
    }

    if (state.currentResults.length === 0) {
      noResultsState.classList.remove('hidden');
    } else {
      renderCards(state.currentResults);
    }
  } catch (err) {
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    if (heroBanner) heroBanner.classList.remove('hidden');
    alert('Fallo de conexión al consultar las tiendas.');
  }
}

// Render Comparison Cards
function renderCards(cards) {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = '';

  cards.forEach(card => {
    // Determine active stores based on settings (e.g. Meli Full toggle)
    const stores = [
      { id: 'golopolis', name: 'Golópolis', branch: 'Las Flores', color: 'orange', data: card.prices.golopolis },
      { id: 'actual', name: 'Actual', branch: 'Las Flores', color: 'sky', data: card.prices.actual },
      { id: 'dia', name: 'Día%', branch: 'Online', color: 'red', data: card.prices.dia },
      { id: 'mercadolibre', name: 'Mercado Libre', branch: 'Full ⚡', color: 'amber', data: state.promos.meliFull ? card.prices.mercadolibre : null }
    ];

    // Recalculate cheapest with current promo rules
    const availableStores = stores
      .filter(s => s.data && s.data.price > 0)
      .map(s => ({
        ...s,
        effectivePrice: getEffectivePrice(s.id, s.data.price)
      }))
      .sort((a, b) => a.effectivePrice - b.effectivePrice);

    const cheapest = availableStores.length > 0 ? availableStores[0] : null;
    const highest = availableStores.length > 1 ? availableStores[availableStores.length - 1] : null;
    const savingPercent = (cheapest && highest && highest.effectivePrice > cheapest.effectivePrice)
      ? Math.round(((highest.effectivePrice - cheapest.effectivePrice) / highest.effectivePrice) * 100)
      : null;

    // Check if card is in cart
    const inCartItem = state.cart.find(c => c.id === card.id);
    const cartQty = inCartItem ? inCartItem.quantity : 0;

    const cardEl = document.createElement('div');
    cardEl.className = 'bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm transition hover:shadow-md';

    // Store comparison pills HTML
    const storePillsHtml = stores.map(store => {
      const p = store.data;
      if (!p || p.price <= 0) {
        return `
          <div class="p-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col justify-between opacity-60 text-center">
            <span class="text-[10px] font-bold text-slate-500">${store.name}</span>
            <span class="text-xs text-slate-400 my-1.5 font-medium">No disponible</span>
            <span class="text-[9px] text-slate-300">-</span>
          </div>
        `;
      }

      const effPrice = getEffectivePrice(store.id, p.price);
      const isWinner = cheapest && cheapest.id === store.id && availableStores.length > 1;

      return `
        <div class="p-2 rounded-xl border ${isWinner ? 'border-emerald-500 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-slate-50/40'} flex flex-col justify-between transition">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-extrabold ${isWinner ? 'text-emerald-800' : 'text-slate-700'}">${store.name}</span>
            ${isWinner ? '<span class="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-full">MEJOR</span>' : ''}
          </div>
          
          <div class="my-1">
            <div class="text-sm font-black ${isWinner ? 'text-emerald-700 font-black' : 'text-slate-900'}">
              ${formatMoney(effPrice)}
            </div>
            ${p.originalPrice && p.originalPrice > p.price ? `
              <div class="text-[10px] text-slate-400 line-through">${formatMoney(p.originalPrice)}</div>
            ` : (state.promos.cuentaDni && store.id !== 'mercadolibre' ? `
              <div class="text-[10px] text-slate-400 line-through">${formatMoney(p.price)}</div>
            ` : '')}
          </div>

          <div class="text-[10px] text-slate-500 truncate">
            ${p.unitPriceText || store.branch}
          </div>
        </div>
      `;
    }).join('');

    // Cheaper alternatives HTML
    let alternativesHtml = '';
    if (card.cheaperAlternatives && card.cheaperAlternatives.length > 0) {
      alternativesHtml = `
        <div class="mt-2.5 pt-2.5 border-t border-slate-100">
          <div class="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1.5">
            <span>💡</span> Alternativas más económicas en esta búsqueda:
          </div>
          <div class="space-y-1">
            ${card.cheaperAlternatives.map(alt => `
              <div class="text-[11px] bg-amber-50/80 border border-amber-200/70 rounded-lg px-2 py-1 flex items-center justify-between">
                <span class="text-slate-700 font-medium truncate mr-2">${alt.title}</span>
                <span class="text-emerald-700 font-bold shrink-0">${formatMoney(alt.minPrice)} (ahorras ${formatMoney(alt.savingAmount)})</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    cardEl.innerHTML = `
      <div class="flex gap-3">
        <!-- Thumbnail -->
        <div class="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200/60 flex items-center justify-center">
          ${card.image ? `
            <img src="${card.image}" alt="${card.title}" class="w-full h-full object-contain p-1" onerror="this.src='/icon.svg'"/>
          ` : `
            <span class="text-2xl">📦</span>
          `}
        </div>

        <!-- Title and Badges -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
            ${card.brand ? `<span class="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase">${card.brand}</span>` : ''}
            ${savingPercent && savingPercent > 0 ? `
              <span class="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-0.5">
                <span>🔥</span> Ahorro del ${savingPercent}%
              </span>
            ` : ''}
            ${card.quantityInfo ? `<span class="text-[10px] text-slate-400 font-medium">${card.quantityInfo}</span>` : ''}
          </div>
          <h3 class="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">${card.title}</h3>
        </div>
      </div>

      <!-- Grid de las 4 tiendas -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        ${storePillsHtml}
      </div>

      <!-- Alternativas -->
      ${alternativesHtml}

      <!-- Botón Agregar a Canasta -->
      <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <div class="text-xs text-slate-500 font-medium">
          ${cheapest ? `Mejor opción: <strong class="text-slate-800">${cheapest.name}</strong>` : ''}
        </div>

        <div>
          ${cartQty > 0 ? `
            <div class="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-2 py-1">
              <button onclick="changeCartItemQty('${card.id}', -1)" class="w-6 h-6 rounded-lg bg-white border border-brand-300 text-brand-700 font-black text-xs hover:bg-brand-100 transition active:scale-95">-</button>
              <span class="text-xs font-black text-brand-900 px-1">${cartQty}</span>
              <button onclick="changeCartItemQty('${card.id}', 1)" class="w-6 h-6 rounded-lg bg-white border border-brand-300 text-brand-700 font-black text-xs hover:bg-brand-100 transition active:scale-95">+</button>
            </div>
          ` : `
            <button onclick="addToCart('${card.id}')" class="bg-slate-900 hover:bg-brand-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5">
              <span>+</span>
              <span>Agregar a canasta</span>
            </button>
          `}
        </div>
      </div>
    `;

    container.appendChild(cardEl);
  });
}

// Add Item to Cart
function addToCart(cardId) {
  const card = state.currentResults.find(c => c.id === cardId);
  if (!card) return;

  const existing = state.cart.find(c => c.id === cardId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: card.id,
      title: card.title,
      brand: card.brand,
      image: card.image,
      quantity: 1,
      prices: card.prices
    });
  }

  saveCart();
  renderCards(state.currentResults);
}

// Change Quantity in Cart
function changeCartItemQty(cardId, delta) {
  const item = state.cart.find(c => c.id === cardId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(c => c.id !== cardId);
  }

  saveCart();
  if (state.currentResults.length > 0) {
    renderCards(state.currentResults);
  }
}

// Update Cart Badge in Navigation
function updateCartBadge() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('navCartBadge');
  if (totalItems > 0) {
    badge.textContent = totalItems > 99 ? '99+' : totalItems;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// Render Cart View
function renderCart() {
  const emptyState = document.getElementById('cartEmptyState');
  const filledContent = document.getElementById('cartFilledContent');
  const itemsList = document.getElementById('cartItemsList');

  if (state.cart.length === 0) {
    emptyState.classList.remove('hidden');
    filledContent.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  filledContent.classList.remove('hidden');
  itemsList.innerHTML = '';

  const totalItemCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  document.getElementById('cartItemsBadge').textContent = `${totalItemCount} ${totalItemCount === 1 ? 'producto' : 'productos'}`;

  // Store Totals Variables
  let totalGolo = 0, goloCount = 0;
  let totalActual = 0, actualCount = 0;
  let totalDia = 0, diaCount = 0;
  let totalMeli = 0, meliCount = 0;

  // Split Optimal Totals
  let optimalTotal = 0;
  const splitItems = {
    golopolis: { name: 'Golópolis', count: 0, total: 0, items: [] },
    actual: { name: 'Actual', count: 0, total: 0, items: [] },
    dia: { name: 'Día%', count: 0, total: 0, items: [] },
    mercadolibre: { name: 'Mercado Libre', count: 0, total: 0, items: [] }
  };

  state.cart.forEach(item => {
    const qty = item.quantity;

    // Prices
    const pGolo = item.prices.golopolis?.price ? getEffectivePrice('golopolis', item.prices.golopolis.price) : null;
    const pAct = item.prices.actual?.price ? getEffectivePrice('actual', item.prices.actual.price) : null;
    const pDia = item.prices.dia?.price ? getEffectivePrice('dia', item.prices.dia.price) : null;
    const pMeli = (state.promos.meliFull && item.prices.mercadolibre?.price) ? getEffectivePrice('mercadolibre', item.prices.mercadolibre.price) : null;

    if (pGolo) { totalGolo += pGolo * qty; goloCount++; }
    if (pAct) { totalActual += pAct * qty; actualCount++; }
    if (pDia) { totalDia += pDia * qty; diaCount++; }
    if (pMeli) { totalMeli += pMeli * qty; meliCount++; }

    // Find best price for this item
    const options = [
      { id: 'golopolis', price: pGolo },
      { id: 'actual', price: pAct },
      { id: 'dia', price: pDia },
      { id: 'mercadolibre', price: pMeli }
    ].filter(o => o.price !== null && o.price > 0);

    options.sort((a, b) => a.price - b.price);

    const best = options.length > 0 ? options[0] : null;
    if (best) {
      optimalTotal += best.price * qty;
      splitItems[best.id].count += qty;
      splitItems[best.id].total += best.price * qty;
      splitItems[best.id].items.push({ title: item.title, qty, unitPrice: best.price, subtotal: best.price * qty });
    }

    // Render row in item list
    const row = document.createElement('div');
    row.className = 'p-3 flex items-center justify-between gap-3';
    row.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="w-11 h-11 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
          ${item.image ? `<img src="${item.image}" alt="" class="w-full h-full object-contain p-0.5" onerror="this.src='/icon.svg'"/>` : '📦'}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="text-xs font-bold text-slate-900 truncate">${item.title}</h4>
          <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
            ${best ? `<span class="text-emerald-700 font-extrabold">${formatMoney(best.price)}</span> c/u en ${splitItems[best.id].name}` : ''}
          </div>
        </div>
      </div>

      <!-- Quantity controls -->
      <div class="flex items-center gap-1.5 shrink-0">
        <div class="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button onclick="changeCartItemQty('${item.id}', -1)" class="w-6 h-6 rounded bg-white text-slate-700 font-black text-xs hover:bg-slate-200 transition">-</button>
          <span class="w-7 text-center text-xs font-black text-slate-800">${qty}</span>
          <button onclick="changeCartItemQty('${item.id}', 1)" class="w-6 h-6 rounded bg-white text-slate-700 font-black text-xs hover:bg-slate-200 transition">+</button>
        </div>
        <button onclick="changeCartItemQty('${item.id}', -${qty})" class="text-slate-400 hover:text-red-600 p-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    `;
    itemsList.appendChild(row);
  });

  // Render Single Store Comparison Totals
  const totalCartUniqueItems = state.cart.length;
  document.getElementById('totalGoloWhole').textContent = goloCount > 0 ? formatMoney(totalGolo) : 'N/D';
  document.getElementById('coverageGolo').textContent = `${goloCount}/${totalCartUniqueItems} items`;

  document.getElementById('totalActualWhole').textContent = actualCount > 0 ? formatMoney(totalActual) : 'N/D';
  document.getElementById('coverageActual').textContent = `${actualCount}/${totalCartUniqueItems} items`;

  document.getElementById('totalDiaWhole').textContent = diaCount > 0 ? formatMoney(totalDia) : 'N/D';
  document.getElementById('coverageDia').textContent = `${diaCount}/${totalCartUniqueItems} items`;

  document.getElementById('totalMeliWhole').textContent = meliCount > 0 ? formatMoney(totalMeli) : 'N/D';
  document.getElementById('coverageMeli').textContent = `${meliCount}/${totalCartUniqueItems} items`;

  // Render Smart Split Card
  document.getElementById('splitOptimalTotal').textContent = formatMoney(optimalTotal);

  // Compare optimal against the best single store
  const singleTotals = [
    { id: 'golo', total: totalGolo, count: goloCount },
    { id: 'actual', total: totalActual, count: actualCount },
    { id: 'dia', total: totalDia, count: diaCount },
    { id: 'meli', total: totalMeli, count: meliCount }
  ].filter(t => t.count === totalCartUniqueItems); // only stores that have 100% of items

  let maxSingle = 0;
  if (singleTotals.length > 0) {
    singleTotals.sort((a, b) => a.total - b.total);
    maxSingle = singleTotals[0].total;
  } else {
    // Fallback if no single store has 100% of items
    const availableSums = [totalGolo, totalActual, totalDia, totalMeli].filter(s => s > 0);
    maxSingle = availableSums.length > 0 ? Math.max(...availableSums) : optimalTotal;
  }

  const savings = Math.max(0, maxSingle - optimalTotal);
  document.getElementById('splitSavingsTotal').textContent = formatMoney(savings);

  // Split details breakdown
  document.getElementById('splitGoloSummary').textContent = `${splitItems.golopolis.count} items (${formatMoney(splitItems.golopolis.total)})`;
  document.getElementById('splitActualSummary').textContent = `${splitItems.actual.count} items (${formatMoney(splitItems.actual.total)})`;
  document.getElementById('splitDiaSummary').textContent = `${splitItems.dia.count} items (${formatMoney(splitItems.dia.total)})`;
  document.getElementById('splitMeliSummary').textContent = `${splitItems.mercadolibre.count} items (${formatMoney(splitItems.mercadolibre.total)})`;
}

// Share List by WhatsApp
function shareListWhatsApp() {
  if (state.cart.length === 0) return;

  let text = `🛒 *MI LISTA DE COMPRAS - LAS FLORES*\n`;
  text += `📅 Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n`;

  // Group items by cheapest store
  const split = {
    'Golópolis (Las Flores)': [],
    'Actual (Las Flores)': [],
    'Día%': [],
    'Mercado Libre (Full ⚡)': []
  };

  let totalOptimo = 0;

  state.cart.forEach(item => {
    const qty = item.quantity;
    const pGolo = item.prices.golopolis?.price ? getEffectivePrice('golopolis', item.prices.golopolis.price) : null;
    const pAct = item.prices.actual?.price ? getEffectivePrice('actual', item.prices.actual.price) : null;
    const pDia = item.prices.dia?.price ? getEffectivePrice('dia', item.prices.dia.price) : null;
    const pMeli = (state.promos.meliFull && item.prices.mercadolibre?.price) ? getEffectivePrice('mercadolibre', item.prices.mercadolibre.price) : null;

    const opts = [
      { name: 'Golópolis (Las Flores)', price: pGolo },
      { name: 'Actual (Las Flores)', price: pAct },
      { name: 'Día%', price: pDia },
      { name: 'Mercado Libre (Full ⚡)', price: pMeli }
    ].filter(o => o.price !== null && o.price > 0);

    opts.sort((a, b) => a.price - b.price);
    if (opts.length > 0) {
      const best = opts[0];
      totalOptimo += best.price * qty;
      split[best.name].push(`  • ${qty}x ${item.title} - ${formatMoney(best.price * qty)}`);
    }
  });

  for (const [storeName, items] of Object.entries(split)) {
    if (items.length > 0) {
      text += `📍 *${storeName}:*\n${items.join('\n')}\n\n`;
    }
  }

  text += `🏆 *Total Óptimo a Pagar:* ${formatMoney(totalOptimo)}\n`;
  text += `_Generado con Súper Comparador Las Flores_`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Render Saved Lists View
function renderSavedLists() {
  const container = document.getElementById('savedListsContainer');
  const emptyState = document.getElementById('noSavedLists');

  if (state.savedLists.length === 0) {
    emptyState.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  state.savedLists.forEach(list => {
    const listEl = document.createElement('div');
    listEl.className = 'bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3';
    
    const itemCount = list.items.reduce((s, i) => s + i.quantity, 0);

    listEl.innerHTML = `
      <div>
        <h3 class="text-sm font-bold text-slate-900">${list.name}</h3>
        <p class="text-xs text-slate-400 mt-0.5">${list.date} • ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="loadSavedList('${list.id}')" class="bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-brand-200 transition">
          Cargar
        </button>
        <button onclick="deleteSavedList('${list.id}')" class="text-slate-400 hover:text-red-600 p-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    `;
    container.appendChild(listEl);
  });
}

function loadSavedList(listId) {
  const list = state.savedLists.find(l => l.id === listId);
  if (!list) return;

  if (confirm(`¿Cargar la lista "${list.name}" a tu canasta actual?`)) {
    state.cart = JSON.parse(JSON.stringify(list.items));
    saveCart();
    switchTab('cart');
  }
}

function deleteSavedList(listId) {
  if (confirm('¿Eliminar esta lista guardada?')) {
    state.savedLists = state.savedLists.filter(l => l.id !== listId);
    saveLists();
  }
}

// Switch Active Tab
function switchTab(tabId) {
  state.activeTab = tabId;

  // Hide all views
  document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));

  // Reset tab button styles
  const tabs = ['search', 'cart', 'lists', 'settings'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) {
      if (t === tabId) {
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-cyan-400');
      } else {
        btn.classList.remove('text-cyan-400');
        btn.classList.add('text-slate-400');
      }
    }
  });

  // Show target view
  const targetView = document.getElementById(`view${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Trigger sub-renders
  if (tabId === 'cart') {
    renderCart();
  } else if (tabId === 'lists') {
    renderSavedLists();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
