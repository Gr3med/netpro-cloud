// المسار: src/controllers/cardController.js
const fs = require('fs');
const { parse } = require('csv-parse');
const db = require('../config/db');

// --- استيراد الكروت الذكي ---
// --- 1. استيراد الكروت من ملف CSV ---
// --- استيراد الكروت من ملف CSV (التنظيف الذكي والعميق) ---
exports.importCards = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "لم يصل أي ملف للسيرفر." });
        
        const packageId = req.body.package_id;
        if (!packageId) return res.status(400).json({ error: "يجب اختيار الباقة أولاً من القائمة." });

        const fileContent = req.file.buffer.toString('utf-8');
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

        let insertedCount = 0;
        let duplicateCount = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let columns = line.split(',');
            
            // 🧹 فلتر التنظيف العنيف (السحر هنا):
            // 1. يأخذ العمود الأول
            // 2. يمسح أي شيء ليس رقماً (0-9) أو حرفاً إنجليزياً (a-z) أو (A-Z)
            let rawCode = columns[0] ? columns[0] : '';
            let voucherCode = rawCode.replace(/[^a-zA-Z0-9]/g, '');

            // تخطي الترويسة أو الأسطر التي أصبحت فارغة بعد التنظيف
            if (!voucherCode || voucherCode.toLowerCase() === 'username' || voucherCode.toLowerCase() === 'pin') {
                continue; 
            }

            try {
                // إدخال الكرت النظيف جداً إلى قاعدة البيانات
                await db.query(
                    'INSERT INTO cards (package_id, voucher_code, status) VALUES (?, ?, ?)',
                    [packageId, voucherCode, 'available']
                );
                insertedCount++;
            } catch (dbError) {
                if (dbError.code === 'ER_DUP_ENTRY') duplicateCount++;
                else throw dbError;
            }
        }

        res.status(200).json({
            success: true,
            total_found: lines.length,
            successfully_inserted: insertedCount,
            duplicates_ignored: duplicateCount
        });

    } catch (error) {
        res.status(500).json({ error: "سبب الفشل: " + (error.sqlMessage || error.message) });
    }
};
// --- جلب جميع الكروت مع البحث والفلترة (للوحة الإدارة) ---
// --- جلب جميع الكروت مع البحث والفلترة (للوحة الإدارة) ---
exports.getAllCards = async (req, res) => {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT c.*, p.name as package_name, a.company_name as agent_name 
                 FROM cards c 
                 LEFT JOIN packages p ON c.package_id = p.id 
                 LEFT JOIN agents a ON c.agent_id = a.id WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as total FROM cards WHERE 1=1`;
    let queryParams = [];

    // فلترة حسب الحالة (متوفر، مباع)
    if (status && status !== 'all') {
        query += ` AND c.status = ?`;
        countQuery += ` AND status = ?`;
        queryParams.push(status);
    }

    // بحث برقم الكرت
    if (search) {
        query += ` AND c.voucher_code LIKE ?`;
        countQuery += ` AND voucher_code LIKE ?`;
        queryParams.push(`%${search}%`);
    }

    // 🔥 التعديل السحري هنا: الترتيب حسب c.id بدلاً من c.created_at
    query += ` ORDER BY c.id DESC LIMIT ? OFFSET ?`;
    
    try {
        const [[{ total }]] = await db.query(countQuery, queryParams);
        const [cards] = await db.query(query, [...queryParams, Number(limit), Number(offset)]);
        
        res.status(200).json({
            success: true,
            data: cards,
            pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("Fetch Cards Error:", error);
        // 🔥 عرض الخطأ الحقيقي لو حدثت مشكلة أخرى
        res.status(500).json({ error: "سبب الفشل: " + (error.sqlMessage || "خطأ داخلي في السيرفر") });
    }
};
// --- حذف كرت (مسموح فقط للكروت غير المباعة) ---
exports.deleteCard = async (req, res) => {
    const cardId = req.params.id;
    try {
        const [card] = await db.query(`SELECT status FROM cards WHERE id = ?`, [cardId]);
        if (card.length === 0) return res.status(404).json({ error: "الكرت غير موجود" });
        if (card[0].status === 'sold') return res.status(400).json({ error: "لا يمكن حذف كرت تم بيعه بالفعل لأسباب محاسبية!" });

        await db.query(`DELETE FROM cards WHERE id = ?`, [cardId]);
        res.status(200).json({ success: true, message: "تم حذف الكرت نهائياً" });
    } catch (error) {
        res.status(500).json({ error: "فشل الحذف" });
    }
};
// --- جلب الباقات المتاحة للاختيار في شاشة الاستيراد ---
exports.getPackages = async (req, res) => {
    try {
        const [packages] = await db.query('SELECT * FROM packages');
        res.status(200).json({ success: true, data: packages });
    } catch (error) {
        res.status(500).json({ error: "فشل جلب الباقات" });
    }
};