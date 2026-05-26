const firebaseConfig = {
    apiKey: "AIzaSyDxpJE_2EYqfRlDcRGOayd1ZmJqjHOs67U",
    authDomain: "ouroguel-1190.firebaseapp.com",
    projectId: "ouroguel-1190",
    storageBucket: "ouroguel-1190.firebasestorage.app",
    messagingSenderId: "831984928283",
    appId: "1:831984928283:web:e1381b716ae26bbf4f1abe",
    measurementId: "G-6LVN3Y4MV9",
};

if (typeof firebase === "undefined") {
    throw new Error("SDK do Firebase não foi carregado. Verifique as tags CDN no HTML.");
}

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let storage = null;

if (firebase.storage) {
    storage = firebase.storage();
}

const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "0.0.0.0" ||
    location.port === "3000";

if (isLocal) {
    auth.useEmulator("http://localhost:9099", {
        disableWarnings: true,
    });

    db.useEmulator("localhost", 8080);

    if (storage) {
        storage.useEmulator("localhost", 9199);
    }

    window.USANDO_FIREBASE_EMULATOR = true;

    console.warn("🔥 Firebase Emulator ATIVO");
    console.warn("Auth Emulator: http://localhost:9099");
    console.warn("Firestore Emulator: localhost:8080");
} else {
    window.USANDO_FIREBASE_EMULATOR = false;

    console.warn("⚠️ Firebase PRODUÇÃO ativo");
}

window.firebase = firebase;
window.auth = auth;
window.db = db;
window.storage = storage;

window.firebaseReady = (async function inicializarFirebase() {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        console.log("Firebase inicializado com sucesso");
        console.log("Ambiente:", isLocal ? "Desenvolvimento local" : "Produção");

        return {
            firebase,
            auth,
            db,
            storage,
            isLocal,
        };
    } catch (error) {
        console.error("Erro ao configurar Firebase:", error);
        throw error;
    }
})();
