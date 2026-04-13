const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal'); // استدعاء مكتبة الباركود

// ⚠️ ضع رقم هاتفك هنا مع مفتاح الدولة (بدون +)
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI; 

let whatsappClient = null;
let isQrPrinted = false; // حارس لمنع تكرار الطباعة

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
            timeout: 60000
        },
        authTimeoutMs: 120000,
        qrMaxRetries: 3
    });

    whatsappClient.on('qr', async (qr) => {
        if (isQrPrinted) return;
        isQrPrinted = true;

        console.log('\n=========================================');
        console.log('📱 الخيار الأول (المضمون): امسح الباركود التالي:');
        console.log('=========================================');
        
        // طباعة الباركود في الشاشة
        qrcode.generate(qr, { small: true });

        console.log('\n⏳ الخيار الثاني: جاري محاولة استخراج رمز الربط (Pairing Code)...');
        
        // الانتظار 8 ثوانٍ ثم محاولة استخراج الرمز السري
        setTimeout(async () => {
            try {
                const pairingCode = await whatsappClient.requestPairingCode(MY_PHONE_NUMBER);
                console.log('\n=========================================');
                console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
                console.log('=========================================\n');
            } catch (error) {
                console.error('❌ تعذر استخراج رمز الربط بسبب تحديثات واتساب.');
                console.log('👈 يرجى استخدام الخيار الأول (مسح الباركود بالأعلى) لربط البوت.');
            }
        }, 8000); 
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 ممتاز! تم حفظ الجلسة في السحابة (MongoDB) للأبد.');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ تم ربط الواتساب بنجاح! المحرك يعمل الآن بكفاءة.');
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ انقطع اتصال الواتساب:', reason);
        isQrPrinted = false; // السماح بطباعة الباركود مجدداً
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
