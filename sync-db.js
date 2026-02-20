const { createConnection } = require('typeorm');
const { User } = require('./dist/modules/users/entities/user.entity');
const { Request } = require('./dist/modules/requests/entities/request.entity');
const { AuditLog } = require('./dist/modules/audit/entities/audit.entity');

async function sync() {
  const connection = await createConnection({
    type: 'sqlite',
    database: './data/database.sqlite',
    entities: [User, Request, AuditLog],
    synchronize: true,
  });
  
  console.log('✅ Таблицы созданы');
  await connection.close();
}

sync().catch(console.error);
