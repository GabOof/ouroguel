const firebaseConfig = {
    apiKey: "AIzaSyDxpJE_2EYqfRlDcRGOayd1ZmJqjHOs67U",
    authDomain: "ouroguel-1190.firebaseapp.com",
    projectId: "ouroguel-1190",
    storageBucket: "ouroguel-1190.firebasestorage.app",
    messagingSenderId: "831984928283",
    appId: "1:831984928283:web:e1381b716ae26bbf4f1abe",
    measurementId: "G-6LVN3Y4MV9",
};

window.firebaseReady = (async function inicializarFirebase() {
    try {
        if (typeof firebase === "undefined") {
            throw new Error("SDK do Firebase não foi carregado. Verifique as tags CDN no HTML.");
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const auth = firebase.auth();
        const db = firebase.firestore();
        const storage = firebase.storage();

        const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

        if (isLocal) {
            const emulatorHost = location.hostname;

            auth.useEmulator(`http://${emulatorHost}:9099`);
            db.useEmulator(emulatorHost, 8080);
            storage.useEmulator(emulatorHost, 9199);

            console.log("Firebase conectado aos emuladores locais");
        }

        window.auth = auth;
        window.db = db;
        window.storage = storage;

        console.log("Firebase inicializado com sucesso");
        console.log("Ambiente:", isLocal ? "Desenvolvimento" : "Produção");

        return { auth, db };
    } catch (error) {
        console.error("Erro ao configurar Firebase:", error);
        throw error;
    }
})();
