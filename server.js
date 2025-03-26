require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Log Twilio configuration
console.log('Twilio Configuration:', {
  accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Not set',
  authToken: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Not set',
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
});

// Weather monitoring configuration
const weatherConfig = {
  highTempThreshold: parseInt(process.env.HIGH_TEMP_THRESHOLD) || 35,
  heavyRainThreshold: parseInt(process.env.HEAVY_RAIN_THRESHOLD) || 10,
  checkInterval: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 30,
  defaultLocation: process.env.DEFAULT_LOCATION || 'New York,NY'
};

// Static list of receivers
const STATIC_RECEIVERS = [
  '+917735601483',  // Replace with actual numbers
  '+916370906519',
  '+919827969492',
  '+919110988058',
  '+917683915002'
];

// Send SMS using Twilio
async function sendSMS(to, message) {
  try {
    if (!to || !message) {
      throw new Error('Phone number and message are required');
    }
    
    // Validate phone number format (basic check)
    if (!to.match(/^\+\d{10,15}$/)) {
      throw new Error('Invalid phone number format. Must include country code (e.g., +1XXXXXXXXXX)');
    }
    
    console.log(`Sending SMS to ${to}: ${message}`);
    
    // Create Twilio client with credentials from .env
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Send message
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    
    console.log(`SMS sent successfully! SID: ${result.sid}`);
    return { success: true, sid: result.sid, status: result.status };
  } catch (error) {
    console.error('Error sending SMS:', error.message);
    
    // Handle specific Twilio errors
    let errorMessage = 'Failed to send SMS';
    
    if (error.code) {
      switch (error.code) {
        case 21211:
          errorMessage = 'Invalid phone number format';
          break;
        case 21608:
          errorMessage = 'Unverified phone number. Free Twilio accounts can only send to verified numbers';
          break;
        case 21614:
          errorMessage = 'Invalid Twilio phone number';
          break;
        default:
          errorMessage = `Twilio error: ${error.message}`;
      }
    }
    
    throw new Error(errorMessage);
  }
}

// Get weather data from Visual Crossing API
async function getWeatherData(location) {
  try {
    // Use demo key for testing - replace with your own
    const apiKey = process.env.WEATHER_API_KEY || 'DEMO_KEY'; 
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/today?unitGroup=metric&include=current&key=${apiKey}&contentType=json`;
    
    console.log(`Fetching weather data for: ${location}`);
    const response = await axios.get(url);
    const data = response.data;
    
    // Now fetch air quality data
    let aqi = null;
    let aqiLevel = "Unknown";
    let components = null;
    
    try {
      // Get coordinates from weather data
      const lat = data.latitude;
      const lon = data.longitude;
      
      console.log(`Coordinates for ${location}: ${lat}, ${lon}`);
      
      // Fetch air quality data
      console.log(`Fetching air quality data for coordinates: ${lat}, ${lon}`);
      const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=8a723a09ea437bf4672a08be4fc5fd46`;
      console.log(`AQI API URL: ${aqiUrl}`);
      
      const aqiResponse = await axios.get(aqiUrl);
      console.log('AQI API Response:', JSON.stringify(aqiResponse.data, null, 2));
      
      if (aqiResponse.data && aqiResponse.data.list && aqiResponse.data.list.length > 0) {
        const aqiData = aqiResponse.data.list[0];
        aqi = aqiData.main.aqi;
        components = aqiData.components;
        
        // Convert AQI number to descriptive level
        switch(aqi) {
          case 1: aqiLevel = "Good"; break;
          case 2: aqiLevel = "Fair"; break;
          case 3: aqiLevel = "Moderate"; break;
          case 4: aqiLevel = "Poor"; break;
          case 5: aqiLevel = "Very Poor"; break;
          default: aqiLevel = "Unknown";
        }
        
        console.log(`Air Quality Index: ${aqi} (${aqiLevel})`);
        if (components) {
          console.log('AQI Components:', components);
        }
      } else {
        console.log('No AQI data found in response');
      }
    } catch (aqiError) {
      console.error('Error fetching air quality data:', aqiError.message);
      if (aqiError.response) {
        console.error('AQI Error response:', aqiError.response.data);
      }
      // Continue without air quality data
    }
    
    // Transform data to standardized format
    return {
      address: data.resolvedAddress || location,
      timezone: data.timezone,
      coordinates: {
        latitude: data.latitude,
        longitude: data.longitude
      },
      current: {
        temp: data.currentConditions.temp,
        feelslike: data.currentConditions.feelslike,
        humidity: data.currentConditions.humidity,
        windspeed: data.currentConditions.windspeed,
        conditions: data.currentConditions.conditions,
        precip: data.currentConditions.precip || 0,
        datetime: data.currentConditions.datetime,
        description: data.days[0].description || '',
        icon: getWeatherIcon(data.currentConditions.conditions),
        aqi: aqi,
        aqiLevel: aqiLevel,
        aqiComponents: components
      },
      alerts: data.alerts || []
    };
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    
    // Return default data for testing if API fails
    return {
      address: location,
      timezone: 'Asia/Kolkata',
      coordinates: {
        latitude: 20.2961,
        longitude: 85.8245
      },
      current: {
        temp: 30,
        feelslike: 32,
        humidity: 70,
        windspeed: 10,
        conditions: 'Partly Cloudy',
        precip: 0,
        datetime: new Date().toISOString(),
        description: 'Partly cloudy conditions throughout the day.',
        icon: 'cloud-sun',
        aqi: 2,
        aqiLevel: 'Fair',
        aqiComponents: {
          co: 303.74,
          no: 0.02,
          no2: 1.07,
          o3: 68.67,
          so2: 0.53,
          pm2_5: 5.59,
          pm10: 9.43,
          nh3: 0.69
        }
      },
      alerts: []
    };
  }
}

