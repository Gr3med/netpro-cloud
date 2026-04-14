const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const db = require('./src/config/db');

// استدعاء المسارات الخاصة بالنظام
const authRoutes = require('./src/routes/authRoutes');
const agentRoutes = require('./src/routes/agentRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const cardRoutes = require('./src/routes/cardRoutes');
const salesRoutes = require('./src/routes/salesRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const userRoutes = require('./src/routes/userRoutes');
const mobileRoutes = require('./src/routes/mobileRoutes');

// استدعاء محرك الواتساب
const whatsappBot = require('./src/utils/whatsappBot');

const app = express();

// Middlewares أساسية
app.use(helmet()); 
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// مسار فحص حالة السيرفر (Health Check)
app.get('/api/status', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: "🟢 النظام يعمل بشكل ممتاز (Online)", db: "متصل" });
    } catch (error) {
        res.status(500).json({ status: "🔴 خطأ في النظام", db: "غير متصل" });
    }
});

// تركيب مسارات النظام (Routes)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/cards', cardRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/mobile', mobileRoutes);

// =====================================================================
// 🚀 مسار الواتساب السريع (Fire-and-Forget API) لحماية التطبيق من التجميد
// =====================================================================
// =====================================================================
// 🚀 مسار الواتساب السريع (Fire-and-Forget API) 
// =====================================================================
// =====================================================================
// 🚀 مسار الواتساب السريع (Fire-and-Forget API) 
// =====================================================================
app.post('/api/v1/whatsapp/send', async (req, res) => {
    try {
        // إضافة price (السعر) ليستقبله من تطبيق الموبايل
        const { phone, pinCode, distributorName, price } = req.body;

        if (!phone || !pinCode) {
            return res.status(400).json({ error: 'رقم الهاتف ورقم الكرت مطلوبان' });
        }

        // تهيئة الرقم اليمني ليقبله محرك الواتساب
        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
        if (formattedPhone.startsWith('7')) formattedPhone = '967' + formattedPhone;
        
        const chatId = `${formattedPhone}@c.us`; 

        const shopName = distributorName ? distributorName : 'المركز الرئيسي';
        const packagePrice = price ? `${price} ريال` : 'غير محدد';

        // 🕒 استخراج الوقت والتاريخ بتنسيق احترافي
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB'); // يعطي التاريخ بصيغة DD/MM/YYYY
        const timeStr = now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', hour12: true }); // يعطي الوقت بصيغة 05:30 م

        // ✨ الرسالة الملكية (VIP Message Formatted)
        const message = `🌟 *مرحباً بك في شبكة زين نت* 🌟\n\n`
                      + `يسعدنا اختيارك لشبكتنا! تم إصدار كرت الإنترنت بنجاح. 🎉\n`
                      + `━━━━━━━━━━━━━━\n`
                      + `🎫 *رقم الكرت (PIN):*\n`
                      + `\`\`\`${pinCode}\`\`\`\n` // 👈 هذا التنسيق يجعل الكرت في مربع رمادي ويُنسخ بضغطة واحدة في الواتساب!
                      + `━━━━━━━━━━━━━━\n`
                      + `💰 *السعر:* ${packagePrice}\n`
                      + `🏪 *الموزع:* ${shopName}\n`
                      + `📅 *التاريخ:* ${dateStr}\n`
                      + `⏰ *الوقت:* ${timeStr}\n\n`
                      + `🚀 *زين نت*.. نتمنى لك تصفحاً فائق السرعة!`;

        // ⚡ الاستجابة فوراً لتطبيق الموبايل قبل بدء الإرسال الفعلي
        res.status(200).json({ success: true, message: 'تم استلام طلب الواتساب وجاري معالجته في الخلفية' });

        // 🤖 إرسال الرسالة في الخلفية بصمت
        whatsappBot.sendMessage(chatId, message).then(() => {
            console.log(`✅ [خلفية] تم تسليم الكرت للرقم ${phone} (بواسطة: ${shopName})`);
        }).catch((err) => {
            console.error(`⚠️ [خلفية] تعذر تسليم الكرت للرقم ${phone}:`, err.message);
        });

    } catch (error) {
        console.error('❌ خطأ غير متوقع في مسار الواتساب:', error);
    }
});
// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 تم تشغيل سيرفر NetPro بنجاح على المنفذ ${PORT}`);
});
