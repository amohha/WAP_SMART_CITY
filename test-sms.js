require('dotenv').config();
const twilio = require('twilio');

// Twilio credentials from .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Test phone number - using the user's verified number
const testPhone = "+916370906519"; // User's verified phone number

// Create Twilio client
const client = new twilio(accountSid, authToken);

console.log("Twilio SMS Test");
console.log("----------------");
console.log(`Account SID: ${accountSid.substring(0, 10)}...`);
console.log(`Auth Token: ${authToken.substring(0, 5)}...`);
console.log(`Twilio Phone: ${twilioPhone}`);
console.log(`Test Phone: ${testPhone}`);
console.log("----------------");

// Verify credentials
console.log("Verifying Twilio credentials...");
try {
  client.api.accounts(accountSid).fetch()
    .then(account => {
      console.log(`✓ Credentials valid! Account type: ${account.type}`);
      console.log(`✓ Account status: ${account.status}`);
      
      // Send test SMS if credentials are valid
      console.log("\nSending test SMS...");
      return client.messages.create({
        body: "This is a test message from your Smart City Weather Monitoring System!",
        from: twilioPhone,
        to: testPhone
      });
    })
    .then(message => {
      console.log(`✓ SMS sent successfully!`);
      console.log(`✓ Message SID: ${message.sid}`);
      console.log(`✓ Status: ${message.status}`);
    })
    .catch(error => {
      console.error("× Error sending SMS:", error.message);
      console.error("× Error code:", error.code);
      console.error("× Error details:", JSON.stringify(error, null, 2));
      
      if (error.code === 21608) {
        console.log("\nNote: Free Twilio accounts can only send messages to verified numbers.");
        console.log("Make sure your test phone number is verified in your Twilio account.");
      }
    });
} catch (error) {
  console.error("× Error verifying credentials:", error.message);
} 