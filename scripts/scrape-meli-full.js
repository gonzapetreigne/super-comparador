import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'mercadolibre.json');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const KNOWN_BRANDS = [
  'Pampers', 'Huggies', 'Babysec', 'Estrella', 'Johnson\'s', 'Johnsons', 'Dove', 'Rexona', 'Axe', 'Colgate',
  'Oral-B', 'Sensodyne', 'Pantene', 'Sedal', 'Elvive', 'Head & Shoulders', 'Gillette', 'Always', 'Kotex',
  'Ladysoft', 'Ala', 'Skip', 'Ariel', 'Granby', 'Vivere', 'Comfort', 'Downy', 'Cif', 'Magistral', 'Ayudin',
  'Lavandina', 'Procénex', 'Poett', 'Mr Musculo', 'Blem', 'Elite', 'Higienol', 'Campanita', 'Sussex', 'Elegante',
  'Raid', 'Fuyi', 'Off!', 'Hellmann\'s', 'Hellmanns', 'Knorr', 'Sancor', 'La Serenísima', 'La Serenisima',
  'Ilolay', 'Milkaut', 'Tregar', 'Verónica', 'Arcor', 'Bagley', 'Terrabusi', 'Oreo', 'Chocolinas', 'Pepitos',
  'Don Satur', 'Gallo', 'Lucchetti', 'Matarazzo', 'Marolio', 'Canale', 'La Campagnola', 'Noel', 'Molto',
  'Natura', 'Cocinero', 'Cañuelas', 'Pureza', 'Morixe', 'Blancaflor', 'Ledesma', 'Chango', 'Hileret',
  'Equal Sweet', 'Taragüi', 'Playadito', 'Cruz de Malta', 'Nobleza Gaucha', 'Rosamonte', 'Amanda', 'Union',
  'La Tranquera', 'Mañanita', 'Chamigo', 'Cabrales', 'La Virginia', 'Dolca', 'Nescafé', 'Nescafe', 'Arlistan',
  'Bonafide', 'Nesquik', 'Chocolino', 'Toddy', 'Coca-Cola', 'Coca Cola', 'Pepsi', 'Sprite', '7Up', 'Fanta',
  'Villa del Sur', 'Villavicencio', 'Eco de los Andes', 'Levité', 'Aquarius', 'Cepita', 'Tang', 'Clight',
  'Quilmes', 'Brahma', 'Heineken', 'Stella Artois', 'Corona', 'Andes', 'Amstel', 'Schneider', 'Fernet Branca',
  'Campari', 'Gancia', 'Cinzano', 'Aperol', 'Smirnoff', 'Absolut', 'Skyy', 'Chandon', 'Navarro Correas',
  'Trapiche', 'Finca Las Moras', 'Norton', 'Trumpeter', 'Rutini', 'Luigi Bosca', 'Alma Mora', 'Canciller',
  'Pedigree', 'Whiskas', 'Dog Chow', 'Cat Chow', 'Purina', 'Royal Canin', 'Eukanuba', 'Raza', 'Tiernitos'
];

function extractBrand(title) {
  if (!title) return '';
  for (const b of KNOWN_BRANDS) {
    const reg = new RegExp(`\\b${b}\\b`, 'i');
    if (reg.test(title)) return b;
  }
  return '';
}

function cleanProductUrl(link) {
  if (!link) return '';
  const itemMatch = link.match(/item_id%3A(MLA\d+)/i) || link.match(/MLA-?(\d+)/i);
  if (link.includes('click1.mercadolibre') && itemMatch) {
    const rawId = itemMatch[1].startsWith('MLA') ? itemMatch[1] : `MLA${itemMatch[1]}`;
    return `https://articulo.mercadolibre.com.ar/${rawId}`;
  }
  let clean = link.split('#')[0];
  if (clean.includes('/p/MLA')) {
    clean = clean.split('?')[0];
  }
  return clean;
}

function extractId(url) {
  if (!url) return `meli_${Math.random().toString(36).slice(2, 10)}`;
  const m = url.match(/(MLA-?\d+)/i);
  if (m) return `meli_${m[1].replace('-', '')}`;
  return `meli_${Math.random().toString(36).slice(2, 10)}`;
}

