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
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
    },
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
    luma: {
      apiKey: process.env.LUMAAI_API_KEY || '',
      baseUrl: process.env.LUMA_BASE_URL || 'https://api.lumalabs.ai/dream-machine/v1'
    }
  },
  db: {
    connectionString: process.env.DATABASE_URL || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
    supabaseJwksUrl: process.env.SUPABASE_JWKS_URL || ''
  }
};

module.exports = config;
