const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const db = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const agentRoutes = require('./src/routes/agentRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const cardRoutes = require('./src/routes/cardRoutes');
const salesRoutes = require('./src/routes/salesRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const userRoutes = require('./src/routes/userRoutes');
const mobileRoutes = require('./src/routes/mobileRoutes');
const whatsappBot = require('./src/utils/whatsappBot');
const app = express();

// Middlewares أساسية
app.use(helmet()); // لحماية الـ Headers
app.use(cors()); // للسماح لتطبيق فلاتر ولوحة التحكم بالاتصال
app.use(express.json()); // لتمكين قراءة البيانات بصيغة JSON
app.use(express.urlencoded({ extended: true }));

// مسار فحص حالة السيرفر (Health Check)
app.get('/api/status', async (req, res) => {
    try {
        // فحص سريع لاتصال قاعدة البيانات
        await db.query('SELECT 1');
        res.status(200).json({ status: "🟢 النظام يعمل بشكل ممتاز (Online)", db: "متصل" });
    } catch (error) {
        res.status(500).json({ status: "🔴 خطأ في النظام", db: "غير متصل" });
    }
});

// هنا سنضيف لاحقاً مسارات (Routes) الموزعين والكروت

 app.use('/api/v1/auth', authRoutes);
 app.use('/api/v1/agents', agentRoutes);
 app.use('/api/v1/cards', cardRoutes);
 app.use('/api/v1/transactions', transactionRoutes);
 app.use('/api/v1/sales', salesRoutes);
 app.use('/api/v1/dashboard', dashboardRoutes);
 app.use('/api/v1/users', userRoutes);
 app.use('/api/v1/mobile', mobileRoutes);
app.post('/api/v1/whatsapp/send', async (req, res) => {
    try {
        const { phone, pinCode } = req.body;

        if (!phone || !pinCode) {
            return res.status(400).json({ error: 'رقم الهاتف ورقم الكرت مطلوبان' });
        }

        // تهيئة الرقم اليمني ليقبله محرك الواتساب (إضافة 967 و @c.us)
        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
        if (formattedPhone.startsWith('7')) formattedPhone = '967' + formattedPhone;
        
        const chatId = `${formattedPhone}@c.us`; // هذه هي الصيغة الإجبارية لمكتبة whatsapp-web.js

        const message = `*مرحباً بك في شبكتنا* 🌐\n\nتم إصدار كرت إنترنت بنجاح:\n*رقم الكرت (PIN):* ${pinCode}\n\nنتمنى لك تصفحاً ممتعاً! 🚀`;

        // أمر البوت بالإرسال
        await whatsappBot.sendMessage(chatId, message);

        res.status(200).json({ success: true, message: 'تم الإرسال للزبون عبر بوت الإدارة بنجاح' });
    } catch (error) {
        console.error('خطأ في إرسال الواتساب:', error);
        res.status(500).json({ error: 'فشل إرسال الرسالة، تأكد من أن البوت متصل.' });
    }
});
// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 تم تشغيل سيرفر NetPro بنجاح على المنفذ ${PORT}`);
});
