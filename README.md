# Smart City Platform - Weather Monitoring System

This repository contains a Weather Monitoring System with SMS notifications for a Smart City Platform. The system allows users to view current weather data for any location and receive SMS alerts for severe weather conditions.

## Features

- Real-time weather data display
- SMS notifications for weather alerts
- User-friendly interface
- Responsive design
- Twilio integration for messaging

## Project Structure

The project is organized into two main directories:

1. **Frontend** - Contains the user interface for accessing the weather system
2. **Twilio** - Contains the backend server for weather data and SMS notifications

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A Twilio account for SMS functionality

## Setup Instructions

### 1. Setting up the Twilio Server

1. Navigate to the Twilio directory:
   ```
   cd twilio
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the twilio directory with your Twilio credentials:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   WEATHER_API_KEY=your_weather_api_key
   ```

4. Start the Twilio server:
   ```
   node server.js
   ```

### 2. Running the Frontend

The frontend is a static HTML/CSS/JS application that communicates with the Twilio server.

1. Open the `frontend/weather.html` file in your browser to access the Weather Monitoring System.

2. The frontend will automatically connect to the Twilio server running on port 3000.

## Testing SMS Functionality

You can test the SMS functionality using the provided test script:

```
cd twilio
node test-sms.js
```

**Note**: Free Twilio accounts can only send SMS messages to verified phone numbers. Make sure to verify your phone number in your Twilio account.

## Usage

1. The main weather page displays current weather conditions for the default location (Bhubaneswar).
2. You can change the location by entering a city name in the "Change Location" field.
3. To receive SMS alerts, enter your phone number in the SMS Notifications section and select the alert types.
4. You can view the history of sent notifications in the Recent Alerts section.

## Troubleshooting

If you encounter the "Failed to fetch" error when sending SMS:

1. Make sure the Twilio server is running on port 3000.
2. Check that your Twilio credentials in the `.env` file are correct.
3. Verify that your phone number is in the correct format (including country code, e.g., +1XXXXXXXXXX).
4. For free Twilio accounts, ensure that the phone number is verified in your Twilio account.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 