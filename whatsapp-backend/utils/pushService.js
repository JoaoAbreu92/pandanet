const admin = require('firebase-admin');

let firebaseApp = null;

// Tenta inicializar o Firebase Admin SDK
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('[FCM] Inicializando Firebase Admin através de variável de ambiente...');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim());
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('[FCM] Firebase Admin inicializado com sucesso.');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        console.log(`[FCM] Inicializando Firebase Admin através do arquivo: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}`);
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('[FCM] Firebase Admin inicializado com sucesso.');
    } else {
        console.warn('[FCM] AVISO: Nenhuma credencial do Firebase (FIREBASE_SERVICE_ACCOUNT ou FIREBASE_SERVICE_ACCOUNT_PATH) foi encontrada no ambiente.');
        console.warn('[FCM] As notificações em segundo plano (Push) não serão enviadas.');
    }
} catch (err) {
    console.error('[FCM] Erro crítico ao inicializar o Firebase Admin SDK:', err.message);
}

/**
 * Envia uma notificação push para um dispositivo específico através do token FCM
 * @param {string} token - Token de registro FCM do dispositivo
 * @param {string} title - Título da notificação
 * @param {string} body - Mensagem da notificação
 * @param {object} [data] - Metadados adicionais da notificação
 */
async function sendPushNotification(token, title, body, data = {}) {
    if (!firebaseApp) {
        console.warn('[FCM] Notificação push ignorada: Firebase Admin SDK não foi inicializado.');
        return null;
    }

    if (!token) {
        console.warn('[FCM] Notificação push ignorada: Token FCM do destinatário está vazio.');
        return null;
    }

    // Garante que todas as propriedades de dados sejam strings (requisito do Firebase FCM)
    const cleanData = {};
    Object.keys(data).forEach(key => {
        cleanData[key] = data[key] ? String(data[key]) : '';
    });

    const message = {
        token: token,
        notification: {
            title: title,
            body: body
        },
        data: cleanData,
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                clickAction: 'FCM_PLUGIN_ACTIVITY',
                channelId: 'default'
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default'
                }
            }
        }
    };

    try {
        console.log(`[FCM] Enviando push para o token: ${token.substring(0, 15)}...`);
        const response = await admin.messaging().send(message);
        console.log('[FCM] Notificação push enviada com sucesso. Response ID:', response);
        return response;
    } catch (error) {
        console.error('[FCM] Erro ao enviar notificação push via Firebase:', error.message);
        return null;
    }
}

module.exports = {
    sendPushNotification
};
