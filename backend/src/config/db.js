const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const config = require('./env');

let supabase = null;
let pgPool = null;

// Initialize Supabase Client if credentials exist
if (config.db.supabaseUrl && config.db.supabaseAnonKey) {
  supabase = createClient(config.db.supabaseUrl, config.db.supabaseAnonKey);
  console.log('[Database] Supabase client initialized.');
} else {
  console.warn('[Database] Supabase credentials missing in env; operating in decoupled state.');
}

// Initialize Postgres Client Pool if connection string exists
if (config.db.connectionString) {
  pgPool = new Pool({
    connectionString: config.db.connectionString,
    ssl: config.env === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('[Database] PostgreSQL pool initialized.');
}

module.exports = {
  supabase,
  pgPool
};
