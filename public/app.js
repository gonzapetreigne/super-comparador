/**
 * Súper Comparador Las Flores - Frontend Application Logic
 */

// Global State
const state = {
  activeTab: 'search',
  currentResults: [],
  cart: [],
  cartStoreFilter: 'all',
  savedLists: [],
  currentSearchId: 0,
  meliSearching: false,
  promos: {
    cuentaDni: false,
    clubDia: false,
    meliFull: true
  }
};

// Store Configuration & Visual Metas
const STORE_CONFIG = {
  dia: {
    id: 'dia',
    name: 'Día%',
    shortName: 'Día%',
    fullName: 'Super Día%',
    emoji: '🔴',
    logo: '/logos/dia.svg',
    logoClass: 'h-4 object-contain rounded shadow-xs',
    headerBg: 'bg-gradient-to-r from-red-600 to-rose-700 text-white',
    badgeColor: 'bg-red-600 text-white',
    borderClass: 'border-red-200',
    lightBg: 'bg-red-50/60',
    btnBg: 'bg-red-600 hover:bg-red-700 text-white',
    branchInfo: 'Online / Sucursal Las Flores',
    address: 'Av. San Martín y Belgrano'
  },
  actual: {
    id: 'actual',
    name: 'Actual',
    shortName: 'Actual',
    fullName: 'Supermercado Actual',
    emoji: '🟠',
    logo: '/logos/actual.svg',
    logoClass: 'h-4 object-contain drop-shadow-xs',
    headerBg: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white',
    badgeColor: 'bg-orange-500 text-white',
    borderClass: 'border-orange-200',
    lightBg: 'bg-orange-50/60',
    btnBg: 'bg-orange-600 hover:bg-orange-700 text-white',
    branchInfo: 'Sucursal Las Flores',
    address: 'Av. San Martín / Rivadavia'
  },
  golopolis: {
    id: 'golopolis',
    name: 'Golópolis',
    shortName: 'Golópolis',
    fullName: 'Supermercado Golópolis',
    emoji: '🟢',
    logo: '/logos/golopolis.svg',
    logoClass: 'h-4 object-contain drop-shadow-xs',
    headerBg: 'bg-gradient-to-r from-lime-700 to-emerald-700 text-white',
    badgeColor: 'bg-lime-600 text-white',
    borderClass: 'border-lime-300',
    lightBg: 'bg-lime-50/60',
    btnBg: 'bg-lime-600 hover:bg-lime-700 text-white',
    branchInfo: 'Sucursal Las Flores',
    address: 'Sucursal Las Flores'
  },
  mercadolibre: {
    id: 'mercadolibre',
    name: 'Mercado Libre',
    shortName: 'MELI Full',
    fullName: 'Mercado Libre (Full ⚡)',
    emoji: '🟡',
    logo: '/logos/mercadolibre.svg',
    logoClass: 'h-4 w-4 object-contain',
    headerBg: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950',
    badgeColor: 'bg-amber-400 text-slate-950',
    borderClass: 'border-amber-300',
    lightBg: 'bg-amber-50/60',
    btnBg: 'bg-amber-400 hover:bg-amber-500 text-slate-950',
    branchInfo: 'Envíos a Las Flores',
    address: 'Compra online / Envío a domicilio'
  }
};

// Floating Toast Notification
function showToast(message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-400/40 text-amber-200 text-xs font-bold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md transition duration-300 opacity-0 pointer-events-none flex items-center gap-2';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0', 'pointer-events-none');
  }, 3500);
}

// Format currency ARS
function formatMoney(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  return '$' + Math.round(amount).toLocaleString('es-AR');
}

// Build canonical search URL for Mercado Libre (opens app on mobile)
function getMeliSearchUrl(title, brand) {
  const query = [brand, title].filter(Boolean).join(' ');
  const clean = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1 && !['de', 'el', 'la', 'los', 'las', 'un', 'una', 'con', 'sin', 'para', 'por', 'ud', 'unidades', 'grs', 'ml'].includes(w))
    .slice(0, 5)
    .join('-');
  return clean ? `https://listado.mercadolibre.com.ar/${encodeURIComponent(clean)}` : 'https://www.mercadolibre.com.ar/supermercado';
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
  fetchCatalogInfo();
});

async function fetchCatalogInfo() {
  try {
    const res = await fetch('/api/info');
    if (res.ok) {
      const data = await res.json();
      if (data.formattedDate) {
        updatePriceDates(data.formattedDate);
      }
    }
  } catch (e) {
    // Keep fallback
  }
}

function updatePriceDates(dateStr) {
  if (!dateStr) return;
  const headerEl = document.getElementById('headerLastUpdateDate');
  if (headerEl) headerEl.textContent = dateStr;
  const searchEl = document.getElementById('searchLastUpdateDate');
  if (searchEl) searchEl.textContent = dateStr;
}

// Get cheapest / best available store for a card or cart item
function getBestStoreForCard(itemOrCard) {
  if (!itemOrCard || !itemOrCard.prices) return 'dia';
  const options = [
    { id: 'dia', price: itemOrCard.prices.dia?.price ? getEffectivePrice('dia', itemOrCard.prices.dia.price) : null },
    { id: 'actual', price: itemOrCard.prices.actual?.price ? getEffectivePrice('actual', itemOrCard.prices.actual.price) : null },
    { id: 'golopolis', price: itemOrCard.prices.golopolis?.price ? getEffectivePrice('golopolis', itemOrCard.prices.golopolis.price) : null },
    { id: 'mercadolibre', price: itemOrCard.prices.mercadolibre?.price ? getEffectivePrice('mercadolibre', itemOrCard.prices.mercadolibre.price) : null }
  ].filter(o => o.price !== null && o.price > 0);

  if (options.length === 0) return 'dia';
  options.sort((a, b) => a.price - b.price);
  return options[0].id;
}

