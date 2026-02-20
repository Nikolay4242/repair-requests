const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3001;
const JWT_SECRET = 'your-secret-key';

app.use(cors());
app.use(express.json());

// Подключение к базе данных
const db = new sqlite3.Database('./data/database.sqlite');

// Создание таблиц
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    fullName TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientName TEXT,
    phone TEXT,
    address TEXT,
    problemText TEXT,
    status TEXT DEFAULT 'new',
    assignedToId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Логин
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ message: 'Неверный логин или пароль' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Неверный логин или пароль' });
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      access_token: token,
      userId: user.id,
      username: user.username,
      role: user.role
    });
  });
});

// Получить все заявки
app.get('/api/requests', authenticateToken, (req, res) => {
  let query = 'SELECT * FROM requests';
  const params = [];
  
  if (req.user.role === 'master') {
    query += ' WHERE assignedToId = ?';
    params.push(req.user.id);
  }
  
  query += ' ORDER BY createdAt DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Создать заявку
app.post('/api/requests', (req, res) => {
  const { clientName, phone, address, problemText } = req.body;
  
  db.run(
    'INSERT INTO requests (clientName, phone, address, problemText) VALUES (?, ?, ?, ?)',
    [clientName, phone, address, problemText],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get('SELECT * FROM requests WHERE id = ?', [this.lastID], (err, request) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json(request);
      });
    }
  );
});

// Назначить мастера
app.patch('/api/requests/:id/assign', authenticateToken, (req, res) => {
  if (req.user.role !== 'dispatcher') {
    return res.status(403).json({ message: 'Только диспетчер может назначать мастеров' });
  }
  
  const { masterId } = req.body;
  
  db.run(
    'UPDATE requests SET assignedToId = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
    [masterId, 'assigned', req.params.id, 'new'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(400).json({ message: 'Заявка не может быть назначена' });
      }
      res.json({ message: 'Мастер назначен' });
    }
  );
});

// Взять в работу (с защитой от гонки)
app.patch('/api/requests/:id/take-to-work', authenticateToken, (req, res) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ message: 'Только мастер может брать заявки в работу' });
  }
  
  // Используем транзакцию для защиты от гонки
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Проверяем статус и назначаем блокировку
    db.get(
      'SELECT * FROM requests WHERE id = ? AND status = ? AND assignedToId = ?',
      [req.params.id, 'assigned', req.user.id],
      (err, request) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        if (!request) {
          db.run('ROLLBACK');
          return res.status(409).json({ 
            message: 'Заявка не может быть взята в работу (возможно, уже взята другим мастером)' 
          });
        }
        
        // Обновляем статус
        db.run(
          'UPDATE requests SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
          ['in_progress', req.params.id, 'assigned'],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            if (this.changes === 0) {
              db.run('ROLLBACK');
              return res.status(409).json({ 
                message: 'Заявка уже взята в работу другим мастером' 
              });
            }
            
            db.run('COMMIT');
            res.json({ message: 'Заявка взята в работу', status: 'in_progress' });
          }
        );
      }
    );
  });
});

// Завершить заявку
app.patch('/api/requests/:id/complete', authenticateToken, (req, res) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ message: 'Только мастер может завершать заявки' });
  }
  
  db.run(
    'UPDATE requests SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND assignedToId = ? AND status = ?',
    ['done', req.params.id, req.user.id, 'in_progress'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(400).json({ message: 'Заявка не может быть завершена' });
      }
      res.json({ message: 'Заявка завершена' });
    }
  );
});

// Отменить заявку
app.patch('/api/requests/:id/cancel', authenticateToken, (req, res) => {
  if (req.user.role !== 'dispatcher') {
    return res.status(403).json({ message: 'Только диспетчер может отменять заявки' });
  }
  
  db.run(
    'UPDATE requests SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status IN (?, ?)',
    ['canceled', req.params.id, 'new', 'assigned'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(400).json({ message: 'Заявка не может быть отменена' });
      }
      res.json({ message: 'Заявка отменена' });
    }
  );
});

// Создаем тестовых пользователей
async function createTestUsers() {
  const hash = await bcrypt.hash('password', 10);
  
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) return;
    if (row.count === 0) {
      db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
        ['dispatcher', hash, 'dispatcher', 'Иван Диспетчеров']);
      db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
        ['master1', hash, 'master', 'Петр Мастеров']);
      db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
        ['master2', hash, 'master', 'Сергей Ремонтов']);
      
      // Создаем тестовые заявки
      db.run('INSERT INTO requests (clientName, phone, address, problemText) VALUES (?, ?, ?, ?)',
        ['Алексей Петров', '+79161234567', 'ул. Ленина, д. 10', 'Не включается стиральная машина']);
    }
  });
}

createTestUsers();

app.listen(port, () => {
  console.log(`🚀 Backend запущен на http://localhost:${port}`);
});
