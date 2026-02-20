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

# Удаляем старую базу данных
rm -f data/database.sqlite

# Создаем базу данных и таблицы напрямую через SQLite
echo "🗄️  Создаем базу данных..."
sqlite3 data/database.sqlite << 'SQL'
-- Таблица users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'master',
  fullName TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица requests
CREATE TABLE IF NOT EXISTS requests (
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
);

-- Таблица audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId INTEGER,
  oldValue TEXT,
  newValue TEXT,
  userId INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assignedToId);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entityType, entityId);
SQL

echo "✅ База данных создана"

# Заполняем базу данных тестовыми данными
echo "🌱 Заполняем базу данных..."

# Генерируем хеш пароля с помощью node
HASH=$(node -e "const bcrypt = require('bcrypt'); bcrypt.hash('password', 10).then(console.log);")

# Вставляем пользователей
sqlite3 data/database.sqlite << SQL
-- Очищаем таблицы
DELETE FROM audit_logs;
DELETE FROM requests;
DELETE FROM users;

-- Вставляем диспетчера
INSERT INTO users (username, password, role, fullName, isActive) 
VALUES ('dispatcher', '$2b$10$YourHashedPasswordHere', 'dispatcher', 'Иван Диспетчеров', 1);

-- Вставляем мастеров
INSERT INTO users (username, password, role, fullName, isActive) 
VALUES ('master1', '$2b$10$YourHashedPasswordHere', 'master', 'Петр Мастеров', 1);

INSERT INTO users (username, password, role, fullName, isActive) 
VALUES ('master2', '$2b$10$YourHashedPasswordHere', 'master', 'Сергей Ремонтов', 1);

-- Вставляем тестовые заявки
INSERT INTO requests (clientName, phone, address, problemText, status) 
VALUES ('Алексей Петров', '+79161234567', 'ул. Ленина, д. 10, кв. 5', 'Не включается стиральная машина', 'new');

INSERT INTO requests (clientName, phone, address, problemText, status, assignedToId) 
VALUES ('Мария Иванова', '+79167654321', 'пр. Мира, д. 25, кв. 12', 'Холодильник не морозит', 'assigned', 2);

INSERT INTO requests (clientName, phone, address, problemText, status, assignedToId) 
VALUES ('Дмитрий Сидоров', '+79169876543', 'ул. Советская, д. 3, кв. 45', 'Телевизор не реагирует на пульт', 'in_progress', 3);
SQL

echo "✅ База данных заполнена"

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
echo "🛑 Для остановки выполните:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
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
