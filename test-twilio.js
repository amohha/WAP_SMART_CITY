require('dotenv').config();
const twilio = require('twilio');

// Check if required environment variables are set
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.error('Missing required Twilio configuration!');
    console.error('Make sure you have set the following environment variables:');
    console.error('- TWILIO_ACCOUNT_SID');
    console.error('- TWILIO_AUTH_TOKEN');
    console.error('- TWILIO_PHONE_NUMBER');
    process.exit(1);
}

console.log('Twilio Configuration:');
console.log('- Account SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('- Auth Token:', process.env.TWILIO_AUTH_TOKEN.substring(0, 4) + '***********');
console.log('- Phone Number:', process.env.TWILIO_PHONE_NUMBER);

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Test Twilio API by fetching account information
async function testTwilioConnection() {
    try {
        console.log('\nTesting Twilio API connection...');
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        console.log('\n✅ Successfully connected to Twilio API!');
        console.log('Account Status:', account.status);
        console.log('Account Type:', account.type);
        console.log('Account Created:', new Date(account.dateCreated).toLocaleString());
        
        return true;
    } catch (error) {
        console.error('\n❌ Failed to connect to Twilio API!');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        
        if (error.message.includes('authenticate')) {
            console.error('\nAuthentication error! Please check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
        }
        
        return false;
    }
}

// Test sending an SMS message
async function testSendSMS(phoneNumber) {
    try {
        console.log('\nTesting SMS functionality...');
        console.log('Sending test message to:', phoneNumber);
        
        const message = await client.messages.create({
            body: 'This is a test message from the Smart City Platform',
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        
        console.log('\n✅ Test message sent successfully!');
        console.log('Message SID:', message.sid);
        console.log('Message Status:', message.status);
        
        return true;
    } catch (error) {
        console.error('\n❌ Failed to send test message!');
        console.error('Error:', error.message);
        
        if (error.code === 21608) {
            console.error('\nYour Twilio account cannot send messages to unverified phone numbers.');
            console.error('Please verify the recipient number in your Twilio console or upgrade your account.');
        }
        
        if (error.code === 21614) {
            console.error('\nYour Twilio phone number is not capable of sending SMS messages.');
            console.error('Please check that you have SMS capability on your Twilio phone number.');
        }
        
        return false;
    }
}

// Run tests
async function runTests() {
    // First test API connection
    const connectionSuccessful = await testTwilioConnection();
    
    if (!connectionSuccessful) {
        console.error('\nAPI connection test failed. Skipping SMS test.');
        process.exit(1);
    }
    
    // Prompt for phone number for SMS test
    const phoneNumber = process.argv[2];
    
    if (!phoneNumber) {
        console.log('\nSkipping SMS test as no phone number was provided.');
        console.log('To test SMS functionality, run: node test-twilio.js +1234567890');
        process.exit(0);
    }
    
    // Test SMS functionality
    await testSendSMS(phoneNumber);
}

runTests(); 