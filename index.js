const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const port = process.env.port || 5000;


// id-apartmentUser pass-2qqXuRbSVcjfxv7J


// middleware
app.use(cors());
app.use(express.json());

// mongodb site

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6nodxbc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const apartmentCollection = client.db("apartmentDb").collection("apartment");
    const agreementCollection = client.db("apartmentDb").collection("agreements");


    app.get('/apartment', async(req,res)=>{
        const result = await apartmentCollection.find().toArray();
        res.send(result);
    });


    // agreement collection
    app.get('/agreements', async(req,res)=>{
      const result = await agreementCollection.find().toArray();
      res.send(result);
    })

    app.post('/agreements', async(req,res)=>{
      const agreementItem = req.body;
      const result = await agreementCollection.insertOne(agreementItem);
      res.send(result);
    })








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('last assignment')
})

app.listen(port, () => {
  console.log(`last assignment coming on port ${port}`)
})