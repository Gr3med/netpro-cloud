const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// إعداد المحرك للعمل في بيئة السيرفر (Render)
const client = new Client({
    authStrategy: new LocalAuth(), // لحفظ الدخول مؤقتاً
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // لتقليل استهلاك الرام في ريندر
            '--disable-gpu'
        ]
    }
});

// 1. استخراج الباركود في الـ Logs
client.on('qr', (qr) => {
    console.log('--- QR CODE بدأت عملية توليد ---');
    console.log('امسح الكود أدناه لربط واتساب المحرك:');
    qrcode.generate(qr, { small: true });
});

// 2. نجاح الربط
client.on('ready', () => {
    console.log('✅ المحرك يعمل الآن! الواتساب مرتبط وجاهز لإرسال كروت NetPro.');
});

// 3. معالجة الخطأ عند فشل التشغيل
client.on('auth_failure', msg => {
    console.error('❌ فشل في المصادقة، يرجى إعادة مسح الباركود:', msg);
});

client.initialize();

module.exports = client;