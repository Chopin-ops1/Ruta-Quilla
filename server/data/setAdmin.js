// Script para marcar usuarios existentes como verificados
const mongoose = require('mongoose');
require('dotenv').config();

async function markVerified() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');

  // Mark ALL existing users as verified (they registered before verification was added)
  const result = await mongoose.connection.db.collection('users').updateMany(
    { isVerified: { $ne: true } },
    { $set: { isVerified: true } }
  );

  console.log(`✅ ${result.modifiedCount} usuarios marcados como verificados`);

  await mongoose.disconnect();
  process.exit(0);
}

markVerified().catch(err => { console.error(err); process.exit(1); });
