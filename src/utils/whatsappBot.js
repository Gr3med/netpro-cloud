const { default: makeWASocket, DisconnectReason, BufferJSON, initAuthCreds, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

const MONGODB_URI = process.env.MONGO_URI;

let sock = null;
let isBotReady = false;
let reconnectAttempts = 0;

// =====================================================================
// 🧠 محول MongoDB مخصص لحفظ جلسة Baileys
// =====================================================================
const AuthSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    data: { type: String, required: true }
});
const AuthModel = mongoose.models.BaileysAuth || mongoose.model('BaileysAuth', AuthSchema);

async function useMongoDBAuthState() {
    const writeData = async (data, id) => {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await AuthModel.findByIdAndUpdate(id, { data: str }, { upsert: true });
    };
    const readData = async (id) => {
        const doc = await AuthModel.findById(id);
        if (doc) return JSON.parse(doc.data, BufferJSON.reviver);
        return null;
    };
    const removeData = async (id) => {
        await AuthModel.findByIdAndDelete(id);
    };

    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// =====================================================================
// 🤖 تشغيل المحرك (Baileys Core)
// =====================================================================
console.log('=========================================');
console.log('🚀 [النظام] بدء تشغيل محرك NetPro الاحترافي (Baileys - Fix 405)');
console.log('=========================================');

async function startBot() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(MONGODB_URI);
            console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');
        }

        const { state, saveCreds } = await useMongoDBAuthState();
        
        // 🎯 [الحل الجذري للخطأ 405]: جلب أحدث إصدار من واتساب ديناميكياً
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`🌐 جاري الاتصال بخوادم واتساب (إصدار: ${version.join('.')}) - الأحدث: ${isLatest}`);

        sock = makeWASocket({
            version, // إرفاق الإصدار هنا هو ما سيمنع الخطأ 405
            auth: state,
            logger: pino({ level: 'silent' }), 
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'), // استخدام بصمة متصفح حقيقية لتجنب الحظر
            markOnlineOnConnect: false,
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                isBotReady = false;
                console.log('\n=========================================');
                console.log('📱 امسح هذا الباركود بالكاميرا لتسجيل الدخول:');
                console.log('=========================================');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                isBotReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`⚠️ انقطع الاتصال. كود الخطأ: ${statusCode || 'غير معروف'}`);

                if (shouldReconnect) {
                    reconnectAttempts++;
                    console.log(`🔄 محاولة إعادة الاتصال رقم (${reconnectAttempts})...`);
                    
                    if (reconnectAttempts >= 3) {
                        console.log('🚨 [حماية النظام] تم اكتشاف مشكلة في الاتصال. جاري مسح الذاكرة للبدء من الصفر...');
                        await AuthModel.deleteMany({});
                        reconnectAttempts = 0;
                    }
                    setTimeout(startBot, 4000);
                } else {
                    console.log('🚨 [طوارئ] تم تسجيل الخروج (LOGOUT). جاري تدمير الجلسة...');
                    await AuthModel.deleteMany({});
                    reconnectAttempts = 0;
                    setTimeout(startBot, 5000);
                }
            }

            if (connection === 'open') {
                console.log('✅ [جاهز] تم ربط الواتساب بنجاح عبر Baileys! النظام مستقر.');
                isBotReady = true;
                reconnectAttempts = 0; 
            }
        });

    } catch (error) {
        console.error('❌ خطأ فادح في تشغيل البوت:', error);
    }
}

startBot();

module.exports = {
    sendMessage: async (chatId, message) => {
        if (!sock || !isBotReady) {
            console.log('⚠️ تم رفض الإرسال: البوت غير متصل.');
            throw new Error('البوت غير متصل بالواتساب حالياً.');
        }

        try {
            let jid = chatId.includes('@c.us') ? chatId.replace('@c.us', '@s.whatsapp.net') : chatId;
            if (!jid.includes('@s.whatsapp.net')) jid = `${jid}@s.whatsapp.net`;

            await sock.sendPresenceUpdate('composing', jid);
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
            await sock.sendPresenceUpdate('paused', jid);

            return await sock.sendMessage(jid, { text: message });
        } catch (error) {
            console.error(`❌ فشل الإرسال للرقم ${chatId}:`, error.message);
            throw error;
        }
    }
};
