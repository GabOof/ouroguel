import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDxpJE_2EYqfRlDcRGOayd1ZmJqjHOs67U",
  authDomain: "ouroguel-1190.firebaseapp.com",
  projectId: "ouroguel-1190",
  storageBucket: "ouroguel-1190.firebasestorage.app",
  messagingSenderId: "831984928283",
  appId: "1:831984928283:web:e1381b716ae26bbf4f1abe",
  measurementId: "G-6LVN3Y4MV9",
};

// Inicialização única do Firebase
if (!firebase.apps.length) {
  try {
    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);

    // Inicializar serviços
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Configurar persistência LOCAL
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Tornar globalmente disponível
    window.auth = auth;
    window.db = db;
    window.firebase = firebase;

    console.log("Firebase inicializado com sucesso");
  } catch (error) {
    console.error("Erro ao configurar Firebase:", error);
  }
} else {
  // Reutilizar instância existente
  window.auth = firebase.auth();
  window.db = firebase.firestore();
  window.firebase = firebase;
}

// Inicializar App Check com reCAPTCHA v3
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("COLE_AQUI_SUA_SITE_KEY_DO_RECAPTCHA"),
  isTokenAutoRefreshEnabled: true, // Mantém o token sempre válido
});
