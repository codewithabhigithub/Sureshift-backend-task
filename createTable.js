const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sureshift',
    password: 'Abhi@123',
    port: 5432,
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Function to create tables if they do not exist
const createTablesIfNotExists = async () => {
    const createAdminsTable = `
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        );
    `;

    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            phone VARCHAR(15) NOT NULL,
            pickup_date DATE NOT NULL,
            pickup_time TIME WITHOUT TIME ZONE NOT NULL,
            pickup_address TEXT NOT NULL,
            drop_address TEXT NOT NULL,
            order_id VARCHAR(20) UNIQUE NOT NULL,
            entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
            purpose TEXT NOT NULL
        );
    `;

    const createStatusTable = `
        CREATE TABLE IF NOT EXISTS status (
            id SERIAL PRIMARY KEY,
            order_id VARCHAR(20) UNIQUE,
            status TEXT NOT NULL
        );
    `;

    try {
        await pool.query(createAdminsTable);
        await pool.query(createUsersTable);
        await pool.query(createStatusTable);
        console.log('Tables are ready.');
    } catch (error) {
        console.error('Error creating tables:', error);
    }
};

module.exports = { createTablesIfNotExists };
