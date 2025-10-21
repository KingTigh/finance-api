require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const {MongoClient, ObjectId} = require('mongodb');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 4000;
const uri = process.env.MONGO_URI;
let coll;
(async ()=>{
  if(uri){
    const client = new MongoClient(uri);
    await client.connect();
    coll = client.db('finance').collection('txs');
  }else{
    const low = require('lowdb'), FileSync = require('lowdb/adapters/FileSync');
    const db = low(new FileSync('data.json'));
    db.defaults({txs:[]}).write();
    coll = {
      find: q => ({ toArray: async () => db.get('txs').filter(q).value() }),
      insertOne: async d => { const r = db.get('txs').insert(d).write(); return {insertedId: r.id}; },
      replaceOne: async (q,d) => db.get('txs').find(q).assign(d).write(),
      deleteOne: async q => db.get('txs').remove(q).write()
    };
  }
})();
function auth(req,res,next){
  const t = (req.headers.authorization||'').split('Bearer ')[1];
  try{ req.uid = jwt.verify(t, process.env.JWT_SECRET).uid; next(); }
  catch{ res.status(401).json({error:'bad token'}); }
}
app.get('/api/transactions', auth, async (req,res)=> res.json(await coll.find({uid:req.uid}).toArray()));
app.post('/api/transactions', auth, async (req,res)=>{
  const doc = {...req.body, uid:req.uid};
  const r = await coll.insertOne(doc);
  doc._id = r.insertedId; res.json(doc);
});
app.put('/api/transactions/:id', auth, async (req,res)=>{
  await coll.replaceOne({_id: new ObjectId(req.params.id), uid:req.uid}, req.body);
  res.json(req.body);
});
app.delete('/api/transactions/:id', auth, async (req,res)=>{
  await coll.deleteOne({_id: new ObjectId(req.params.id), uid:req.uid});
  res.sendStatus(204);
});
app.listen(PORT, ()=>console.log('API on',PORT));
