const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ⚠️ ضع رقم الواتساب هنا مع المفتاح الدولي (بدون + أو أصفار)
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI;

let whatsappClient = null;
let isQrPrinted = false;
let isClientReady = false; // 🌟 [إضافة جديدة] متغير لتتبع حالة جاهزية البوت الحقيقية

// =====================================================================
// 🛡️ درع الحماية الأقصى: يمنع سيرفر Node.js من الانهيار
// =====================================================================
process.on('unhandledRejection', (reason) => {
    console.log('🛡️ [درع السيرفر] تم امتصاص خطأ بصمت:', reason?.message || reason);
});
process.on('uncaughtException', (error) => {
    console.log('🛡️ [درع السيرفر] تم منع انهيار السيرفر بسبب خطأ مميت:', error?.message);
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
        isClientReady = false; // البوت غير جاهز
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
                console.log('\n⚠️ [تحذير] واتساب حظر الرمز السري مؤقتاً. يرجى مسح الباركود أعلاه.');
            }
        }, 5000); 
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 [ممتاز] تم حفظ الجلسة في MongoDB بنجاح دائم!');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ [جاهز] تم ربط الواتساب! البوت مستعد لإرسال الكروت.');
        isClientReady = true; // 🌟 البوت الآن جاهز فعلياً لاستقبال الطلبات
        isQrPrinted = false;
    });

    whatsappClient.on('disconnected', async (reason) => {
        console.log('⚠️ [تنبيه] انقطع اتصال الواتساب:', reason);
        isClientReady = false; // 🌟 إيقاف استقبال الطلبات فوراً
        isQrPrinted = false; 
        
        try {
            console.log('🧹 جاري تدمير المتصفح القديم وإعادة الإقلاع...');
            if (whatsappClient) await whatsappClient.destroy();
        } catch (e) {
            console.log('تم تجاوز خطأ تدمير المتصفح.');
        }

        setTimeout(() => {
            whatsappClient.initialize().catch(() => {});
        }, 5000);
    });

    // العلاج الذاتي لقاعدة البيانات (Self-Healing DB)
    whatsappClient.on('auth_failure', async msg => {
        console.error('🚨 [طوارئ] الجلسة فاسدة. جاري العلاج الذاتي...', msg);
        isClientReady = false; // 🌟 إيقاف الطلبات
        try {
            await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.files').drop().catch(()=>Object());
            await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.chunks').drop().catch(()=>Object());
            console.log('✅ تم تنظيف السحابة. سيتم استخراج باركود جديد عند إعادة التشغيل.');
        } catch (e) {
            console.log('الذاكرة نظيفة مسبقاً.');
        }
    });

    whatsappClient.initialize().catch(() => {});

}).catch((err) => {
    console.error('❌ [خطأ] فشل الاتصال بقاعدة بيانات MongoDB:', err);
});

// =====================================================================
// 🤖 وحدة الإرسال الذكية (محمية ضد الانهيارات)
// =====================================================================
module.exports = {
    sendMessage: async (chatId, message) => {
        // 1. التحقق الصارم من جاهزية البوت
        if (!whatsappClient || !isClientReady) {
            console.log(`⚠️ تم رفض إرسال رسالة للرقم ${chatId} لأن البوت غير متصل حالياً.`);
            throw new Error('البوت غير متصل بالواتساب حالياً (Not Ready).');
        }

        try {
            // 2. التحقق مما إذا كان الرقم مسجلاً في واتساب أصلاً (لتجنب الحظر والأخطاء)
            const isRegistered = await whatsappClient.isRegisteredUser(chatId);
            if (!isRegistered) {
                console.log(`⚠️ الرقم ${chatId} لا يمتلك حساب واتساب.`);
                throw new Error('الرقم المدخل لا يمتلك حساب واتساب نشط.');
            }

            // 3. محاولة الحصول على المحادثة لمحاكاة الكتابة (بشكل آمن)
            try {
                const chat = await whatsappClient.getChatById(chatId);
                if (chat) {
                    await chat.sendStateTyping();
                    const randomDelay = Math.floor(Math.random() * 2000) + 1000;
                    await new Promise(resolve => setTimeout(resolve, randomDelay));
                    await chat.clearState();
                }
            } catch (chatError) {
                // في حال فشل جلب المحادثة (مثلاً رقم جديد)، نتجاهل خطأ "يكتب..." ونستمر في الإرسال
                console.log('⚠️ تعذر محاكاة حالة "يكتب..."، سيتم الإرسال المباشر.');
            }

            // 4. إرسال الرسالة النهائية
            return await whatsappClient.sendMessage(chatId, message);

        } catch (error) {
            console.error(`❌ فشل الإرسال للرقم ${chatId}:`, error.message);
            throw error; // إعادة توجيه الخطأ ليتم التقاطه في السيرفر
        }
    }
};
