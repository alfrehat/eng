const { Pool } = require('pg');
require('dotenv').config();

async function check() {
    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    try {
        const seqTable = await client.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_sequences';
        `);
        console.log('system_sequences exists in DB:', seqTable.rows.length > 0);

        const tasksTable = await client.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks';
        `);
        console.log('tasks exists in DB:', tasksTable.rows.length > 0);

        const seqCount = await client.query('SELECT count(*)::int as c FROM public.system_sequences;');
        console.log('system_sequences row count:', seqCount.rows[0].c);

        const tasksCount = await client.query('SELECT count(*)::int as c FROM public.tasks;');
        console.log('tasks row count:', tasksCount.rows[0].c);
    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);
