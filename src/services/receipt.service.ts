import PDFDocument from 'pdfkit';
import type { Sale, SaleItem, Customer, Product, UserProfile } from '../types/model.types.js';

interface ReceiptData {
    sale: Sale & {
        customer?: Customer | null;
        items?: (SaleItem & { product?: Product | null })[];
        cashier?: UserProfile | null;
    };
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
    shopEmail?: string;
}

export const generateReceiptPDF = (receiptData: ReceiptData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: [80 * 2.83465, 297 * 2.83465], // 80mm width (thermal printer size), A4 height
                margins: { top: 20, bottom: 20, left: 15, right: 15 }
            });

            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);

            const { sale, shopName = 'Hardware Shop', shopAddress = '', shopPhone = '', shopEmail = '' } = receiptData;

            // Header
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text(shopName, { align: 'center' });
            
            if (shopAddress) {
                doc.fontSize(10)
                   .font('Helvetica')
                   .text(shopAddress, { align: 'center' });
            }
            
            if (shopPhone || shopEmail) {
                const contactInfo = [shopPhone, shopEmail].filter(Boolean).join(' | ');
                doc.fontSize(9)
                   .font('Helvetica')
                   .text(contactInfo, { align: 'center' });
            }

            // Separator line
            doc.moveDown(0.5);
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .stroke();
            doc.moveDown(0.5);

            // Receipt Title
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('SALES RECEIPT', { align: 'center' });
            doc.moveDown(0.3);

            // Sale Information
            doc.fontSize(10)
               .font('Helvetica');
            
            const saleDate = new Date(sale.sale_date);
            doc.text(`Receipt #: ${sale.sale_number}`, { continued: false });
            doc.text(`Date: ${saleDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}`);
            doc.moveDown(0.3);

            // Customer Information
            if (sale.customer) {
                doc.font('Helvetica-Bold')
                   .text('Customer:', { continued: false });
                doc.font('Helvetica')
                   .text(` ${sale.customer.name}`);
                
                if (sale.customer.phone) {
                    doc.text(`Phone: ${sale.customer.phone}`);
                }
                if (sale.customer.address) {
                    doc.text(`Address: ${sale.customer.address}`);
                }
                doc.moveDown(0.3);
            } else {
                doc.font('Helvetica')
                   .text('Customer: Walk-in Customer');
                doc.moveDown(0.3);
            }

            // Separator line
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .stroke();
            doc.moveDown(0.3);

            // Items Table Header
            doc.fontSize(9)
               .font('Helvetica-Bold');
            
            const col1 = doc.page.margins.left;
            const col2 = col1 + 80;
            const col3 = col2 + 60;
            const col4 = col3 + 50;
            const col5 = doc.page.width - doc.page.margins.right - 60;

            doc.text('Item', col1, doc.y);
            doc.text('Qty', col2, doc.y);
            doc.text('Price', col3, doc.y);
            doc.text('Disc.', col4, doc.y);
            doc.text('Total', col5, doc.y);
            
            doc.moveDown(0.2);
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .stroke();
            doc.moveDown(0.2);

            // Items
            doc.fontSize(9)
               .font('Helvetica');
            
            if (sale.items && sale.items.length > 0) {
                sale.items.forEach((item) => {
                    const productName = item.product?.name || 'Unknown Product';
                    const quantity = item.quantity.toString();
                    const unitPrice = item.unit_price.toFixed(2);
                    const discount = item.discount > 0 ? item.discount.toFixed(2) : '-';
                    const lineTotal = item.line_total.toFixed(2);

                    // Handle long product names
                    const maxNameWidth = col2 - col1 - 5;
                    doc.text(productName.substring(0, 30), col1, doc.y, { width: maxNameWidth });
                    
                    doc.text(quantity, col2, doc.y);
                    doc.text(unitPrice, col3, doc.y);
                    doc.text(discount, col4, doc.y);
                    doc.text(lineTotal, col5, doc.y);
                    
                    doc.moveDown(0.2);
                });
            }

            doc.moveDown(0.3);
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .stroke();
            doc.moveDown(0.3);

            // Totals
            doc.fontSize(10);
            
            const subtotal = sale.subtotal.toFixed(2);
            const discountAmount = sale.discount_amount > 0 ? sale.discount_amount.toFixed(2) : '0.00';
            const totalAmount = sale.total_amount.toFixed(2);

            doc.font('Helvetica')
               .text(`Subtotal:`, col4, doc.y, { continued: false });
            doc.text(`KES ${subtotal}`, col5, doc.y, { align: 'right' });
            
            if (sale.discount_amount > 0) {
                doc.moveDown(0.2);
                doc.text(`Discount:`, col4, doc.y, { continued: false });
                doc.text(`KES ${discountAmount}`, col5, doc.y, { align: 'right' });
            }

            doc.moveDown(0.3);
            doc.font('Helvetica-Bold')
               .fontSize(12)
               .text(`TOTAL:`, col4, doc.y, { continued: false });
            doc.text(`KES ${totalAmount}`, col5, doc.y, { align: 'right' });

            doc.moveDown(0.5);

            // Payment Information
            doc.fontSize(10)
               .font('Helvetica');
            
            const paymentMethod = sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1).replace('_', ' ');
            doc.text(`Payment Method: ${paymentMethod}`);

            if (sale.payment_status && sale.payment_status !== 'paid') {
                const amountPaid = sale.amount_paid || 0;
                const remaining = sale.total_amount - amountPaid;
                doc.text(`Amount Paid: KES ${amountPaid.toFixed(2)}`);
                doc.text(`Balance: KES ${remaining.toFixed(2)}`);
            }

            doc.moveDown(0.5);

            // Cashier Information
            if (sale.cashier) {
                doc.fontSize(9)
                   .font('Helvetica')
                   .text(`Served by: ${sale.cashier.full_name || 'Cashier'}`, { align: 'center' });
            }

            doc.moveDown(0.5);

            // Footer
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .stroke();
            doc.moveDown(0.3);

            doc.fontSize(8)
               .font('Helvetica')
               .text('Thank you for your business!', { align: 'center' });
            doc.moveDown(0.2);
            doc.text('This is a computer-generated receipt.', { align: 'center' });

            // Notes (if any)
            if (sale.notes) {
                doc.moveDown(0.3);
                doc.fontSize(8)
                   .font('Helvetica-Italic')
                   .text(`Note: ${sale.notes}`, { align: 'left' });
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

