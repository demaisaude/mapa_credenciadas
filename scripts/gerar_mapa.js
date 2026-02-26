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
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

    <style>
    body { margin:0; font-family: Arial; }
    #map { height: 100vh; }

    .control-panel {
        position:absolute;
        bottom:20px;
        right:20px;
        z-index:1000;
        background:white;
        padding:10px;
        border-radius:10px;
        box-shadow:0 4px 12px rgba(0,0,0,0.25);
        width:240px;
        max-height:300px;
        overflow-y:auto;
    }

    .control-panel input,
    .control-panel select {
        width:100%;
        padding:6px;
        margin-bottom:8px;
        box-sizing:border-box;
        font-size:14px;
        height:34px;
    }
    </style>
    </head>
    <body>

    <div class="control-panel">
        <input type="text" id="searchInput" placeholder="Buscar fornecedor...">
        <select id="examFilter">
            <option value="">Filtrar por exame</option>
        </select>
    </div>

    <div id="map"></div>

    <script>

    var fornecedores = ${JSON.stringify(data)};

    var map = L.map('map').setView([-14.2350, -51.9253], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);

    // ===== Popular dropdown de exames =====
    let examesSet = new Set();

    fornecedores.forEach(f => {
        if (f.servicos) {
            f.servicos.forEach(s => examesSet.add(s.servico));
        }
    });

    let examSelect = document.getElementById('examFilter');
    [...examesSet].sort().forEach(exame => {
        let option = document.createElement("option");
        option.value = exame;
        option.text = exame;
        examSelect.appendChild(option);
    });

    // ===== Renderizar marcadores =====
    function renderMarkers() {

        markersLayer.clearLayers();

        let searchText = document.getElementById('searchInput').value.toLowerCase();
        let exameSelecionado = document.getElementById('examFilter').value;

        fornecedores.forEach(f => {

            const lat = parseFloat(f.endereco_latitude);
            const lng = parseFloat(f.endereco_longitude);

            if (isNaN(lat) || isNaN(lng)) return;

            if (!f.nome.toLowerCase().includes(searchText)) return;

            let examesFiltrados = f.servicos;

            if (exameSelecionado) {
                examesFiltrados = f.servicos.filter(s => s.servico === exameSelecionado);
                if (examesFiltrados.length === 0) return;
            }

            let examesHtml = '';

            examesFiltrados.forEach(ex => {
                examesHtml += \`
                    <div style="margin-bottom:4px;">
                        <b>\${ex.servico}</b><br>
                        Pagar: R$ \${ex.valor_a_pagar} |
                        Cobrar: R$ \${ex.valor_a_cobrar}
                    </div>
                \`;
            });

            let marker = L.circleMarker([lat, lng], { radius:6 })
            .bindPopup(
                "<div style='max-height:200px; overflow-y:auto; font-size:13px;'>" +
                "<b style='font-size:14px;'>" + f.nome + "</b><br><br>" +
                examesHtml +
                "</div>",
                {
                    maxWidth: 260,
                    autoPan: true,
                    closeButton: true
                }
            );

            markersLayer.addLayer(marker);
        });
    }

    renderMarkers();

    document.getElementById('searchInput').addEventListener('input', renderMarkers);
    document.getElementById('examFilter').addEventListener('change', renderMarkers);

    </script>
    </body>
    </html>
    `;

    fs.mkdirSync('docs', { recursive: true });
    fs.writeFileSync('docs/index.html', html);

    console.log('🗺️ Mapa gerado: mapa_fornecedores.html');
}

gerarMapa();
