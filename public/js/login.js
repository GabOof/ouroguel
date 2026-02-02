// js/login-scripts.js

// VARIÁVEL GLOBAL para controlar se estamos processando login
let isProcessingLogin = false;

// Limpar estado anterior
console.log("🧹 Limpando estado de login anterior...");
localStorage.removeItem("userLoggedIn");
localStorage.removeItem("userEmail");
localStorage.removeItem("userId");
localStorage.removeItem("userRole");

// Prevenir navegação para trás
history.pushState(null, null, location.href);
window.onpopstate = function () {
  history.go(1);
};

// Funções auxiliares
function togglePassword() {
  const passwordInput = document.getElementById("password");
  const eyeIcon = document.querySelector("#password + .show-password i");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    passwordInput.type = "password";
    eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

function toggleRegisterPassword() {
  const passwordInput = document.getElementById("registerPassword");
  const eyeIcon = document.querySelector(
    "#registerPassword + .show-password i",
  );

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    passwordInput.type = "password";
    eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

function showRegister() {
  document.getElementById("loginForm").parentElement.style.display = "none";
  document.getElementById("registerCard").style.display = "block";
  return false;
}

function showLogin() {
  document.getElementById("loginForm").parentElement.style.display = "block";
  document.getElementById("registerCard").style.display = "none";
  return false;
}

function forgotPassword() {
  const email = document.getElementById("email").value;
  if (!email) {
    alert("Por favor, insira seu e-mail para recuperar a senha.");
    return false;
  }

  alert("Funcionalidade de recuperação de senha em desenvolvimento.");
  return false;
}

// Configurar formulário de login
async function handleLogin(e) {
  e.preventDefault();

  // Prevenir múltiplos envios
  if (isProcessingLogin) {
    console.log("⏳ Login já em processamento...");
    return;
  }

  isProcessingLogin = true;

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember").checked;

  if (!email || !password) {
    alert("Preencha todos os campos");
    isProcessingLogin = false;
    return;
  }

  try {
    console.log("🔐 Tentando login para:", email);

    // Desativar botão durante o processo
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    submitBtn.disabled = true;

    // Verificar se Firebase está pronto
    if (!window.auth) {
      console.error("❌ Firebase auth não está disponível");
      throw new Error(
        "Sistema de autenticação não está disponível. Recarregue a página.",
      );
    }

    // Configurar persistência
    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    console.log("🔄 Configurando persistência:", persistence);
    await auth.setPersistence(persistence);

    // Fazer login
    console.log("📤 Enviando credenciais para Firebase...");
    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password,
    );

    const user = userCredential.user;
    console.log("✅ Login bem-sucedido:", user.email);
    console.log("👤 User ID:", user.uid);

    // Verificar se o usuário já existe no Firestore
    const userRef = db.collection("usuarios").doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log("📝 Criando registro do usuário no Firestore...");
      await userRef.set({
        nome: email.split("@")[0],
        email: email,
        role: "user",
        dataCriacao: new Date().toISOString(),
        ultimoLogin: new Date().toISOString(),
      });
      console.log("✅ Usuário registrado no sistema");
    } else {
      // Atualizar último login
      await userRef.update({
        ultimoLogin: new Date().toISOString(),
      });
      console.log("📝 Último login atualizado");
    }

    // Salvar informações no localStorage
    localStorage.setItem("userLoggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.uid);

    console.log("💾 Dados salvos no localStorage");
    console.log("🔄 Preparando redirecionamento...");

    // Adicionar um pequeno delay para garantir que tudo está salvo
    setTimeout(() => {
      console.log("↪️ Redirecionando para index.html...");
      window.location.href = "../index.html";
    }, 1000);
  } catch (error) {
    console.error("❌ Erro no login:", error);
    console.error("🔍 Código do erro:", error.code);
    console.error("📝 Mensagem do erro:", error.message);

    // Reativar botão
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML =
      '<i class="fas fa-sign-in-alt"></i> Entrar no Sistema';
    submitBtn.disabled = false;

    isProcessingLogin = false;

    let mensagem = "";
    switch (error.code) {
      case "auth/user-not-found":
        mensagem = "Usuário não encontrado. Verifique o e-mail.";
        break;
      case "auth/wrong-password":
        mensagem = "Senha incorreta. Tente novamente.";
        break;
      case "auth/invalid-email":
        mensagem = "E-mail inválido. Verifique o formato.";
        break;
      case "auth/invalid-login-credentials":
        mensagem = "Credenciais inválidas. Verifique e-mail e senha.";
        break;
      case "auth/too-many-requests":
        mensagem = "Muitas tentativas. Tente novamente mais tarde.";
        break;
      case "auth/network-request-failed":
        mensagem = "Erro de conexão. Verifique sua internet.";
        break;
      case "auth/user-disabled":
        mensagem = "Esta conta foi desativada.";
        break;
      default:
        mensagem = "Erro ao fazer login: " + error.message;
    }

    // Mostrar alerta com mais detalhes para debugging
    console.log("🚨 Exibindo alerta:", mensagem);
    alert("❌ " + mensagem + "\n\nE-mail tentado: " + email);
  }
}

// Verificar status de autenticação (APENAS para mostrar/ocultar formulário)
function checkAuthStatus() {
  console.log("🔐 Página de login carregada");

  const checkAuth = setInterval(() => {
    if (window.auth) {
      clearInterval(checkAuth);

      auth.onAuthStateChanged((user) => {
        if (user) {
          console.log("✅ Já está logado como:", user.email);

          // Mostrar mensagem e redirecionar após 2 segundos
          const loginCard = document.querySelector(".login-card");
          if (loginCard) {
            const originalHTML = loginCard.innerHTML;
            loginCard.innerHTML = `
              <div class="text-center">
                <i class="fas fa-check-circle success-icon" style="font-size: 48px; color: #28a745; margin-bottom: 20px;"></i>
                <h2>Você já está logado!</h2>
                <p>Redirecionando para o sistema...</p>
                <div class="spinner-border text-primary mt-3" role="status">
                  <span class="sr-only">Carregando...</span>
                </div>
              </div>
            `;
          }

          console.log("↪️ Redirecionando para sistema...");
          setTimeout(() => {
            window.location.href = "../index.html";
          }, 2000);
        } else {
          console.log("⚠️ Nenhum usuário logado. Mostrando formulário.");
          // Formulário já está visível
        }
      });
    }
  }, 100);
}

// Inicializar quando o DOM carregar
document.addEventListener("DOMContentLoaded", function () {
  console.log("📄 DOM login carregado");

  // DESATIVAR verificação automática de auth na página de login
  // A verificação será feita apenas quando o usuário tentar fazer login

  // Configurar listeners de eventos
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Configurar botões
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", togglePassword);
  }

  const toggleRegisterPasswordBtn = document.getElementById(
    "toggleRegisterPasswordBtn",
  );
  if (toggleRegisterPasswordBtn) {
    toggleRegisterPasswordBtn.addEventListener("click", toggleRegisterPassword);
  }

  const showRegisterLink = document.getElementById("showRegisterLink");
  if (showRegisterLink) {
    showRegisterLink.addEventListener("click", function (e) {
      e.preventDefault();
      showRegister();
    });
  }

  const showLoginBtn = document.getElementById("showLoginBtn");
  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", function (e) {
      e.preventDefault();
      showLogin();
    });
  }

  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", function (e) {
      e.preventDefault();
      forgotPassword();
    });
  }

  // Focar no campo de email automaticamente
  const emailInput = document.getElementById("email");
  if (emailInput) {
    setTimeout(() => {
      emailInput.focus();
    }, 100);
  }
});

// Exportar funções para uso global
window.togglePassword = togglePassword;
window.toggleRegisterPassword = toggleRegisterPassword;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.forgotPassword = forgotPassword;
