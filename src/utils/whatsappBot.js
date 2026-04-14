const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ⚠️ ضع رقم الواتساب هنا مع المفتاح الدولي (بدون + أو أصفار)
const MY_PHONE_NUMBER = '967770674574'; 
const MONGODB_URI = process.env.MONGO_URI;

let whatsappClient = null;
let isQrPrinted = false;
let isClientReady = false; 

// =====================================================================
// 🛡️ درع الحماية الأقصى: يمنع سيرفر Node.js من الانهيار
// =====================================================================
process.on('unhandledRejection', (reason) => {
    // تجاهل خطأ تدمير السياق لأنه متوقع عند إغلاق المتصفح أو إعادة التشغيل
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) return;
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

    // =====================================================================
    // ⚙️ إعدادات المتصفح المحسنة لمنصات الاستضافة المجانية (Render)
    // =====================================================================
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
                '--disable-gpu',
                // 🛡️ دروع حماية الذاكرة (لإجبار المتصفح على عدم استهلاك كل الرام)
                '--js-flags="--max-old-space-size=256"', 
                '--memory-pressure-off',
                '--disable-software-rasterizer',
                '--disable-features=site-per-process' 
            ],
            timeout: 120000 
        }
    });

    whatsappClient.on('qr', async (qr) => {
        isClientReady = false; 
        if (isQrPrinted) return;
        isQrPrinted = true;

        console.log('\n=========================================');
        console.log('📱 [الخيار الأول] امسح هذا الباركود بكاميرا الواتساب:');
        console.log('=========================================');
        qrcode.generate(qr, { small: true });

        console.log('\n⏳ جاري محاولة استخراج رمز الربط البديل...');
        try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const pairingCode = await whatsappClient.requestPairingCode(MY_PHONE_NUMBER);
            console.log('\n*****************************************');
            console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
            console.log('*****************************************\n');
        } catch (error) {
            console.log('\n⚠️ [حظر مؤقت] واتساب أوقف طلبات الرمز السري حالياً. يرجى استخدام مسح الباركود (QR Code) أعلاه.');
        }
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 [ممتاز] تم حفظ الجلسة في MongoDB بنجاح دائم!');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ [جاهز] تم ربط الواتساب بنجاح! البوت مستقر ومستعد لإرسال الكروت.');
        isClientReady = true; 
        isQrPrinted = false;
    });

    whatsappClient.on('disconnected', async (reason) => {
        console.log(`⚠️ [تنبيه] انقطع اتصال الواتساب. السبب: ${reason}`);
        isClientReady = false; 
        isQrPrinted = false; 
        
        // 🧹 التنظيف الذاتي للجلسة التالفة من السحابة إذا طردك واتساب
        if (reason === 'LOGOUT') {
            console.log('🚨 [علاج ذاتي] الجلسة المحفوظة مرفوضة. جاري تدمير البيانات التالفة للبدء من جديد...');
            try {
                await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.files').drop().catch(()=>Object());
                await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.chunks').drop().catch(()=>Object());
                console.log('✅ تم تنظيف الذاكرة السحابية التالفة بنجاح. البوت سيطبع باركود جديد.');
            } catch (e) {}
        }

        try {
            console.log('🧹 جاري تدمير المتصفح القديم وإعادة الإقلاع بأمان...');
            if (whatsappClient) await whatsappClient.destroy();
        } catch (e) {}

        // إعادة التشغيل بعد 8 ثوانٍ لضمان تفريغ الذاكرة العشوائية بالكامل
        setTimeout(() => {
            console.log('🔄 جاري بدء جلسة جديدة...');
            whatsappClient.initialize().catch(() => {});
        }, 8000);
    });

    whatsappClient.on('auth_failure', async msg => {
        console.error('🚨 [طوارئ] فشل المصادقة.', msg);
        isClientReady = false; 
        try {
            await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.files').drop().catch(()=>Object());
            await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.chunks').drop().catch(()=>Object());
        } catch (e) {}
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
        if (!whatsappClient || !isClientReady) {
            console.log(`⚠️ تم رفض إرسال رسالة للرقم ${chatId} (البوت غير جاهز بعد).`);
            throw new Error('البوت غير متصل بالواتساب حالياً. يرجى الانتظار.');
        }

        try {
            // التحقق من وجود الرقم في واتساب لتجنب الحظر
            const isRegistered = await whatsappClient.isRegisteredUser(chatId);
            if (!isRegistered) {
                console.log(`⚠️ الرقم ${chatId} لا يمتلك حساب واتساب.`);
                throw new Error('الرقم المدخل لا يمتلك حساب واتساب نشط.');
            }

            // محاكاة الكتابة لتقليل فرص الحظر
            try {
                const chat = await whatsappClient.getChatById(chatId);
                if (chat) {
                    await chat.sendStateTyping();
                    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
                    await chat.clearState();
                }
            } catch (e) {
                console.log('⚠️ تعذر محاكاة الكتابة، سيتم الإرسال المباشر.');
            }

            return await whatsappClient.sendMessage(chatId, message);
        } catch (error) {
            console.error(`❌ فشل الإرسال للرقم ${chatId}:`, error.message);
            throw error;
        }
    }
};
