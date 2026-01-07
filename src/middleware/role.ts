import type { Request, Response, NextFunction } from 'express';

const authorizeRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // supabase user role is stored in the user.app_metadata.role
        if (!roles.includes(req.user?.app_metadata.role)) {
            return res.status(403).json({ status: 'error', message: 'Forbidden: You are not authorized to access this resource' });
        }
        next();
    };
};

export default authorizeRole;