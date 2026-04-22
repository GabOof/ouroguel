// firebase-config.js - Versão corrigida

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

      // Inicializar App Check se disponível
      if (firebase.appCheck && typeof firebase.appCheck === "function") {
        const appCheck = firebase.appCheck();
        appCheck.activate("6LfMobksAAAAAIwHePM83kRWY1nHAzUyK-hNFI_r", true);
        console.log("✅ App Check inicializado");
      } else {
        console.warn("⚠️ App Check não disponível - continuando sem ele");
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

// Aguardar o DOM e scripts carregarem
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarFirebase);
} else {
  inicializarFirebase();
}
