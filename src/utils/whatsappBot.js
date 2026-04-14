const { default: makeWASocket, DisconnectReason, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');

const MONGODB_URI = process.env.MONGO_URI;

let sock = null;
let isBotReady = false;

// =====================================================================
// 🧠 محول MongoDB مخصص لحفظ جلسة Baileys (حماية من الحذف في Render)
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

    const creds = await readData('creds') || initAuthCreds();

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
console.log('🚀 [النظام] بدء تشغيل محرك NetPro الاحترافي (Baileys Edition)');
console.log('=========================================');

async function startBot() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(MONGODB_URI);
            console.log('✅ [قاعدة البيانات] تم الاتصال بـ MongoDB بنجاح.');
        }

        const { state, saveCreds } = await useMongoDBAuthState();

        sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }), // إخفاء الرسائل المزعجة في التيرمنال
            printQRInTerminal: false,
            browser: ['NetPro System', 'Chrome', '1.0.0'],
            markOnlineOnConnect: false,
            syncFullHistory: false // إيقاف المزامنة الثقيلة لتوفير الرام
        });

        // حفظ الاعتمادات عند التحديث
        sock.ev.on('creds.update', saveCreds);

        // مراقبة حالة الاتصال
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
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log('🔄 انقطع الاتصال العادي. جاري إعادة الاتصال السريع...');
                    setTimeout(startBot, 3000);
                } else {
                    console.log('🚨 [طوارئ] تم تسجيل الخروج (LOGOUT). جاري تدمير الجلسة السحابية...');
                    await AuthModel.deleteMany({}); // تنظيف قاعدة البيانات بالكامل
                    console.log('✅ تم التنظيف. جاري توليد باركود جديد...');
                    setTimeout(startBot, 5000);
                }
            }

            if (connection === 'open') {
                console.log('✅ [جاهز] تم ربط الواتساب بنجاح عبر Baileys! استهلاك الذاكرة الآن مثالي.');
                isBotReady = true;
            }
        });

        // الرد التلقائي (اختياري)
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const jid = msg.key.remoteJid;

            if (text.trim() === 'مرحبا') {
                await sock.sendMessage(jid, { text: 'مرحباً بك في نظام NetPro! 🚀 المحرك الجديد يعمل بكفاءة.' });
            }
        });

    } catch (error) {
        console.error('❌ خطأ فادح في تشغيل البوت:', error);
    }
}

// تشغيل النظام
startBot();

// =====================================================================
// 📤 وحدة الإرسال (متوافقة 100% مع server.js الحالي الخاص بك)
// =====================================================================
module.exports = {
    sendMessage: async (chatId, message) => {
        if (!sock || !isBotReady) {
            console.log('⚠️ تم رفض الإرسال: البوت غير متصل.');
            throw new Error('البوت غير متصل بالواتساب حالياً.');
        }

        try {
            // تحويل صيغة الرقم من @c.us (القديمة) إلى @s.whatsapp.net (لـ Baileys)
            let jid = chatId.includes('@c.us') ? chatId.replace('@c.us', '@s.whatsapp.net') : chatId;
            if (!jid.includes('@s.whatsapp.net')) jid = `${jid}@s.whatsapp.net`;

            // محاكاة "يكتب..." (Typing)
            await sock.sendPresenceUpdate('composing', jid);
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
            await sock.sendPresenceUpdate('paused', jid);

            // إرسال الرسالة
            const result = await sock.sendMessage(jid, { text: message });
            return result;
        } catch (error) {
            console.error(`❌ فشل الإرسال للرقم ${chatId}:`, error.message);
            throw error;
        }
    }
};