#!/bin/bash

echo "🚀 Запуск ремонтной службы..."
echo "================================"

# Останавливаем предыдущие процессы
echo "🛑 Останавливаем предыдущие процессы..."
pkill -f "nest" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "ts-node" 2>/dev/null

# Создаем папку для базы данных
mkdir -p data

# Удаляем старую базу данных если есть
rm -f data/database.sqlite

echo "📦 Устанавливаем зависимости backend..."
npm install

echo "🏗️  Собираем проект..."
npm run build

echo "🗄️  Создаем таблицы через синхронизацию..."
cat > sync-db.js << 'EOJS'
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
EOJS

node sync-db.js

echo "🌱 Заполняем базу данных тестовыми данными..."
node dist/database/seeds/seed.js

echo "🚀 Запускаем backend сервер..."
nohup npm run start:dev > backend.log 2>&1 &
BACKEND_PID=$!

echo "⏳ Ожидаем запуск backend..."
sleep 10

echo "📱 Запускаем frontend..."
cd client
nohup npm start > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "==================================="
echo "✅ Приложение запущено!"
echo "==================================="
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:3001/api"
echo ""
echo "👤 Тестовые пользователи:"
echo "   Диспетчер: dispatcher / password"
echo "   Мастер 1:  master1 / password"
echo "   Мастер 2:  master2 / password"
echo ""
echo "📊 Логи:"
echo "   backend.log  - логи backend"
echo "   client/frontend.log - логи frontend"
echo ""
echo "🛑 Для остановки выполните:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   или ./stop.sh"
echo ""

# Создаем скрипт остановки
cat > stop.sh << 'STOP'
#!/bin/bash
echo "🛑 Останавливаем сервисы..."
pkill -f "nest"
pkill -f "react-scripts"
pkill -f "ts-node"
echo "✅ Сервисы остановлены"
STOP

chmod +x stop.sh
