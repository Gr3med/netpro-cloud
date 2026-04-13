const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(), // يحفظ الجلسة في مجلد .wwebjs_auth
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // يمنع انهيار الذاكرة في سيرفرات لينكس
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // الأهم لـ Render: دمج العمليات لتقليل الرام
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('=========================================');
    console.log('📱 عاجل: امسح الباركود التالي لربط الواتساب');
    console.log('=========================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ تم ربط الواتساب بنجاح! المحرك جاهز.');
});

// إعادة التشغيل التلقائي إذا انقطع الاتصال
client.on('disconnected', (reason) => {
    console.log('⚠️ انقطع اتصال الواتساب:', reason);
    client.initialize();
});

client.initialize();

module.exports = client;
