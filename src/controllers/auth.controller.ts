import type { Request, Response } from 'express';
import { supabaseAdmin, supabaseClient } from '../config/supabase.js';
import type { CreateUserProfileInput } from '../types/model.types.js';
import config from '../config/env.js';

// Admin creates user - no auto-login
export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, username, full_name, role, phone, is_active } = req.body;

        // Create user in Supabase Auth with role in app_metadata
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email for admin-created users
            user_metadata: {
                full_name,
                username,
            },
            app_metadata: {
                role: role,
            },
        });

        if (authError || !authData.user) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create user',
                details: authError?.message || 'Unknown error'
            });
        }

        // Create user profile
        const userProfile: CreateUserProfileInput = {
            id: authData.user.id,
            username,
            full_name,
            role,
            phone: phone || null,
            is_active: is_active !== undefined ? is_active : true,
        };

        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert(userProfile);

        if (profileError) {
            // Rollback: delete the auth user if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create user profile',
                details: profileError.message
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                username,
                full_name,
                role,
                phone: phone || null,
                is_active: userProfile.is_active,
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Sign in with Supabase Auth using regular client
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.session || !data.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password',
                details: error?.message || 'Authentication failed'
            });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, full_name, role, phone, is_active')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({
                status: 'error',
                message: 'User profile not found'
            });
        }

        if (!profile.is_active) {
            return res.status(403).json({
                status: 'error',
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Set secure HTTP-only cookies
        const cookieOptions = {
            httpOnly: config.cookies.httpOnly,
            secure: config.cookies.secure,
            sameSite: config.cookies.sameSite,
            maxAge: config.cookies.maxAge,
            path: '/',
        };

        res.cookie(config.cookies.accessTokenName, data.session.access_token, cookieOptions);
        res.cookie(config.cookies.refreshTokenName, data.session.refresh_token, cookieOptions);

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            user: {
                id: profile.id,
                email: data.user.email,
                username: profile.username,
                full_name: profile.full_name,
                role: profile.role,
                phone: profile.phone,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Refresh access token
export const refreshToken = async (req: Request, res: Response) => {
    try {
        // Get refresh token from cookie
        const refresh_token = req.cookies?.[config.cookies.refreshTokenName];

        if (!refresh_token) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token not found'
            });
        }

        // Refresh the session using Supabase client
        const { data, error } = await supabaseClient.auth.refreshSession({
            refresh_token,
        });

        if (error || !data.session) {
            // Clear invalid cookies
            res.clearCookie(config.cookies.accessTokenName, { path: '/' });
            res.clearCookie(config.cookies.refreshTokenName, { path: '/' });
            
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired refresh token',
                details: error?.message || 'Token refresh failed'
            });
        }

        // Verify user is still active
        if (!data.user) {
            return res.status(401).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('id, is_active')
            .eq('id', data.user.id)
            .single();

        if (!profile || !profile.is_active) {
            // Clear cookies for inactive user
            res.clearCookie(config.cookies.accessTokenName, { path: '/' });
            res.clearCookie(config.cookies.refreshTokenName, { path: '/' });
            
            return res.status(403).json({
                status: 'error',
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Set new secure HTTP-only cookies
        const cookieOptions = {
            httpOnly: config.cookies.httpOnly,
            secure: config.cookies.secure,
            sameSite: config.cookies.sameSite,
            maxAge: config.cookies.maxAge,
            path: '/',
        };

        res.cookie(config.cookies.accessTokenName, data.session.access_token, cookieOptions);
        res.cookie(config.cookies.refreshTokenName, data.session.refresh_token, cookieOptions);

        res.status(200).json({
            status: 'success',
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { current_password, new_password } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized'
            });
        }

        // Verify current password by attempting to sign in
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!authUser?.user?.email) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
            email: authUser.user.email,
            password: current_password,
        });

        if (verifyError) {
            return res.status(401).json({
                status: 'error',
                message: 'Current password is incorrect'
            });
        }

        // Update password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: new_password,
        });

        if (updateError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update password',
                details: updateError.message
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Admin reset password
export const adminResetPassword = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            password: new_password,
        });

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to reset password',
                details: error.message
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Admin reset password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Request password reset
export const requestPasswordReset = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        // Request password reset email using Supabase client
        // Supabase will send an email with a reset link
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${config.frontendUrl}/reset-password`,
        });

        // Always return success message for security (don't reveal if email exists)
        // This prevents email enumeration attacks
        res.status(200).json({
            status: 'success',
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    } catch (error) {
        console.error('Request password reset error:', error);
        // Still return success for security
        res.status(200).json({
            status: 'success',
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    }
};

// Reset password - called after user clicks reset link from email
// Note: Supabase's password reset flow works as follows:
// 1. User requests reset -> Supabase sends email with token
// 2. User clicks link -> Frontend receives token in URL hash
// 3. Frontend verifies token and calls updateUser with new password
// 
// This endpoint provides an alternative using admin API if needed
// The frontend should ideally use Supabase client's updateUser after verifying token
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, new_password } = req.body;

        // Find user by email
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const user = users?.users.find(u => u.email === email);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Update password using admin API
        // Note: In a production environment, you should verify the reset token
        // from the email link before allowing password reset
        // For now, this provides a backend alternative
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password: new_password,
        });

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to reset password',
                details: error.message
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Password reset successfully. Please login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Logout
export const logout = async (req: Request, res: Response) => {
    try {
        // Clear HTTP-only cookies
        res.clearCookie(config.cookies.accessTokenName, {
            httpOnly: config.cookies.httpOnly,
            secure: config.cookies.secure,
            sameSite: config.cookies.sameSite,
            path: '/',
        });
        res.clearCookie(config.cookies.refreshTokenName, {
            httpOnly: config.cookies.httpOnly,
            secure: config.cookies.secure,
            sameSite: config.cookies.sameSite,
            path: '/',
        });

        res.status(200).json({
            status: 'success',
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

