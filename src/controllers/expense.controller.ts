import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateExpenseInput, UpdateExpenseInput } from '../types/model.types.js';

// Create expense
export const createExpense = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const expenseData: CreateExpenseInput = req.body;

        // Create expense
        const { data: expense, error } = await supabaseAdmin
            .from('expenses')
            .insert({
                ...expenseData,
                recorded_by: expenseData.recorded_by || userId || null,
            })
            .select()
            .single();

        if (error || !expense) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create expense',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Expense created successfully',
            data: expense,
        });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all expenses with filters
export const getExpenses = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, expense_category, start_date, end_date, recorded_by } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('expenses')
            .select(`
                *,
                recorder:user_profiles(id, username, full_name)
            `, { count: 'exact' })
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (expense_category) {
            query = query.eq('expense_category', expense_category);
        }
        if (start_date) {
            query = query.gte('expense_date', start_date);
        }
        if (end_date) {
            query = query.lte('expense_date', end_date);
        }
        if (recorded_by) {
            query = query.eq('recorded_by', recorded_by);
        }

        const { data: expenses, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch expenses',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: expenses || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single expense by ID
export const getExpenseById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Expense ID is required',
            });
        }

        const { data: expense, error } = await supabaseAdmin
            .from('expenses')
            .select(`
                *,
                recorder:user_profiles(id, username, full_name, role)
            `)
            .eq('expenses_id', id)
            .single();

        if (error || !expense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: expense,
        });
    } catch (error) {
        console.error('Get expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update expense
export const updateExpense = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData: UpdateExpenseInput = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Expense ID is required',
            });
        }

        // Check if expense exists
        const { data: existingExpense } = await supabaseAdmin
            .from('expenses')
            .select('expenses_id')
            .eq('expenses_id', id)
            .single();

        if (!existingExpense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found',
            });
        }

        // Update expense
        const { data: expense, error } = await supabaseAdmin
            .from('expenses')
            .update(updateData)
            .eq('expenses_id', id)
            .select()
            .single();

        if (error || !expense) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update expense',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Expense updated successfully',
            data: expense,
        });
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete expense
export const deleteExpense = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Expense ID is required',
            });
        }

        // Check if expense exists
        const { data: existingExpense } = await supabaseAdmin
            .from('expenses')
            .select('expenses_id')
            .eq('expenses_id', id)
            .single();

        if (!existingExpense) {
            return res.status(404).json({
                status: 'error',
                message: 'Expense not found',
            });
        }

        // Delete expense
        const { error } = await supabaseAdmin
            .from('expenses')
            .delete()
            .eq('expenses_id', id);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete expense',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

