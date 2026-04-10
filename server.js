const express = require('express');
const app = express();
const pool = require('./db');

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use(express.static('public'));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { user_id, user_password } = req.body;
    if (!user_id || !user_password) {
      return res.json({ success: false, msg: 'ID/Password cannot be empty' });
    }

    const [userExist] = await pool.query(
      'SELECT * FROM sys.user WHERE LOWER(user_id) = LOWER(?)',
      [user_id]
    );
    if (userExist.length === 0) {
      return res.json({ success: false, msg: 'User not found' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM sys.user WHERE LOWER(user_id) = LOWER(?) AND user_password = ?',
      [user_id, user_password]
    );
    if (rows.length === 0) {
      return res.json({ success: false, msg: 'Wrong password' });
    }

    res.json({ success: true, userId: user_id, msg: 'Login successful' });
  } catch (err) {
    console.error('Login API error:', err);
    res.json({ success: false, msg: 'User not found' });
  }
});

// User Register
app.post('/api/signup', async (req, res) => {
  try {
    const { user_id, user_password, user_name, gender, date_of_birth, mobile_number, email } = req.body;
    const required = [user_id, user_password, user_name, gender, date_of_birth, mobile_number, email];
    if (required.some(item => !item)) {
      return res.json({ success: false, msg: 'All fields are required' });
    }

    const lowerUserId = user_id.toLowerCase();
    const [exist] = await pool.query(
      'SELECT * FROM sys.user WHERE user_id = ?',
      [lowerUserId]
    );
    if (exist.length > 0) {
      return res.json({ success: false, msg: 'ID already exists' });
    }

    await pool.query(
      `INSERT INTO sys.user
      (user_id, user_password, user_name, gender, date_of_birth, mobile_number, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [lowerUserId, user_password, user_name, gender, date_of_birth, mobile_number, email]
    );
    res.json({ success: true, msg: 'Signup successful' });
  } catch (err) {
    console.error('Signup API error:', err);
    res.json({ success: false, msg: 'Signup failed' });
  }
});

// Get All Users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sys.user');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.json({ success: true, data: [] });
  }
});

// Delete User
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM sys.user WHERE user_id = ?', [id]);
    res.json({ success: true, msg: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.json({ success: false, msg: 'User deletion failed' });
  }
});

// Publish Item
app.post('/api/item/publish', async (req, res) => {
  try {
    const {
      user_id,
      item_title,
      item_category,
      item_price,
      item_status,
      item_images,
      description
    } = req.body;

    const required = [user_id, item_title, item_category, item_price, item_status, item_images];
    if (required.some(item => !item)) {
      return res.json({ success: false, msg: 'Required fields cannot be empty' });
    }

    const [result] = await pool.query(
      `INSERT INTO sys.item
      (user_id, item_title, item_category, item_price, item_status, item_images, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, item_title, item_category, item_price, item_status, item_images, description || null]
    );

    res.json({
      success: true,
      msg: 'Item published successfully',
      data: { item_id: result.insertId }
    });
  } catch (err) {
    console.error('Publish item error:', err);
    res.json({ success: false, msg: 'Item publication failed' });
  }
});

// Get Item List
app.get('/api/item/list', async (req, res) => {
  const page = Number(req.query.page) || 1;
  const size = Number(req.query.size) || 10;
  const offset = (page - 1) * size;

  try {
    const sql = `
      SELECT i.*, u.user_name
      FROM sys.item i
      LEFT JOIN sys.user u ON i.user_id = u.user_id
      ORDER BY i.item_id DESC
      LIMIT ${size} OFFSET ${offset}
    `;
    const [rows] = await pool.query(sql);
    const [count] = await pool.query('SELECT COUNT(*) as total FROM sys.item');

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count[0].total,
        page,
        size
      }
    });
  } catch (err) {
    console.error('Get item list error:', err);
    res.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        page,
        size
      }
    });
  }
});

