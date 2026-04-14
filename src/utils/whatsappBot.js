const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ⚠️ ضع رقمك هنا مع المفتاح الدولي (بدون + أو أصفار)
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI;

let whatsappClient = null;
let isQrPrinted = false;

// =====================================================================
// 🛡️ درع الحماية الأقصى: يمنع سيرفر Node.js من الانهيار
// =====================================================================
process.on('unhandledRejection', (reason) => {
    console.log('🛡️ [درع السيرفر] تم امتصاص خطأ من متصفح كروم بصمت.');
});
process.on('uncaughtException', (error) => {
    console.log('🛡️ [درع السيرفر] تم منع انهيار السيرفر بسبب خطأ مميت.');
});

console.log('=========================================');
console.log('🚀 [النظام] بدء تشغيل محرك NetPro الاحترافي (V3 - Enterprise)');
console.log('=========================================');

mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');
    
    const store = new MongoStore({ mongoose: mongoose });

    whatsappClient = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 60000,
            clientId: 'NetPro-Session-Clean-V1' // تغيير هذا الاسم مستقبلاً يمسح الجلسة فوراً
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

    // 1. استخراج الباركود والرمز السري
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
                console.log('\n⚠️ [تحذير] واتساب حظر الرمز السري. يرجى مسح الباركود أعلاه.');
            }
        }, 5000); 
    });

    // 2. الحفظ في السحابة
    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 [ممتاز] تم حفظ الجلسة في MongoDB بنجاح دائم!');
    });

    // 3. البوت جاهز
    whatsappClient.on('ready', () => {
        console.log('✅ [جاهز] تم ربط الواتساب! البوت مستعد لإرسال الكروت.');
    });

    // 4. الانقطاع والتنظيف الآمن
    whatsappClient.on('disconnected', async (reason) => {
        console.log('⚠️ [تنبيه] انقطع اتصال الواتساب:', reason);
        isQrPrinted = false; 
        
        try {
            console.log('🧹 جاري تدمير المتصفح القديم وإعادة الإقلاع...');
            await whatsappClient.destroy();
        } catch (e) {}

        setTimeout(() => {
            whatsappClient.initialize().catch(() => {});
        }, 5000);
    });

    // 5. العلاج الذاتي لقاعدة البيانات (Self-Healing DB)
    whatsappClient.on('auth_failure', async msg => {
        console.error('🚨 [طوارئ] الجلسة فاسدة. جاري العلاج الذاتي...', msg);
        try {
            // تدمير ملفات الجلسة الفاسدة من قاعدة البيانات
            await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.files').drop().catch(()=>Object());
            await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.chunks').drop().catch(()=>Object());
            console.log('✅ تم تنظيف السحابة. سيتم استخراج باركود جديد.');
        } catch (e) {
            console.log('الذاكرة نظيفة مسبقاً.');
        }
    });

    whatsappClient.initialize().catch(() => {});

}).catch((err) => {
    console.error('❌ [خطأ] فشل الاتصال بقاعدة بيانات MongoDB:', err);
});

// =====================================================================
// 🤖 وحدة الإرسال الذكية (تحاكي السلوك البشري لتجنب الحظر)
// =====================================================================
module.exports = {
    sendMessage: async (chatId, message) => {
        if (!whatsappClient) {
            console.log('⚠️ البوت غير جاهز، سيتم وضع الرسالة في قائمة الانتظار...');
            throw new Error('البوت قيد التشغيل.');
        }

        try {
            // الحصول على المحادثة
            const chat = await whatsappClient.getChatById(chatId);
            
            // 1. محاكاة "يكتب..." (Typing Simulation)
            await chat.sendStateTyping();

            // 2. تأخير زمني عشوائي من ثانية إلى 3 ثوانٍ
            const randomDelay = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(resolve => setTimeout(resolve, randomDelay));

            // 3. إيقاف حالة الكتابة وإرسال الرسالة
            await chat.clearState();
            return await whatsappClient.sendMessage(chatId, message);

        } catch (error) {
            console.error(`❌ فشل الإرسال للرقم ${chatId}:`, error.message);
            throw error;
        }
    }
};
