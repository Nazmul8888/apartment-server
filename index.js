const express = require('express')
require('dotenv').config();
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// console.log(process.env.STRIPE_SECRET_KEY)

const port = process.env.port || 5000;


// id-apartmentUser pass-2qqXuRbSVcjfxv7J ACCESS_TOKEN_SECRET=a6338cd7e907a7ef43d1954ec6e654e48e83326c9f16765473be9ce5edca2e7ab70a89fb94b3d528c61283dc5f1ce5ca7ae508f9aa74d598b7c413ba89a27feb


// middleware
app.use(cors());
app.use(express.json());

// mongodb site

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const userCollection = client.db("apartmentDb").collection("users");
    const apartmentCollection = client.db("apartmentDb").collection("apartment");
    const agreementCollection = client.db("apartmentDb").collection("agreements");
    const paymentCollection = client.db("apartmentDb").collection("payments");


    //  token related api

    app.post('/jwt', async(req,res)=>{
      const user = req.body;
      console.log(user,'user')
      if(!user) return
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // middleware

    const verifyToken = (req,res,next)=>{
      // console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'forbidden access '});
      }

      const token = req.headers.authorization.split(' ')[1];
      // console.log(token)
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
      })
      
    }

      // use verify admin after verifyToken
      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }
  


    

    // user related api

    app.get('/apartment', async(req,res)=>{
        const result = await apartmentCollection.find().toArray();
        res.send(result);
    });

    app.delete('/apartment/:id', verifyToken,verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await apartmentCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/users', verifyToken, verifyAdmin,async(req,res)=>{
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async(req,res)=>{
      const email = req.params.email;
      // console.log(email)
      if(email !== req.decoded.email){
        return res.status(403).send({message:'unauthorized access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      // console.log(user)
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin}); 

    });


    app.post('/users', async(req,res)=>{
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message:'user already exist ', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });


    app.patch('/users/admin/:id', async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })






    // agreement collection
    app.get('/agreements/:email', async(req,res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await agreementCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/agreements', async(req,res)=>{
      const agreementItem = req.body;
      const query = {email: agreementItem.email}
      const result = await agreementCollection.insertOne(agreementItem);
      res.send(result);
    });



    // payment intent 
    app.post('/create-payment-intent', async (req, res) => {
      const { rent } = req.body;
      const amount = 100;
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.get('/payments/:email',verifyToken, async(req,res)=>{
      const query = {email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments', async(req,res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log('payment info',payment);
      const query = {_id:{
        $in: payment.apartmentId.map(id=> new ObjectId(id))
      }};
      const deleteResult = await cartCollection.deleteMany(query);

      res.send({paymentResult, deleteResult});
    });

    // analytics system

    app.get('/admin-stats', async(req,res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const  apartmentItems = await agreementCollection.estimatedDocumentCount();
      const agreements = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection.aggregate([
        {
          $group:{
            _id: null,
            totalRevenue:{
              $sum: '$rent'
            }
          }
        }
       
      ]).toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({
        users,
        apartmentItems,
        agreements,
        revenue
      })
    })


    // how to aggregate

   app.get('/orders-stats',async (req,res)=>{
    const result = await paymentCollection.aggregate([
      {
        $unwind: '$apartmentId'
      },
      {
        $lookup:{
          from: 'apartment',
          localField: 'apartmentId',
          foreignField: '_id',
          as: 'apartmentItems'

        }
      },
      {
        $unwind: '$apartmentItems'
      },
      {
        $group: {
          _id: '$apartmentItems.category',
          quantity: {$sum:1},
          revenue: {$sum:'$apartmentItems.rent'}
        }
      }

    ]).toArray();
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


// // DB_USER=apartmentUser
// DB_PASS=2qqXuRbSVcjfxv7J
// ACCESS_TOKEN_SECRET=a6338cd7e907a7ef43d1954ec6e654e48e83326c9f16765473be9ce5edca2e7ab70a89fb94b3d528c61283dc5f1ce5ca7ae508f9aa74d598b7c413ba89a27feb
// STRIPE_SECRET_KEY=sk_test_51OEVndANtyZ5zA59a4Rph3kRAgk416Kf65KHgz0t37TFbh6SIJ6XFczNaNgF99A35pyxvj42SY3dSiuFy0hHzwZL00JIIzqTB7