// Get Item Detail
app.get('/api/item/detail/:item_id', async (req, res) => {
  try {
    const { item_id } = req.params;
    const [rows] = await pool.query(
      `SELECT i.*, u.user_name
       FROM sys.item i
       LEFT JOIN sys.user u ON i.user_id = u.user_id
       WHERE i.item_id = ?`,
      [item_id]
    );
    if (rows.length === 0) {
      return res.json({ success: false, msg: 'Item not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get item detail error:', err);
    res.json({ success: false, msg: 'Item not found' });
  }
});

// Update Item
app.put('/api/item/edit/:item_id', async (req, res) => {
  try {
    const { item_id } = req.params;
    const updateData = req.body;
    const [exist] = await pool.query('SELECT * FROM sys.item WHERE item_id = ?', [item_id]);
    if (exist.length === 0) {
      return res.json({ success: false, msg: 'Item not found' });
    }

    const updateFields = Object.entries(updateData).map(([k, v]) => `${k} = ?`).join(', ');
    const values = [...Object.values(updateData), item_id];
    await pool.query(`UPDATE sys.item SET ${updateFields} WHERE item_id = ?`, values);

    res.json({ success: true, msg: 'Item updated successfully' });
  } catch (err) {
    console.error('Update item error:', err);
    res.json({ success: false, msg: 'Item update failed' });
  }
});

// Delete Item
app.delete('/api/item/delete/:item_id', async (req, res) => {
  try {
    const { item_id } = req.params;
    const [exist] = await pool.query('SELECT * FROM sys.item WHERE item_id = ?', [item_id]);
    if (exist.length === 0) {
      return res.json({ success: false, msg: 'Item not found' });
    }

    await pool.query('DELETE FROM sys.item WHERE item_id = ?', [item_id]);
    res.json({ success: true, msg: 'Item deleted successfully' });
  } catch (err) {
    console.error('Delete item error:', err);
    res.json({ success: false, msg: 'Item deletion failed' });
  }
});

// Add favourite
app.post('/api/favourite/add', async (req, res) => {
  try {
    const { user_id, item_id } = req.body;
    if (!user_id || !item_id) {
      return res.json({ success: false, msg: 'user_id and item_id are required' });
    }

    const [exist] = await pool.query(
      'SELECT * FROM sys.favourite WHERE user_id = ? AND item_id = ?',
      [user_id, item_id]
    );

    if (exist.length > 0) {
      return res.json({ success: true, msg: 'Already favourited' });
    }

    await pool.query(
      'INSERT INTO sys.favourite (user_id, item_id) VALUES (?, ?)',
      [user_id, item_id]
    );

    res.json({ success: true, msg: 'Favourite added successfully' });
  } catch (err) {
    console.error('Add favourite error:', err);
    res.json({ success: false, msg: 'Failed to add favourite' });
  }
});

// Remove favourite
app.post('/api/favourite/remove', async (req, res) => {
  try {
    const { user_id, item_id } = req.body;
    if (!user_id || !item_id) {
      return res.json({ success: false, msg: 'user_id and item_id are required' });
    }

    await pool.query(
      'DELETE FROM sys.favourite WHERE user_id = ? AND item_id = ?',
      [user_id, item_id]
    );

    res.json({ success: true, msg: 'Favourite removed successfully' });
  } catch (err) {
    console.error('Remove favourite error:', err);
    res.json({ success: false, msg: 'Failed to remove favourite' });
  }
});

// Get favourite item ids
app.get('/api/favourite/ids/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await pool.query(
      'SELECT item_id FROM sys.favourite WHERE user_id = ?',
      [user_id]
    );
    res.json({ success: true, data: rows.map(row => String(row.item_id)) });
  } catch (err) {
    console.error('Get favourite ids error:', err);
    res.json({ success: true, data: [] });
  }
});

// Get favourite item list
app.get('/api/favourite/list/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await pool.query(
      `SELECT i.*, u.user_name
       FROM sys.favourite f
       INNER JOIN sys.item i ON f.item_id = i.item_id
       LEFT JOIN sys.user u ON i.user_id = u.user_id
       WHERE f.user_id = ?
       ORDER BY i.item_id DESC`,
      [user_id]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get favourite list error:', err);
    res.json({ success: true, data: [] });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});