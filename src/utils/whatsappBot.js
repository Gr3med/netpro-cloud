const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

// ⚠️ ضع رقم هاتفك هنا مع مفتاح الدولة
const MY_PHONE_NUMBER = '96770674574'; 

// رابط قاعدة البيانات الذي سنضعه في إعدادات Render
const MONGODB_URI = process.env.MONGO_URI; 

console.log('🔄 جاري الاتصال بقاعدة بيانات الجلسات (MongoDB)...');

// 1. الاتصال بقاعدة البيانات أولاً
mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ تم الاتصال بقاعدة البيانات. جاري تشغيل المحرك...');
    
    // إخبار الواتساب بأن يستخدم هذه القاعدة لحفظ الجلسات
    const store = new MongoStore({ mongoose: mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 60000 // مزامنة الجلسة كل دقيقة لضمان عدم ضياعها
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

    // 2. إذا لم تكن هناك جلسة محفوظة، سيطلب كود الربط
    client.on('qr', async () => {
        console.log('⏳ جاري استخراج رمز الربط السري (Pairing Code)...');
        try {
            const pairingCode = await client.requestPairingCode(MY_PHONE_NUMBER);
            console.log('\n=========================================');
            console.log(`🔑 رمز الربط الخاص بك هو: ${pairingCode}`);
            console.log('=========================================\n');
        } catch (error) {
            console.error('❌ خطأ في طلب الرمز:', error.message);
        }
    });

    // 3. حدث الحفظ في السحابة (الأهم!)
    client.on('remote_session_saved', () => {
        console.log('☁️ 🎉 ممتاز! تم حفظ الجلسة في MongoDB. السيرفر الآن محمي ضد إعادة التشغيل.');
    });

    // 4. البوت جاهز للعمل
    client.on('ready', () => {
        console.log('✅ تم ربط الواتساب بنجاح! المحرك يعمل الآن بكفاءة.');
    });

    // إعادة التشغيل عند الانقطاع
    client.on('disconnected', (reason) => {
        console.log('⚠️ انقطع اتصال الواتساب:', reason);
        client.initialize();
    });

    client.initialize();
}).catch((err) => {
    console.error('❌ فشل الاتصال بقاعدة بيانات MongoDB:', err);
});

module.exports = client; // سيتم تصديره بعد التفعيل
