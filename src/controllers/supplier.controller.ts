import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateSupplierInput, UpdateSupplierInput } from '../types/model.types.js';

// Create supplier
export const createSupplier = async (req: Request, res: Response) => {
    try {
        const supplierData: CreateSupplierInput = req.body;

        // Create supplier
        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .insert({
                ...supplierData,
                is_active: supplierData.is_active !== undefined ? supplierData.is_active : true,
            })
            .select()
            .single();

        if (error || !supplier) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create supplier',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Supplier created successfully',
            data: supplier,
        });
    } catch (error) {
        console.error('Create supplier error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all suppliers with filters
export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, is_active, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('suppliers')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: suppliers, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch suppliers',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: suppliers || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get suppliers error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single supplier by ID
export const getSupplierById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Supplier ID is required',
            });
        }

        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !supplier) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: supplier,
        });
    } catch (error) {
        console.error('Get supplier error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update supplier
export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData: UpdateSupplierInput = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Supplier ID is required',
            });
        }

        // Check if supplier exists
        const { data: existingSupplier } = await supabaseAdmin
            .from('suppliers')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingSupplier) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found',
            });
        }

        // Update supplier
        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !supplier) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update supplier',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Supplier updated successfully',
            data: supplier,
        });
    } catch (error) {
        console.error('Update supplier error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update supplier status (activate/deactivate)
export const updateSupplierStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Supplier ID is required',
            });
        }

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                status: 'error',
                message: 'is_active must be a boolean',
            });
        }

        // Check if supplier exists
        const { data: existingSupplier } = await supabaseAdmin
            .from('suppliers')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingSupplier) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found',
            });
        }

        // Update status
        const { data: supplier, error } = await supabaseAdmin
            .from('suppliers')
            .update({
                is_active,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !supplier) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update supplier status',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(200).json({
            status: 'success',
            message: `Supplier ${is_active ? 'activated' : 'deactivated'} successfully`,
            data: supplier,
        });
    } catch (error) {
        console.error('Update supplier status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete supplier
export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Supplier ID is required',
            });
        }

        // Check if supplier exists
        const { data: existingSupplier } = await supabaseAdmin
            .from('suppliers')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingSupplier) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found',
            });
        }

        // Check if supplier has associated products
        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('supplier_id', id)
            .limit(1);

        if (productsError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to check supplier associations',
                details: productsError.message,
            });
        }

        if (products && products.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete supplier with associated products. Please deactivate instead or reassign products.',
            });
        }

        // Check if supplier has associated purchases
        const { data: purchases, error: purchasesError } = await supabaseAdmin
            .from('purchases')
            .select('id')
            .eq('supplier_id', id)
            .limit(1);

        if (purchasesError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to check supplier associations',
                details: purchasesError.message,
            });
        }

        if (purchases && purchases.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete supplier with associated purchases. Please deactivate instead.',
            });
        }

        // Delete supplier
        const { error } = await supabaseAdmin
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete supplier',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Supplier deleted successfully',
        });
    } catch (error) {
        console.error('Delete supplier error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

