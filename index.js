const { MongoClient } = require("mongodb");

// Replace the uri string with your connection string.
const uri =
  "mongodb://WAP:WAP@123@cluster0-shard-00-00.b1u66.mongodb.net:27017,cluster0-shard-00-01.b1u66.mongodb.net:27017,cluster0-shard-00-02.b1u66.mongodb.net:27017/?replicaSet=atlas-14mwbp-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();

    const database = client.db('position');
    const movies = database.collection('movies');

    // Query for a movie that has the title 'Back to the Future'
    const query = { title: 'Back to the Future' };
    const movie = await movies.findOne(query);

    console.log(movie);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);