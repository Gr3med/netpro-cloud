const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ⚠️ ضع رقمك هنا مع المفتاح الدولي (بدون +)
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI;

let whatsappClient = null;
let isQrPrinted = false; // لمنع تكرار الطباعة

console.log('=========================================');
console.log('🚀 [النظام] بدء تشغيل محرك NetPro الاحترافي');
console.log('=========================================');

mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');
    
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
            timeout: 120000 // إعطاء السيرفر دقيقتين لفتح المتصفح براحة تامة
        }
    });

    // عندما يكون البوت جاهزاً للربط
    whatsappClient.on('qr', async (qr) => {
        if (isQrPrinted) return;
        isQrPrinted = true;

        console.log('\n=========================================');
        console.log('📱 [الخيار الأول] امسح هذا الباركود بكاميرا الواتساب:');
        console.log('=========================================');
        
        // رسم الباركود فوراً قبل أي شيء آخر
        qrcode.generate(qr, { small: true });

        console.log('\n⏳ [الخيار الثاني] جاري استخراج رمز الربط (Pairing Code)... الرجاء الانتظار 5 ثوانٍ.');
        
        // الانتظار الإجباري لتفادي أخطاء الواتساب
        setTimeout(async () => {
            try {
                const pairingCode = await whatsappClient.requestPairingCode(MY_PHONE_NUMBER);
                console.log('\n*****************************************');
                console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
                console.log('*****************************************\n');
            } catch (error) {
                console.log('\n⚠️ [تحذير] قامت شركة واتساب بحظر استخراج الرمز السري مؤقتاً في هذه الجلسة.');
                console.log('👈 يرجى استخدام الخيار الأول (مسح الباركود) الموجود في الأعلى. (قم بتصغير الشاشة Ctrl و - لقرائته).\n');
            }
        }, 5000); 
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 [ممتاز] تم حفظ الجلسة في MongoDB للأبد! لن تحتاج لمسح الباركود مجدداً.');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ [جاهز] تم ربط الواتساب! البوت مستعد لإرسال الكروت.');
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️ [تنبيه] انقطع اتصال الواتساب:', reason);
        isQrPrinted = false; 
        whatsappClient.initialize();
    });

    // تشغيل المحرك مع اصطياد الانهيارات
    whatsappClient.initialize().catch(err => {
        console.error('❌ [خطأ حرج] فشل تشغيل المتصفح:', err.message);
    });

}).catch((err) => {
    console.error('❌ [خطأ] فشل الاتصال بقاعدة بيانات MongoDB:', err);
});

module.exports = {
    sendMessage: async (chatId, message) => {
        if (!whatsappClient) {
            throw new Error('البوت قيد التشغيل، يرجى الانتظار.');
        }
        return await whatsappClient.sendMessage(chatId, message);
    }
};
