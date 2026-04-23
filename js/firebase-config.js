// firebase-config.js - Versão corrigida para produção

const firebaseConfig = {
  apiKey: "AIzaSyDxpJE_2EYqfRlDcRGOayd1ZmJqjHOs67U",
  authDomain: "ouroguel-1190.firebaseapp.com",
  projectId: "ouroguel-1190",
  storageBucket: "ouroguel-1190.firebasestorage.app",
  messagingSenderId: "831984928283",
  appId: "1:831984928283:web:e1381b716ae26bbf4f1abe",
  measurementId: "G-6LVN3Y4MV9",
};

// Função para inicializar o Firebase
function inicializarFirebase() {
  if (!firebase.apps.length) {
    try {
      // Inicializar Firebase
      firebase.initializeApp(firebaseConfig);

      // Inicializar App Check
      if (firebase.appCheck && typeof firebase.appCheck === "function") {
        const appCheck = firebase.appCheck();

        // Ativar App Check com reCAPTCHA v3
        appCheck.activate(
          "6LfMobksAAAAAIwHePM83kRWY1nHAzUyK-hNFI_r",
          true, // autoRefresh
        );

        console.log("✅ App Check inicializado");
      } else {
        console.warn("⚠️ App Check não disponível");
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
    } catch (error) {
      console.error("❌ Erro ao configurar Firebase:", error);
    }
  } else {
    // Reutilizar instância existente
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.firebase = firebase;
  }
}

// Inicializar quando a página carregar
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarFirebase);
} else {
  inicializarFirebase();
}
