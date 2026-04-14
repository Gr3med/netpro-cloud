require('dotenv').config();

const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');

const MONGO_URI = process.env.MONGO_URI;
const CLIENT_ID = process.env.WA_CLIENT_ID || 'netpro';
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI غير موجود داخل .env');
  process.exit(1);
}

let whatsappClient = null;
let isStarting = false;
let isReady = false;
let reconnectTimer = null;

console.log('=========================================');
console.log('🚀 [النظام] بدء تشغيل محرك NetPro');
console.log('=========================================');

async function startBot() {
  if (isStarting) return;
  isStarting = true;

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000
    });

    console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');

    const store = new MongoStore({ mongoose });

    whatsappClient = new Client({
      authStrategy: new RemoteAuth({
        store,
        clientId: CLIENT_ID,
        backupSyncIntervalMs: 60000,
        dataPath: './.wwebjs_auth/'
      }),
      puppeteer: {
        headless: true,
        executablePath: puppeteer.executablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        timeout: 120000
      }
    });

    whatsappClient.on('qr', (qr) => {
      console.log('\n=========================================');
      console.log('📱 امسح هذا الباركود بكاميرا واتساب:');
      console.log('=========================================');
      qrcode.generate(qr, { small: true });
    });

    whatsappClient.on('authenticated', () => {
      console.log('✅ [واتساب] تم التوثيق بنجاح.');
    });

    whatsappClient.on('remote_session_saved', () => {
      console.log('☁️ [واتساب] تم حفظ الجلسة في MongoDB.');
    });

    whatsappClient.on('ready', () => {
      isReady = true;
      console.log('✅ [جاهز] تم ربط الواتساب، والنظام مستعد.');
    });

    whatsappClient.on('auth_failure', (msg) => {
      console.error('❌ [واتساب] فشل في المصادقة:', msg);
    });

    whatsappClient.on('disconnected', (reason) => {
      console.log('⚠️ [واتساب] انقطع الاتصال:', reason);
      isReady = false;

      if (reconnectTimer) clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(() => {
        startBot().catch((err) => {
          console.error('❌ [إعادة تشغيل] فشل إعادة الاتصال:', err.message);
        });
      }, 5000);
    });

    whatsappClient.initialize();
  } catch (error) {
    console.error('❌ [خطأ حرج] فشل تشغيل البوت:', error.message);
  } finally {
    isStarting = false;
  }
}

process.on('unhandledRejection', (err) => {
  console.error('❌ [UnhandledRejection]:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ [UncaughtException]:', err);
});

startBot();

const server = require('express')();

server.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    botReady: isReady
  });
});

server.listen(PORT, () => {
  console.log(`🚀 تم تشغيل سيرفر NetPro بنجاح على المنفذ ${PORT}`);
});

module.exports = {
  sendMessage: async (chatId, message) => {
    if (!whatsappClient || !isReady) {
      throw new Error('البوت ليس جاهزًا بعد.');
    }
    return await whatsappClient.sendMessage(chatId, message);
  },
  getClient: () => whatsappClient
};
