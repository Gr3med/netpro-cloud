const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

// ⚠️ تأكد من وضع رقمك هنا
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI; 

let whatsappClient = null;
let isPairingRequested = false; // حارس لمنع تكرار الطلب

console.log('🔄 جاري الاتصال بقاعدة بيانات الجلسات (MongoDB)...');

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
            ],
            timeout: 60000 // إعطاء المتصفح دقيقة كاملة ليفتح
        },
        authTimeoutMs: 120000, // إعطاء عملية المصادقة دقيقتين كاملتين
        qrMaxRetries: 3 // تقليل محاولات إعادة الرسم حتى لا ينهار السيرفر
    });

    whatsappClient.on('qr', async () => {
        // إذا تم طلب الكود مسبقاً، لا تطلبه مرة أخرى
        if (isPairingRequested) return;
        isPairingRequested = true;

        console.log('⏳ تم رصد استجابة الواتساب! ننتظر 6 ثوانٍ لاكتمال تحميل الصفحة على السيرفر البطيء...');
        
        // الانتظار الإجباري للسيرفرات المجانية قبل طلب الرمز
        setTimeout(async () => {
            console.log('⏳ جاري طلب رمز الربط السري (Pairing Code)...');
            try {
                const pairingCode = await whatsappClient.requestPairingCode(MY_PHONE_NUMBER);
                console.log('\n=========================================');
                console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
                console.log('=========================================\n');
            } catch (error) {
                console.error('❌ خطأ في طلب الرمز، السيرفر أبطأ من اللازم:', error.message);
                isPairingRequested = false; // السماح بمحاولة جديدة
            }
        }, 6000); // تأخير 6 ثوانٍ
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 ممتاز! تم حفظ الجلسة في السحابة (MongoDB).');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ تم ربط الواتساب بنجاح! المحرك يعمل الآن بكفاءة.');
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ انقطع اتصال الواتساب:', reason);
        isPairingRequested = false;
        whatsappClient.initialize();
    });

    whatsappClient.initialize();

}).catch((err) => {
    console.error('❌ فشل الاتصال بقاعدة بيانات MongoDB:', err);
});

module.exports = {
    sendMessage: async (chatId, message) => {
        if (!whatsappClient) {
            throw new Error('محرك الواتساب لم يكتمل تشغيله بعد، يرجى الانتظار ثوانٍ قليلة.');
        }
        return await whatsappClient.sendMessage(chatId, message);
    }
};
