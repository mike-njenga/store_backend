import dotenv from "dotenv"
const env = dotenv.config()

const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,

    supabase :{
        url: process.env.SUPABASE_URL,
        Anonkey: process.env.SUPABASE_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },

    rateLimit:{
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX || '1000'), // increased for development purposes
        enable: process.env.RATE_LIMIT_ENABLE === 'true', // enable rate limiting
        message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests, please try again later.',
    },

}

export default config