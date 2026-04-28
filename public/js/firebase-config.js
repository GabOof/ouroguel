// ============================================
// CONFIGURAÇÃO DO FIREBASE - OUROGUEL
// Versão com App Check (modo debug)
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyDxpJE_2EYqfRlDcRGOayd1ZmJqjHOs67U",
  authDomain: "ouroguel-1190.firebaseapp.com",
  projectId: "ouroguel-1190",
  storageBucket: "ouroguel-1190.firebasestorage.app",
  messagingSenderId: "831984928283",
  appId: "1:831984928283:web:e1381b716ae26bbf4f1abe",
  measurementId: "G-6LVN3Y4MV9",
};

// ============================================
// INICIALIZAÇÃO
// ============================================

if (!firebase.apps.length) {
  try {
    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);

    // ============================================
    // APP CHECK (modo debug - não bloqueia)
    // ============================================
    if (typeof firebase.appCheck === "function") {
      // Debug token para desenvolvimento local
      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      const appCheck = firebase.appCheck();
      appCheck.activate(
        "6LfMobksAAAAAIwHePM83kRWY1nHAzUyK-hNFI_r",
        true, // autoRefresh
      );
      console.log("✅ App Check inicializado (modo monitoramento)");
    } else {
      console.warn("⚠️ App Check SDK não carregado");
    }

    // Inicializar serviços
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Configurar persistência LOCAL
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Tornar globalmente disponível
    window.auth = auth;
    window.db = db;
    window.firebase = firebase;

    console.log("✅ Firebase inicializado com sucesso");
    console.log(
      "📍 Ambiente:",
      window.location.hostname === "localhost" ? "Desenvolvimento" : "Produção",
    );
  } catch (error) {
    console.error("❌ Erro ao configurar Firebase:", error);
  }
} else {
  // Reutilizar instância existente
  window.auth = firebase.auth();
  window.db = firebase.firestore();
  window.firebase = firebase;
}
