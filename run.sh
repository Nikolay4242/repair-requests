#!/bin/bash

echo "🚀 Запуск ремонтной службы..."
echo "================================"

# Функция для остановки процессов
cleanup() {
    echo -e "\n🛑 Останавливаем сервисы..."
    pkill -f "nest" 2>/dev/null
    pkill -f "react-scripts" 2>/dev/null
    pkill -f "ts-node" 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Останавливаем предыдущие процессы
pkill -f "nest" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null

# Создаем папку для базы данных
mkdir -p data

# Удаляем старую базу данных
rm -f data/database.sqlite

# Создаем базу данных через Node.js (более надежно)
echo "🗄️  Создаем базу данных..."
node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

db.serialize(() => {
  // Таблица users
  db.run(\`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'master',
    fullName TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )\`);

  // Таблица requests
  db.run(\`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientName TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    problemText TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    assignedToId INTEGER,
    version INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignedToId) REFERENCES users(id)
  )\`);

  // Таблица audit_logs
  db.run(\`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId INTEGER,
    oldValue TEXT,
    newValue TEXT,
    userId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  )\`);

  console.log('✅ Таблицы созданы');
});

db.close();
"

# Заполняем базу данных
echo "🌱 Заполняем базу данных..."
node -e "
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./data/database.sqlite');

async function seed() {
  const hash = await bcrypt.hash('password', 10);
  
  db.serialize(() => {
    // Очищаем таблицы
    db.run('DELETE FROM audit_logs');
    db.run('DELETE FROM requests');
    db.run('DELETE FROM users');

    // Вставляем пользователей
    db.run(
      'INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
      ['dispatcher', hash, 'dispatcher', 'Иван Диспетчеров']
    );

    db.run(
      'INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
      ['master1', hash, 'master', 'Петр Мастеров']
    );

    db.run(
      'INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
      ['master2', hash, 'master', 'Сергей Ремонтов']
    );

    // Получаем ID мастеров
    db.all('SELECT id FROM users WHERE role = ?', ['master'], (err, masters) => {
      if (err) {
        console.error(err);
        return;
      }

      // Вставляем заявки
      db.run(
        \`INSERT INTO requests (clientName, phone, address, problemText, status) 
         VALUES (?, ?, ?, ?, ?)\`,
        ['Алексей Петров', '+79161234567', 'ул. Ленина, д. 10', 'Не включается стиральная машина', 'new']
      );

      if (masters[0]) {
        db.run(
          \`INSERT INTO requests (clientName, phone, address, problemText, status, assignedToId) 
           VALUES (?, ?, ?, ?, ?, ?)\`,
          ['Мария Иванова', '+79167654321', 'пр. Мира, д. 25', 'Холодильник не морозит', 'assigned', masters[0].id]
        );
      }

      if (masters[1]) {
        db.run(
          \`INSERT INTO requests (clientName, phone, address, problemText, status, assignedToId) 
           VALUES (?, ?, ?, ?, ?, ?)\`,
          ['Дмитрий Сидоров', '+79169876543', 'ул. Советская, д. 3', 'Телевизор не реагирует на пульт', 'in_progress', masters[1].id]
        );
      }
    });
  });

  setTimeout(() => {
    db.close();
    console.log('✅ База данных заполнена');
  }, 1000);
}

seed();
"

# Запускаем backend
echo "🚀 Запускаем backend сервер..."
cd ~/repair-requests
npm run start:dev > backend.log 2>&1 &
BACKEND_PID=$!

echo "⏳ Ожидаем запуск backend..."
sleep 10

# Запускаем frontend
echo "📱 Запускаем frontend..."
cd client
npm start > frontend.log 2>&1 &
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
echo "🛑 Для остановки нажмите Ctrl+C"
echo ""

# Ждем сигнала остановки
while true; do
    sleep 1
done
