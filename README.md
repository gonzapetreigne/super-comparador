# 🛒 Súper Comparador de Precios (Las Flores + Mercado Libre Full)

Aplicación web progresiva (**PWA**) mobile-first para comparar precios en tiempo real de los supermercados de **Las Flores, Buenos Aires**:
1. **Golópolis** (Sucursal Las Flores - ID 227)
2. **Actual Supermercados** (Sucursal Las Flores - ID 10)
3. **Supermercado Día%** (Día Online Argentina)
4. **Mercado Libre** (Supermercado con Envíos Full ⚡)

---

## ⚡ Despliegue 100% Gratuito en la Nube (Vercel)

Esta aplicación está lista para desplegarse en **Vercel** en menos de 2 minutos.  
**Ventajas:**
- **100% Gratis de por vida** (sin tarjeta de crédito).
- **Nunca se apaga ni se duerme**: abre instantáneamente en 1 segundo cuando estás en el supermercado con datos 4G.
- Dominio público permanente con HTTPS seguro (ej. `https://tu-comparador.vercel.app`).

### Pasos para publicar en Vercel:

#### 1. Subir a GitHub
Crea un repositorio en [GitHub.com](https://github.com) (privado o público) y sube los archivos de esta carpeta:
```bash
git init
git add .
git commit -m "Comparador de supermercados Las Flores"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

#### 2. Conectar con Vercel
1. Ingresa a [vercel.com](https://vercel.com) y crea tu cuenta gratuita (puedes iniciar sesión con tu cuenta de GitHub).
2. Haz clic en **"Add New..."** > **"Project"**.
3. Selecciona tu repositorio de GitHub y presiona **"Import"**.
4. Deja todas las opciones predeterminadas y haz clic en **"Deploy"**.
5. En 1 minuto tendrás tu enlace web permanente listo para abrir y usar en tu celular desde cualquier lugar.

---

## 🚀 Uso en tu Computadora (Local)

### Requisitos
- [Node.js](https://nodejs.org/) v18 o superior.

### Iniciar la Aplicación
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
node server.js
```

Verás en la consola:
```text
================================================================
🛒 Comparador de Precios (Las Flores + Mercado Libre Full)
================================================================
PC (Navegador):       http://localhost:3000
Celular (Misma Wi-Fi): http://192.168.x.x:3000
================================================================
```

Abre `http://localhost:3000` en tu computadora o abre la IP local que te indica en el navegador de tu celular conectado a tu red Wi-Fi.

---

## ✨ Características Principales

- **⚡ Consultas en Tiempo Real**: Busca en paralelo en las 4 tiendas en 1 a 3 segundos y obtiene los precios exactos del día.
- **🏆 Tarjetas Comparativas Unificadas**: Agrupa automáticamente productos idénticos por marca, código de barra y volumen, mostrando los 4 precios lado a lado y destacando en verde el más barato.
- **💡 Alternativas Económicas**: Si buscas una primera marca cara, te sugiere opciones más económicas encontradas en la misma búsqueda (ej. marcas propias Día o segundas marcas).
- **💳 Simulador de Promociones**: Switch interactivo para aplicar **Cuenta DNI** (-20% reintegro) o **Club Día** para calcular el precio final real en tu bolsillo.
- **🧺 Canasta / Carrito Inteligente con Ahorro Dividido**:
  - Calcula cuánto te sale la lista completa comprando todo en un solo lugar.
  - **Ahorro Dividido Óptimo**: Te indica exactamente qué comprar en Golópolis, qué en Actual, qué en Día y qué en Mercado Libre para pagar lo mínimo posible y cuánto dinero ahorras.
- **📋 Guardado y Compartir por WhatsApp**:
  - Guarda múltiples listas ("Compra mensual", "Asado", "Limpieza") directamente en el almacenamiento de tu celular sin necesidad de usuario ni contraseñas.
  - Botón para compartir la lista y desglose de compra directamente por WhatsApp con formato legible.
- **📲 PWA Instalable en el Celular**: Se puede agregar a la pantalla de inicio de Android o iPhone y abrirla a pantalla completa como una app nativa.

---

## 🏛️ Estructura del Proyecto

```text
├── api/
│   └── index.js           # Entrada Serverless para Vercel
├── vercel.json            # Configuración de rutas y timeouts para Vercel
├── server.js              # Servidor Express autónomo para PC o Render
├── package.json           # Dependencias y scripts
├── scrapers/
│   ├── golopolis.js       # Conector Golópolis (Sucursal Las Flores ID 227)
│   ├── actual.js          # Conector Actual Supermercados (Sucursal 10 Las Flores)
│   ├── dia.js             # Conector Día% Online (API VTEX)
│   ├── mercadolibre.js    # Conector Mercado Libre (Supermercado / Envíos Full)
│   └── matcher.js         # Motor de coincidencia, normalización y cálculo de ahorro
└── public/
    ├── index.html         # Interfaz web móvil adaptable (Tailwind CSS)
    ├── app.js             # Lógica cliente, carrito reactivo, persistencia local
    ├── manifest.json      # Configuración de instalación PWA
    ├── icon.svg           # Icono de la aplicación
    └── sw.js              # Service Worker para funcionamiento offline del cascarón
```
