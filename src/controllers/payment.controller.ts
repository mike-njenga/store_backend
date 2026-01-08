import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateCustomerPaymentInput } from '../types/model.types.js';

// Record a payment for a sale
export const recordPayment = async (req: Request, res: Response) => {
    try {
        const paymentData: CreateCustomerPaymentInput = req.body;
        const userId = (req as any).user?.id;

        // Validate sale exists and get customer_id
        const { data: sale, error: saleError } = await supabaseAdmin
            .from('sales')
            .select('id, customer_id, total_amount, amount_paid, payment_status')
            .eq('id', paymentData.sale_id)
            .single();

        if (saleError || !sale) {
            return res.status(404).json({
                status: 'error',
                message: 'Sale not found',
            });
        }

        // Check if sale has a customer (credit sale)
        if (!sale.customer_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot record payment for sale without customer. Cash sales are automatically marked as paid.',
            });
        }

        // Calculate remaining balance
        const amountPaid = sale.amount_paid || 0;
        const remainingBalance = sale.total_amount - amountPaid;

        // Validate payment amount
        if (paymentData.amount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Payment amount must be greater than 0',
            });
        }

        if (paymentData.amount > remainingBalance) {
            return res.status(400).json({
                status: 'error',
                message: `Payment amount (${paymentData.amount}) exceeds remaining balance (${remainingBalance})`,
            });
        }

        // Record payment
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('customer_payments')
            .insert({
                sale_id: paymentData.sale_id,
                customer_id: sale.customer_id,
                amount: paymentData.amount,
                payment_method: paymentData.payment_method,
                reference_number: paymentData.reference_number || null,
                notes: paymentData.notes || null,
                recorded_by: userId,
            })
            .select()
            .single();

        if (paymentError || !payment) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to record payment',
                details: paymentError?.message || 'Unknown error',
            });
        }

        // Fetch updated sale with payment status
        const { data: updatedSale } = await supabaseAdmin
            .from('sales')
            .select('id, payment_status, amount_paid, total_amount')
            .eq('id', paymentData.sale_id)
            .single();

        res.status(201).json({
            status: 'success',
            message: 'Payment recorded successfully',
            data: {
                payment,
                sale: updatedSale,
                remaining_balance: updatedSale ? updatedSale.total_amount - (updatedSale.amount_paid || 0) : 0,
            },
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get payment history for a specific sale
export const getSalePayments = async (req: Request, res: Response) => {
    try {
        const { saleId } = req.params;

        if (!saleId) {
            return res.status(400).json({
                status: 'error',
                message: 'Sale ID is required',
            });
        }

        // Verify sale exists
        const { data: sale, error: saleError } = await supabaseAdmin
            .from('sales')
            .select('id, total_amount, amount_paid, payment_status')
            .eq('id', saleId)
            .single();

        if (saleError || !sale) {
            return res.status(404).json({
                status: 'error',
                message: 'Sale not found',
            });
        }

        // Get all payments for this sale
        const { data: payments, error: paymentsError } = await supabaseAdmin
            .from('customer_payments')
            .select('*')
            .eq('sale_id', saleId)
            .order('payment_date', { ascending: false });

        if (paymentsError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch payments',
                details: paymentsError.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                sale: {
                    id: sale.id,
                    total_amount: sale.total_amount,
                    amount_paid: sale.amount_paid || 0,
                    payment_status: sale.payment_status,
                    remaining_balance: sale.total_amount - (sale.amount_paid || 0),
                },
                payments: payments || [],
            },
        });
    } catch (error) {
        console.error('Get sale payments error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get payment history for a specific customer
export const getCustomerPayments = async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;
        const { page = 1, limit = 50, start_date, end_date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        if (!customerId) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required',
            });
        }

        // Verify customer exists
        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customers')
            .select('id, name, current_balance, credit_limit')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
            });
        }

        // Build query
        let query = supabaseAdmin
            .from('customer_payments')
            .select('*, sale:sales(id, sale_number, total_amount, sale_date)', { count: 'exact' })
            .eq('customer_id', customerId)
            .order('payment_date', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        // Apply date filters if provided
        if (start_date) {
            query = query.gte('payment_date', start_date);
        }
        if (end_date) {
            query = query.lte('payment_date', end_date);
        }

        const { data: payments, error: paymentsError, count } = await query;

        if (paymentsError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch payments',
                details: paymentsError.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                customer: {
                    id: customer.id,
                    name: customer.name,
                    current_balance: customer.current_balance,
                    credit_limit: customer.credit_limit,
                },
                payments: payments || [],
            },
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get customer payments error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get customer outstanding balance and unpaid sales
export const getCustomerOutstanding = async (req: Request, res: Response) => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID is required',
            });
        }

        // Get customer details
        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customers')
            .select('id, name, current_balance, credit_limit')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return res.status(404).json({
                status: 'error',
                message: 'Customer not found',
            });
        }

        // Get all unpaid sales for this customer
        const { data: unpaidSales, error: salesError } = await supabaseAdmin
            .from('sales')
            .select('id, sale_number, total_amount, amount_paid, payment_status, sale_date, created_at')
            .eq('customer_id', customerId)
            .in('payment_status', ['pending', 'partial'])
            .order('sale_date', { ascending: false });

        if (salesError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch unpaid sales',
                details: salesError.message,
            });
        }

        // Calculate totals
        const totalOutstanding = unpaidSales?.reduce((sum, sale) => {
            return sum + (sale.total_amount - (sale.amount_paid || 0));
        }, 0) || 0;

        res.status(200).json({
            status: 'success',
            data: {
                customer: {
                    id: customer.id,
                    name: customer.name,
                    current_balance: customer.current_balance,
                    credit_limit: customer.credit_limit,
                    available_credit: customer.credit_limit - customer.current_balance,
                },
                outstanding: {
                    total_amount: totalOutstanding,
                    unpaid_sales_count: unpaidSales?.length || 0,
                    unpaid_sales: unpaidSales?.map(sale => ({
                        id: sale.id,
                        sale_number: sale.sale_number,
                        total_amount: sale.total_amount,
                        amount_paid: sale.amount_paid || 0,
                        remaining_balance: sale.total_amount - (sale.amount_paid || 0),
                        payment_status: sale.payment_status,
                        sale_date: sale.sale_date,
                    })) || [],
                },
            },
        });
    } catch (error) {
        console.error('Get customer outstanding error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete a payment (only managers/owners)
export const deletePayment = async (req: Request, res: Response) => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return res.status(400).json({
                status: 'error',
                message: 'Payment ID is required',
            });
        }

        // Check if payment exists
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('customer_payments')
            .select('id, sale_id, customer_id, amount')
            .eq('id', paymentId)
            .single();

        if (paymentError || !payment) {
            return res.status(404).json({
                status: 'error',
                message: 'Payment not found',
            });
        }

        // Delete payment (triggers will update sale and customer balance)
        const { error: deleteError } = await supabaseAdmin
            .from('customer_payments')
            .delete()
            .eq('id', paymentId);

        if (deleteError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete payment',
                details: deleteError.message,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Payment deleted successfully',
        });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

