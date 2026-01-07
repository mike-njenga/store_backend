import { supabaseAdmin } from '../config/supabase.js';
import type { Request, Response, NextFunction } from 'express';

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];


        // validate te auth token using supabase admin
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        
        if (error || !data.user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
        }
        
        req.user = data.user;
        next();
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Internal server error', details: error });
    }
};