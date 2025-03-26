document.addEventListener('DOMContentLoaded', () => {
    // Initialize map for location selection
    const locationMap = L.map('locationMap').setView([20.1759234, 85.70367], 13);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
    }).addTo(locationMap);
    
    let marker;
    let currentLocation = null;
    
    // Use current location button
    document.getElementById('useLocationBtn').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    setLocationOnMap(latitude, longitude);
                    reverseGeocode(latitude, longitude);
                },
                error => {
                    console.error('Geolocation error:', error);
                    alert('Could not get your location. Please enter it manually.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser. Please enter location manually.');
        }
    });
    
    // Set marker on map when clicking
    locationMap.on('click', (e) => {
        setLocationOnMap(e.latlng.lat, e.latlng.lng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
    
    function setLocationOnMap(lat, lng) {
        currentLocation = { lat, lng };
        
        if (marker) {
            locationMap.removeLayer(marker);
        }
        
        marker = L.marker([lat, lng], {
            draggable: true
        }).addTo(locationMap);
        
        marker.on('dragend', function(e) {
            const position = e.target.getLatLng();
            currentLocation = { lat: position.lat, lng: position.lng };
            reverseGeocode(position.lat, position.lng);
        });
        
        locationMap.setView([lat, lng], 15);
    }
    
    async function reverseGeocode(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
                headers: { 'User-Agent': 'SmartCityMobility/1.0' }
            });
            
            if (!response.ok) throw new Error('Geocoding failed');
            
            const data = await response.json();
            if (data && data.display_name) {
                document.getElementById('emergencyLocation').value = data.display_name;
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
    }
    
    // Handle form submission
    document.getElementById('emergencyReportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = document.getElementById('submitEmergency');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        
        // Gather form data
        const reportData = {
            name: document.getElementById('reporterName').value,
            type: document.getElementById('emergencyType').value,
            location: document.getElementById('emergencyLocation').value,
            coordinates: currentLocation,
            description: document.getElementById('emergencyDescription').value,
            severity: document.querySelector('input[name="severity"]:checked').value,
            timestamp: new Date().toISOString()
        };
        
        try {
            // Define API URL - update this to your MongoDB deployment URL if needed
            const API_URL = 'http://localhost:5050/api/emergency/report';
            // const API_URL = 'https://your-deployed-backend.com/api/emergency/report'; // Use this format for production

            // Send data to backend API
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });
            
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to submit report');
            }
            
            console.log('MongoDB Response:', responseData);
            
            // Show success message with the report ID
            alert(`Emergency report submitted successfully! Reference ID: ${responseData.reportId}\nEmergency services have been notified.`);
            
            // Add report status tracking (optional)
            localStorage.setItem('lastReportId', responseData.reportId);
            
            // Reset form
            document.getElementById('emergencyReportForm').reset();
            if (marker) locationMap.removeLayer(marker);
            currentLocation = null;
            
            // Redirect back to main page after a short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error submitting report:', error);
            alert(`Failed to submit emergency report: ${error.message}. Please try again or call emergency services directly.`);
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
        }
    });
});