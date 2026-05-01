const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bazi = require('./lib/bazi');

const app = express();
const PORT = 3000;

// JWT密钥
const JWT_SECRET = 'wuxing-store-secret-key-2024';
const JWT_EXPIRES = '7d';

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 初始化数据库
const db = new sqlite3.Database('./wuxing-store.db', (err) => {
    if (err) {
        console.error('数据库连接失败:', err);
    } else {
        console.log('数据库连接成功');
        initDatabase();
    }
});

// 创建数据库表
function initDatabase() {
    db.serialize(() => {
        // 商品表
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            element TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            image TEXT,
            stock INTEGER DEFAULT 100
        )`);

        // 用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 八字记录表
        db.run(`CREATE TABLE IF NOT EXISTS bazi_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            birthday TEXT NOT NULL,
            bazi_data TEXT NOT NULL,
            result TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // 订单表
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 订单详情表
        db.run(`CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            price REAL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`, () => {
            insertSampleData();
        });
    });
}

// 插入示例商品数据
function insertSampleData() {
    const products = [
        {
            name: '金行手串·招财纳福',
            element: '金',
            price: 299,
            description: '精选黄金檀木，寓意招财纳福，增强决断力和领导力。适合五行缺金或需要增强金行能量的人群。',
            image: '🪙',
            stock: 50
        },
        {
            name: '木行手串·生机勃勃',
            element: '木',
            price: 269,
            description: '天然绿檀木，象征生机与成长，助旺事业运和人际关系。适合五行缺木或需要增强木行能量的人群。',
            image: '🌳',
            stock: 50
        },
        {
            name: '水行手串·智慧灵动',
            element: '水',
            price: 319,
            description: '深海蓝晶石，代表智慧与灵动，提升直觉和沟通能力。适合五行缺水或需要增强水行能量的人群。',
            image: '💧',
            stock: 50
        },
        {
            name: '火行手串·热情活力',
            element: '火',
            price: 289,
            description: '南红玛瑙制作，象征热情与活力，增强行动力和创造力。适合五行缺火或需要增强火行能量的人群。',
            image: '🔥',
            stock: 50
        },
        {
            name: '土行手串·稳重踏实',
            element: '土',
            price: 279,
            description: '黄玉髓精制，寓意稳重踏实，提升稳定性和包容力。适合五行缺土或需要增强土行能量的人群。',
            image: '⛰️',
            stock: 50
        }
    ];

    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO products (name, element, price, description, image, stock) VALUES (?, ?, ?, ?, ?, ?)");
            products.forEach(p => {
                stmt.run(p.name, p.element, p.price, p.description, p.image, p.stock);
            });
            stmt.finalize();
            console.log('示例商品数据已插入');
        }
    });
}

// JWT验证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '请先登录' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '登录已过期，请重新登录' });
        }
        req.user = user;
        next();
    });
}

// ======================== 用户API ========================

// 注册
app.post('/api/auth/register', (req, res) => {
    const { username, password, phone } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少6位' });
    }

    // 检查用户是否已存在
    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (row) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        // 加密密码
        const hashedPassword = bcrypt.hashSync(password, 10);

        // 创建用户
        db.run("INSERT INTO users (username, password, phone) VALUES (?, ?, ?)",
            [username, hashedPassword, phone || ''],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: '注册失败' });
                }

                // 生成token
                const token = jwt.sign(
                    { id: this.lastID, username: username },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRES }
                );

                res.json({
                    success: true,
                    token: token,
                    user: { id: this.lastID, username: username }
                });
            }
        );
    });
});

// 登录
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({
            success: true,
            token: token,
            user: { id: user.id, username: user.username }
        });
    });
});

// 获取当前用户
app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get("SELECT id, username, phone, created_at FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json({ user: user });
    });
});

// ======================== 八字API ========================

// 计算八字
app.post('/api/bazi/calculate', (req, res) => {
    const { birthday } = req.body;

    if (!birthday) {
        return res.status(400).json({ error: '请提供生日信息' });
    }

    try {
        const result = bazi.calculateBazi(birthday);

        // 如果用户已登录，保存记录
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            jwt.verify(token, JWT_SECRET, (err, user) => {
                if (!err && user) {
                    db.run("INSERT INTO bazi_records (user_id, birthday, bazi_data, result) VALUES (?, ?, ?, ?)",
                        [user.id, birthday, JSON.stringify(result), result.analysis.recommendation.name],
                        (err) => {
                            if (err) console.error('保存八字记录失败:', err);
                        }
                    );
                }
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('八字计算错误:', error);
        res.status(500).json({ error: '计算失败，请检查日期格式是否正确' });
    }
});

// 获取八字历史记录
app.get('/api/bazi/history', authenticateToken, (req, res) => {
    db.all("SELECT * FROM bazi_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
        [req.user.id],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: '获取历史记录失败' });
            }
            res.json({ records: rows });
        }
    );
});

// 删除八字记录
app.delete('/api/bazi/history/:id', authenticateToken, (req, res) => {
    db.run("DELETE FROM bazi_records WHERE id = ? AND user_id = ?",
        [req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '删除失败' });
            }
            res.json({ success: true });
        }
    );
});

// ======================== 商品API ========================

// 获取所有商品
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// 根据五行元素获取商品
app.get('/api/products/:element', (req, res) => {
    const element = req.params.element;
    db.all("SELECT * FROM products WHERE element = ?", [element], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// 五行配置计算（旧接口，保留兼容）
app.post('/api/wuxing', (req, res) => {
    const { birthday } = req.body;

    if (!birthday) {
        return res.status(400).json({ error: '请提供生日信息' });
    }

    try {
        const result = bazi.calculateBazi(birthday);
        res.json({
            success: true,
            birthday: birthday,
            elements: result.wuxingCount,
            recommendedElement: result.analysis.xiYongShen[0],
            message: `根据您的八字分析，日主为${result.riZhu}（${result.riZhuWuxing}行）`,
            detail: result
        });
    } catch (error) {
        res.status(500).json({ error: '计算失败' });
    }
});

// ======================== 订单API ========================

// 创建订单
app.post('/api/orders', (req, res) => {
    const { customer_name, phone, address, items } = req.body;

    if (!customer_name || !phone || !address || !items || items.length === 0) {
        return res.status(400).json({ error: '订单信息不完整' });
    }

    let totalAmount = 0;
    const itemPromises = items.map(item => {
        return new Promise((resolve, reject) => {
            db.get("SELECT price FROM products WHERE id = ?", [item.productId], (err, row) => {
                if (err) reject(err);
                else {
                    totalAmount += row.price * item.quantity;
                    resolve({ ...item, price: row.price });
                }
            });
        });
    });

    Promise.all(itemPromises).then(orderItems => {
        db.run("INSERT INTO orders (customer_name, phone, address, total_amount) VALUES (?, ?, ?, ?)",
            [customer_name, phone, address, totalAmount], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    const orderId = this.lastID;

                    const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
                    orderItems.forEach(item => {
                        stmt.run(orderId, item.productId, item.quantity, item.price);
                    });
                    stmt.finalize();

                    res.json({
                        success: true,
                        orderId: orderId,
                        totalAmount: totalAmount,
                        message: '订单创建成功！'
                    });
                }
            });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// 获取所有订单
app.get('/api/orders', (req, res) => {
    db.all(`SELECT o.*, GROUP_CONCAT(p.name || 'x' || oi.quantity) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            GROUP BY o.id
            ORDER BY o.created_at DESC`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`五行手串电商服务器运行在 http://0.0.0.0:${PORT}`);
    console.log(`可以通过 http://43.128.101.103:${PORT} 访问`);
});
