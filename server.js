require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { authenticateToken, hashPassword, comparePassword } = require('./auth');
const sendEmail = require('./email');
const { createTablesIfNotExists } = require('./createTable'); // Import the function

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// Call the function to create tables when server starts
createTablesIfNotExists();

// PostgreSQL connection setup
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sureshift',
    password: 'Abhi@123',
    port: 5432,
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Admin registration
app.post('/admin/register', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body);
    const hashedPassword = await hashPassword(password);

    try {
        await pool.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.status(201).send('Admin registered successfully');
    } catch (error) {
        console.log(error);
        res.status(400).send('Error registering admin');
    }
});

// Admin login
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(400).send('Username or password is incorrect');

        const admin = result.rows[0];
        const validPassword = await comparePassword(password, admin.password);
        if (!validPassword) return res.status(400).send('Invalid password');

        const token = jwt.sign({ id: admin.id }, process.env.TOKEN_SECRET, { expiresIn: '1h' });
        console.log(token);
        res.header('Authorization', `Bearer ${token}`).send({ token });
    } catch (error) {
        res.status(500).send('Error logging in');
    }
});

// Get user details by ID
app.get('/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('User not found');
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(400).send('Error retrieving user details');
    }
});

// Get all users
app.get('/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT us.entry_date, us.name, us.email, us.phone, us.pickup_date, us.pickup_time, 
                   us.pickup_address, us.drop_address, us.order_id, us.purpose, s.status 
            FROM users AS us 
            FULL OUTER JOIN status AS s ON us.order_id = s.order_id 
            ORDER BY us.id DESC
        `);
        if (result.rows.length === 0) {
            return res.status(404).send('Users not found');
        }
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(400).send('Error retrieving users');
    }
});

// Get all completeInfo
app.post('/completeInfo', async (req, res) => {
    console.log(req.body);
    const order_id = req.body.order_id;
    try {
        const result = await pool.query(`
            SELECT us.name, us.email, us.phone, us.pickup_date, us.pickup_time, us.pickup_address, 
                   us.drop_address, us.order_id, us.purpose, s.status 
            FROM users AS us 
            FULL OUTER JOIN status AS s ON us.order_id = s.order_id
            WHERE us.order_id = $1
        `, [order_id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Users not found');
        }
        res.status(200).json(result.rows);
    } catch (error) {
        console.log(error);
        res.status(400).send('Error retrieving users');
    }
});

// Add status
app.post('/status', async (req, res) => {
    const { order_id, status } = req.body;

    try {
        await pool.query(
            `INSERT INTO status (order_id, status)
             VALUES ($1, $2)
             ON CONFLICT (order_id)
             DO UPDATE SET status = EXCLUDED.status`,
            [order_id, status]
        );
        res.status(200).send('Order processed successfully');
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(400).send('Error processing order');
    }
});

// Add user details and send email
const crypto = require('crypto');

// Function to generate a 20-digit unique order ID with a prefix
const generateOrderId = (prefix = '') => {
    const randomPart = crypto.randomBytes(10).toString('hex').toUpperCase(); // Generates a 20-character hex string
    return `${prefix}${randomPart}`.slice(0, 20); // Concatenate prefix and ensure total length is 20
};

const sendConfirmationEmail = async (userEmail, orderDetails) => {
    const subject = 'Your Pickup Request Received';
    const text = `Thank you for your request. Here are your details:\n${orderDetails}`;
    await sendEmail(userEmail, subject, text);
};

// Add user details and send email
app.post('/user', async (req, res) => {
    const { name, email, phone, pickup_date, pickup_time, pickup_address, drop_address, purpose } = req.body;
    console.log(req.body);

    const order_id = generateOrderId('SSON'); // Generate a 20-digit order ID with 'SSON' prefix

    try {
        await pool.query(
            `INSERT INTO users (order_id, name, email, phone, pickup_date, pickup_time, pickup_address, drop_address, purpose) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [order_id, name, email, phone, pickup_date, pickup_time, pickup_address, drop_address, purpose]
        );

        const orderDetails = `Order ID: ${order_id}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nPickup Date: ${pickup_date}\nPickup Time: ${pickup_time}\nPickup Address: ${pickup_address}\nDrop Address: ${drop_address}\nPurpose: ${purpose}`;

        // Send emails asynchronously
        Promise.all([
            sendConfirmationEmail(email, orderDetails),
            sendEmail(process.env.COMPANY_EMAIL, 'New Pickup Request', orderDetails)
        ]).then(() => {
            res.status(201).send('User details added successfully and emails sent');
        }).catch(error => {
            console.error('Error sending emails:', error);
            res.status(500).send('User details added successfully, but email sending failed');
        });
    } catch (error) {
        console.error('Error adding user details:', error);
        res.status(400).send('Error adding user details');
    }
});


app.listen(4000, () => {
    console.log('Server is running on port 4000');
});
