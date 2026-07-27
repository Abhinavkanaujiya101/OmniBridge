const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root or backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  wsPort: parseInt(process.env.WS_PORT || '5001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  gatewaySecret: process.env.GATEWAY_SECRET || 'default_secret',
  providers: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: 'https://api.openai.com/v1'
    },
    together: {
      apiKey: process.env.TOGETHER_API_KEY || '',
      baseUrl: 'https://api.together.xyz/v1'
    },
    runway: {
      apiKey: process.env.RUNWAY_API_KEY || '',
      baseUrl: 'https://api.runwayml.com/v1'
    }
  },
  db: {
    connectionString: process.env.DATABASE_URL || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  }
};

module.exports = config;
