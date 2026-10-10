import { escapeHtml, imageForDisplay } from './catalog.mjs';

export function renderCategoriesHTML(allProducts, activeCategory = "todas") {
    const categories = ['todas', ...new Set(allProducts
        .filter(p => p.status.toLowerCase() !== 'anuncio' && !p.popup)
        .map(p => p.collection.toLowerCase().trim()))].sort();
        
    return categories.map(cat => `
        <button data-action="category" data-category="${escapeHtml(cat)}"
            class="whitespace-nowrap px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm
            ${cat === activeCategory ? 'bg-pink-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'}">${escapeHtml(cat)}</button>
    `).join('');
}

export function renderProductGrid(products, { activeCategory = "todas", searchTerm = "", images = {} } = {}) {

    if (products.length === 0) {
        return '<p class="text-center col-span-full py-20 text-gray-400 uppercase text-[10px]">Sin resultados</p>';
    }


    if (activeCategory === 'todas' && searchTerm === "") {
        const destacados = products.filter(p => p.destacado).slice(0, 6);
        const noDestacados = products.filter(p => !p.destacado);

        const grouped = noDestacados.reduce((acc, p) => {
            const col = p.collection || "Otros";
            if (!acc[col]) acc[col] = [];
            acc[col].push(p);
            return acc;
        }, Object.create(null));

        let finalHTML = '';

        if (destacados.length > 0) {
            finalHTML += `
                <div class="category-section mb-12">
                    <div class="flex justify-between items-center mb-6 px-2">
                        <h3 class="text-sm font-black uppercase tracking-[0.2em] text-pink-600">
                            <i class="fas fa-star mr-2"></i> Destacados de la Semana
                        </h3>
                    </div>
                    <div class="flex overflow-x-auto space-x-6 pb-6 no-scrollbar snap-x snap-mandatory">
                        ${destacados.map(p => createProductCard(p, true, images)).join('')}
                    </div>
                </div>
                <div class="h-px bg-gray-100 mb-12"></div>
            `;
        }

        finalHTML += Object.keys(grouped).sort().map(category => `
            <div class="category-section">
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 class="text-sm font-black uppercase tracking-widest text-gray-800 hover:text-pink-600 transition-colors">
                        <button data-action="category" data-category="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)} <i class="fas fa-chevron-right text-[10px] ml-2 opacity-30"></i></button>
                    </h3>
                    <span class="text-[9px] text-gray-400 font-bold uppercase">${grouped[category].length} items</span>
                </div>
                <div class="flex overflow-x-auto space-x-6 pb-6 no-scrollbar snap-x snap-mandatory">
                    ${grouped[category].map(p => createProductCard(p, true, images)).join('')}
                </div>
            </div>
        `).join('');

        return finalHTML;
    } else {
        const sorted = [...products].sort((a, b) => (b.destacado === true) - (a.destacado === true));
        return `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            ${sorted.map(p => createProductCard(p, false, images)).join('')}
        </div>`;
    }
}

export function createProductCard(p, isHorizontal = false, optimizedImages = {}) {
    const statusStr = p.status.toLowerCase();
    const isAgotado = statusStr.includes("agotado") || statusStr.includes("sin stock") || p.available === false;
    const isOferta = statusStr.includes("oferta");
    const isNuevo = statusStr.includes("nuevo");

    let badgeHTML = '';
    if (isAgotado) {
        badgeHTML = `<div class="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 font-black text-gray-900 text-[12px] uppercase tracking-[0.2em]">Agotado</div>`;
    } else if (p.destacado) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-yellow-400 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg"><i class="fas fa-star"></i> Destacado</div>`;
    } else if (isOferta) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg animate-pulse">Oferta</div>`;
    } else if (isNuevo) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-pink-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg">Nuevo</div>`;
    }

    const mainImage = imageForDisplay(p.images[0], optimizedImages);

    return `
        <div class="${isHorizontal ? 'min-w-[240px] md:min-w-[300px] snap-start' : ''} bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group transition-all duration-500 hover:shadow-xl relative">
            <button type="button" aria-label="Ver fotos de ${escapeHtml(p.name)}" data-action="gallery" data-product-id="${escapeHtml(p.id)}" class="relative w-full h-48 md:h-64 overflow-hidden cursor-pointer bg-gray-50 flex items-center justify-center">
                ${badgeHTML}
                <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" width="600" height="600" class="w-full h-full object-cover transition-transform duration-700 ${!isAgotado ? 'group-hover:scale-110' : 'grayscale opacity-70' }">
                <span class="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full text-[9px] font-bold uppercase text-gray-500 z-10">${escapeHtml(p.collection)}</span>
            </button>
            <div class="p-4 md:p-6 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-[10px] md:text-[11px] mb-1 line-clamp-1" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
                <p class="text-pink-600 font-black mb-4 text-xs md:text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button data-action="add" data-product-id="${escapeHtml(p.id)}" ${isAgotado ? 'disabled' : ''}
                    class="w-full ${isAgotado ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-pink-600 cursor-pointer'} py-3 rounded-xl text-[9px] font-bold uppercase transition-all">
                    ${isAgotado ? 'Agotado' : 'Agregar al carrito'}
                </button>
            </div>
        </div>`;
}
