const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['STUDENT', 'TEACHER'].includes(role)) {
    return res.status(400).json({ error: 'Role must be STUDENT or TEACHER' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Renamed from 'query' to 'sql' to avoid shadowing the imported query() function
    const sql = `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, is_active
    `;

    const result = await query(sql, [name, email, hashedPassword, role]);

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Force primary read: login must see the latest user state (avoid stale replica reads)
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email],
      { isWrite: true }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMe = async (req, res) => {
  try {
    // Force primary read: must reflect the latest is_active status
    const result = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [req.user.id],
      { isWrite: true }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  const { userId } = req.params;

  if (parseInt(userId, 10) !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1',
      [userId],
      { isWrite: true }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  const { name, email } = req.body;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  try {
    const result = await query(
      `UPDATE users
       SET name = $1, email = $2
       WHERE id = $3
       RETURNING id, name, email, role, is_active, created_at`,
      [name.trim(), email.trim().toLowerCase(), req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  const { old_password, new_password, confirm_password } = req.body;

  if (!old_password || !new_password || !confirm_password) {
    return res.status(400).json({ error: 'All password fields are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  try {
    const result = await query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id],
      { isWrite: true }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(old_password, result.rows[0].password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { register, login, getMe, getProfile, updateProfile, changePassword };
