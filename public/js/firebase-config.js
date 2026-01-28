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
// Inicializar Firebase APENAS UMA VEZ
try {
  // Verificar se Firebase já foi inicializado
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase inicializado com sucesso!");
  } else {
    console.log("ℹ️ Firebase já estava inicializado");
  }
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase:", error);
}

// Inicializar serviços APÓS o Firebase estar pronto
let db, auth;

try {
  // Aguardar Firebase estar pronto
  if (firebase.apps.length) {
    db = firebase.firestore();
    auth = firebase.auth();

    // Configurar persistência (opcional)
    auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => console.log("✅ Persistência configurada"))
      .catch((error) => console.error("❌ Erro na persistência:", error));

    console.log("✅ Serviços Firebase configurados!");

    // Verificar se há usuário logado
    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log("👤 Usuário logado:", user.email);
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);
      } else {
        console.log("👤 Nenhum usuário logado");
        localStorage.removeItem("userLoggedIn");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");
      }
    });
  } else {
    console.error("❌ Firebase não inicializado!");
  }
} catch (error) {
  console.error("❌ Erro ao configurar serviços Firebase:", error);
}

// Exportar para uso global (com fallback)
window.db = db || null;
window.auth = auth || null;

// Função para verificar se Firebase está pronto
function isFirebaseReady() {
  return db && auth;
}

console.log("🎯 Firebase configurado!");
