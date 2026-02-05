// admin.js - Fase 12: Restauración y Fix de CORS
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const path = "database.json";
// CIRUGÍA: La API de GitHub NO permite parámetros de caché como ?v=
const url = `https://api.github.com/repos/${repo}/contents/${path}`;

let sha = "";
let products = [];

async function loadProductsAdmin() {
    if (!itoken) {
        itoken = prompt("Tu sesión expiró o hay un problema de red. Por favor, ingresa tu Token:");
        if (itoken) localStorage.setItem('itoken', itoken);
    }

    try {
        // Petición limpia a la API (Sin rompe-caché para evitar error de CORS)
        const response = await fetch(url, {
            headers: { 
                'Authorization': `token ${itoken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('itoken');
            alert("Token inválido. Reingresa.");
            location.reload();
            return;
        }

        const data = await response.json();
        sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        products = content.products;
        renderAdminProducts();
    } catch (e) {
        console.error("Error crítico:", e);
        alert("Error de conexión con GitHub. Revisa la consola (F12).");
    }
}

// Función para guardar cambios (Esta es la que usa el Admin)
async function saveToGitHub(newProducts) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${itoken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Actualización desde Admin (Fase 12)",
                content: newContent,
                sha: sha
            })
        });

        if (response.ok) {
            alert("¡Cambios guardados con éxito en el depósito!");
            location.reload();
        } else {
            alert("Error al guardar. Verifica tu conexión.");
        }
    } catch (e) {
        console.error("Error al guardar:", e);
    }
}

// --- Aquí siguen tus funciones de renderizado del Admin (Botones, formularios, etc.) ---
// Asegúrate de mantener tus funciones de 'renderAdminProducts', 'deleteProduct', etc.
// Si las borraste accidentalmente, avisame y las reconstruimos.

document.addEventListener('DOMContentLoaded', loadProductsAdmin);