// Load cart and saved lists from localStorage
function loadSavedData() {
  try {
    const storedCart = localStorage.getItem('super_cart_v1');
    if (storedCart) {
      state.cart = JSON.parse(storedCart);
      state.cart.forEach(item => {
        if (!item.selectedStore) {
          item.selectedStore = getBestStoreForCard(item);
        }
        if (typeof item.checked !== 'boolean') {
          item.checked = false;
        }
      });
    }
    const storedLists = localStorage.getItem('super_lists_v1');
    if (storedLists) {
      state.savedLists = JSON.parse(storedLists);
    }
    const storedPromos = localStorage.getItem('super_promos_v1');
    if (storedPromos) {
      try {
        const parsed = JSON.parse(storedPromos);
        state.promos.cuentaDni = !!parsed.cuentaDni;
        state.promos.clubDia = !!parsed.clubDia;
      } catch (e) {}
      const dniEl = document.getElementById('toggleDNI');
      if (dniEl) dniEl.checked = state.promos.cuentaDni;
      const diaEl = document.getElementById('toggleClubDia');
      if (diaEl) diaEl.checked = state.promos.clubDia;
    }
    state.promos.meliFull = true;
    const meliToggle = document.getElementById('toggleMeliFull');
    if (meliToggle) meliToggle.checked = true;
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

  const searchId = ++state.currentSearchId;
  state.meliSearching = true;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (state.currentSearchId !== searchId) return;
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
    if (data.lastUpdatedDate) {
      updatePriceDates(data.lastUpdatedDate);
    }

    document.getElementById('countGolo').textContent = data.counts?.golopolis || 0;
    document.getElementById('countActual').textContent = data.counts?.actual || 0;
    document.getElementById('countDia').textContent = data.counts?.dia || 0;

    const countMeliEl = document.getElementById('countMeli');
    const meliNotice = document.getElementById('meliCloudNotice');
    if (meliNotice) meliNotice.classList.add('hidden');

    // Show animated searching status for Mercado Libre in stats bar
    if (data.meliPending) {
      countMeliEl.innerHTML = `
        <span class="inline-flex items-center justify-center gap-1 text-amber-400 font-bold animate-pulse">
          <svg class="animate-spin h-3 w-3 inline text-amber-400" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span class="text-[10px]">Buscando...</span>
        </span>
      `;
      // Trigger background fetch for Mercado Libre
      fetchMeliBackground(query, searchId);
    } else {
      state.meliSearching = false;
      countMeliEl.textContent = data.counts?.mercadolibre || 0;
    }

    if (state.currentResults.length === 0) {
      noResultsState.classList.remove('hidden');
    } else {
      renderCards(state.currentResults);
    }
  } catch (err) {
    if (state.currentSearchId !== searchId) return;
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    if (heroBanner) heroBanner.classList.remove('hidden');
    alert('Fallo de conexión al consultar las tiendas.');
  }
}

async function fetchMeliBackground(query, searchId) {
  try {
    const res = await fetch(`/api/search/meli?q=${encodeURIComponent(query)}`);
    if (state.currentSearchId !== searchId) return;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (state.currentSearchId !== searchId) return;

    state.meliSearching = false;
    const countMeliEl = document.getElementById('countMeli');
    const meliNotice = document.getElementById('meliCloudNotice');

    const meliCount = data.counts?.mercadolibre || 0;
    const isBlocked = data.stores?.mercadolibre?.blockedByBot === true;

    if (isBlocked || meliCount === 0) {
      countMeliEl.innerHTML = '<span class="text-amber-500 font-bold" title="No disponible en la nube">0 ⚠️</span>';
      if (meliNotice) {
        meliNotice.classList.remove('hidden');
        const meliDirectLink = document.getElementById('meliDirectLink');
        if (meliDirectLink) {
          meliDirectLink.href = `https://listado.mercadolibre.com.ar/alimentos-bebidas/${encodeURIComponent(query)}_Envio_Full`;
        }
      }
      if (state.activeTab === 'search') {
        renderCards(state.currentResults);
      }
    } else {
      countMeliEl.textContent = meliCount;
      if (meliNotice) meliNotice.classList.add('hidden');

      state.currentResults = data.cards || [];
      document.getElementById('totalCardsCount').textContent = data.totalCards;
      if (data.lastUpdatedDate) {
        updatePriceDates(data.lastUpdatedDate);
      }

      if (state.activeTab === 'search') {
        renderCards(state.currentResults);
      }
      showToast(`${meliCount} productos de Mercado Libre Full actualizados`);
    }
  } catch (e) {
    if (state.currentSearchId !== searchId) return;
    state.meliSearching = false;
    const countMeliEl = document.getElementById('countMeli');
    if (countMeliEl) countMeliEl.innerHTML = '<span class="text-amber-500 font-bold">0 ⚠️</span>';
    const meliNotice = document.getElementById('meliCloudNotice');
    if (meliNotice) meliNotice.classList.remove('hidden');
    if (state.activeTab === 'search') {
      renderCards(state.currentResults);
    }
  }
}

