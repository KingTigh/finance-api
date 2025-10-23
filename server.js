require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const {MongoClient, ObjectId} = require('mongodb');
const {OAuth2Client} = require('google-auth-library');

const app = express();
app.use(cors({origin: ['http://localhost:3000',
                       'https://financetracker7.netlify.app'],
              credentials: true}));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const uri = process.env.MONGO_URI;

// ----------  DB ----------
let coll, budgetColl;
(async ()=>{
  if(uri){
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('finance');
    coll = db.collection('txs');
    budgetColl = db.collection('budgets');
    console.log('Mongo connected');
  }else{
    const low = require('lowdb'), FileSync = require('lowdb/adapters/FileSync');
    const db = low(new FileSync('data.json'));
    db.defaults({txs: [], budgets: {}}).write();
    coll = {
      find: q => ({ toArray: async () => db.get('txs').filter(q).value() }),
      insertOne: async d => { const r = db.get('txs').insert(d).write(); return {insertedId: r.id}; },
      replaceOne: async (q,d) => db.get('txs').find(q).assign(d).write(),
      deleteOne: async q => db.get('txs').remove(q).write()
    };
    budgetColl = {
      findOne: async () => db.get('budgets').value(),
      replaceOne: async (q,d,opts) => db.set('budgets', d.data).write()
    };
  }
})();

// ----------  AUTH MIDDLEWARE ----------
function auth(req,res,next){
  const hdr = req.headers.authorization||'';
  const t = hdr.split('Bearer ')[1];
  try{ req.uid = jwt.verify(t, process.env.JWT_SECRET).uid; next(); }
  catch{ res.status(401).json({error:'bad token'}); }
}

// ----------  GIS TOKEN EXCHANGE ----------
const oAuth2Client = new OAuth2Client();
app.post('/auth/google', async (req,res)=>{
  const {idToken} = req.body;
  try{
    const ticket = await oAuth2Client.verifyIdToken({idToken});
    const payload = ticket.getPayload();
    const uid   = payload.sub;
    const token = jwt.sign({uid}, process.env.JWT_SECRET, {expiresIn:'7d'});
    res.json({token});
  }catch(e){
    console.log('GIS verify failed:', e.message);
    res.status(401).json({error:'bad GIS token'});
  }
});

// ----------  CRUD ----------
app.get('/api/transactions', auth, async (req,res)=>{
  const list = await coll.find({uid:req.uid}).sort({date:-1}).toArray();
  res.json(list);
});
app.post('/api/transactions', auth, async (req,res)=>{
  const doc = {...req.body, uid:req.uid};
  const r = await coll.insertOne(doc);
  doc._id = r.insertedId;
  res.json(doc);
});
app.put('/api/transactions/:id', auth, async (req,res)=>{
  const id = ObjectId(req.params.id);
  await coll.replaceOne({_id:id, uid:req.uid}, req.body);
  res.json(req.body);
});

//  CORS-safe DELETE (wrapped in try-catch)
app.delete('/api/transactions/:id', auth, async (req,res)=>{
  try{
    const id = ObjectId(req.params.id);
    await coll.deleteOne({_id:id, uid:req.uid});
    res.sendStatus(204);
  }catch(e){
    console.log('del error', e);
    res.status(400).json({error:'invalid id'});
  }
});

// ----------  BUDGETS ----------
app.get('/api/budgets', auth, async (req,res)=>{
  const b = await budgetColl.findOne({uid:req.uid});
  res.json(b ? b.data : {});
});
app.put('/api/budgets', auth, async (req,res)=>{
  await budgetColl.replaceOne(
    {uid:req.uid},
    {uid:req.uid, data:req.body},
    {upsert:true}
  );
  res.sendStatus(204);
});

// ----------  START ----------
app.listen(PORT, ()=>console.log('API on',PORT));