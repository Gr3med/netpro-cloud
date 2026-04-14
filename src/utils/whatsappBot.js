const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ⚠️ ضع رقمك هنا (بدون +)
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI;

let whatsappClient = null;
let isQrPrinted = false;

// =====================================================================
// 🛡️ درع الحماية الأقصى: يمنع سيرفر Node.js من الانهيار مهما حدث في كروم
// =====================================================================
process.on('unhandledRejection', (reason) => {
    console.log('🛡️ [درع السيرفر] تم امتصاص صدمة/خطأ من متصفح كروم بصمت:', reason.message || reason);
});
process.on('uncaughtException', (error) => {
    console.log('🛡️ [درع السيرفر] تم منع انهيار السيرفر بسبب خطأ مميت:', error.message);
});

console.log('=========================================');
console.log('🚀 [النظام] بدء تشغيل محرك NetPro الاحترافي (V2)');
console.log('=========================================');

mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');
    
    const store = new MongoStore({ mongoose: mongoose });

    whatsappClient = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 60000,
            // 💡 السر هنا: تغيير اسم الجلسة لبدء صفحة بيضاء نظيفة في قاعدة البيانات
            clientId: 'NetPro-Session-Clean-V1' 
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
            timeout: 120000 
        }
    });

    whatsappClient.on('qr', async (qr) => {
        if (isQrPrinted) return;
        isQrPrinted = true;

        console.log('\n=========================================');
        console.log('📱 [الخيار الأول] امسح هذا الباركود بكاميرا الواتساب:');
        console.log('=========================================');
        qrcode.generate(qr, { small: true });

        console.log('\n⏳ [الخيار الثاني] جاري استخراج رمز الربط... الرجاء الانتظار 5 ثوانٍ.');
        setTimeout(async () => {
            try {
                const pairingCode = await whatsappClient.requestPairingCode(MY_PHONE_NUMBER);
                console.log('\n*****************************************');
                console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
                console.log('*****************************************\n');
            } catch (error) {
                console.log('\n⚠️ [تحذير] واتساب حظر الرمز السري. يرجى مسح الباركود أعلاه (صغّر الشاشة بـ Ctrl و - لقرائته).');
            }
        }, 5000); 
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 [ممتاز] تم حفظ الجلسة في MongoDB بنجاح دائم!');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ [جاهز] تم ربط الواتساب! البوت مستعد لإرسال الكروت.');
    });

    whatsappClient.on('disconnected', async (reason) => {
        console.log('⚠️ [تنبيه] انقطع اتصال الواتساب:', reason);
        isQrPrinted = false; 
        
        // التدمير الآمن للمتصفح المعطوب قبل إعادة التشغيل
        try {
            console.log('🧹 جاري تنظيف الذاكرة وتدمير المتصفح القديم...');
            await whatsappClient.destroy();
        } catch (e) {}

        setTimeout(() => {
            console.log('🔄 جاري إعادة الإقلاع...');
            whatsappClient.initialize().catch(err => console.log('❌ خطأ إعادة التشغيل', err));
        }, 5000);
    });

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
