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
        addGeneralEventListeners(); // Ensure event listeners are added
        updateMap(geojsonData, houses); // Initial map update
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
        resetFilterButtonTexts(); // New function to reset all filter button texts
    });
    document.getElementById('status-filter').addEventListener('change', () => updateMap(geojsonData, houses));
    
    document.querySelectorAll('.multi-select-filter input').forEach(checkbox => {
        checkbox.addEventListener('change', () => updateMap(geojsonData, houses));
    });   

    function populateMultiSelect(id, options) {
        var container = document.getElementById(id);
        container.innerHTML = ''; // Clears previous options
        var dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
    
        var button = document.createElement('button');
        button.className = 'dropbtn';
        button.innerText = '选择'; // Default text
        button.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent the click event from bubbling up to document
            var isShown = dropdown.classList.contains('show');
            closeAllDropdowns(); // Close all open dropdowns first
            if (!isShown) {
                dropdown.classList.add('show'); // Only open this dropdown if it was previously closed
            }
        });
        dropdown.appendChild(button);
    
        var dropdownContent = document.createElement('div');
        dropdownContent.className = 'dropdown-content';
        dropdownContent.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent the click event from closing the dropdown
        });
    
        options.forEach(option => {
            var wrapper = document.createElement('div');
            wrapper.className = 'option-wrapper';
    
            var opt = document.createElement('input');
            opt.type = 'checkbox';
            opt.value = option.toString().trim();
            opt.id = `${id}-${option}`;
    
            var label = document.createElement('label');
            label.htmlFor = `${id}-${option}`;
            label.textContent = option.toString().trim();
    
            wrapper.appendChild(opt);
            wrapper.appendChild(label);
            dropdownContent.appendChild(wrapper);
    
            // Event listener to update button text when checkbox changes
            opt.addEventListener('change', function() {
                updateButtonText(id);
                updateMap(geojsonData, houses); // Update map based on filter change
            });
        });
    
        dropdown.appendChild(dropdownContent);
        container.appendChild(dropdown);
    }
    
    function updateButtonText(filterId) {
        var container = document.getElementById(filterId);
        var dropdown = container.querySelector('.dropdown');
        var button = dropdown.querySelector('.dropbtn');
        var checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        var selected = Array.from(checkboxes).map(checkbox => checkbox.nextSibling.textContent);
    
        if (selected.length > 0) {
            button.innerText = selected.join(', '); // Join selected items by comma
        } else {
            button.innerText = '选择'; // Default text if no checkbox is checked
        }
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    document.addEventListener('click', function() {
        closeAllDropdowns();
    });

                
    
    function populateFilters(houses, headers) {
        const filterMapping = {
            'style-filter': '风格',
            'type-filter': '户型',
            'status-filter': '销售状态',
            'mortgage-status-filter': '抵押状态',
            'property-nature-filter': '房源性质'
        };
    
        const houseList = Object.values(houses);
    
        Object.entries(filterMapping).forEach(([id, header]) => {
            if (headers.includes(header)) {
                var options = new Set(houseList.map(house => house[header] || '无').filter(Boolean));
                if (header === '户型') {
                    options = new Set([...options].sort((a, b) => a - b));
                }
                populateMultiSelect(id, options);
            }
        });
    }
    
    // Call this function after populating filters
    function addGeneralEventListeners() {
        document.querySelectorAll('.multi-select-filter input').forEach(checkbox => {
            checkbox.addEventListener('change', () => updateMap(geojsonData, houses));
        });
    
        document.getElementById('clear-filters-button').addEventListener('click', function() {
            clearFilters();
            resetInfoBox(); // Resets the info box to its default state
        });
    }

    function updateMap(geojsonData, houses) {
        houseLayer.clearLayers();
        var selectedStyles = Array.from(document.querySelectorAll('#style-filter input:checked')).map(input => input.value);
        var selectedTypes = Array.from(document.querySelectorAll('#type-filter input:checked')).map(input => input.value);
        var selectedStatuses = Array.from(document.querySelectorAll('#status-filter input:checked')).map(input => input.value);
        var selectedMortgageStatuses = Array.from(document.querySelectorAll('#mortgage-status-filter input:checked')).map(input => input.value);
        var selectedPropertyNatures = Array.from(document.querySelectorAll('#property-nature-filter input:checked')).map(input => input.value);
    
        L.geoJSON(geojsonData, {
            filter: feature => {
                var houseData = houses[feature.properties.ID];
                return (!selectedStyles.length || selectedStyles.includes(houseData.风格 || '无')) &&
                       (!selectedTypes.length || selectedTypes.includes(houseData.户型.toString() || '无')) &&
                       (!selectedStatuses.length || selectedStatuses.includes(houseData.销售状态 || '无')) &&
                       (!selectedMortgageStatuses.length || selectedMortgageStatuses.includes(houseData.抵押状态 || '无')) &&
                       (!selectedPropertyNatures.length || selectedPropertyNatures.includes(houseData.房源性质 || '无'));
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
                    var marker = L.marker(latlng, { icon: customIcon });
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
                    var popupContent = `ID: ${feature.properties.ID}<br>风格: ${houseData.风格 || '无'}<br>户型: ${houseData.户型 || '无'}<br>销售状态: ${houseData.销售状态 || '无'}`;
                    layer.bindPopup(popupContent, {
                        offset: L.point(0, -12)
                    });
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
        document.querySelectorAll('.multi-select-filter input:checked').forEach(checkbox => {
            checkbox.checked = false; // Uncheck all checkboxes
        });
        updateMap(geojsonData, houses); // Update map to show all data since filters are cleared
    }
    
    function resetInfoBox() {
        document.getElementById('property-info').innerHTML = '点击房屋查看详细信息。'; // Set a default or empty message
    }

    function resetFilterButtonTexts() {
        var filterContainers = document.querySelectorAll('.multi-select-filter');
        filterContainers.forEach(container => {
            var filterId = container.id;
            updateButtonText(filterId); // Call updateButtonText to reset the button text
        });
    }
});
