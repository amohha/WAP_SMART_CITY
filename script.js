document.addEventListener('DOMContentLoaded', () => {
    setupTabNavigation();

    const map = L.map('map', { zoomControl: false }).setView([20.1759234, 85.70367], 8);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
    }).addTo(map);

    const trafficFlowLayer = L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=jcuKA8OOXWjEQykToZuJTucqprunCJWi&thickness=10&style=night`, {
        attribution: '© TomTom',
        opacity: 0.6
    }).addTo(map);

    const trafficIncidentsLayer = L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=jcuKA8OOXWjEQykToZuJTucqprunCJWi`, {
        attribution: '© TomTom'
    }).addTo(map);

    L.control.layers({
        "Satellite View": satelliteMap,
        "Standard Map": L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=jcuKA8OOXWjEQykToZuJTucqprunCJWi`, { attribution: '© TomTom' })
    }, {
        "Traffic Flow": trafficFlowLayer,
        "Traffic Incidents": trafficIncidentsLayer
    }).addTo(map);

    const TOMTOM_API_KEY = 'jcuKA8OOXWjEQykToZuJTucqprunCJWi';
    const FLASK_API_URL = 'http://127.0.0.1:5000/predict_congestion';

    let currentRoadsData = []; // Store the latest roads data globally for route suggestions and rescheduling

    async function geocodeCity(city) {
        showLoading();
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'SmartCityMobility/1.0' } });
            if (!response.ok) throw new Error(`Geocoding failed: ${response.statusText}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon, display_name } = data[0];
                return [parseFloat(lat), parseFloat(lon), display_name];
            }
            throw new Error('City not found');
        } catch (error) {
            console.error('Geocoding error:', error);
            document.querySelector('#road-status-list').innerHTML = `<div class="error">Error finding city.</div>`;
            return null;
        }
    }

    async function reverseGeocodeAndNearbyRoads(lat, lon) {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'SmartCityMobility/1.0' } });
            if (!response.ok) throw new Error(`Reverse geocoding failed: ${response.statusText}`);
            const data = await response.json();
            if (!data || !data.address) throw new Error('Location not found');

            const formattedAddress = data.display_name;
            const primaryRoad = data.address.road || data.address.highway || 'Nearby Road';

            const bbox = `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`;
            const nearbyUrl = `https://nominatim.openstreetmap.org/search?format=json&q=highway&bbox=${bbox}&limit=10`;
            const nearbyResponse = await fetch(nearbyUrl, { headers: { 'User-Agent': 'SmartCityMobility/1.0' } });
            if (!nearbyResponse.ok) throw new Error(`Nearby roads fetch failed: ${nearbyResponse.statusText}`);
            const nearbyData = await nearbyResponse.json();

            const nearbyRoads = Array.isArray(nearbyData) ? nearbyData
                .filter(item => item.class === 'highway' && item.display_name !== formattedAddress)
                .map(item => ({
                    name: item.display_name.split(',')[0],
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                }))
                .filter((road, index, self) => road.name && self.findIndex(r => r.name === road.name) === index)
                .slice(0, 4) : [];

            return [formattedAddress, primaryRoad, nearbyRoads];
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return ["Selected Location", "Nearby Road", []];
        }
    }

    function getCongestionStatus(congestionLevel) {
        if (congestionLevel <= 10) return { status: 'Free Flow', color: '#22c55e', class: 'good' };
        else if (congestionLevel <= 30) return { status: 'Moderate Traffic', color: '#f59e0b', class: 'moderate' };
        else if (congestionLevel <= 50) return { status: 'Congested', color: '#ef4444', class: 'bad' };
        else return { status: 'Heavily Congested', color: '#7f1d1d', class: 'severe' };
    }

    function drawRoadSegment(trafficData, roadName, congestionStatus, lat, lon) {
        const coordinates = trafficData.flowSegmentData.coordinates?.coordinate || [];
        if (coordinates.length > 0) {
            const latLngs = coordinates.map(coord => [coord.latitude, coord.longitude]);
            const roadSegment = L.polyline(latLngs, {
                color: congestionStatus.color,
                weight: 5,
                opacity: 0.8,
                className: 'road-segment'
            }).addTo(map);

            const midPoint = latLngs[Math.floor(latLngs.length / 2)] || [lat, lon];

            // Enhanced popup content with congestion badge
            const popupContent = `
                <div class="traffic-info-popup">
                    <div class="road-name">${roadName}</div>
                    <div>Current Speed: ${trafficData.flowSegmentData.currentSpeed} km/h</div>
                    <div>Free Flow: ${trafficData.flowSegmentData.freeFlowSpeed} km/h</div>
                    <div class="congestion-badge ${congestionStatus.class}">
                        ${congestionStatus.status}
                    </div>
                </div>
            `;

            L.marker(midPoint, {
                icon: L.divIcon({
                    className: 'road-label',
                    html: `<div style="background-color: rgba(255, 255, 255, 0.9); padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; box-shadow: 0 1px 5px rgba(0,0,0,0.2); border-left: 4px solid ${congestionStatus.color};">${roadName}</div>`,
                    iconSize: [200, 20],
                    iconAnchor: [100, 10]
                })
            }).addTo(map).bindPopup(popupContent);

            return roadSegment.getBounds();
        }
        return null;
    }

    async function fetchTrafficDataForRoad(lat, lon, roadName) {
        const trafficUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_API_KEY}&point=${lat},${lon}`;
        try {
            const response = await fetch(trafficUrl);
            if (!response.ok) throw new Error(`Traffic data fetch failed for ${roadName}`);
            const trafficData = await response.json();

            const predictionResponse = await fetch(FLASK_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segments: [trafficData],
                    weather: 'Clear',
                    event: 'None',
                    time_offsets: [0, 30, 60, 120]
                })
            });

            if (!predictionResponse.ok) throw new Error(`Prediction failed for ${roadName}`);
            const predictionData = await predictionResponse.json();

            return { trafficData, predictionData };
        } catch (error) {
            console.error(`Error fetching data for ${roadName}:`, error);
            return null;
        }
    }

    async function suggestRoute(startLat, startLon, primaryRoad) {
        const destination = prompt("Enter your destination (e.g., 'Bhubaneswar Airport'):");
        if (!destination) return;

        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`;
        try {
            const geocodeResponse = await fetch(geocodeUrl, { headers: { 'User-Agent': 'SmartCityMobility/1.0' } });
            if (!geocodeResponse.ok) throw new Error('Destination geocoding failed');
            const geocodeData = await geocodeResponse.json();
            if (!geocodeData || geocodeData.length === 0) throw new Error('Destination not found');

            const { lat: endLat, lon: endLon } = geocodeData[0];
            const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLon}:${endLat},${endLon}/json?key=${TOMTOM_API_KEY}&traffic=true&routeType=fastest`;

            const routeResponse = await fetch(routeUrl);
            if (!routeResponse.ok) throw new Error('Route calculation failed');
            const routeData = await routeResponse.json();

            const routePoints = routeData.routes[0].legs[0].points.map(point => [point.latitude, point.longitude]);
            map.eachLayer(layer => { if (layer instanceof L.Polyline && layer.options.className === 'suggested-route') map.removeLayer(layer); });
            const routeLine = L.polyline(routePoints, {
                color: '#3b82f6',
                weight: 6,
                opacity: 0.7,
                className: 'suggested-route'
            }).addTo(map);

            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            alert(`Suggested route from ${primaryRoad} to ${destination} drawn on the map. Travel time: ${Math.round(routeData.routes[0].summary.travelTimeInSeconds / 60)} minutes`);
        } catch (error) {
            console.error('Route suggestion error:', error);
            alert('Failed to suggest a route. Please try again.');
        }
    }

    function rescheduleTrip(primaryRoad) {
        const primaryRoadData = currentRoadsData.find(r => r.road.name === primaryRoad);
        if (!primaryRoadData || !primaryRoadData.predictionData) {
            alert('No prediction data available to reschedule.');
            return;
        }

        const predictions = primaryRoadData.predictionData.predictions;
        const bestTime = predictions.reduce((best, current) => {
            const currentCongestion = current.congestion_level * 100;
            const bestCongestion = best.congestion_level * 100;
            return currentCongestion < bestCongestion ? current : best;
        });

        const congestionLevel = bestTime.congestion_level * 100;
        const status = getCongestionStatus(congestionLevel);
        const timeOffset = bestTime.time_offset;
        const timeText = timeOffset === 0 ? 'Now' : `${timeOffset} minutes from now`;

        document.querySelector('#mobility-prediction .prediction-display').innerHTML = `
            <div class="prediction-bar-container">
                <div class="prediction-bar ${status.class}" style="--prediction-width: ${Math.min(congestionLevel, 100)}%;"></div>
            </div>
            <div class="prediction-value" style="color: ${status.color};">Best time: ${timeText} (${congestionLevel.toFixed(1)}%)</div>
        `;
        alert(`Best time to travel on ${primaryRoad}: ${timeText} with ${status.status} (${congestionLevel.toFixed(1)}% congestion).`);
    }

    function updateTrafficDisplay(roadsData, formattedAddress, primaryRoad) {
        currentRoadsData = roadsData; // Store globally for Suggest Routes and Reschedule
        const roadStatusList = document.querySelector('#road-status-list');
        roadStatusList.innerHTML = '';

        const bounds = [];
        roadsData.forEach(({ road, trafficData, predictionData }) => {
            const currentSpeed = trafficData.flowSegmentData.currentSpeed;
            const freeFlowSpeed = trafficData.flowSegmentData.freeFlowSpeed;
            const travelTime = trafficData.flowSegmentData.currentTravelTime;

            const currentCongestionLevel = (1 - currentSpeed / freeFlowSpeed) * 100;
            const currentStatus = getCongestionStatus(currentCongestionLevel);

            const roadItem = document.createElement('div');
            roadItem.className = 'road-item';
            roadItem.innerHTML = `
                <div class="road-name">${road.name}</div>
                <div class="status-indicator">
                    <div class="indicator-circle" style="background-color: ${currentStatus.color};"></div>
                    <span class="status-value" style="color: ${currentStatus.color};">${currentStatus.status}</span>
                </div>
                <div class="mobility-metric">
                    <div class="metric">
                        <span class="metric-value">${currentSpeed || '--'}</span>
                        <span class="metric-label">Current Speed</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${freeFlowSpeed || '--'}</span>
                        <span class="metric-label">Free Flow</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${travelTime ? Math.round(travelTime / 60) : '--'}</span>
                        <span class="metric-label">Travel Time</span>
                    </div>
                </div>
                <div class="congestion-level">
                    <div class="congestion-bar-container">
                        <div class="congestion-bar ${currentStatus.class}" style="width: ${Math.min(currentCongestionLevel, 100)}%;"></div>
                    </div>
                    <div class="congestion-percentage">${currentCongestionLevel.toFixed(1)}% congestion</div>
                </div>
            `;
            roadStatusList.appendChild(roadItem);

            const roadBounds = drawRoadSegment(trafficData, road.name, currentStatus, road.lat, road.lon);
            if (roadBounds) bounds.push(roadBounds);
        });

        document.querySelector('#location-info .area-value').textContent = formattedAddress;
        document.querySelector('#location-info .road-value').textContent = primaryRoad;

        const predictionDisplay = document.querySelector('#mobility-prediction .prediction-display');
        const timeSelector = document.querySelectorAll('.time-btn');
        timeSelector.forEach(btn => {
            btn.addEventListener('click', () => {
                timeSelector.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const timeOffset = parseInt(btn.dataset.time);
                const primaryRoadData = roadsData.find(r => r.road.name === primaryRoad);
                if (primaryRoadData && primaryRoadData.predictionData) {
                    const prediction = primaryRoadData.predictionData.predictions.find(p => p.time_offset === timeOffset);
                    if (prediction && !prediction.error) {
                        const congestionLevel = prediction.congestion_level * 100;
                        const status = getCongestionStatus(congestionLevel);
                        predictionDisplay.innerHTML = `
                            <div class="prediction-bar-container">
                                <div class="prediction-bar ${status.class}" style="--prediction-width: ${Math.min(congestionLevel, 100)}%;"></div>
                            </div>
                            <div class="prediction-value" style="color: ${status.color};">${congestionLevel.toFixed(1)}%</div>
                        `;
                    } else {
                        predictionDisplay.innerHTML = `
                            <div class="prediction-bar-container">
                                <div class="prediction-bar error" style="--prediction-width: 0%;"></div>
                            </div>
                            <div class="prediction-value">--</div>
                        `;
                    }
                }
            });
        });

        timeSelector[0].click();

        // Add event listeners for Suggest Routes and Reschedule
        document.querySelector('.action-pill[data-action="suggest-routes"]').onclick = () => suggestRoute(roadsData[0].road.lat, roadsData[0].road.lon, primaryRoad);
        document.querySelector('.action-pill[data-action="reschedule"]').onclick = () => rescheduleTrip(primaryRoad);

        if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }

    async function fetchTrafficData() {
        const city = document.getElementById('cityInput').value || 'Bhubaneswar';
        const geocodeResult = await geocodeCity(city);
        if (!geocodeResult) return;

        const [lat, lon, formattedAddress] = geocodeResult;
        map.flyTo([lat, lon], 17, { duration: 2 });
        await updateRoadsForLocation(lat, lon, formattedAddress);
    }

    async function updateRoadsForLocation(lat, lon, formattedAddressOverride = null) {
        showLoading();

        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:#38bdf8; width:15px; height:15px; border-radius:50%; border:3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);" class="pulse"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        map.eachLayer(layer => { if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); });
        L.marker([lat, lon], { icon: customIcon }).addTo(map).bindPopup(`<b>${formattedAddressOverride || 'Analyzing...'}</b><br>Fetching traffic data...`);

        const [formattedAddress, primaryRoad, nearbyRoads] = await reverseGeocodeAndNearbyRoads(lat, lon);
        const allRoads = [{ name: primaryRoad, lat, lon }, ...nearbyRoads];

        const roadsData = [];
        for (const road of allRoads) {
            const data = await fetchTrafficDataForRoad(road.lat, road.lon, road.name);
            if (data) roadsData.push({ road, ...data });
        }

        if (roadsData.length > 0) {
            updateTrafficDisplay(roadsData, formattedAddressOverride || formattedAddress, primaryRoad);
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) layer.setPopupContent(`<b>${formattedAddressOverride || formattedAddress}</b><br>Traffic data updated`);
            });
        } else {
            document.querySelector('#road-status-list').innerHTML = '<div class="error">No traffic data available.</div>';
        }
    }

    function showLoading() {
        document.querySelector('#road-status-list').innerHTML = '<div class="loading">Loading road statuses...</div>';
        document.querySelector('#location-info .area-value').textContent = 'Loading...';
        document.querySelector('#location-info .road-value').textContent = 'Loading...';
        document.querySelector('#mobility-prediction .prediction-display').innerHTML = `
            <div class="prediction-bar-container">
                <div class="prediction-bar"></div>
            </div>
            <div class="prediction-value">--</div>
        `;
    }

    function addLegend() {
        // Remove existing legend if any
        document.querySelectorAll('.legend, .congestion-key-overlay').forEach(el => el.remove());

        // Add bottom right legend with detailed information
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function () {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Traffic Congestion</h4>
                <div class="legend-item"><span class="legend-color" style="background-color:#22c55e;"></span><span>Free Flow (0-10%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background-color:#f59e0b;"></span><span>Moderate (11-30%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background-color:#ef4444;"></span><span>Congested (31-50%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background-color:#7f1d1d;"></span><span>Heavily Congested (51%+)</span></div>
            `;
            return div;
        };
        legend.addTo(map);

        // Add compact key at top-right for quick reference
        const keyOverlay = document.createElement('div');
        keyOverlay.className = 'congestion-key-overlay';
        keyOverlay.innerHTML = `

        `;
        document.querySelector('.map-container').appendChild(keyOverlay);
    }

    addLegend();

    document.getElementById('cityInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') fetchTrafficData();
    });

    function getUserLocation() {
        showLoading();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async position => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    map.flyTo([lat, lon], 17, { duration: 2 });
                    await updateRoadsForLocation(lat, lon);
                },
                error => {
                    console.error('Geolocation error:', error);
                    fetchTrafficData();
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            fetchTrafficData();
        }
    }

    map.on('click', async (e) => {
        const { lat, lng: lon } = e.latlng;
        map.flyTo([lat, lon], 17, { duration: 2 });
        await updateRoadsForLocation(lat, lon);
    });

    if (navigator.geolocation) getUserLocation();
    else fetchTrafficData();
});

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            // Special case for emergency tab - redirect to emergency.html
            if (tabId === 'emergency') {
                window.location.href = 'emergency.html';
                return;
            }
            
            // Special case for weather tab - redirect to weather.html
            if (tabId === 'weather') {
                window.location.href = 'weather.html';
                return;
            }
            
            // For other tabs, just show the corresponding content
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to selected tab
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Set up actions for emergency tab button clicks
    document.addEventListener('click', event => {
        if (event.target.matches('#emergency-tab .placeholder-btn')) {
            showEmergencyUI();
        }
    });
}

function showEmergencyUI() {
    const emergencyTab = document.getElementById('emergency-tab');
    emergencyTab.innerHTML = '<div class="module-header"><h2><i class="fas fa-ambulance"></i> Emergency Response</h2></div><p class="placeholder-message">Navigating to emergency reporting page...</p>';
    
    // Redirect to emergency.html after a brief delay
    setTimeout(() => {
        window.location.href = 'emergency.html';
    }, 500);
}
