require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB Atlas Connection...');
console.log(`Using connection string: ${process.env.MONGODB_URI.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://$1:****@')}`);

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('Database connection is working properly.');
    
    // List all collections
    mongoose.connection.db.listCollections().toArray()
        .then(collections => {
            console.log('\nAvailable collections:');
            if (collections.length === 0) {
                console.log('- No collections found (this is normal for a new database)');
            } else {
                collections.forEach(collection => {
                    console.log(`- ${collection.name}`);
                });
            }
            mongoose.connection.close();
            console.log('\nConnection test complete, process will exit.');
        });
})
.catch(err => {
    console.error('❌ ERROR: Failed to connect to MongoDB Atlas');
    console.error(err);
    console.error('\nPossible reasons for failure:');
    console.error('1. Incorrect username or password in connection string');
    console.error('2. IP address not whitelisted in MongoDB Atlas');
    console.error('3. Cluster name is incorrect');
    console.error('4. Network connectivity issues');
    console.error('\nFix your .env file and try again.');
    process.exit(1);
}); 