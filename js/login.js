// ========== VARIÁVEIS GLOBAIS ==========
let isProcessingLogin = false;
let isProcessingRegister = false;

// ========== LIMPAR ESTADO ANTERIOR ==========
localStorage.removeItem("userLoggedIn");
localStorage.removeItem("userEmail");
localStorage.removeItem("userId");
localStorage.removeItem("userRole");

// ========== PREVENIR NAVEGAÇÃO PARA TRÁS ==========
history.pushState(null, null, location.href);
window.onpopstate = function () {
  history.go(1);
};

// ========== FUNÇÕES AUXILIARES ==========
function togglePassword() {
  const passwordInput = document.getElementById("password");
  const eyeIcon = document.querySelector("#togglePasswordBtn i");

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
  const eyeIcon = document.querySelector("#toggleRegisterPasswordBtn i");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    passwordInput.type = "password";
    eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

function showRegister() {
  document.querySelector(".login-card:first-child").style.display = "none";
  document.getElementById("registerCard").style.display = "block";
}

function showLogin() {
  document.querySelector(".login-card:first-child").style.display = "block";
  document.getElementById("registerCard").style.display = "none";
}

function forgotPassword() {
  const email = document.getElementById("email").value;
  if (!email) {
    alert("Por favor, insira seu e-mail para recuperar a senha.");
    return;
  }

  if (!window.auth) {
    alert("Sistema de autenticação não disponível.");
    return;
  }

  auth
    .sendPasswordResetEmail(email)
    .then(() => {
      alert("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    })
    .catch((error) => {
      let mensagem = "";
      switch (error.code) {
        case "auth/user-not-found":
          mensagem = "E-mail não cadastrado.";
          break;
        case "auth/invalid-email":
          mensagem = "E-mail inválido.";
          break;
        default:
          mensagem = "Erro ao enviar e-mail de recuperação.";
      }
      alert(mensagem);
    });
}

// ========== FUNÇÃO DE LOGIN ==========
async function handleLogin(e) {
  e.preventDefault();

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
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    submitBtn.disabled = true;

    if (!window.auth) {
      throw new Error("Sistema de autenticação não está disponível.");
    }

    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    await auth.setPersistence(persistence);

    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password,
    );
    const user = userCredential.user;

    // Verificar/Atualizar documento do usuário
    const userRef = db.collection("usuarios").doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        nome: user.displayName || email.split("@")[0],
        email: email,
        role: "user",
        dataCriacao: new Date().toISOString(),
        ultimoLogin: new Date().toISOString(),
      });
    } else {
      await userRef.update({
        ultimoLogin: new Date().toISOString(),
      });
    }

    localStorage.setItem("userLoggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.uid);

    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1000);
  } catch (error) {
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
    alert(mensagem);
  }
}

// ========== FUNÇÃO DE REGISTRO ==========
async function handleRegister(e) {
  e.preventDefault();

  if (isProcessingRegister) return;
  isProcessingRegister = true;

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById(
    "registerConfirmPassword",
  ).value;

  // Validações
  if (!name || !email || !password || !confirmPassword) {
    alert("Preencha todos os campos");
    isProcessingRegister = false;
    return;
  }

  if (password.length < 6) {
    alert("A senha deve ter pelo menos 6 caracteres");
    isProcessingRegister = false;
    return;
  }

  if (password !== confirmPassword) {
    alert("As senhas não coincidem");
    isProcessingRegister = false;
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Criando conta...';
  submitBtn.disabled = true;

  try {
    if (!window.auth || !window.db) {
      throw new Error("Sistema de autenticação não está disponível");
    }

    // 1. Criar usuário no Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(
      email,
      password,
    );
    const user = userCredential.user;

    // 2. Atualizar perfil com nome
    await user.updateProfile({
      displayName: name,
    });

    // 3. Criar documento no Firestore
    await db.collection("usuarios").doc(user.uid).set({
      nome: name,
      email: email,
      role: "user",
      dataCriacao: new Date().toISOString(),
      ultimoLogin: new Date().toISOString(),
      status: "ativo",
    });

    // 4. Salvar no localStorage
    localStorage.setItem("userLoggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.uid);
    localStorage.setItem("userRole", "user");

    alert("✅ Conta criada com sucesso! Redirecionando...");

    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1500);
  } catch (error) {
    // Restaurar botão
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    isProcessingRegister = false;

    let mensagem = "";
    switch (error.code) {
      case "auth/email-already-in-use":
        mensagem = "❌ Este e-mail já está cadastrado.";
        break;
      case "auth/invalid-email":
        mensagem = "❌ E-mail inválido.";
        break;
      case "auth/weak-password":
        mensagem = "❌ Senha muito fraca. Use pelo menos 6 caracteres.";
        break;
      case "auth/network-request-failed":
        mensagem = "❌ Erro de conexão. Verifique sua internet.";
        break;
      case "permission-denied":
        mensagem = "❌ Erro de permissão. Contate o administrador.";
        break;
      default:
        mensagem = "❌ Erro ao criar conta: " + error.message;
    }
    alert(mensagem);
    console.error("Erro no registro:", error);
  }
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener("DOMContentLoaded", function () {
  console.log("Inicializando página de login...");

  // Configurar formulário de login
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
    console.log("✓ Formulário de login configurado");
  }

  // Configurar formulário de registro
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
    console.log("✓ Formulário de registro configurado");
  }

  // Botões de mostrar senha
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

  // Links de navegação
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

  // Link de recuperar senha
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
    setTimeout(() => emailInput.focus(), 100);
  }
});

// ========== EXPORTAR FUNÇÕES ==========
window.togglePassword = togglePassword;
window.toggleRegisterPassword = toggleRegisterPassword;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.forgotPassword = forgotPassword;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
