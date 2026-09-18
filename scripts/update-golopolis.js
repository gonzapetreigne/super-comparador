import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'golopolis.json');

const GOLO_CATEGORIES_AND_TERMS = [
  'Cuidado del Cabello', 'Limpieza del Hogar', 'Dulces', 'Aperitivos y Amargos', 'Desodorantes y Antitranspirantes',
  'Bebes', 'Aderezos', 'Dulces y Mermeladas', 'Saladas', 'Infusiones', 'Vinos', 'Cuidado Bucal', 'Limpieza de Cocina',
  'Cuidado de cuerpo', 'Espirituosas', 'Reposteria', 'Jabones', 'Lacteos', 'Caramelos', 'Snacks', 'Filos',
  'Proteccion Femenina', 'Tomates', 'Caldos y Sopas', 'Aceites', 'Arroz y Legumbres', 'Azucar y Edulcorantes',
  'Cereales', 'Especias y Condimentos', 'Fideos y Pastas', 'Harinas y Panificados', 'Jugos', 'Panificados', 'Postres',
  'Agua', 'Cervezas', 'Espumantes', 'Gaseosas', 'Saborizadas', 'Chocolates', 'Alfajores', 'Limpieza de Baño',
  'Papeleria', 'Alimentos mascotas', 'Bolsas de residuos', 'Pañales', 'Shampoo', 'Jabon', 'Leche', 'Cafe', 'Yerba',
  'Arroz', 'Fideos', 'Atun', 'Mayonesa', 'Galletitas', 'Aceite'
];

export async function updateGolopolisCatalog() {
  console.log('[Golópolis Updater] Iniciando actualización del catálogo de Golópolis (Las Flores - ID 227)...');
  const startTime = Date.now();

  const productMap = new Map();

  // Cargar existente como base si hay
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (Array.isArray(existing)) {
        for (const p of existing) {
          productMap.set(p.id, p);
        }
        console.log(`[Golópolis Updater] Catálogo base cargado: ${productMap.size} productos.`);
      }
    } catch (e) {
      console.warn(`[Golópolis Updater] No se pudo leer base existente:`, e.message);
    }
  }

  let index = 0;
  for (const term of GOLO_CATEGORIES_AND_TERMS) {
    index++;
    try {
      const url = `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(term)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': 'suite-company-id=227; PHPSESSID=comparador_las_flores_session'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        console.warn(`[Golópolis Updater] Falló consulta para "${term}": HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const match = html.match(/aProducts\s*=\s*(\[[\s\S]*?\]);/);
      if (!match) continue;

      let rawList = [];
      try {
        rawList = JSON.parse(match[1]);
      } catch (e) {
        continue;
      }

      let newCount = 0;
      for (const p of rawList) {
        const id = `golo_${p.id || p.foreign_id}`;
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

        const category = (p.category || '').trim();
        if (category.toLowerCase() === 'aceites' && !title.toLowerCase().includes('aceite') && !title.toLowerCase().includes('a.oliva')) {
          title = `ACEITE ${title}`;
        }

        const formatted = {
          id: id,
          store: 'Golópolis',
          storeId: 'golopolis',
          branch: 'Las Flores',
          title: title,
          brand: (p.brand || '').trim(),
          category: category,
          price: Math.round(price * 100) / 100,
          originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : null,
          discountPercent: discount ? Math.round(discount) : null,
          promotionText: discount ? 'Ofertas del día' : null,
          ean: ean,
          image: imageUrl,
          available: (p.enabled === 1 || p.enabled === '1') && price > 0,
          url: `https://golopolis.com.ar/app/?action=products&search=${encodeURIComponent(p.name || title)}`
        };

        if (!productMap.has(id)) newCount++;
        productMap.set(id, formatted);
      }

      console.log(`[Golópolis Updater] [${index}/${GOLO_CATEGORIES_AND_TERMS.length}] "${term}" -> ${rawList.length} productos (+${newCount} nuevos). Total: ${productMap.size}`);

      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.warn(`[Golópolis Updater] Error en "${term}":`, err.message);
    }
  }

  const finalList = Array.from(productMap.values());
  if (finalList.length > 0) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalList), 'utf8');
    console.log(`[Golópolis Updater] Catálogo guardado en data/golopolis.json (${finalList.length} productos en ${(Date.now() - startTime) / 1000}s).`);
  }

  return finalList.length;
}

if (process.argv[1] && process.argv[1].endsWith('update-golopolis.js')) {
  updateGolopolisCatalog()
    .then(count => {
      console.log(`Actualización Golópolis finalizada. Total: ${count}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(`Error en actualización Golópolis:`, err);
      process.exit(1);
    });
}