// Render Comparison Cards
function renderCards(cards) {
  const container = document.getElementById('resultsContainer');
  const noResultsState = document.getElementById('noResultsState');
  const totalCardsCountEl = document.getElementById('totalCardsCount');
  container.innerHTML = '';

  let visibleCount = 0;

  cards.forEach(card => {
    // Determine active stores based on settings (e.g. Meli Full toggle)
    const stores = [
      {
        id: 'golopolis',
        name: 'Golópolis',
        branch: 'Las Flores',
        logo: '/logos/golopolis.svg',
        logoClass: 'h-3.5 max-w-[36px] object-contain',
        theme: {
          border: 'border-lime-300/90 hover:border-lime-400',
          bg: 'bg-gradient-to-b from-lime-50/80 to-emerald-50/40',
          nameColor: 'text-emerald-950',
          priceColor: 'text-slate-900',
          subColor: 'text-emerald-900/70',
          unavailBorder: 'border-dashed border-lime-300/70',
          unavailBg: 'bg-lime-50/30',
          unavailText: 'text-emerald-900/70'
        },
        data: card.prices.golopolis
      },
      {
        id: 'actual',
        name: 'Actual',
        branch: 'Las Flores',
        logo: '/logos/actual.png',
        logoClass: 'h-3.5 w-3.5 object-contain rounded-full shadow-xs',
        theme: {
          border: 'border-orange-200/90 hover:border-orange-300',
          bg: 'bg-gradient-to-b from-orange-50/70 to-amber-50/30',
          nameColor: 'text-orange-950',
          priceColor: 'text-slate-900',
          subColor: 'text-orange-900/60',
          unavailBorder: 'border-dashed border-orange-200/70',
          unavailBg: 'bg-orange-50/25',
          unavailText: 'text-orange-900/70'
        },
        data: card.prices.actual
      },
      {
        id: 'dia',
        name: 'Día%',
        branch: 'Online',
        logo: '/logos/dia.svg',
        logoClass: 'h-3.5 object-contain rounded shadow-xs',
        theme: {
          border: 'border-red-200/90 hover:border-red-300',
          bg: 'bg-gradient-to-b from-red-50/70 to-rose-50/30',
          nameColor: 'text-red-950',
          priceColor: 'text-slate-900',
          subColor: 'text-red-900/60',
          unavailBorder: 'border-dashed border-red-200/70',
          unavailBg: 'bg-red-50/25',
          unavailText: 'text-red-900/70'
        },
        data: card.prices.dia
      },
      {
        id: 'mercadolibre',
        name: 'Mercado Libre',
        branch: 'Full ⚡',
        logo: '/logos/mercadolibre.svg',
        logoClass: 'h-4 w-4 object-contain',
        theme: {
          border: 'border-amber-200/90 hover:border-amber-300',
          bg: 'bg-gradient-to-b from-amber-50/70 to-yellow-50/30',
          nameColor: 'text-amber-950',
          priceColor: 'text-slate-900',
          subColor: 'text-amber-900/60',
          unavailBorder: 'border-dashed border-amber-200/70',
          unavailBg: 'bg-amber-50/25',
          unavailText: 'text-amber-900/70'
        },
        data: card.prices.mercadolibre
      }
    ];

    // Recalculate cheapest with current promo rules
    const availableStores = stores
      .filter(s => s.data && s.data.price > 0 && s.data.available !== false)
      .map(s => ({
        ...s,
        effectivePrice: getEffectivePrice(s.id, s.data.price)
      }))
      .sort((a, b) => a.effectivePrice - b.effectivePrice);

    // If no store has this product available, do NOT display the card at all
    if (availableStores.length === 0) {
      return;
    }

    visibleCount++;

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
      const theme = store.theme;

      if (!p || p.price <= 0 || p.available === false) {
        if (store.id === 'mercadolibre' && state.meliSearching) {
          return `
            <div class="p-2 sm:p-2.5 rounded-xl border border-dashed border-amber-400/60 bg-amber-500/10 flex flex-col justify-between text-center animate-pulse">
              <div class="flex items-center justify-between gap-1 mb-1">
                <span class="text-[10px] sm:text-[11px] font-extrabold text-amber-900 truncate">${store.name}</span>
                <img src="${store.logo}" alt="${store.name}" class="${store.logoClass} opacity-80" onerror="this.style.display='none'" />
              </div>
              <span class="text-[11px] text-amber-600 my-1 font-semibold flex items-center justify-center gap-1">
                <svg class="animate-spin h-3 w-3 inline text-amber-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                Buscando...
              </span>
              <span class="text-[9px] text-amber-600/70">Full ⚡</span>
            </div>
          `;
        }

        if (store.id === 'mercadolibre') {
          const searchUrl = getMeliSearchUrl(card.title, card.brand);
          return `
            <div class="p-2 sm:p-2.5 rounded-xl border border-dashed border-amber-300/90 bg-amber-50/50 flex flex-col justify-between text-center transition">
              <div class="flex items-center justify-between gap-1 mb-1">
                <span class="text-[10px] sm:text-[11px] font-bold text-amber-950 truncate">${store.name}</span>
                <img src="${store.logo}" alt="${store.name}" class="${store.logoClass} opacity-80" onerror="this.style.display='none'" />
              </div>
              <div class="my-1">
                <span class="text-[10px] text-slate-400 font-medium block">Sin catálogo local</span>
                <span class="text-[9px] text-amber-900/70 font-medium block">Otros vendedores en app</span>
              </div>
              <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="mt-1.5 w-full py-1 px-1.5 bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-950 font-black text-[10px] rounded-lg border border-amber-300 transition flex items-center justify-center gap-1 text-center" title="Buscar vendedores para este producto en la app de Mercado Libre">
                <span>Ver en MELI</span>
                <svg class="w-3 h-3 text-amber-900 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          `;
        }

        return `
          <div class="p-2 sm:p-2.5 rounded-xl border ${theme.unavailBorder} ${theme.unavailBg} flex flex-col justify-between opacity-75 text-center transition">
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="text-[10px] sm:text-[11px] font-bold ${theme.unavailText} truncate">${store.name}</span>
              <img src="${store.logo}" alt="${store.name}" class="${store.logoClass} opacity-60" onerror="this.style.display='none'" />
            </div>
            <span class="text-[11px] sm:text-xs text-slate-400 my-1 font-medium">No disponible</span>
            <span class="text-[9px] text-slate-400/60">${store.id === 'dia' ? 'Online' : 'Sucursal local'}</span>
          </div>
        `;
      }

      const effPrice = getEffectivePrice(store.id, p.price);
      const isWinner = cheapest && cheapest.id === store.id && availableStores.length > 1;

      let actionBtnHtml = '';
      if (store.id === 'mercadolibre') {
        const meliUrl = p.url || getMeliSearchUrl(card.title, card.brand);
        actionBtnHtml = `
          <div class="mt-2 space-y-1">
            <button onclick="addToCart('${card.id}', 'mercadolibre')" class="w-full py-1 px-1 rounded-lg text-[10px] font-black transition active:scale-95 flex items-center justify-center gap-1 ${isWinner ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs' : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'}">
              <span>+</span><span>MELI</span>
            </button>
            <a href="${meliUrl}" target="_blank" rel="noopener noreferrer" class="w-full py-0.5 px-1 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-bold text-[9px] rounded shadow-2xs transition flex items-center justify-center gap-1 text-center" title="Abrir en Mercado Libre">
              <span>Ver en App</span>
              <svg class="w-2.5 h-2.5 text-slate-950 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        `;
      } else if (store.id === 'dia') {
        actionBtnHtml = `
          <div class="mt-2 space-y-1">
            <button onclick="addToCart('${card.id}', 'dia')" class="w-full py-1 px-1 rounded-lg text-[10px] font-black transition active:scale-95 flex items-center justify-center gap-1 ${isWinner ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs' : 'bg-red-50 hover:bg-red-100 text-red-900 border border-red-200'}">
              <span>+</span><span>Día%</span>
            </button>
            ${p.url ? `
              <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="w-full py-0.5 px-1 text-red-700 hover:underline font-bold text-[9px] transition flex items-center justify-center gap-0.5 text-center">
                <span>Día Online</span>
                <svg class="w-2 h-2 text-red-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline></svg>
              </a>
            ` : ''}
          </div>
        `;
      } else {
        actionBtnHtml = `
          <div class="mt-2">
            <button onclick="addToCart('${card.id}', '${store.id}')" class="w-full py-1 px-1 rounded-lg text-[10px] font-black transition active:scale-95 flex items-center justify-center gap-1 ${isWinner ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'}">
              <span>+</span><span>${store.name}</span>
            </button>
          </div>
        `;
      }

      return `
        <div class="p-2 sm:p-2.5 rounded-xl border ${isWinner ? 'border-2 border-emerald-500 bg-gradient-to-b from-emerald-50/90 to-emerald-50/40 shadow-sm ring-1 ring-emerald-500/30' : `border ${theme.border} ${theme.bg}`} flex flex-col justify-between transition hover:shadow-xs">
          <!-- Header: Nombre y Logo en la esquina superior derecha -->
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-[10px] sm:text-[11px] font-black truncate ${isWinner ? 'text-emerald-950' : theme.nameColor}">${store.name}</span>
            <div class="flex items-center gap-1 shrink-0">
              ${isWinner ? '<span class="text-[8px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight shadow-xs">MEJOR</span>' : ''}
              <img src="${store.logo}" alt="${store.name}" class="${store.logoClass} drop-shadow-xs" onerror="this.style.display='none'" />
            </div>
          </div>
          
          <div class="my-1">
            <div class="text-sm sm:text-base font-black ${isWinner ? 'text-emerald-700 font-black' : theme.priceColor}">
              ${formatMoney(effPrice)}
            </div>
            ${p.originalPrice && p.originalPrice > p.price ? `
              <div class="text-[10px] text-slate-400 line-through">${formatMoney(p.originalPrice)}</div>
            ` : (state.promos.cuentaDni && store.id !== 'mercadolibre' ? `
              <div class="text-[10px] text-slate-400 line-through">${formatMoney(p.price)}</div>
            ` : '')}
          </div>

          <div class="text-[10px] ${isWinner ? 'text-emerald-900/70 font-semibold' : theme.subColor} truncate">
            ${p.unitPriceText || store.branch}
          </div>

          ${actionBtnHtml}
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

      <!-- Botón Agregar a Canasta y Link a MELI -->
      <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div class="text-xs text-slate-500 font-medium">
          ${cheapest ? `Mejor opción: <strong class="text-slate-800">${cheapest.name}</strong>` : ''}
        </div>

        <div class="flex items-center gap-2">
          <!-- Botón directo para abrir en la App de Mercado Libre / Ver más vendedores -->
          <a href="${card.prices.mercadolibre?.url || getMeliSearchUrl(card.title, card.brand)}"
             target="_blank"
             rel="noopener noreferrer"
             class="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400 font-extrabold text-[11px] px-2.5 py-1.5 rounded-xl shadow-2xs transition active:scale-95 flex items-center gap-1.5"
             title="Abrir en la App de Mercado Libre para ver todos los vendedores y opciones de envío">
            <img src="/logos/mercadolibre.svg" alt="MELI" class="h-3.5 w-3.5 object-contain" />
            <span>Ver en MELI</span>
            <svg class="w-3 h-3 text-amber-800 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>

          ${cartQty > 0 ? `
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg flex items-center gap-1">
                <span>${inCartItem?.selectedStore && STORE_CONFIG[inCartItem.selectedStore] ? STORE_CONFIG[inCartItem.selectedStore].emoji : '🛒'}</span>
                <span>${inCartItem?.selectedStore && STORE_CONFIG[inCartItem.selectedStore] ? STORE_CONFIG[inCartItem.selectedStore].name : 'Canasta'}</span>
              </span>
              <div class="flex items-center gap-1 bg-brand-50 border border-brand-200 rounded-xl px-2 py-1">
                <button onclick="changeCartItemQty('${card.id}', -1)" class="w-6 h-6 rounded-lg bg-white border border-brand-300 text-brand-700 font-black text-xs hover:bg-brand-100 transition active:scale-95">-</button>
                <span class="text-xs font-black text-brand-900 px-1.5">${cartQty}</span>
                <button onclick="changeCartItemQty('${card.id}', 1)" class="w-6 h-6 rounded-lg bg-white border border-brand-300 text-brand-700 font-black text-xs hover:bg-brand-100 transition active:scale-95">+</button>
              </div>
            </div>
          ` : `
            <button onclick="addToCart('${card.id}')" class="bg-slate-900 hover:bg-brand-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5">
              <span>+</span>
              <span>Agregar a canasta (${cheapest ? cheapest.name : 'Mejor súper'})</span>
            </button>
          `}
        </div>
      </div>
    `;

    container.appendChild(cardEl);
  });

  if (totalCardsCountEl) {
    totalCardsCountEl.textContent = visibleCount;
  }

  if (visibleCount === 0) {
    if (noResultsState) noResultsState.classList.remove('hidden');
  } else {
    if (noResultsState) noResultsState.classList.add('hidden');
  }
}

