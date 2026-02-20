const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3002;
const JWT_SECRET = 'your-secret-key';

// Простая настройка CORS - разрешаем всё для разработки
app.use(cors());
app.use(express.json());

// Логирование всех запросов для отладки
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

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

// Тестовый endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'API работает', time: new Date().toISOString() });
});

// Публичный endpoint для получения заявок
app.get('/api/requests/public', (req, res) => {
    db.all('SELECT * FROM requests ORDER BY createdAt DESC', (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Логин
app.post('/api/auth/login', async (req, res) => {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
    }
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ message: 'Неверный логин или пароль' });
        }
        
        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log('Invalid password for user:', username);
                return res.status(401).json({ message: 'Неверный логин или пароль' });
            }
            
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            console.log('Login successful:', username);
            res.json({
                access_token: token,
                userId: user.id,
                username: user.username,
                role: user.role
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });
});

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Получить заявки (требуется авторизация)
app.get('/api/requests', authenticateToken, (req, res) => {
    let query = 'SELECT * FROM requests';
    const params = [];
    
    if (req.user.role === 'master') {
        query += ' WHERE assignedToId = ?';
        params.push(req.user.id);
    }
    
    query += ' ORDER BY createdAt DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Получить мастеров
app.get('/api/users/masters', authenticateToken, (req, res) => {
    db.all('SELECT id, username, fullName FROM users WHERE role = ?', ['master'], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
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
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(400).json({ message: 'Заявка не может быть назначена' });
            }
            res.json({ message: 'Мастер назначен' });
        }
    );
});

// Взять в работу
app.patch('/api/requests/:id/take-to-work', authenticateToken, (req, res) => {
    if (req.user.role !== 'master') {
        return res.status(403).json({ message: 'Только мастер может брать заявки в работу' });
    }
    
    db.run(
        'UPDATE requests SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND assignedToId = ? AND status = ?',
        ['in_progress', req.params.id, req.user.id, 'assigned'],
        function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(409).json({ message: 'Заявка не может быть взята в работу' });
            }
            res.json({ message: 'Заявка взята в работу', status: 'in_progress' });
        }
    );
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
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
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
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(400).json({ message: 'Заявка не может быть отменена' });
            }
            res.json({ message: 'Заявка отменена' });
        }
    );
});

// Создаем тестовых пользователей
async function createTestUsers() {
    try {
        db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
            if (err) {
                console.error(err);
                return;
            }
            
            if (row.count === 0) {
                console.log('Создание тестовых пользователей...');
                const hash = await bcrypt.hash('password', 10);
                
                db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
                    ['dispatcher', hash, 'dispatcher', 'Иван Диспетчеров']);
                db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
                    ['master1', hash, 'master', 'Петр Мастеров']);
                db.run('INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)',
                    ['master2', hash, 'master', 'Сергей Ремонтов']);
                
                // Создаем тестовые заявки
                db.run('INSERT INTO requests (clientName, phone, address, problemText) VALUES (?, ?, ?, ?)',
                    ['Алексей Петров', '+79161234567', 'ул. Ленина, д. 10', 'Не включается стиральная машина']);
                
                db.run('INSERT INTO requests (clientName, phone, address, problemText, status, assignedToId) VALUES (?, ?, ?, ?, ?, ?)',
                    ['Мария Иванова', '+79167654321', 'пр. Мира, д. 25', 'Холодильник не морозит', 'assigned', 2]);
                
                db.run('INSERT INTO requests (clientName, phone, address, problemText, status, assignedToId) VALUES (?, ?, ?, ?, ?, ?)',
                    ['Дмитрий Сидоров', '+79169876543', 'ул. Советская, д. 3', 'Телевизор не реагирует на пульт', 'in_progress', 3]);
                
                console.log('✅ Тестовые пользователи и заявки созданы');
            }
        });
    } catch (error) {
        console.error('Ошибка при создании пользователей:', error);
    }
}

createTestUsers();

app.listen(port, () => {
    console.log(`🚀 Backend запущен на http://localhost:${port}`);
    console.log(`📝 Тестовые пользователи: dispatcher/password, master1/password, master2/password`);
    console.log(`🔍 Проверка: curl http://localhost:${port}/api/test`);
});
