async function initApp() {
    try {
        const response = await fetch('database.json');
        if (!response.ok) throw new Error('No se pudo cargar la base de datos');
        const data = await response.json();

        const config = data.siteConfig;
        if (config) {
            document.title = `${config.logoText} | Catálogo`;
            updateElementText('store-name', config.logoText);
            updateElementText('hero-title', config.heroTitle);
            updateElementText('hero-subtitle', config.heroSubtitle);
            updateElementText('hero-btn', config.heroButtonText);

            const heroSection = document.getElementById('hero-section');
            if (heroSection) heroSection.style.backgroundImage = `url('${config.heroImage}')`;
        }

        renderProductGrid(data.products, config.whatsappNumber);

    } catch (error) {
        console.error('Error:', error);
    }
}

function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderProductGrid(products, phone) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = products.map(product => {
        // Lógica de mensaje de WhatsApp
        const message = encodeURIComponent(`Hola Creaciones Marilyn, me interesa el producto: ${product.name} (Gs. ${product.price.toLocaleString()})`);
        const waLink = `https://wa.me/${phone}?text=${message}`;

        return `
            <article class="group bg-white p-3 rounded-sm shadow-sm hover:shadow-md transition-all">
                <div class="relative aspect-square overflow-hidden bg-gray-50">
                    <img src="${product.image}" alt="${product.name}" class="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110">
                    <span class="absolute top-2 left-2 bg-white/90 px-2 py-1 text-[10px] uppercase font-bold tracking-widest">${product.collection}</span>
                </div>
                <div class="mt-4 text-center">
                    <h3 class="text-sm font-medium text-gray-900 uppercase tracking-tighter">${product.name}</h3>
                    <p class="text-pink-600 font-bold mt-1">Gs. ${product.price.toLocaleString('es-PY')}</p>
                    
                    <a href="${waLink}" target="_blank" class="mt-4 inline-flex items-center justify-center w-full py-2 border border-gray-900 text-[10px] uppercase tracking-widest font-bold hover:bg-gray-900 hover:text-white transition-colors">
                        Consultar Disponibilidad
                    </a>
                </div>
            </article>
        `;
    }).join('');
}

window.addEventListener('DOMContentLoaded', initApp);