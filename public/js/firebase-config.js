// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA85IJjdoyweYtK4QrPYuIY1SgylH1pGZg",
  authDomain: "ouroguel-1190.firebaseapp.com",
  projectId: "ouroguel-1190",
  storageBucket: "ouroguel-1190.firebasestorage.app",
  messagingSenderId: "831984928283",
  appId: "1:831984928283:web:e1381b716ae26bbf4f1abe",
  measurementId: "G-6LVN3Y4MV9",
};

// Evitar inicialização duplicada
if (!firebase.apps.length) {
  try {
    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);

    // Inicializar serviços
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Configurar persistência LOCAL (mantém login)
    auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {})
      .catch((error) => {
        console.error("Erro na persistência:", error);
      });

    // Tornar globalmente disponível
    window.auth = auth;
    window.db = db;
    window.firebase = firebase;
  } catch (error) {
    console.error("Erro ao configurar Firebase:", error);
  }
} else {
  // Reutilizar instância existente
  window.auth = firebase.auth();
  window.db = firebase.firestore();
  window.firebase = firebase;
}
