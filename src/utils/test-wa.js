const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer');

const MONGO_URI = process.env.MONGO_URI;

let client;

(async () => {
    try {
        console.log('🚀 بدء تشغيل واتساب...');

        // الاتصال بـ MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ تم الاتصال بـ MongoDB');

        const store = new MongoStore({ mongoose });

        client = new Client({
            authStrategy: new RemoteAuth({
                store: store,
                clientId: "netpro",
                backupSyncIntervalMs: 60000
            }),
            puppeteer: {
                headless: false, // 👈 محلي خليها false
                executablePath: puppeteer.executablePath(),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
        });

        // 🔥 QR
        client.on('qr', (qr) => {
            console.log('\n📱 امسح QR:');
            qrcode.generate(qr, { small: true });
        });

        // 🔐 تم التوثيق
        client.on('authenticated', () => {
            console.log('✅ تم تسجيل الدخول');
        });

        // ☁️ حفظ الجلسة
        client.on('remote_session_saved', () => {
            console.log('💾 تم حفظ الجلسة في MongoDB');
        });

        // ✅ جاهز
        client.on('ready', () => {
            console.log('🚀 البوت جاهز للعمل!');
        });

        // ⚠️ انقطاع
        client.on('disconnected', (reason) => {
            console.log('⚠️ انقطع الاتصال:', reason);
        });

        client.initialize();

    } catch (err) {
        console.error('❌ خطأ:', err);
    }
})();

module.exports = {
    sendMessage: async (chatId, message) => {
        if (!client) throw new Error('البوت لم يبدأ');
        return await client.sendMessage(chatId, message);
    }
};