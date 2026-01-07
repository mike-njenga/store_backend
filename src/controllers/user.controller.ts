import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateUserProfileInput, UpdateUserProfileInput } from '../types/model.types.js';

// Admin creates user
export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, username, full_name, role, phone, is_active } = req.body;

        // Create user in Supabase Auth with role in app_metadata
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
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

// Get all users (admin only)
export const getUsers = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, role, is_active } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('user_profiles')
            .select('id, username, full_name, role, phone, is_active, created_at, updated_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (role) {
            query = query.eq('role', role);
        }
        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const { data, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch users',
                details: error.message
            });
        }

        res.status(200).json({
            status: 'success',
            data: data || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit))
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, full_name, role, phone, is_active, created_at, updated_at')
            .eq('id', id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Get auth user email
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
        
        res.status(200).json({
            status: 'success',
            user: {
                ...profile,
                email: authUser?.user?.email || null,
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Get own profile
export const getOwnProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized'
            });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, full_name, role, phone, is_active, created_at, updated_at')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({
                status: 'error',
                message: 'User profile not found'
            });
        }

        // Get auth user email
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        res.status(200).json({
            status: 'success',
            user: {
                ...profile,
                email: authUser?.user?.email || null,
            }
        });
    } catch (error) {
        console.error('Get own profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Update user (admin)
export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData: UpdateUserProfileInput = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        // Update user profile
        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update user',
                details: error?.message || 'Unknown error'
            });
        }

        // Update app_metadata if role is being changed
        if (updateData.role) {
            await supabaseAdmin.auth.admin.updateUserById(id, {
                app_metadata: { role: updateData.role }
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'User updated successfully',
            user: data
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Update own profile
export const updateOwnProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { role, is_active, ...updateData } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized'
            });
        }

        // Prevent role and is_active changes
        const allowedUpdates: UpdateUserProfileInput = {
            username: updateData.username,
            full_name: updateData.full_name,
            phone: updateData.phone,
        };

        // Update user profile
        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .update({
                ...allowedUpdates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
            .select()
            .single();

        if (error || !data) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update profile',
                details: error?.message || 'Unknown error'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully',
            user: data
        });
    } catch (error) {
        console.error('Update own profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Delete user (admin)
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'User ID is required'
            });
        }

        // Delete auth user (this will cascade delete profile due to FK constraint)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete user',
                details: error.message
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

