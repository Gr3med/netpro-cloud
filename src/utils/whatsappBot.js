const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// مهم: استدعاء puppeteer الكامل
const puppeteer = require('puppeteer');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth' // حفظ الجلسة
    }),
    puppeteer: {
        headless: true,

        // 🔥 أهم سطر لحل مشكلة Chrome
        executablePath: puppeteer.executablePath(),

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

// QR
client.on('qr', (qr) => {
    console.log('--- QR CODE ---');
    qrcode.generate(qr, { small: true });
});

// جاهز
client.on('ready', () => {
    console.log('✅ WhatsApp Ready!');
});

// فشل المصادقة
client.on('auth_failure', msg => {
    console.error('❌ Auth failed:', msg);
});

// أخطاء عامة (مهم جدًا)
client.on('disconnected', (reason) => {
    console.log('🔴 Disconnected:', reason);
});

client.initialize();

module.exports = client;
