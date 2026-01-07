import { supabaseAdmin } from '../config/supabase.js';
import config from '../config/env.js';
import type { Request, Response, NextFunction } from 'express';

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get access token from cookie (preferred) or Authorization header (fallback)
        const token = req.cookies?.[config.cookies.accessTokenName] 
            || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

        if (!token) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Unauthorized: Missing or invalid token' 
            });
        }

        // Validate the auth token using supabase admin
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        
        if (error || !data.user) {
            // If token is invalid, try to refresh it
            const refresh_token = req.cookies?.[config.cookies.refreshTokenName];
            if (refresh_token) {
                // Token might be expired, but don't auto-refresh here
                // Let the client handle refresh via /refresh endpoint
            }
            return res.status(401).json({ 
                status: 'error', 
                message: 'Unauthorized: Invalid or expired token' 
            });
        }
        
        req.user = data.user;
        next();
    } catch (error) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
};