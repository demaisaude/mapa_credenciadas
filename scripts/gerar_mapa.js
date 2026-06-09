const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// ================= CONFIG =================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= GERAR MAPA =================

async function gerarMapa() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ SUPABASE_URL/SUPABASE_KEY ausentes.");
        process.exit(1);
    }


    const { data, error } = await supabase
        .from('view_fornecedores_servicos_ativos')
        .select(`
            id_fornecedor,
            nome,
            cidade,
            estado,
            endereco_latitude,
            endereco_longitude,
            servicos
        `)
        .not('endereco_latitude', 'is', null)
        .neq('endereco_latitude', 'NO_COORDS');

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("Nenhum fornecedor com coordenadas.");
        return;
    }

    let markers = '';
    let boundsArray = [];

    data.forEach(f => {

        const lat = parseFloat(f.endereco_latitude);
        const lng = parseFloat(f.endereco_longitude);

        if (isNaN(lat) || isNaN(lng)) return;

        boundsArray.push([lat, lng]);

        markers += `
            L.circleMarker([${lat}, ${lng}], {
                radius: 6
            })
            .addTo(map)
            .bindPopup("<b>${f.id_fornecedor}</b><br>${f.cidade}/${f.estado}");
        `;
    });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8"/>
    <title>Mapa Fornecedores Brasil</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

    <style>
    :root {
        --primary: #0d9488;
        --primary-hover: #0f766e;
        --bg-panel: rgba(255, 255, 255, 0.85);
        --border-color: rgba(226, 232, 240, 0.8);
        --text-main: #0f172a;
        --text-muted: #64748b;
        --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
        --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.08);
        --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    body {
        margin: 0;
        padding: 0;
        font-family: var(--font);
        background-color: #f8fafc;
        color: var(--text-main);
        overflow: hidden;
    }

    #map {
        height: 100vh;
        width: 100vw;
        z-index: 1;
    }

    /* Painel Lateral */
    .sidebar {
        position: absolute;
        top: 20px;
        left: 20px;
        bottom: 20px;
        width: 380px;
        z-index: 1000;
        background: var(--bg-panel);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 16px;
        box-shadow: var(--shadow-md);
        display: flex;
        flex-direction: column;
        overflow: visible; /* Permite que o botão toggle flutue do lado de fora */
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar.collapsed {
        transform: translateX(-400px);
    }

    .toggle-sidebar-btn {
        position: absolute;
        top: 50%;
        right: -24px;
        transform: translateY(-50%);
        width: 24px;
        height: 48px;
        background: var(--bg-panel);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--border-color);
        border-left: none;
        border-radius: 0 8px 8px 0;
        box-shadow: 4px 0 8px rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1001;
        color: var(--text-main);
        transition: all 0.2s ease;
        padding: 0;
    }

    .toggle-sidebar-btn:hover {
        background: white;
        color: var(--primary);
    }

    .toggle-sidebar-btn svg {
        width: 16px;
        height: 16px;
        transition: transform 0.3s ease;
    }

    .sidebar.collapsed .toggle-sidebar-btn svg {
        transform: rotate(180deg);
    }

    .sidebar-header {
        padding: 24px 20px;
        border-bottom: 1px solid var(--border-color);
    }

    .brand-section {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
    }

    .brand-icon {
        width: 10px;
        height: 24px;
        background: var(--primary);
        border-radius: 4px;
    }

    .brand-name {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-main);
        letter-spacing: -0.5px;
    }

    .sidebar-subtitle {
        font-size: 13px;
        color: var(--text-muted);
        margin: 0;
    }

    /* Stats */
    .stats-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(13, 148, 136, 0.05);
        border: 1px solid rgba(13, 148, 136, 0.1);
        padding: 10px 14px;
        border-radius: 10px;
        margin-top: 16px;
    }

    .stats-label {
        font-size: 12px;
        color: var(--text-muted);
        font-weight: 500;
    }

    .stats-value {
        font-size: 13px;
        font-weight: 700;
        color: var(--primary);
    }

    /* Filtros */
    .filters-section {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: rgba(248, 250, 252, 0.5);
        border-bottom: 1px solid var(--border-color);
    }

    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .input-icon {
        position: absolute;
        left: 12px;
        color: var(--text-muted);
        pointer-events: none;
        display: flex;
        align-items: center;
    }

    .input-icon svg {
        width: 16px;
        height: 16px;
    }

    .search-input {
        width: 100%;
        padding: 10px 12px 10px 36px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-family: var(--font);
        font-size: 14px;
        background: white;
        color: var(--text-main);
        box-shadow: var(--shadow-sm);
        transition: all 0.2s ease;
        box-sizing: border-box;
    }

    .search-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
    }

    /* Custom Select styling */
    .select-wrapper {
        position: relative;
    }

    .custom-select {
        width: 100%;
        padding: 10px 32px 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-family: var(--font);
        font-size: 14px;
        background: white;
        color: var(--text-main);
        box-shadow: var(--shadow-sm);
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
        box-sizing: border-box;
    }

    .custom-select:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
    }

    .select-wrapper::after {
        content: "";
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid var(--text-muted);
        pointer-events: none;
    }

    /* Lista de Resultados */
    .results-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
    }

    .results-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 700;
        color: var(--text-muted);
        margin-bottom: 12px;
        margin-top: 0;
    }

    .provider-card {
        background: white;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);
    }

    .provider-card:hover {
        border-color: var(--primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.08);
    }

    .provider-card.active {
        border-color: var(--primary);
        background: rgba(13, 148, 136, 0.02);
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.08);
    }

    .provider-name {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--text-main);
        line-height: 1.4;
    }

    .provider-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .provider-badge {
        font-size: 11px;
        background: #f1f5f9;
        color: var(--text-muted);
        padding: 2px 8px;
        border-radius: 20px;
        font-weight: 500;
    }

    .provider-services-count {
        font-size: 12px;
        color: var(--primary);
        font-weight: 600;
    }

    /* Customizing Leaflet popups */
    .leaflet-popup-content-wrapper {
        font-family: var(--font);
        border-radius: 16px;
        box-shadow: var(--shadow-md);
        padding: 10px 10px 6px 10px;
        border: 1px solid rgba(226, 232, 240, 0.8);
    }

    .leaflet-popup-content {
        margin: 8px;
    }

    .leaflet-popup-tip {
        box-shadow: var(--shadow-sm);
    }

    /* Tabela de Exames */
    .popup-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-main);
        margin-bottom: 4px;
        padding-right: 16px;
    }

    .popup-location {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 12px;
        font-weight: 500;
    }

    .exams-container {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #f1f5f9;
        border-radius: 8px;
    }

    .exam-row {
        padding: 8px 10px;
        border-bottom: 1px solid #f1f5f9;
    }

    .exam-row:last-child {
        border-bottom: none;
    }

    .exam-name {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-main);
        margin-bottom: 4px;
    }

    .exam-prices {
        display: flex;
        gap: 12px;
        font-size: 11px;
    }

    .price-item {
        color: var(--text-muted);
    }

    .price-val {
        font-weight: 600;
        color: var(--text-main);
    }

    .price-val.pagar {
        color: #059669; /* Verde para Pagar */
    }

    .price-val.cobrar {
        color: #2563eb; /* Azul para Cobrar */
    }

    /* Scrollbar Customization */
    ::-webkit-scrollbar {
        width: 6px;
    }
    ::-webkit-scrollbar-track {
        background: transparent;
    }
    ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    /* Mobile styles */
    @media (max-width: 768px) {
        .sidebar {
            top: auto;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 40vh;
            border-radius: 20px 20px 0 0;
            border-width: 1px 0 0 0;
        }
    }
    </style>
    </head>
    <body>

    <div class="sidebar" id="sidebar">
        <button class="toggle-sidebar-btn" id="toggleSidebarBtn" title="Minimizar painel">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"></path>
            </svg>
        </button>
        <div class="sidebar-header">
            <div class="brand-section">
                <div class="brand-icon"></div>
                <div class="brand-name">Demais Saúde</div>
            </div>
            <p class="sidebar-subtitle">Mapa de Credenciadas e Exames</p>

        </div>
        
        <div class="filters-section">
            <div class="input-wrapper">
                <span class="input-icon">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.636z"></path>
                    </svg>
                </span>
                <input type="text" id="searchInput" class="search-input" placeholder="Buscar por nome ou cidade...">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div class="select-wrapper">
                    <select id="stateFilter" class="custom-select">
                        <option value="">Estados</option>
                    </select>
                </div>
                <div class="select-wrapper">
                    <select id="examFilter" class="custom-select">
                        <option value="">Exames</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="results-list">
            <h4 class="results-title">Lista de Fornecedores</h4>
            <div id="resultsContainer"></div>
        </div>
    </div>

    <div id="map"></div>

    <script>

    var fornecedores = ${JSON.stringify(data)};

    // Limites do Brasil para restringir arrasto e zoom
    var bounds = [
        [-34.0, -74.0], // Sudoeste
        [5.5, -34.0]    // Nordeste
    ];

    var map = L.map('map', {
        minZoom: 4,
        maxZoom: 18,
        maxBounds: bounds,
        maxBoundsViscosity: 0.8
    }).setView([-14.2350, -51.9253], 4);

    // TileLayer moderno e limpo CartoDB Positron
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO'
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);
    var providerMarkers = {};

    // ===== Popular dropdowns =====
    let examesSet = new Set();
    let estadosSet = new Set();

    fornecedores.forEach(f => {
        if (f.servicos) {
            f.servicos.forEach(s => examesSet.add(s.servico));
        }
        if (f.estado) {
            estadosSet.add(f.estado.trim().toUpperCase());
        }
    });

    let examSelect = document.getElementById('examFilter');
    [...examesSet].sort().forEach(exame => {
        let option = document.createElement("option");
        option.value = exame;
        option.text = exame;
        examSelect.appendChild(option);
    });

    let stateSelect = document.getElementById('stateFilter');
    [...estadosSet].sort().forEach(estado => {
        let option = document.createElement("option");
        option.value = estado;
        option.text = estado;
        stateSelect.appendChild(option);
    });

    // ===== Renderizar marcadores e lista =====
    function renderMarkers() {

        markersLayer.clearLayers();
        providerMarkers = {};

        let searchText = document.getElementById('searchInput').value.toLowerCase();
        let exameSelecionado = document.getElementById('examFilter').value;
        let estadoSelecionado = document.getElementById('stateFilter').value;
        let filteredProviders = [];

        fornecedores.forEach(f => {

            const lat = parseFloat(f.endereco_latitude);
            const lng = parseFloat(f.endereco_longitude);

            if (isNaN(lat) || isNaN(lng)) return;

            // Filtro de busca (nome ou cidade)
            const matchesSearch = f.nome.toLowerCase().includes(searchText) || 
                                 (f.cidade && f.cidade.toLowerCase().includes(searchText));
            if (!matchesSearch) return;

            // Filtro de estado
            if (estadoSelecionado && (!f.estado || f.estado.trim().toUpperCase() !== estadoSelecionado)) return;

            // Filtro de exames
            let examesFiltrados = f.servicos || [];
            if (exameSelecionado) {
                examesFiltrados = (f.servicos || []).filter(s => s.servico === exameSelecionado);
                if (examesFiltrados.length === 0) return;
            }

            filteredProviders.push({
                provider: f,
                lat: lat,
                lng: lng,
                filteredExams: examesFiltrados
            });
        });


        const container = document.getElementById('resultsContainer');
        container.innerHTML = '';

        if (filteredProviders.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">Nenhum fornecedor encontrado</div>';
            return;
        }

        filteredProviders.forEach(item => {
            const f = item.provider;
            const lat = item.lat;
            const lng = item.lng;
            const examesFiltrados = item.filteredExams;

            let examesHtml = '';

            examesFiltrados.forEach(ex => {
                const pagarStr = ex.valor_a_pagar ? parseFloat(ex.valor_a_pagar).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
                const cobrarStr = ex.valor_a_cobrar ? parseFloat(ex.valor_a_cobrar).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

                examesHtml += \`
                    <div class="exam-row">
                        <div class="exam-name">\${ex.servico}</div>
                        <div class="exam-prices">
                            <span class="price-item">Pagar: <span class="price-val pagar">\${pagarStr}</span></span>
                            <span class="price-item">Cobrar: <span class="price-val cobrar">\${cobrarStr}</span></span>
                        </div>
                    </div>
                \`;
            });

            // Marcador personalizado
            let marker = L.circleMarker([lat, lng], {
                radius: 6,
                fillColor: '#0d9488',
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9
            })
            .bindPopup(
                "<div class='popup-title'>" + f.nome + "</div>" +
                "<div class='popup-location'>" + (f.cidade || 'Não informada') + " / " + (f.estado || '') + "</div>" +
                "<div class='exams-container'>" + examesHtml + "</div>",
                {
                    maxWidth: 280,
                    autoPan: true,
                    closeButton: true
                }
            );

            // Efeitos de Hover no marcador
            marker.on('mouseover', function() {
                this.setStyle({
                    radius: 9,
                    fillColor: '#0f766e',
                    weight: 2
                });
            });
            marker.on('mouseout', function() {
                this.setStyle({
                    radius: 6,
                    fillColor: '#0d9488',
                    weight: 1.5
                });
            });

            markersLayer.addLayer(marker);
            providerMarkers[f.id_fornecedor] = marker;

            // Criar card na barra lateral
            const card = document.createElement('div');
            card.className = 'provider-card';
            card.innerHTML = \`
                <h3 class="provider-name">\${f.nome}</h3>
                <div class="provider-meta">
                    <span class="provider-badge">\${f.cidade || 'Não informada'} / \${f.estado || ''}</span>
                    <span class="provider-services-count">\${examesFiltrados.length} \${examesFiltrados.length === 1 ? 'exame' : 'exames'}</span>
                </div>
            \`;

            // Clique no card centraliza o mapa e abre popup
            card.addEventListener('click', () => {
                document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                map.setView([lat, lng], 14, { animate: true, duration: 0.8 });
                setTimeout(() => {
                    marker.openPopup();
                }, 300);
            });

            container.appendChild(card);
        });
    }

    renderMarkers();

    document.getElementById('searchInput').addEventListener('input', renderMarkers);
    document.getElementById('examFilter').addEventListener('change', renderMarkers);
    document.getElementById('stateFilter').addEventListener('change', renderMarkers);

    // ===== Minimizar / Maximizar Painel Lateral =====
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
            toggleSidebarBtn.title = "Maximizar painel";
        } else {
            toggleSidebarBtn.title = "Minimizar painel";
        }
        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    });

    </script>
    </body>
    </html>
    `;

    fs.mkdirSync('docs', { recursive: true });
    fs.writeFileSync('docs/index.html', html);
    fs.writeFileSync('mapa_fornecedores.html', html);

    console.log('🗺️ Mapa gerado: docs/index.html e mapa_fornecedores.html');
}

gerarMapa();