// Add Item to Cart (optionally specifying target store)
function addToCart(cardId, preferredStore = null) {
  const card = state.currentResults.find(c => c.id === cardId);
  if (!card) return;

  const targetStore = preferredStore || getBestStoreForCard(card);
  const existing = state.cart.find(c => c.id === cardId);

  if (existing) {
    existing.quantity += 1;
    if (preferredStore) {
      existing.selectedStore = preferredStore;
    }
  } else {
    state.cart.push({
      id: card.id,
      title: card.title,
      brand: card.brand,
      image: card.image,
      quantity: 1,
      prices: card.prices,
      selectedStore: targetStore,
      checked: false
    });
  }

  saveCart();
  renderCards(state.currentResults);
  const storeMeta = STORE_CONFIG[targetStore];
  showToast(`Agregado a la lista de ${storeMeta ? storeMeta.name : 'la canasta'}`);
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
  if (state.activeTab === 'cart') {
    renderCart();
  }
}

// Change Assigned Store for a Cart Item
function changeCartItemStore(cardId, newStore) {
  const item = state.cart.find(c => c.id === cardId);
  if (!item) return;

  item.selectedStore = newStore;
  saveCart();
  renderCart();
  const storeMeta = STORE_CONFIG[newStore];
  showToast(`Movido a lista de ${storeMeta ? storeMeta.name : newStore}`);
}

