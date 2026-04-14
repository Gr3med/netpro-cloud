const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

// ⚠️ ضع رقم الواتساب هنا مع المفتاح الدولي (بدون + أو أصفار)
const MY_PHONE_NUMBER = '967782607615'; 
const MONGODB_URI = process.env.MONGO_URI;

let whatsappClient = null;
let isClientReady = false; 
let qrRefreshTimeout = null; // 🌟 مؤقت تحديث الباركود
let qrCount = 0; // عداد محاولات الباركود

// =====================================================================
// 🧠 نظام إدارة جلسات المستخدمين (لعمل خطوات متسلسلة مثل الحجز والشراء)
// =====================================================================
const activeSessions = new Map();

const sessionManager = {
    set: (chatId, stepName, extraData = {}) => {
        if (activeSessions.has(chatId)) clearTimeout(activeSessions.get(chatId).timeout);
        const timeout = setTimeout(() => activeSessions.delete(chatId), 600000); // 10 دقائق وتنتهي
        activeSessions.set(chatId, { stepName, extraData, timeout });
    },
    get: (chatId) => activeSessions.get(chatId),
    remove: (chatId) => {
        if (activeSessions.has(chatId)) {
            clearTimeout(activeSessions.get(chatId).timeout);
            activeSessions.delete(chatId);
        }
    }
};

// =====================================================================
// 🛡️ درع الحماية الأقصى: يمنع سيرفر Node.js من الانهيار
// =====================================================================
process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) return;
    console.log('🛡️ [درع السيرفر] تم امتصاص خطأ بصمت:', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
    console.log('🛡️ [درع السيرفر] تم منع انهيار السيرفر:', error?.message);
});

console.log('=========================================');
console.log('🚀 [النظام] بدء تشغيل محرك NetPro الاحترافي (V4 - Auto Refresh)');
console.log('=========================================');

mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');
    
    const store = new MongoStore({ mongoose: mongoose });

    // ⚙️ إعدادات المتصفح المحسنة لمنصات الاستضافة المجانية (Render)
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
                '--js-flags="--max-old-space-size=256"', // 🛡️ حماية الذاكرة العشوائية من الامتلاء
                '--memory-pressure-off',
                '--disable-software-rasterizer',
                '--disable-features=site-per-process' 
            ],
            timeout: 120000 
        }
    });

    whatsappClient.on('qr', async (qr) => {
        isClientReady = false; 
        qrCount++;
        
        console.log('\n=========================================');
        console.log(`📱 [الباركود - محاولة ${qrCount}] امسح هذا الباركود بالكاميرا:`);
        console.log('=========================================');
        qrcode.generate(qr, { small: true });

        // ⏱️ نظام التحديث التلقائي للباركود بعد دقيقة
        clearTimeout(qrRefreshTimeout);
        qrRefreshTimeout = setTimeout(async () => {
            if (!isClientReady) {
                console.log('\n⏳ [تحديث] مرت 60 ثانية ولم يتم مسح الباركود. جاري توليد واحد جديد...');
                try {
                    await whatsappClient.destroy();
                    whatsappClient.initialize().catch(() => {});
                } catch (e) {}
            }
        }, 60000); // 60,000 مللي ثانية = دقيقة واحدة
    });

    whatsappClient.on('remote_session_saved', () => {
        console.log('☁️ 🎉 [ممتاز] تم حفظ الجلسة في السحابة بنجاح!');
    });

    whatsappClient.on('ready', () => {
        console.log('✅ [جاهز] تم ربط الواتساب بنجاح! البوت مستقر ومستعد للعمل.');
        isClientReady = true; 
        clearTimeout(qrRefreshTimeout); // إيقاف مؤقت التحديث لأننا اتصلنا بنجاح
        qrCount = 0; // تصفير العداد
    });

    // =====================================================================
    // 🤖 معالج رسائل الواتساب (التفاعل المباشر مع العملاء)
    // =====================================================================
    whatsappClient.on('message', async (msg) => {
        if (!isClientReady) return;
        
        const chatId = msg.from;
        const text = msg.body.trim();
        const currentSession = sessionManager.get(chatId);

        // 1. أمر الخروج العام
        if (text === 'الغاء' || text === 'خروج') {
            if (currentSession) {
                sessionManager.remove(chatId);
                await msg.reply('⛔ تم إلغاء العملية. كيف يمكنني مساعدتك؟');
            }
            return;
        }

        // 2. إذا كان المستخدم في منتصف عملية (جلسة محجوزة)
        if (currentSession) {
            if (currentSession.stepName === 'WAITING_FOR_PIN') {
                if (text.length >= 4) {
                    await msg.reply(`✅ تم استلام الكرت: ${text}. جاري المعالجة...`);
                    sessionManager.remove(chatId);
                } else {
                    await msg.reply('⚠️ رقم الكرت قصير. أرسل الرقم الصحيح أو اكتب "الغاء".');
                }
                return; 
            }
        }

        // 3. الأوامر العادية
        if (text === 'مرحبا') {
            await msg.reply('مرحباً بك في شبكتنا 🌐\nأرسل كلمة "شراء" للبدء.');
        } else if (text === 'شراء') {
            await msg.reply('💳 تفضل بإرسال رقم الكرت:');
            sessionManager.set(chatId, 'WAITING_FOR_PIN'); // حجز الجلسة
        }
    });

    whatsappClient.on('disconnected', async (reason) => {
        console.log(`⚠️ [تنبيه] انقطع اتصال الواتساب. السبب: ${reason}`);
        isClientReady = false; 
        clearTimeout(qrRefreshTimeout);
        
        // 🧹 التنظيف الذاتي للجلسة التالفة
        if (reason === 'LOGOUT') {
            console.log('🚨 [علاج ذاتي] الجلسة مرفوضة. جاري تدمير البيانات التالفة...');
            try {
                await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.files').drop().catch(()=>Object());
                await mongoose.connection.db.collection('whatsapp-RemoteAuth-NetPro-Session-Clean-V1.chunks').drop().catch(()=>Object());
                console.log('✅ تم تنظيف السحابة. سيتم عرض باركود جديد.');
            } catch (e) {}
        }

        try {
            console.log('🧹 جاري إعادة تشغيل المحرك...');
            if (whatsappClient) await whatsappClient.destroy();
        } catch (e) {}

        setTimeout(() => {
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
    console.error('❌ [خطأ] فشل الاتصال بـ MongoDB:', err);
});

// =====================================================================
// 📤 وحدة الإرسال السريع (تُستدعى من ملف server.js)
// =====================================================================
module.exports = {
    sendMessage: async (chatId, message) => {
        if (!whatsappClient || !isClientReady) {
            throw new Error('البوت غير متصل بالواتساب حالياً.');
        }

        try {
            const isRegistered = await whatsappClient.isRegisteredUser(chatId);
            if (!isRegistered) throw new Error('الرقم المدخل لا يمتلك واتساب.');

            try {
                const chat = await whatsappClient.getChatById(chatId);
                if (chat) {
                    await chat.sendStateTyping();
                    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
                    await chat.clearState();
                }
            } catch (e) {}

            return await whatsappClient.sendMessage(chatId, message);
        } catch (error) {
            console.error(`❌ فشل الإرسال للرقم ${chatId}:`, error.message);
            throw error;
        }
    }
};
