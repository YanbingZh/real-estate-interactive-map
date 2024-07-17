document.addEventListener("DOMContentLoaded", function() {
    var map = L.map('map', {
        center: [36.438900, 120.65700],
        zoom: 17,
        zoomControl: false,
        maxZoom: 20,
        minZoom: 17,
        maxBounds: L.latLngBounds(L.latLng(36.435100, 120.650800), L.latLng(36.442500, 120.664000)),
        maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZmVyZ2llemgwOCIsImEiOiJjbG16a2t0bjUxaXh6MmttenhhbTduemx2In0.iLoGnNSuKYA31RWtXcZcdg', {
        maxZoom: 20,
        attribution: 'Map data &copy; <a href="https://www.mapbox.com/">Mapbox</a>',
        tileSize: 512,
        zoomOffset: -1
    }).addTo(map);

    // Add custom zoom control
    L.control.zoom({
         position: 'topleft'
    }).addTo(map);

    // Custom control for resetting the map view
    var resetControl = L.control({position: 'topleft'});
    resetControl.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.style.backgroundColor = 'white'; // Set the background color to white
        div.innerHTML = '<button title="Reset view" style="background: none; border: none; cursor: pointer; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 1 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8.5 1.5V3h1a.5.5 0 0 1 0 1h-1.5V1.5a.5.5 0 0 1 1 0z"/></svg></button>';
        div.onclick = function(){
            map.setView([36.438900, 120.65700], 17);
        };
        return div;
    };
    resetControl.addTo(map);

    var houseLayer = L.layerGroup().addTo(map);
    var searchResults = L.layerGroup().addTo(map); // Properly initialize searchResults here
    var houses, geojsonData;

    map.on('popupclose', function() {
        resetInfoBox(); // Resets the info box to its default state when a popup is closed
    });
    
    Promise.all([
        fetch('https://yanbingzh.github.io/real-estate-interactive-map/data/Houses.geojson').then(response => response.json()),
        fetch('https://yanbingzh.github.io/real-estate-interactive-map/data/catalog.csv').then(response => response.text())
    ]).then(([geoJson, csvData]) => {
        var parsedData = Papa.parse(csvData, { header: true, dynamicTyping: true, skipEmptyLines: true });
        headers = parsedData.meta.fields;
        houses = parsedData.data.reduce((acc, row) => { acc[row['房源编号']] = row; return acc; }, {});
        geojsonData = geoJson;
        
        populateFilters(houses, headers);
        updateMap(geojsonData, houses);
    });

    map.on('click', function() {
        resetInfoBox(); // Use the centralized function to reset the info box
        searchResults.clearLayers(); // Clears any search results if displayed
    });    

    document.getElementById('search-button').addEventListener('click', () => searchById(geojsonData, houses));
    document.getElementById('clear-search-button').addEventListener('click', function() {
        clearSearch();
        resetInfoBox(); // Resets the info box to its default state
    });
    document.getElementById('clear-filters-button').addEventListener('click', function() {
        clearFilters();
        resetInfoBox(); // Resets the info box to its default state
    });
    document.getElementById('status-filter').addEventListener('change', () => updateMap(geojsonData, houses));
    document.getElementById('style-filter').addEventListener('change', () => updateMap(geojsonData, houses));
    document.getElementById('type-filter').addEventListener('change', () => updateMap(geojsonData, houses));
    document.getElementById('status-filter').addEventListener('change', () => updateMap(geojsonData, houses));

    function populateFilters(houses, headers) {
        const filterMapping = {
            'style-filter': '风格',
            'type-filter': '户型',
            'status-filter': '销售状态'
        };
    
        const houseList = Object.values(houses);
    
        Object.entries(filterMapping).forEach(([id, header]) => {
            if (headers.includes(header)) {
                var options = new Set(houseList.map(house => house[header]).filter(Boolean));
                if (header === '户型') {
                    // Convert to array, sort numerically, and convert back to Set if necessary
                    options = new Set([...options].sort((a, b) => a - b));
                }
                populateSelect(id, options);
            }
        });
    }
    

    function populateSelect(id, options) {
        var select = document.getElementById(id);
        select.innerHTML = '<option value="">选择</option>'; // Clears previous options
        options.forEach(option => {
            var opt = document.createElement('option');
            opt.value = opt.textContent = option.toString().trim(); // Ensure proper string handling
            select.appendChild(opt);
        });
    }

    function updateMap(geojsonData, houses) {
        houseLayer.clearLayers();
        L.geoJSON(geojsonData, {
            filter: feature => {
                var houseData = houses[feature.properties.ID];
                var style = document.getElementById('style-filter').value;
                var type = document.getElementById('type-filter').value;
                var status = document.getElementById('status-filter').value;

                return (!style || houseData && houseData.风格 === style) &&
                       (!type || houseData && houseData.户型.toString() === type) &&
                       (!status || houseData && houseData.销售状态 === status);
            },
            pointToLayer: function(feature, latlng) {
                var houseData = houses[feature.properties.ID];
                if (houseData) {
                    var iconUrl = getIconUrl(houseData);
                    var customIcon = L.icon({
                        iconUrl: iconUrl,
                        iconSize: [18, 24],
                        iconAnchor: [9, 24]
                    });
                    var marker = L.marker(latlng, {icon: customIcon});
                    marker.on('click', function() {
                        updateInfoBox(houseData);
                    });
                    return marker;
                }
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: "#ff7800",
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function(feature, layer) {
                var houseData = houses[feature.properties.ID];
                if (houseData) {
                    var popupContent = `ID: ${feature.properties.ID}<br>风格: ${houseData.风格}<br>户型: ${houseData.户型}<br>销售状态: ${houseData.销售状态}`;
                    layer.bindPopup(popupContent);
                }
            }
        }).addTo(houseLayer);
    }

    function getIconUrl(houseData) {
        var baseIconUrl = houseData.销售状态 === '已售' ? '_sold.png' : '.png';
        switch (houseData.风格) {
            case '西班牙': return 'https://yanbingzh.github.io/real-estate-interactive-map/images/spain' + baseIconUrl;
            case '法兰西': return 'https://yanbingzh.github.io/real-estate-interactive-map/images/france' + baseIconUrl;
            case '意大利': return 'https://yanbingzh.github.io/real-estate-interactive-map/images/italy' + baseIconUrl;
        }
    }

    function updateInfoBox(houseData) {
        var infoContent = headers.filter(header => header !== '序号').map(header => {
            return `<strong>${header}:</strong> ${houseData[header] || '无'}`;
        }).join('<br>');
        document.getElementById('property-info').innerHTML = infoContent;
    }
    
    function searchById(geojsonData, houses) {
        var searchId = document.getElementById('search-input').value.trim();
        if (!searchId) {
            clearSearch();
            return;
        }
        var found = false;
    
        geojsonData.features.forEach(feature => {
            if (houses[feature.properties.ID] && houses[feature.properties.ID].房源编号 === searchId) {
                var houseData = houses[feature.properties.ID];
                var latlng = L.geoJSON(feature.geometry).getLayers()[0].getLatLng();
                var iconUrl = getIconUrl(houseData);
                searchResults.clearLayers(); // Now should work without error
    
                var marker = L.marker(latlng, {
                    icon: L.icon({
                        iconUrl: iconUrl,
                        iconSize: [27.5, 37.5],
                        iconAnchor: [13.75, 18.75]
                    })
                }).addTo(searchResults).on('click', function() {
                    updateInfoBox(houseData);
                });
    
                marker.bindPopup(`ID: ${houseData.房源编号}<br>户型: ${houseData.户型}<br>风格: ${houseData.风格}<br>销售状态: ${houseData.销售状态}`).openPopup();
                updateInfoBox(houseData);
                map.setView(latlng, 19);
                found = true;
            }
        });
    
        if (!found) {
            alert('没有找到相应的房源编号');
            clearSearch();
        }
    }
    

    function clearSearch() {
        document.getElementById('search-input').value = '';
        searchResults.clearLayers();
        updateMap(geojsonData, houses);
    }

    
    function clearFilters() {
        document.getElementById('style-filter').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('status-filter').value = '';
        updateMap(geojsonData, houses); // Update map to show all data since filters are cleared
    }

    function resetInfoBox() {
        document.getElementById('property-info').innerHTML = '点击房屋查看详细信息。'; // Set a default or empty message
    }
});
