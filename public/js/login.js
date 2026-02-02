// VARIÁVEL GLOBAL para controlar se estamos processando login
let isProcessingLogin = false;

// Limpar estado anterior
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
  if (isProcessingLogin) return;

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
    // Desativar botão durante o processo
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    submitBtn.disabled = true;

    // Verificar se Firebase está pronto
    if (!window.auth) {
      throw new Error(
        "Sistema de autenticação não está disponível. Recarregue a página.",
      );
    }

    // Configurar persistência
    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    await auth.setPersistence(persistence);

    // Fazer login
    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password,
    );
    const user = userCredential.user;

    // Verificar se o usuário já existe no Firestore
    const userRef = db.collection("usuarios").doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        nome: email.split("@")[0],
        email: email,
        role: "user",
        dataCriacao: new Date().toISOString(),
        ultimoLogin: new Date().toISOString(),
      });
    } else {
      // Atualizar último login
      await userRef.update({
        ultimoLogin: new Date().toISOString(),
      });
    }

    // Salvar informações no localStorage
    localStorage.setItem("userLoggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.uid);

    // Adicionar um pequeno delay para garantir que tudo está salvo
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1000);
  } catch (error) {
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
  }
}

// Inicializar quando o DOM carregar
document.addEventListener("DOMContentLoaded", function () {
  // Configurar listeners de eventos
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  // Configurar botões
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  if (togglePasswordBtn)
    togglePasswordBtn.addEventListener("click", togglePassword);

  const toggleRegisterPasswordBtn = document.getElementById(
    "toggleRegisterPasswordBtn",
  );
  if (toggleRegisterPasswordBtn)
    toggleRegisterPasswordBtn.addEventListener("click", toggleRegisterPassword);

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
  if (emailInput) setTimeout(() => emailInput.focus(), 100);
});

// Exportar funções
window.togglePassword = togglePassword;
window.toggleRegisterPassword = toggleRegisterPassword;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.forgotPassword = forgotPassword;
