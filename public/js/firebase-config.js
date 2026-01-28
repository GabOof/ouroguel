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

// Inicialização Firebase
firebase.initializeApp(firebaseConfig);

// Referências ao banco de dados
const db = firebase.firestore();
const auth = firebase.auth();

// Verificar estado de autenticação
auth.onAuthStateChanged((user) => {
  // Salvar estado no localStorage para fácil acesso
  if (user) {
    localStorage.setItem("userLoggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.uid);
  } else {
    localStorage.removeItem("userLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
  }
});

console.log("Firebase configurado com sucesso!");
