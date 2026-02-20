const bcrypt = require('bcrypt');

async function generateHash() {
  const hash = await bcrypt.hash('password', 10);
  console.log(hash);
}

generateHash();