// Toggle Checked State (for in-store shopping checklist)
function toggleCartItemCheck(cardId) {
  const item = state.cart.find(c => c.id === cardId);
  if (!item) return;

  item.checked = !item.checked;
  saveCart();
  renderCart();
}

// Toggle All Items for a Specific Store
function toggleStoreItemsCheck(storeId) {
  const storeItems = state.cart.filter(i => (i.selectedStore || getBestStoreForCard(i)) === storeId);
  if (storeItems.length === 0) return;

  const allChecked = storeItems.every(i => i.checked);
  storeItems.forEach(i => i.checked = !allChecked);
  saveCart();
  renderCart();
}

// Copy a Supermarket Checklist to Clipboard
function copyStoreList(storeId) {
  const storeMeta = STORE_CONFIG[storeId] || { name: storeId };
  const storeItems = state.cart.filter(i => (i.selectedStore || getBestStoreForCard(i)) === storeId);
  if (storeItems.length === 0) return;

  let text = `🛒 *LISTA ${storeMeta.fullName ? storeMeta.fullName.toUpperCase() : storeMeta.name.toUpperCase()}*\n`;
  text += `📅 ${new Date().toLocaleDateString('es-AR')}\n\n`;

  let subtotal = 0;
  storeItems.forEach(item => {
    const p = item.prices[storeId]?.price ? getEffectivePrice(storeId, item.prices[storeId].price) : null;
    const priceText = p ? ` - ${formatMoney(p * item.quantity)} (${formatMoney(p)} c/u)` : '';
    if (p) subtotal += p * item.quantity;
    text += `${item.checked ? '✅' : '▫️'} ${item.quantity}x ${item.title}${priceText}\n`;
  });
  text += `\nTotal: ${formatMoney(subtotal)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`¡Lista de ${storeMeta.name} copiada al portapapeles!`);
    }).catch(() => {
      prompt('Copia tu lista:', text);
    });
  } else {
    prompt('Copia tu lista:', text);
  }
}

// Filter Active Supermarket in Cart
function setCartStoreFilter(storeId) {
  state.cartStoreFilter = storeId;
  renderCart();
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

// Render Cart View (Organized into Supermarket Lists)
function renderCart() {
  const emptyState = document.getElementById('cartEmptyState');
  const filledContent = document.getElementById('cartFilledContent');
  const groupsContainer = document.getElementById('cartStoreGroupsContainer');
  const filterContainer = document.getElementById('cartStoreFilterContainer');
  const badge = document.getElementById('cartItemsBadge');

  if (state.cart.length === 0) {
    emptyState.classList.remove('hidden');
    filledContent.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  filledContent.classList.remove('hidden');

  const totalItemCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  if (badge) {
    badge.textContent = `${totalItemCount} ${totalItemCount === 1 ? 'producto' : 'productos'}`;
  }

  // Store lists calculation
  const storeKeys = ['dia', 'actual', 'golopolis', 'mercadolibre'];
  const storeGroups = {
    dia: { items: [], total: 0, count: 0 },
    actual: { items: [], total: 0, count: 0 },
    golopolis: { items: [], total: 0, count: 0 },
    mercadolibre: { items: [], total: 0, count: 0 }
  };

  // Whole single store calculations (if buying 100% of items at that store)
  let totalGolo = 0, goloCount = 0;
  let totalActual = 0, actualCount = 0;
  let totalDia = 0, diaCount = 0;
  let totalMeli = 0, meliCount = 0;

  let grandTotal = 0;

  state.cart.forEach(item => {
    const qty = item.quantity;
    const pGolo = item.prices.golopolis?.price ? getEffectivePrice('golopolis', item.prices.golopolis.price) : null;
    const pAct = item.prices.actual?.price ? getEffectivePrice('actual', item.prices.actual.price) : null;
    const pDia = item.prices.dia?.price ? getEffectivePrice('dia', item.prices.dia.price) : null;
    const pMeli = item.prices.mercadolibre?.price ? getEffectivePrice('mercadolibre', item.prices.mercadolibre.price) : null;

    if (pGolo) { totalGolo += pGolo * qty; goloCount++; }
    if (pAct) { totalActual += pAct * qty; actualCount++; }
    if (pDia) { totalDia += pDia * qty; diaCount++; }
    if (pMeli) { totalMeli += pMeli * qty; meliCount++; }

    // Assign to selected store or best store
    const assignedStore = (item.selectedStore && storeGroups[item.selectedStore]) 
      ? item.selectedStore 
      : getBestStoreForCard(item);

    // Calculate effective price for assigned store (or fallback to best available)
    let unitPrice = item.prices[assignedStore]?.price ? getEffectivePrice(assignedStore, item.prices[assignedStore].price) : null;
    if (!unitPrice || unitPrice <= 0) {
      const bestFallback = getBestStoreForCard(item);
      unitPrice = item.prices[bestFallback]?.price ? getEffectivePrice(bestFallback, item.prices[bestFallback].price) : 0;
    }

    const subtotal = (unitPrice || 0) * qty;
    grandTotal += subtotal;

    if (storeGroups[assignedStore]) {
      storeGroups[assignedStore].items.push({
        ...item,
        assignedStore,
        effectiveUnitPrice: unitPrice,
        subtotal
      });
      storeGroups[assignedStore].count += qty;
      storeGroups[assignedStore].total += subtotal;
    }
  });

  // Single Store Comparisons
  const totalCartUniqueItems = state.cart.length;
  const setStoreTotalText = (id, price, count) => {
    const elPrice = document.getElementById(`total${id}Whole`);
    const elCov = document.getElementById(`coverage${id}`);
    if (elPrice) elPrice.textContent = count > 0 ? formatMoney(price) : 'N/D';
    if (elCov) elCov.textContent = `${count}/${totalCartUniqueItems} items`;
  };

  setStoreTotalText('Golo', totalGolo, goloCount);
  setStoreTotalText('Actual', totalActual, actualCount);
  setStoreTotalText('Dia', totalDia, diaCount);
  setStoreTotalText('Meli', totalMeli, meliCount);

  // Split Optimal Hero card
  const optimalTotalEl = document.getElementById('splitOptimalTotal');
  if (optimalTotalEl) optimalTotalEl.textContent = formatMoney(grandTotal);

  const singleTotals = [
    { total: totalGolo, count: goloCount },
    { total: totalActual, count: actualCount },
    { total: totalDia, count: diaCount },
    { total: totalMeli, count: meliCount }
  ].filter(t => t.count === totalCartUniqueItems);

  let maxSingle = 0;
  if (singleTotals.length > 0) {
    singleTotals.sort((a, b) => a.total - b.total);
    maxSingle = singleTotals[0].total;
  } else {
    const availableSums = [totalGolo, totalActual, totalDia, totalMeli].filter(s => s > 0);
    maxSingle = availableSums.length > 0 ? Math.max(...availableSums) : grandTotal;
  }
  const savings = Math.max(0, maxSingle - grandTotal);
  const savingsEl = document.getElementById('splitSavingsTotal');
  if (savingsEl) savingsEl.textContent = formatMoney(savings);

  // Summaries
  const goloSumEl = document.getElementById('splitGoloSummary');
  if (goloSumEl) goloSumEl.textContent = `${storeGroups.golopolis.count} items (${formatMoney(storeGroups.golopolis.total)})`;
  const actSumEl = document.getElementById('splitActualSummary');
  if (actSumEl) actSumEl.textContent = `${storeGroups.actual.count} items (${formatMoney(storeGroups.actual.total)})`;
  const diaSumEl = document.getElementById('splitDiaSummary');
  if (diaSumEl) diaSumEl.textContent = `${storeGroups.dia.count} items (${formatMoney(storeGroups.dia.total)})`;
  const meliSumEl = document.getElementById('splitMeliSummary');
  if (meliSumEl) meliSumEl.textContent = `${storeGroups.mercadolibre.count} items (${formatMoney(storeGroups.mercadolibre.total)})`;

  // Render Filter Buttons (Todos, Día, Actual, Golópolis, MELI)
  if (filterContainer) {
    filterContainer.innerHTML = '';

    const filterOptions = [
      { id: 'all', label: `Todos (${totalItemCount})` },
      ...storeKeys
        .filter(key => storeGroups[key].items.length > 0)
        .map(key => ({
          id: key,
          label: `${STORE_CONFIG[key].emoji} ${STORE_CONFIG[key].shortName} (${storeGroups[key].count})`
        }))
    ];

    // If active filter has 0 items, reset to all
    if (state.cartStoreFilter !== 'all' && (!storeGroups[state.cartStoreFilter] || storeGroups[state.cartStoreFilter].items.length === 0)) {
      state.cartStoreFilter = 'all';
    }

    filterOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = state.cartStoreFilter === opt.id;
      btn.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap shrink-0 ${
        isActive 
          ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-800' 
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
      }`;
      btn.textContent = opt.label;
      btn.onclick = () => setCartStoreFilter(opt.id);
      filterContainer.appendChild(btn);
    });
  }

  // Render Supermarket Group Cards
  if (groupsContainer) {
    groupsContainer.innerHTML = '';

    const storesToRender = storeKeys.filter(key => {
      if (storeGroups[key].items.length === 0) return false;
      if (state.cartStoreFilter !== 'all' && state.cartStoreFilter !== key) return false;
      return true;
    });

    if (storesToRender.length === 0) {
      groupsContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-6 text-center border border-slate-200">
          <p class="text-sm font-bold text-slate-600">No hay productos en esta lista de supermercado.</p>
          <button onclick="setCartStoreFilter('all')" class="mt-2 text-xs font-bold text-brand-700 hover:underline">Ver todos los supermercados</button>
        </div>
      `;
      return;
    }

    storesToRender.forEach(storeId => {
      const storeMeta = STORE_CONFIG[storeId];
      const groupData = storeGroups[storeId];
      const allChecked = groupData.items.length > 0 && groupData.items.every(i => i.checked);

      const storeCard = document.createElement('div');
      storeCard.className = `bg-white rounded-2xl border ${storeMeta.borderClass || 'border-slate-200'} shadow-sm overflow-hidden transition`;

      // Header
      const headerEl = document.createElement('div');
      headerEl.className = `${storeMeta.headerBg} p-3 sm:p-4 flex items-center justify-between gap-2 flex-wrap shadow-sm`;
      headerEl.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-sm">
            <img src="${storeMeta.logo}" alt="${storeMeta.name}" class="${storeMeta.logoClass}" onerror="this.src='/icon.svg'">
          </div>
          <div>
            <h3 class="font-black text-sm sm:text-base leading-tight flex items-center gap-1.5">
              <span>${storeMeta.fullName}</span>
              <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">${groupData.count} items</span>
            </h3>
            <p class="text-[11px] opacity-90 font-medium">${storeMeta.branchInfo}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="text-right">
            <span class="text-[10px] uppercase font-bold tracking-wider opacity-85 block">Subtotal</span>
            <span class="text-base sm:text-lg font-black tracking-tight">${formatMoney(groupData.total)}</span>
          </div>
          <button onclick="copyStoreList('${storeId}')" title="Copiar lista de este súper al portapapeles" class="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition active:scale-95 flex items-center gap-1 text-xs font-bold" aria-label="Copiar lista">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            <span class="hidden sm:inline">Copiar</span>
          </button>
        </div>
      `;
      storeCard.appendChild(headerEl);

      // Sub-bar with quick checklist controls
      const subBar = document.createElement('div');
      subBar.className = 'px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600';
      subBar.innerHTML = `
        <span class="font-bold text-slate-700 flex items-center gap-1">
          <span>🛒</span>
          <span>${groupData.items.length} ${groupData.items.length === 1 ? 'producto' : 'productos'} para comprar en ${storeMeta.name}</span>
        </span>
        <button onclick="toggleStoreItemsCheck('${storeId}')" class="text-brand-700 hover:text-brand-900 font-bold transition flex items-center gap-1">
          <span>${allChecked ? 'Desmarcar todos' : 'Marcar todos'}</span>
        </button>
      `;
      storeCard.appendChild(subBar);

      // Items List
      const listEl = document.createElement('div');
      listEl.className = 'divide-y divide-slate-100';

      groupData.items.forEach(item => {
        const row = document.createElement('div');
        row.className = `p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 transition ${item.checked ? 'bg-emerald-50/40 opacity-70' : 'hover:bg-slate-50/50'}`;

        // Options for the store switcher dropdown
        const storeOptionsHtml = storeKeys.map(sId => {
          const sMeta = STORE_CONFIG[sId];
          const rawP = item.prices[sId]?.price;
          if (!rawP || rawP <= 0) return '';
          const effP = getEffectivePrice(sId, rawP);
          const isSelected = sId === storeId;
          return `<option value="${sId}" ${isSelected ? 'selected' : ''}>${sMeta.name}: ${formatMoney(effP)}</option>`;
        }).filter(Boolean).join('');

        row.innerHTML = `
          <!-- Checkbox + Thumbnail + Details -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <button onclick="toggleCartItemCheck('${item.id}')" 
                    type="button"
                    class="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition active:scale-90 ${item.checked ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'border-slate-300 hover:border-emerald-500 bg-white'}" 
                    title="${item.checked ? 'Comprado (click para desmarcar)' : 'Marcar como comprado'}">
              ${item.checked ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>` : ''}
            </button>

            <div class="w-11 h-11 sm:w-12 sm:h-12 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-2xs">
              ${item.image ? `<img src="${item.image}" alt="" class="w-full h-full object-contain" onerror="this.src='/icon.svg'"/>` : '📦'}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${item.brand ? `<span class="text-[9px] uppercase font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">${item.brand}</span>` : ''}
              </div>
              <h4 class="text-xs sm:text-sm font-bold text-slate-900 truncate leading-snug mt-0.5 ${item.checked ? 'line-through text-slate-400' : ''}">${item.title}</h4>
              
              <!-- Store Switcher & Subtotal -->
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="text-[11px] font-black text-slate-800">${formatMoney(item.effectiveUnitPrice)} c/u</span>
                ${item.quantity > 1 ? `<span class="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">(Subtotal: ${formatMoney(item.subtotal)})</span>` : ''}

                <!-- Selector de Supermercado -->
                <div class="flex items-center gap-1 text-[10px]">
                  <span class="text-slate-400 font-medium">Comprar en:</span>
                  <select onchange="changeCartItemStore('${item.id}', this.value)" class="bg-white border border-slate-300 text-slate-800 text-[10px] font-bold rounded-md px-1.5 py-0.5 focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs">
                    ${storeOptionsHtml}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Quantity Controls & Delete -->
          <div class="flex items-center gap-1.5 shrink-0">
            <div class="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-2xs">
              <button onclick="changeCartItemQty('${item.id}', -1)" class="w-6 h-6 rounded bg-white text-slate-700 font-black text-xs hover:bg-slate-200 transition active:scale-90">-</button>
              <span class="w-6 text-center text-xs font-black text-slate-800">${item.quantity}</span>
              <button onclick="changeCartItemQty('${item.id}', 1)" class="w-6 h-6 rounded bg-white text-slate-700 font-black text-xs hover:bg-slate-200 transition active:scale-90">+</button>
            </div>
            <button onclick="changeCartItemQty('${item.id}', -${item.quantity})" class="text-slate-300 hover:text-red-600 p-1.5 transition active:scale-90" title="Eliminar de la canasta">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `;
        listEl.appendChild(row);
      });

      storeCard.appendChild(listEl);

      // Card Footer with Supermarket Subtotal
      const footerEl = document.createElement('div');
      footerEl.className = 'p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-2';
      footerEl.innerHTML = `
        <span class="text-slate-500 font-medium">Total estimado para pagar en ${storeMeta.name}:</span>
        <span class="font-black text-sm text-slate-900">${formatMoney(groupData.total)}</span>
      `;
      storeCard.appendChild(footerEl);

      groupsContainer.appendChild(storeCard);
    });
  }
}

// Share List by WhatsApp (Organized by Supermarket)
function shareListWhatsApp() {
  if (state.cart.length === 0) return;

  let text = `🛒 *MI LISTA DE COMPRAS - LAS FLORES*\n`;
  text += `📅 Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n`;

  const storeKeys = ['dia', 'actual', 'golopolis', 'mercadolibre'];
  let grandTotal = 0;

  storeKeys.forEach(storeId => {
    const storeMeta = STORE_CONFIG[storeId];
    const storeItems = state.cart.filter(i => (i.selectedStore || getBestStoreForCard(i)) === storeId);
    if (storeItems.length === 0) return;

    let storeSubtotal = 0;
    const totalUnits = storeItems.reduce((s, i) => s + i.quantity, 0);
    text += `${storeMeta.emoji} *${storeMeta.fullName ? storeMeta.fullName.toUpperCase() : storeMeta.name.toUpperCase()}* (${totalUnits} ${totalUnits === 1 ? 'producto' : 'productos'}):\n`;

    storeItems.forEach(item => {
      const p = item.prices[storeId]?.price ? getEffectivePrice(storeId, item.prices[storeId].price) : null;
      const sub = p ? p * item.quantity : 0;
      storeSubtotal += sub;
      const checkMark = item.checked ? '✅' : '▫️';
      const priceText = p ? ` - ${formatMoney(sub)} (${formatMoney(p)} c/u)` : '';
      const meliLink = (storeId === 'mercadolibre' && item.prices.mercadolibre?.url) ? `\n    📲 Comprar en MELI: ${item.prices.mercadolibre.url}` : '';
      text += `${checkMark} ${item.quantity}x ${item.title}${priceText}${meliLink}\n`;
    });

    text += `👉 *Subtotal en ${storeMeta.name}:* ${formatMoney(storeSubtotal)}\n\n`;
    grandTotal += storeSubtotal;
  });

  text += `🏆 *TOTAL A PAGAR:* ${formatMoney(grandTotal)}\n`;
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
    state.cart.forEach(item => {
      if (!item.selectedStore) item.selectedStore = getBestStoreForCard(item);
      if (typeof item.checked !== 'boolean') item.checked = false;
    });
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
