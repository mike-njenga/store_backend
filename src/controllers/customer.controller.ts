import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../types/model.types.js';

// Create customer
export const createCustomer = async (req: Request, res: Response) => {
    try {
        const customerData: CreateCustomerInput = req.body;

        // Create customer
        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .insert({
                ...customerData,
                customer_type: customerData.customer_type || 'retail',
                credit_limit: customerData.credit_limit ?? 0,
                current_balance: customerData.current_balance ?? 0,
                is_active: customerData.is_active !== undefined ? customerData.is_active : true,
            })
            .select()
            .single();

        if (error || !customer) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create customer',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Customer created successfully',
            data: customer,
        });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all customers with filters
export const getCustomers = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, customer_type, is_active, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('customers')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (customer_type) {
            query = query.eq('customer_type', customer_type);
        }

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const { data: customers, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch customers',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: customers || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single customer by ID
export const getCustomerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required',
            });
        }

        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !customer) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: customer,
        });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update customer
export const updateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData: UpdateCustomerInput = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required',
            });
        }

        // Check if customer exists
        const { data: existingCustomer } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingCustomer) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
            });
        }

        // Update customer
        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !customer) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update customer',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Customer updated successfully',
            data: customer,
        });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update customer status (activate/deactivate)
export const updateCustomerStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required',
            });
        }

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                status: 'error',
                message: 'is_active must be a boolean',
            });
        }

        // Check if customer exists
        const { data: existingCustomer } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingCustomer) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
            });
        }

        // Update status
        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .update({
                is_active,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !customer) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update customer status',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(200).json({
            status: 'success',
            message: `Customer ${is_active ? 'activated' : 'deactivated'} successfully`,
            data: customer,
        });
    } catch (error) {
        console.error('Update customer status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete customer
export const deleteCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required',
            });
        }

        // Check if customer exists
        const { data: existingCustomer } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingCustomer) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
            });
        }

        // Check if customer has associated sales
        const { data: sales, error: salesError } = await supabaseAdmin
            .from('sales')
            .select('id')
            .eq('customer_id', id)
            .limit(1);

        if (salesError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to check customer associations',
                details: salesError.message,
            });
        }

        if (sales && sales.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete customer with associated sales. Please deactivate instead.',
            });
        }

        // Delete customer
        const { error } = await supabaseAdmin
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete customer',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Customer deleted successfully',
        });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