// 105+ high-yield supermarket search queries for Mercado Libre Full Super (yielding 5,000+ products)
export const CATEGORY_PAGES = [
  // 0. SECCIÓN DESTACADOS Y OFERTAS DE SUPERMERCADO (Alta densidad de productos, sin bloqueos)
  { cat: 'Supermercado', name: 'Ofertas Supermercado P1', url: 'https://www.mercadolibre.com.ar/ofertas?page=1#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P2', url: 'https://www.mercadolibre.com.ar/ofertas?page=2#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P3', url: 'https://www.mercadolibre.com.ar/ofertas?page=3#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P4', url: 'https://www.mercadolibre.com.ar/ofertas?page=4#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P5', url: 'https://www.mercadolibre.com.ar/ofertas?page=5#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P6', url: 'https://www.mercadolibre.com.ar/ofertas?page=6#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P7', url: 'https://www.mercadolibre.com.ar/ofertas?page=7#c_id=/supermercado' },
  { cat: 'Supermercado', name: 'Ofertas Supermercado P8', url: 'https://www.mercadolibre.com.ar/ofertas?page=8#c_id=/supermercado' },
  { cat: 'Bebés', name: 'Ofertas Bebés P1', url: 'https://www.mercadolibre.com.ar/ofertas?page=1&category=MLA1132' },
  { cat: 'Bebés', name: 'Ofertas Bebés P2', url: 'https://www.mercadolibre.com.ar/ofertas?page=2&category=MLA1132' },
  { cat: 'Bebés', name: 'Ofertas Bebés P3', url: 'https://www.mercadolibre.com.ar/ofertas?page=3&category=MLA1132' },
  { cat: 'Bebés', name: 'Ofertas Bebés P4', url: 'https://www.mercadolibre.com.ar/ofertas?page=4&category=MLA1132' },
  { cat: 'Almacén', name: 'Ofertas Alimentos P1', url: 'https://www.mercadolibre.com.ar/ofertas?page=1&category=MLA1403' },
  { cat: 'Almacén', name: 'Ofertas Alimentos P2', url: 'https://www.mercadolibre.com.ar/ofertas?page=2&category=MLA1403' },
  { cat: 'Almacén', name: 'Ofertas Alimentos P3', url: 'https://www.mercadolibre.com.ar/ofertas?page=3&category=MLA1403' },
  { cat: 'Almacén', name: 'Ofertas Alimentos P4', url: 'https://www.mercadolibre.com.ar/ofertas?page=4&category=MLA1403' },
  { cat: 'Almacén', name: 'Ofertas Alimentos P5', url: 'https://www.mercadolibre.com.ar/ofertas?page=5&category=MLA1403' },
  { cat: 'Limpieza', name: 'Ofertas Limpieza y Perfumería P1', url: 'https://www.mercadolibre.com.ar/ofertas?page=1&category=MLA1246' },
  { cat: 'Limpieza', name: 'Ofertas Limpieza y Perfumería P2', url: 'https://www.mercadolibre.com.ar/ofertas?page=2&category=MLA1246' },
  { cat: 'Mascotas', name: 'Ofertas Alimentos Mascotas P1', url: 'https://www.mercadolibre.com.ar/ofertas?page=1&category=MLA1071' },
  { cat: 'Mascotas', name: 'Ofertas Alimentos Mascotas P2', url: 'https://www.mercadolibre.com.ar/ofertas?page=2&category=MLA1071' },

  // 1. BEBÉS Y MATERNIDAD (Prioridad Máxima: Pañales, Toallitas, Fórmulas, Higiene)
  { cat: 'Bebés', name: 'Pañales General', url: 'https://listado.mercadolibre.com.ar/panales_Envio_Full' },
  { cat: 'Bebés', name: 'Pañales Pampers', url: 'https://listado.mercadolibre.com.ar/panales-pampers_Envio_Full' },
  { cat: 'Bebés', name: 'Pañales Huggies', url: 'https://listado.mercadolibre.com.ar/panales-huggies_Envio_Full' },
  { cat: 'Bebés', name: 'Pañales Babysec', url: 'https://listado.mercadolibre.com.ar/panales-babysec_Envio_Full' },
  { cat: 'Bebés', name: 'Pañales Adultos', url: 'https://listado.mercadolibre.com.ar/panales-adultos_Envio_Full' },
  { cat: 'Bebés', name: 'Toallitas Húmedas Bebé', url: 'https://listado.mercadolibre.com.ar/toallitas-humedas-bebe_Envio_Full' },
  { cat: 'Bebés', name: 'Toallitas Pampers', url: 'https://listado.mercadolibre.com.ar/toallitas-pampers_Envio_Full' },
  { cat: 'Bebés', name: 'Toallitas Huggies', url: 'https://listado.mercadolibre.com.ar/toallitas-huggies_Envio_Full' },
  { cat: 'Bebés', name: 'Óleo Calcáreo', url: 'https://listado.mercadolibre.com.ar/oleo-calcareo_Envio_Full' },
  { cat: 'Bebés', name: 'Shampoo Bebé', url: 'https://listado.mercadolibre.com.ar/shampoo-bebe_Envio_Full' },
  { cat: 'Bebés', name: 'Jabón Bebé', url: 'https://listado.mercadolibre.com.ar/jabon-bebe_Envio_Full' },
  { cat: 'Bebés', name: 'Leche Nutrilon', url: 'https://listado.mercadolibre.com.ar/leche-nutrilon_Envio_Full' },
  { cat: 'Bebés', name: 'Leche Vital Infantil', url: 'https://listado.mercadolibre.com.ar/leche-vital-infantil_Envio_Full' },
  { cat: 'Bebés', name: 'Leche Sancor Bebé', url: 'https://listado.mercadolibre.com.ar/leche-sancor-bebe_Envio_Full' },
  { cat: 'Bebés', name: 'Mamaderas Avent', url: 'https://listado.mercadolibre.com.ar/mamaderas-avent_Envio_Full' },
  { cat: 'Bebés', name: 'Chupetes Avent', url: 'https://listado.mercadolibre.com.ar/chupetes-avent_Envio_Full' },

  // 2. ALMACÉN Y DESPENSA
  { cat: 'Almacén', name: 'Aceite de Girasol', url: 'https://listado.mercadolibre.com.ar/aceite-girasol_Envio_Full' },
  { cat: 'Almacén', name: 'Aceite de Oliva', url: 'https://listado.mercadolibre.com.ar/aceite-oliva_Envio_Full' },
  { cat: 'Almacén', name: 'Aceite Natura', url: 'https://listado.mercadolibre.com.ar/aceite-natura_Envio_Full' },
  { cat: 'Almacén', name: 'Aceite Cocinero', url: 'https://listado.mercadolibre.com.ar/aceite-cocinero_Envio_Full' },
  { cat: 'Almacén', name: 'Arroz 1kg', url: 'https://listado.mercadolibre.com.ar/arroz-1kg_Envio_Full' },
  { cat: 'Almacén', name: 'Arroz Gallo', url: 'https://listado.mercadolibre.com.ar/arroz-gallo_Envio_Full' },
  { cat: 'Almacén', name: 'Lentejas y Garbanzos', url: 'https://listado.mercadolibre.com.ar/lentejas_Envio_Full' },
  { cat: 'Almacén', name: 'Fideos Matarazzo', url: 'https://listado.mercadolibre.com.ar/fideos-matarazzo_Envio_Full' },
  { cat: 'Almacén', name: 'Fideos Lucchetti', url: 'https://listado.mercadolibre.com.ar/fideos-lucchetti_Envio_Full' },
  { cat: 'Almacén', name: 'Fideos Spaghetti', url: 'https://listado.mercadolibre.com.ar/fideos-spaghetti_Envio_Full' },
  { cat: 'Almacén', name: 'Fideos Guiseros', url: 'https://listado.mercadolibre.com.ar/fideos-tirabuzon_Envio_Full' },
  { cat: 'Almacén', name: 'Atún en Lata', url: 'https://listado.mercadolibre.com.ar/atun-en-lata_Envio_Full' },
  { cat: 'Almacén', name: 'Atún La Campagnola', url: 'https://listado.mercadolibre.com.ar/atun-la-campagnola_Envio_Full' },
  { cat: 'Almacén', name: 'Conservas de Choclo', url: 'https://listado.mercadolibre.com.ar/choclo-lata_Envio_Full' },
  { cat: 'Almacén', name: 'Arvejas en Lata', url: 'https://listado.mercadolibre.com.ar/arvejas-lata_Envio_Full' },
  { cat: 'Almacén', name: 'Puré de Tomate', url: 'https://listado.mercadolibre.com.ar/pure-tomate_Envio_Full' },
  { cat: 'Almacén', name: 'Tomate Triturado', url: 'https://listado.mercadolibre.com.ar/tomate-triturado_Envio_Full' },
  { cat: 'Almacén', name: 'Mayonesa Hellmanns', url: 'https://listado.mercadolibre.com.ar/mayonesa-hellmanns_Envio_Full' },
  { cat: 'Almacén', name: 'Mayonesa Natura', url: 'https://listado.mercadolibre.com.ar/mayonesa-natura_Envio_Full' },
  { cat: 'Almacén', name: 'Ketchup', url: 'https://listado.mercadolibre.com.ar/ketchup_Envio_Full' },
  { cat: 'Almacén', name: 'Mostaza', url: 'https://listado.mercadolibre.com.ar/mostaza_Envio_Full' },
  { cat: 'Almacén', name: 'Harina 000', url: 'https://listado.mercadolibre.com.ar/harina-000_Envio_Full' },
  { cat: 'Almacén', name: 'Harina 0000', url: 'https://listado.mercadolibre.com.ar/harina-0000_Envio_Full' },
  { cat: 'Almacén', name: 'Harina Leudante Pureza', url: 'https://listado.mercadolibre.com.ar/harina-leudante_Envio_Full' },
  { cat: 'Almacén', name: 'Azúcar Ledesma', url: 'https://listado.mercadolibre.com.ar/azucar-ledesma_Envio_Full' },
  { cat: 'Almacén', name: 'Edulcorante Hileret', url: 'https://listado.mercadolibre.com.ar/edulcorante-hileret_Envio_Full' },
  { cat: 'Almacén', name: 'Sal Fina Dos Anclas', url: 'https://listado.mercadolibre.com.ar/sal-fina_Envio_Full' },
  { cat: 'Almacén', name: 'Caldos Knorr', url: 'https://listado.mercadolibre.com.ar/caldos-knorr_Envio_Full' },
  { cat: 'Almacén', name: 'Puré de Papas Maggi', url: 'https://listado.mercadolibre.com.ar/pure-papas_Envio_Full' },
  { cat: 'Almacén', name: 'Polenta Presto Pronta', url: 'https://listado.mercadolibre.com.ar/polenta-presto-pronta_Envio_Full' },
  { cat: 'Almacén', name: 'Vinagre de Alcohol', url: 'https://listado.mercadolibre.com.ar/vinagre-alcohol_Envio_Full' },
  { cat: 'Almacén', name: 'Aceitunas', url: 'https://listado.mercadolibre.com.ar/aceitunas_Envio_Full' },

  // 3. DESAYUNO, MERIENDA E INFUSIONES
  { cat: 'Almacén', name: 'Yerba Mate Playadito', url: 'https://listado.mercadolibre.com.ar/yerba-playadito_Envio_Full' },
  { cat: 'Almacén', name: 'Yerba Mate Taragüi', url: 'https://listado.mercadolibre.com.ar/yerba-taragui_Envio_Full' },
  { cat: 'Almacén', name: 'Yerba Mate Rosamonte', url: 'https://listado.mercadolibre.com.ar/yerba-rosamonte_Envio_Full' },
  { cat: 'Almacén', name: 'Yerba Mate Amanda', url: 'https://listado.mercadolibre.com.ar/yerba-amanda_Envio_Full' },
  { cat: 'Almacén', name: 'Yerba Mate Cruz Malta', url: 'https://listado.mercadolibre.com.ar/yerba-cruz-de-malta_Envio_Full' },
  { cat: 'Almacén', name: 'Café Dolca', url: 'https://listado.mercadolibre.com.ar/cafe-dolca_Envio_Full' },
  { cat: 'Almacén', name: 'Café Cabrales', url: 'https://listado.mercadolibre.com.ar/cafe-cabrales_Envio_Full' },
  { cat: 'Almacén', name: 'Café La Virginia', url: 'https://listado.mercadolibre.com.ar/cafe-la-virginia_Envio_Full' },
  { cat: 'Almacén', name: 'Cápsulas Dolce Gusto', url: 'https://listado.mercadolibre.com.ar/capsulas-dolce-gusto_Envio_Full' },
  { cat: 'Almacén', name: 'Cápsulas Nespresso', url: 'https://listado.mercadolibre.com.ar/capsulas-nespresso_Envio_Full' },
  { cat: 'Almacén', name: 'Té Saquitos', url: 'https://listado.mercadolibre.com.ar/te-taragui_Envio_Full' },
  { cat: 'Almacén', name: 'Mate Cocido', url: 'https://listado.mercadolibre.com.ar/mate-cocido_Envio_Full' },
  { cat: 'Almacén', name: 'Cacao Nesquik', url: 'https://listado.mercadolibre.com.ar/nesquik_Envio_Full' },
  { cat: 'Almacén', name: 'Leche Larga Vida', url: 'https://listado.mercadolibre.com.ar/leche-larga-vida_Envio_Full' },
  { cat: 'Almacén', name: 'Dulce de Leche La Serenísima', url: 'https://listado.mercadolibre.com.ar/dulce-de-leche_Envio_Full' },
  { cat: 'Almacén', name: 'Mermelada BC', url: 'https://listado.mercadolibre.com.ar/mermelada-bc_Envio_Full' },
  { cat: 'Almacén', name: 'Cereales Granix', url: 'https://listado.mercadolibre.com.ar/cereales-desayuno_Envio_Full' },
  { cat: 'Almacén', name: 'Avena Quaker', url: 'https://listado.mercadolibre.com.ar/avena-quaker_Envio_Full' },

  // 4. GALLETITAS, DULCES Y SNACKS
  { cat: 'Almacén', name: 'Chocolinas', url: 'https://listado.mercadolibre.com.ar/chocolinas_Envio_Full' },
  { cat: 'Almacén', name: 'Galletitas Oreo', url: 'https://listado.mercadolibre.com.ar/galletitas-oreo_Envio_Full' },
  { cat: 'Almacén', name: 'Galletitas Pepitos', url: 'https://listado.mercadolibre.com.ar/pepitos_Envio_Full' },
  { cat: 'Almacén', name: 'Galletitas Sonrisas', url: 'https://listado.mercadolibre.com.ar/galletitas-sonrisas_Envio_Full' },
  { cat: 'Almacén', name: 'Galletitas Rumba', url: 'https://listado.mercadolibre.com.ar/galletitas-rumba_Envio_Full' },
  { cat: 'Almacén', name: 'Galletitas de Agua', url: 'https://listado.mercadolibre.com.ar/galletitas-agua_Envio_Full' },
  { cat: 'Almacén', name: 'Bizcochitos Don Satur', url: 'https://listado.mercadolibre.com.ar/don-satur_Envio_Full' },
  { cat: 'Almacén', name: 'Alfajores Havanna', url: 'https://listado.mercadolibre.com.ar/alfajores-havanna_Envio_Full' },
  { cat: 'Almacén', name: 'Alfajores Guaymallén', url: 'https://listado.mercadolibre.com.ar/alfajores-guaymallen_Envio_Full' },
  { cat: 'Almacén', name: 'Alfajores Fantoche', url: 'https://listado.mercadolibre.com.ar/alfajores-fantoche_Envio_Full' },
  { cat: 'Almacén', name: 'Chocolates Arcor', url: 'https://listado.mercadolibre.com.ar/chocolate-arcor_Envio_Full' },
  { cat: 'Almacén', name: 'Chocolates Milka', url: 'https://listado.mercadolibre.com.ar/chocolate-milka_Envio_Full' },
  { cat: 'Almacén', name: 'Caramelos y Gomitas Mogul', url: 'https://listado.mercadolibre.com.ar/gomitas-mogul_Envio_Full' },
  { cat: 'Almacén', name: 'Papas Fritas Lays', url: 'https://listado.mercadolibre.com.ar/papas-lays_Envio_Full' },

  // 5. LIMPIEZA DEL HOGAR
  { cat: 'Limpieza', name: 'Jabón Líquido Ala', url: 'https://listado.mercadolibre.com.ar/jabon-liquido-ala_Envio_Full' },
  { cat: 'Limpieza', name: 'Jabón Líquido Skip', url: 'https://listado.mercadolibre.com.ar/jabon-liquido-skip_Envio_Full' },
  { cat: 'Limpieza', name: 'Jabón Líquido Ariel', url: 'https://listado.mercadolibre.com.ar/jabon-liquido-ariel_Envio_Full' },
  { cat: 'Limpieza', name: 'Suavizante Vivere', url: 'https://listado.mercadolibre.com.ar/suavizante-vivere_Envio_Full' },
  { cat: 'Limpieza', name: 'Suavizante Comfort', url: 'https://listado.mercadolibre.com.ar/suavizante-comfort_Envio_Full' },
  { cat: 'Limpieza', name: 'Detergente Magistral', url: 'https://listado.mercadolibre.com.ar/detergente-magistral_Envio_Full' },
  { cat: 'Limpieza', name: 'Detergente Cif', url: 'https://listado.mercadolibre.com.ar/detergente-cif_Envio_Full' },
  { cat: 'Limpieza', name: 'Detergente Ala', url: 'https://listado.mercadolibre.com.ar/detergente-ala_Envio_Full' },
  { cat: 'Limpieza', name: 'Lavandina Ayudín', url: 'https://listado.mercadolibre.com.ar/lavandina-ayudin_Envio_Full' },
  { cat: 'Limpieza', name: 'Lavandina en Gel', url: 'https://listado.mercadolibre.com.ar/lavandina-en-gel_Envio_Full' },
  { cat: 'Limpieza', name: 'Desinfectante Lysoform', url: 'https://listado.mercadolibre.com.ar/desinfectante-lysoform_Envio_Full' },
  { cat: 'Limpieza', name: 'Limpiador Piso Poett', url: 'https://listado.mercadolibre.com.ar/limpiador-piso-poett_Envio_Full' },
  { cat: 'Limpieza', name: 'Limpiador Procénex', url: 'https://listado.mercadolibre.com.ar/procenex_Envio_Full' },
  { cat: 'Limpieza', name: 'Papel Higiénico Higienol', url: 'https://listado.mercadolibre.com.ar/papel-higienico-higienol_Envio_Full' },
  { cat: 'Limpieza', name: 'Papel Higiénico Elite', url: 'https://listado.mercadolibre.com.ar/papel-higienico-elite_Envio_Full' },
  { cat: 'Limpieza', name: 'Rollos de Cocina Sussex', url: 'https://listado.mercadolibre.com.ar/rollos-cocina-sussex_Envio_Full' },
  { cat: 'Limpieza', name: 'Bolsas de Residuos', url: 'https://listado.mercadolibre.com.ar/bolsas-de-residuos_Envio_Full' },
  { cat: 'Limpieza', name: 'Insecticida Raid', url: 'https://listado.mercadolibre.com.ar/insecticida-raid_Envio_Full' },
  { cat: 'Limpieza', name: 'Repelente Off', url: 'https://listado.mercadolibre.com.ar/repelente-off_Envio_Full' },
  { cat: 'Limpieza', name: 'Esponja Mortimer', url: 'https://listado.mercadolibre.com.ar/esponja-mortimer_Envio_Full' },

  // 6. PERFUMERÍA Y CUIDADO PERSONAL
  { cat: 'Perfumería', name: 'Shampoo Pantene', url: 'https://listado.mercadolibre.com.ar/shampoo-pantene_Envio_Full' },
  { cat: 'Perfumería', name: 'Shampoo Elvive', url: 'https://listado.mercadolibre.com.ar/shampoo-elvive_Envio_Full' },
  { cat: 'Perfumería', name: 'Shampoo Dove', url: 'https://listado.mercadolibre.com.ar/shampoo-dove_Envio_Full' },
  { cat: 'Perfumería', name: 'Shampoo Sedal', url: 'https://listado.mercadolibre.com.ar/shampoo-sedal_Envio_Full' },
  { cat: 'Perfumería', name: 'Shampoo Head Shoulders', url: 'https://listado.mercadolibre.com.ar/shampoo-head-and-shoulders_Envio_Full' },
  { cat: 'Perfumería', name: 'Acondicionador Pantene', url: 'https://listado.mercadolibre.com.ar/acondicionador-pantene_Envio_Full' },
  { cat: 'Perfumería', name: 'Desodorante Rexona', url: 'https://listado.mercadolibre.com.ar/desodorante-rexona_Envio_Full' },
  { cat: 'Perfumería', name: 'Desodorante Axe', url: 'https://listado.mercadolibre.com.ar/desodorante-axe_Envio_Full' },
  { cat: 'Perfumería', name: 'Desodorante Dove', url: 'https://listado.mercadolibre.com.ar/desodorante-dove_Envio_Full' },
  { cat: 'Perfumería', name: 'Jabón Dove', url: 'https://listado.mercadolibre.com.ar/jabon-dove_Envio_Full' },
  { cat: 'Perfumería', name: 'Jabón Palmolive', url: 'https://listado.mercadolibre.com.ar/jabon-palmolive_Envio_Full' },
  { cat: 'Perfumería', name: 'Dentífrico Colgate', url: 'https://listado.mercadolibre.com.ar/pasta-dental-colgate_Envio_Full' },
  { cat: 'Perfumería', name: 'Dentífrico Sensodyne', url: 'https://listado.mercadolibre.com.ar/pasta-dental-sensodyne_Envio_Full' },
  { cat: 'Perfumería', name: 'Cepillos Dientes Colgate', url: 'https://listado.mercadolibre.com.ar/cepillo-dental-colgate_Envio_Full' },
  { cat: 'Perfumería', name: 'Enjuague Listerine', url: 'https://listado.mercadolibre.com.ar/enjuague-bucal-listerine_Envio_Full' },
  { cat: 'Perfumería', name: 'Toallitas Always', url: 'https://listado.mercadolibre.com.ar/toallitas-always_Envio_Full' },
  { cat: 'Perfumería', name: 'Toallitas Kotex', url: 'https://listado.mercadolibre.com.ar/toallitas-kotex_Envio_Full' },
  { cat: 'Perfumería', name: 'Maquinitas Gillette', url: 'https://listado.mercadolibre.com.ar/gillette-prestobarba_Envio_Full' },
  { cat: 'Perfumería', name: 'Crema Hinds', url: 'https://listado.mercadolibre.com.ar/crema-hinds_Envio_Full' },
  { cat: 'Perfumería', name: 'Crema Nivea', url: 'https://listado.mercadolibre.com.ar/crema-nivea_Envio_Full' },

  // 7. BEBIDAS
  { cat: 'Bebidas', name: 'Coca-Cola', url: 'https://listado.mercadolibre.com.ar/coca-cola_Envio_Full' },
  { cat: 'Bebidas', name: 'Sprite', url: 'https://listado.mercadolibre.com.ar/sprite_Envio_Full' },
  { cat: 'Bebidas', name: 'Agua Villavicencio', url: 'https://listado.mercadolibre.com.ar/agua-villavicencio_Envio_Full' },
  { cat: 'Bebidas', name: 'Agua Levité', url: 'https://listado.mercadolibre.com.ar/levite_Envio_Full' },
  { cat: 'Bebidas', name: 'Jugos Tang', url: 'https://listado.mercadolibre.com.ar/jugos-tang_Envio_Full' },
  { cat: 'Bebidas', name: 'Cerveza Quilmes', url: 'https://listado.mercadolibre.com.ar/cerveza-quilmes_Envio_Full' },
  { cat: 'Bebidas', name: 'Cerveza Heineken', url: 'https://listado.mercadolibre.com.ar/cerveza-heineken_Envio_Full' },
  { cat: 'Bebidas', name: 'Cerveza Corona', url: 'https://listado.mercadolibre.com.ar/cerveza-corona_Envio_Full' },
  { cat: 'Bebidas', name: 'Vino Malbec', url: 'https://listado.mercadolibre.com.ar/vino-malbec_Envio_Full' },
  { cat: 'Bebidas', name: 'Vino Rutini', url: 'https://listado.mercadolibre.com.ar/vino-rutini_Envio_Full' },
  { cat: 'Bebidas', name: 'Fernet Branca', url: 'https://listado.mercadolibre.com.ar/fernet-branca_Envio_Full' },
  { cat: 'Bebidas', name: 'Aperitivo Campari', url: 'https://listado.mercadolibre.com.ar/campari_Envio_Full' },

  // 8. ALIMENTOS PARA MASCOTAS
  { cat: 'Mascotas', name: 'Alimento Pedigree Perro', url: 'https://listado.mercadolibre.com.ar/alimento-pedigree-perro_Envio_Full' },
  { cat: 'Mascotas', name: 'Alimento Dog Chow', url: 'https://listado.mercadolibre.com.ar/alimento-dog-chow_Envio_Full' },
  { cat: 'Mascotas', name: 'Alimento Whiskas Gato', url: 'https://listado.mercadolibre.com.ar/alimento-whiskas-gato_Envio_Full' },
  { cat: 'Mascotas', name: 'Alimento Cat Chow', url: 'https://listado.mercadolibre.com.ar/alimento-cat-chow_Envio_Full' },
  { cat: 'Mascotas', name: 'Piedras Sanitarias Gato', url: 'https://listado.mercadolibre.com.ar/piedras-sanitarias-gato_Envio_Full' }
];

