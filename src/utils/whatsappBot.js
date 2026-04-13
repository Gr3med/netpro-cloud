const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

// ⚠️ ضع رقم هاتفك هنا مع مفتاح الدولة (بدون +)
const MY_PHONE_NUMBER = '967xxxxxxxxx'; 

// رابط قاعدة البيانات من إعدادات Render
const MONGODB_URI = process.env.MONGO_URI; 

// 1. تعريف المتغير في النطاق العام (Global Scope)
let whatsappClient = null;

console.log('🔄 جاري الاتصال بقاعدة بيانات الجلسات (MongoDB)...');

// 2. بدء الاتصال والتجهيز
mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح.');
    
    const store = new MongoStore({ mongoose: mongoose });

    whatsappClient = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 60000 
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }
    });

    whatsappClient.on('qr', async () => {
        console.log('⏳ جاري استخراج رمز الربط السري (Pairing Code)...');
        try {
            const pairingCode = await whatsappClient.requestPairingCode(MY_PHONE_NUMBER);
            console.log('\n=========================================');
            console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
            console.log('=========================================\n');
        } catch (error) {
            console.error('❌ خطأ في طلب الرمز:', error.message);
        }
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 ممتاز! تم حفظ الجلسة في السحابة (MongoDB).');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ تم ربط الواتساب بنجاح! المحرك يعمل الآن بكفاءة.');
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ انقطع اتصال الواتساب:', reason);
        whatsappClient.initialize();
    });

    whatsappClient.initialize();

}).catch((err) => {
    console.error('❌ فشل الاتصال بقاعدة بيانات MongoDB:', err);
});

// 3. تصدير دالة وسيطة لملف server.js
module.exports = {
    sendMessage: async (chatId, message) => {
        // حماية السيرفر: التأكد من أن البوت جاهز قبل محاولة الإرسال
        if (!whatsappClient) {
            throw new Error('محرك الواتساب لم يكتمل تشغيله بعد، يرجى الانتظار ثوانٍ قليلة.');
        }
        return await whatsappClient.sendMessage(chatId, message);
    }
};