// Get weather icon based on conditions
function getWeatherIcon(condition) {
  const conditions = condition ? condition.toLowerCase() : '';
  
  if (conditions.includes('clear') || conditions.includes('sunny')) {
    return 'sun';
  } else if (conditions.includes('partly cloudy')) {
    return 'cloud-sun';
  } else if (conditions.includes('cloud')) {
    return 'cloud';
  } else if (conditions.includes('rain')) {
    return 'cloud-rain';
  } else if (conditions.includes('thunder')) {
    return 'bolt';
  } else if (conditions.includes('snow')) {
    return 'snowflake';
  } else if (conditions.includes('fog') || conditions.includes('mist')) {
    return 'smog';
  } else {
    return 'cloud';
  }
}

// Function to send SMS to all receivers
async function broadcastSMS(message) {
  const results = [];
  for (const receiver of STATIC_RECEIVERS) {
    const result = await sendSMS(receiver, message);
    results.push({ number: receiver, ...result });
  }
  return {
    success: results.some(r => r.success),
    results: results
  };
}

// Function to check weather conditions and send alerts
async function checkWeatherAndSendAlerts(location) {
  try {
    const weatherData = await getWeatherData(location);
    const currentConditions = weatherData.current;
    const messages = [];

    if (!currentConditions.temp && currentConditions.temp !== 0) {
      throw new Error('Temperature data not available for this location');
    }

    // Create interactive SMS with emojis and formatting
    messages.push(`🌦️ *WEATHER UPDATE* 🌦️
📍 *${weatherData.address}*
${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}

🌡️ Temp: ${Math.round(currentConditions.temp)}°C (Feels like: ${Math.round(currentConditions.feelslike)}°C)
💧 Humidity: ${currentConditions.humidity}%
💨 Wind: ${currentConditions.windspeed} km/h
☁️ Conditions: ${currentConditions.conditions}
${currentConditions.aqi ? `
🌬️ *AIR QUALITY*
AQI: ${currentConditions.aqi}/5 (${currentConditions.aqiLevel})
${getAQIRecommendation(currentConditions.aqi)}` : ''}`);

    // Add alerts if conditions exceed thresholds
    const alerts = [];
    
    if (currentConditions.temp >= weatherConfig.highTempThreshold) {
      alerts.push(`⚠️ *HIGH TEMPERATURE ALERT!*\nTemperature has reached ${Math.round(currentConditions.temp)}°C. Stay hydrated and avoid direct sun exposure.`);
    }

    if (currentConditions.precip >= weatherConfig.heavyRainThreshold) {
      alerts.push(`⚠️ *HEAVY RAIN ALERT!*\nRainfall of ${currentConditions.precip}mm detected. Watch for localized flooding and drive carefully.`);
    }
    
    if (currentConditions.aqi >= 4) {
      alerts.push(`⚠️ *POOR AIR QUALITY ALERT!*\nAir quality is ${currentConditions.aqiLevel}. Consider limiting outdoor activities.`);
    }
    
    if (alerts.length > 0) {
      messages.push(`\n${alerts.join('\n\n')}`);
    }
    
    messages.push(`\nStay safe and have a great day! 🌈`);

    // Send the combined message to all receivers
    const fullMessage = messages.join('\n');
    const result = await broadcastSMS(fullMessage);

    if (result.success) {
      return {
        success: true,
        message: 'Weather information broadcast successfully',
        weatherData: currentConditions,
        broadcastResults: result.results
      };
    } else {
      throw new Error('Failed to send messages to any receiver');
    }
  } catch (error) {
    console.error('Error in weather check:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to check weather conditions. Please try again later.'
    };
  }
}

// Get AQI recommendation based on level
function getAQIRecommendation(aqi) {
  switch(aqi) {
    case 1: 
      return "Air quality is good - perfect for outdoor activities!";
    case 2: 
      return "Air quality is fair - suitable for most outdoor activities.";
    case 3: 
      return "Air quality is moderate - sensitive individuals should limit prolonged outdoor exertion.";
    case 4: 
      return "Air quality is poor - everyone should reduce outdoor activities.";
    case 5: 
      return "Air quality is very poor - avoid outdoor activities if possible.";
    default: 
      return "";
  }
}

