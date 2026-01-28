console.log("⚙️ Configurando Firebase...");

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

try {
  // Inicializar Firebase apenas uma vez
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase App inicializado");
  }

  // Inicializar serviços
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Configurar persistência LOCAL (mantém login)
  auth
    .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      console.log("✅ Persistência LOCAL configurada");
    })
    .catch((error) => {
      console.error("❌ Erro na persistência:", error);
    });

  // Exportar para uso global
  window.db = db;
  window.auth = auth;

  console.log("🎯 Firebase configurado com sucesso!");

  // Verificar estado atual
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log(`👤 Usuário atual: ${user.email}`);
    } else {
      console.log("👤 Nenhum usuário autenticado");
    }
  });
} catch (error) {
  console.error("❌ Erro crítico no Firebase:", error);
  alert("Erro ao conectar com o banco de dados. Recarregue a página.");
}