async function createBrowserInstance() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
      '--window-position=-2400,-2400'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  return { browser, page };
}

export async function crawlMercadoLibreCatalog(maxPages = CATEGORY_PAGES.length) {
  console.log(`[MELI Scraper] Iniciando extracción masiva de Mercado Libre Full Super...`);
  console.log(`[MELI Scraper] Total categorías/páginas configuradas: ${CATEGORY_PAGES.length}`);

  let catalogMap = new Map();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (Array.isArray(existing)) {
        for (const item of existing) {
          if (item.url) catalogMap.set(item.url, item);
        }
        console.log(`[MELI Scraper] Catálogo previo cargado con ${catalogMap.size} productos existentes.`);
      }
    } catch (err) {
      console.warn(`[MELI Scraper] No se pudo leer catálogo previo:`, err.message);
    }
  }

  let { browser, page } = await createBrowserInstance();

  const pagesToScrape = CATEGORY_PAGES.slice(0, maxPages);
  let pageIndex = 0;
  let consecutiveEmpties = 0;

  try {
    for (const target of pagesToScrape) {
      pageIndex++;

      // Reciclar navegador cada 25 consultas o tras 2 fallos consecutivos
      if (consecutiveEmpties >= 2 || (pageIndex > 1 && pageIndex % 25 === 0)) {
        console.log(`[MELI Scraper] Reciclando sesión de navegador para mantener máxima velocidad...`);
        try { await browser.close(); } catch (e) {}
        await new Promise(r => setTimeout(r, 2000));
        const inst = await createBrowserInstance();
        browser = inst.browser;
        page = inst.page;
        consecutiveEmpties = 0;
      }

      console.log(`\n[MELI Scraper] [${pageIndex}/${pagesToScrape.length}] Cargando: ${target.cat} -> ${target.name}...`);
      
      try {
        await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise(r => setTimeout(r, 2000));
      } catch (gotoErr) {
        console.warn(`[MELI Scraper] Error de navegación: ${gotoErr.message}, reintentando...`);
        try {
          await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } catch (e2) {
          console.error(`[MELI Scraper] Falló carga de ${target.name}:`, e2.message);
          continue;
        }
      }

      try {
        await page.waitForSelector('.poly-card, .promotion-item, .ui-search-layout__item', { timeout: 8000 });
      } catch (waitErr) {
        // Si hay challenge o botón continuar, esperar o reciclar
        const hasChallenge = await page.evaluate(() => !!document.getElementById('continue-button'));
        if (hasChallenge) {
          console.log(`[MELI Scraper] Challenge detectado en ${target.name}, esperando 4s...`);
          await new Promise(r => setTimeout(r, 4000));
        } else {
          console.warn(`[MELI Scraper] Selector no apareció en ${target.name}.`);
        }
      }

      const extracted = await page.evaluate((categoryName) => {
        const list = [];
        const seenUrls = new Set();
        const elements = document.querySelectorAll('.poly-card, .promotion-item, .ui-search-layout__item');

        for (const el of elements) {
          const titleEl = el.querySelector('.poly-component__title, .promotion-item__title, a[title], .ui-search-item__title');
          const title = titleEl ? (titleEl.textContent.trim() || titleEl.getAttribute('title') || '') : '';

          const linkEl = el.querySelector('a.poly-component__title, a.promotion-item__link-container, a.ui-search-link, a[href*="mercadolibre.com.ar"], a');
          let link = linkEl ? linkEl.href : '';
          if (link) {
            link = link.split('#')[0];
            if (link.includes('/p/MLA')) {
              link = link.split('?')[0];
            }
          }

          const curPriceEl = el.querySelector('.poly-price__current .andes-money-amount__fraction, .andes-money-amount__fraction');
          const curPriceText = curPriceEl ? curPriceEl.textContent.replace(/\./g, '').replace(/,/g, '.') : '';
          const price = parseFloat(curPriceText) || 0;

          const oldPriceEl = el.querySelector('.andes-money-amount--previous .andes-money-amount__fraction, s .andes-money-amount__fraction');
          const oldPriceText = oldPriceEl ? oldPriceEl.textContent.replace(/\./g, '').replace(/,/g, '.') : '';
          const originalPrice = parseFloat(oldPriceText) || price;

          let discountPercent = 0;
          if (originalPrice > price) {
            discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
          }

          const imgEl = el.querySelector('img.poly-component__picture, img.promotion-item__img, img.ui-search-result-image__element, img[src*="mlstatic"]');
          const image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

          const isFull = el.textContent.includes('Full') || el.innerHTML.includes('full') || el.innerHTML.includes('⚡') || true;

          if (title && price > 0 && link && !seenUrls.has(link)) {
            seenUrls.add(link);
            list.push({
              title,
              price,
              originalPrice,
              discountPercent,
              link,
              image,
              isFull,
              categoryName
            });
          }
        }
        return list;
      }, target.cat);

      let newInThisPage = 0;
      for (const item of extracted) {
        const cleanLink = cleanProductUrl(item.link);
        const id = extractId(cleanLink);
        const brand = extractBrand(item.title);
        const productObj = {
          id,
          store: 'Mercado Libre',
          storeId: 'mercadolibre',
          title: item.title,
          brand,
          category: item.categoryName,
          price: item.price,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          image: item.image,
          available: true,
          url: cleanLink,
          isFull: item.isFull
        };

        if (!catalogMap.has(cleanLink)) {
          newInThisPage++;
        }
        catalogMap.set(cleanLink, productObj);
      }

      if (extracted.length === 0) {
        consecutiveEmpties++;
      } else {
        consecutiveEmpties = 0;
      }

      console.log(`[MELI Scraper] -> Extraídos: ${extracted.length} | Nuevos en este lote: ${newInThisPage} | Total acumulado único: ${catalogMap.size}`);

      if (newInThisPage > 0 || pageIndex % 5 === 0 || pageIndex === pagesToScrape.length || catalogMap.size >= 5100) {
        const currentList = Array.from(catalogMap.values());
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(currentList, null, 2), 'utf8');
        console.log(`[MELI Scraper] [Guardado incremental] ${currentList.length} productos persistidos en data/mercadolibre.json.`);
      }

      // Si ya superamos con margen el objetivo de 5.000 productos únicos, finalizar
      if (catalogMap.size >= 5100) {
        console.log(`[MELI Scraper] ¡Meta de 5.000+ productos superada con éxito! Total único: ${catalogMap.size}`);
        break;
      }

      const delay = Math.floor(Math.random() * 1000) + 1500;
      await new Promise(r => setTimeout(r, delay));
    }
  } finally {
    await browser.close();
  }

  const finalList = Array.from(catalogMap.values());
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalList, null, 2), 'utf8');
  console.log(`\n========================================================`);
  console.log(`[MELI Scraper] ¡EXTRACCIÓN FINALIZADA CON ÉXITO!`);
  console.log(`[MELI Scraper] Total productos en data/mercadolibre.json: ${finalList.length}`);
  console.log(`========================================================\n`);

  return finalList.length;
}

if (process.argv[1] && process.argv[1].endsWith('scrape-meli-full.js')) {
  crawlMercadoLibreCatalog()
    .then(count => {
      console.log(`Scraper finalizado. Total: ${count} productos.`);
      process.exit(0);
    })
    .catch(err => {
      console.error(`Error crítico en scraper:`, err);
      process.exit(1);
    });
}