// Send SMS endpoint
app.post('/send-sms', async (req, res) => {
  try {
    const { to, message, twilioConfig } = req.body;
    
    console.log('----- SMS Request Details -----');
    console.log('To:', to);
    console.log('Message length:', message ? message.length : 0);
    console.log('Using client credentials:', !!twilioConfig);
    
    if (!to) {
      console.log('Error: Phone number is required');
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    if (!message) {
      console.log('Error: Message content is required');
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }
    
    console.log(`SMS request received for ${to}`);
    
    // Validate phone number format
    if (!to.match(/^\+\d{10,15}$/)) {
      console.log('Error: Invalid phone number format');
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Must include country code (e.g., +1XXXXXXXXXX)'
      });
    }
    
    // If client provided Twilio config, use it for this request only
    if (twilioConfig && twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.phoneNumber) {
      console.log('Using client-provided Twilio credentials');
      console.log('AccountSid:', twilioConfig.accountSid.substring(0, 10) + '...');
      console.log('Phone number:', twilioConfig.phoneNumber);
      
      try {
        // Create one-time client with provided credentials
        const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
        
        // Fix phone number formatting if needed
        let formattedNumber = to;
        if (!formattedNumber.startsWith('+')) {
          formattedNumber = '+' + formattedNumber;
          console.log('Adding + prefix to phone number:', formattedNumber);
        }
        
        console.log('Sending SMS with client credentials...');
        const result = await client.messages.create({
          body: message,
          from: twilioConfig.phoneNumber,
          to: formattedNumber
        });
        
        console.log(`SMS sent with client credentials! SID: ${result.sid}`);
        return res.json({
          success: true,
          sid: result.sid,
          status: result.status
        });
      } catch (error) {
        console.error('Error with client credentials:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error; // Will be caught by outer try/catch
      }
    } else {
      // Use server's Twilio credentials
      console.log('Using server Twilio credentials');
      
      try {
        const result = await sendSMS(to, message);
        return res.json({ success: true, ...result });
      } catch (error) {
        console.error('Error in sendSMS function:', error.message);
        throw error; // Will be caught by outer try/catch
      }
    }
  } catch (error) {
    console.error('Error in /send-sms endpoint:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Format the error message for the client
    let clientErrorMessage = error.message || 'Failed to send SMS';
    
    // Add helpful information for common errors
    if (error.code === 21608) {
      clientErrorMessage = 'Free Twilio accounts can only send to verified numbers. Please verify your phone number in your Twilio account.';
    } else if (error.code === 21211) {
      clientErrorMessage = 'Invalid phone number format. Please ensure your number includes country code (e.g., +916370906519).';
    }
    
    res.status(500).json({
      success: false,
      error: clientErrorMessage,
      code: error.code || 'unknown'
    });
  }
});

// API endpoint to set up weather monitoring
app.post('/monitor-weather', async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'Location is required'
      });
    }

    console.log('Broadcasting weather information for:', location);
    const result = await checkWeatherAndSendAlerts(location);
    
    if (result.success) {
      console.log('Successfully broadcast weather information');
    } else {
      console.error('Failed to broadcast weather information:', result.error);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in monitor-weather endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Schedule regular weather checks
const monitoredLocations = new Map();

app.post('/setup-monitoring', (req, res) => {
  try {
    const { location, phoneNumber } = req.body;
    
    if (location) {
      monitoringLocation = location;
    }
    
    if (phoneNumber) {
      // Add phone number to notification list if not already there
      if (!notificationPhones.includes(phoneNumber)) {
        notificationPhones.push(phoneNumber);
      }
    }
    
    console.log(`Weather monitoring set up for location: ${monitoringLocation}`);
    console.log(`Notification phones: ${notificationPhones.join(', ')}`);
    
    res.json({
      success: true,
      message: 'Weather monitoring set up successfully',
      location: monitoringLocation,
      phoneNumbers: notificationPhones
    });
  } catch (error) {
    console.error('Error setting up monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set up weather monitoring'
    });
  }
});

app.delete('/remove-monitoring', async (req, res) => {
  const { location } = req.body;
  monitoredLocations.delete(location);
  res.json({ success: true, message: 'Monitoring removed successfully' });
});

// Set up cron job for regular weather checks
cron.schedule(`*/${weatherConfig.checkInterval} * * * *`, async () => {
  console.log('Running scheduled weather checks...');
  for (const [location, phoneNumber] of monitoredLocations) {
    await checkWeatherAndSendAlerts(location);
  }
});

// API endpoint to get current weather data
app.get('/weather/:location', async (req, res) => {
  try {
    const location = req.params.location || 'Bhubaneswar';
    const weatherData = await getWeatherData(location);
    
    res.json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data'
    });
  }
});

// Redirect root to weather.html
app.get('/', (req, res) => {
  res.redirect('/public/weather.html');
});

// Serve weather.html at /weather
app.get('/weather', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'weather.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 