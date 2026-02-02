// Variáveis globais para estado
let isInitialized = false;
let currentUser = null;

// Função para verificar se estamos na página de login
function isLoginPage() {
  const currentPath = window.location.pathname;
  return (
    currentPath.includes("login.html") ||
    currentPath.includes("pages/login.html")
  );
}

// Função para verificar se estamos na página de impressão
function isPrintPage() {
  const currentPath = window.location.pathname;
  return (
    currentPath.includes("imprimir.html") ||
    currentPath.includes("pages/imprimir.html")
  );
}

// Função para inicializar autenticação
async function initializeAuth() {
  try {
    // Evitar inicialização duplicada
    if (isInitialized) {
      return;
    }

    // Aguardar Firebase estar pronto
    if (!window.db || !window.auth) {
      setTimeout(initializeAuth, 500);
      return;
    }

    // Configurar observador de estado de autenticação
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      isInitialized = true;

      if (user) {
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);

        // Se estiver na página de login E o redirecionamento não está bloqueado
        if (isLoginPage() && !window.blockLoginRedirect) {
          setTimeout(() => {
            window.location.href = "../index.html";
          }, 1000);
          return;
        }

        // Se não for página de login, carregar perfil
        if (!isLoginPage()) {
          loadUserProfile();
          addUserMenu();
        }
      } else {
        localStorage.removeItem("userLoggedIn");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");

        // Se NÃO for página de login nem impressão, redirecionar
        if (!isLoginPage() && !isPrintPage()) {
          setTimeout(() => {
            window.location.href = "pages/login.html";
          }, 1000);
        }
      }
    });
  } catch (error) {
    console.error("Erro ao inicializar auth:", error);
  }
}

// Função para verificar se usuário está logado
function isUserLoggedIn() {
  return !!currentUser || !!auth?.currentUser;
}

// Função para verificar login e proteger páginas
function protectPage() {
  // Não proteger páginas de login e impressão
  if (isLoginPage() || isPrintPage()) {
    return true;
  }

  if (!isUserLoggedIn()) {
    window.location.href = "pages/login.html";
    return false;
  }

  return true;
}

// Função para logout
function logout() {
  if (!auth) return;

  if (confirm("Deseja sair do sistema?")) {
    auth
      .signOut()
      .then(() => {
        localStorage.clear();
        window.location.href = "pages/login.html";
      })
      .catch((error) => {
        alert("Erro ao sair do sistema: " + error.message);
      });
  }
}

// Função para obter informações do usuário
async function getUserInfo() {
  if (!isUserLoggedIn()) return null;

  const user = auth.currentUser;
  if (!user) return null;

  try {
    const userDoc = await db.collection("usuarios").doc(user.uid).get();

    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        id: user.uid,
        email: user.email,
        nome: data.nome || user.email.split("@")[0],
        role: data.role || "user",
      };
    }

    // Se não existe no Firestore, criar registro básico
    const userData = {
      nome: user.email.split("@")[0],
      email: user.email,
      role: "user",
      dataCriacao: new Date().toISOString(),
    };

    await db.collection("usuarios").doc(user.uid).set(userData);

    return {
      id: user.uid,
      email: user.email,
      nome: user.email.split("@")[0],
      role: "user",
    };
  } catch (error) {
    return null;
  }
}

// Função para carregar perfil do usuário
async function loadUserProfile() {
  const userInfo = await getUserInfo();

  if (userInfo) {
    // Atualizar elementos na página
    document.querySelectorAll(".user-name").forEach((el) => {
      el.textContent = userInfo.nome;
    });

    document.querySelectorAll(".user-email").forEach((el) => {
      el.textContent = userInfo.email;
    });

    // Salvar no localStorage
    localStorage.setItem("userRole", userInfo.role);
  }
}

// Função para adicionar menu do usuário
function addUserMenu() {
  // Verificar se já existe
  if (document.querySelector(".user-menu")) return;

  const header = document.querySelector(".header .container");
  if (!header) return;

  // Criar menu do usuário
  const userMenuHTML = `
    <div class="user-menu">
      <div class="user-info" id="userInfoBtn">
        <i class="fas fa-user-circle"></i>
        <span class="user-name">Usuário</span>
      </div>
      <div class="user-dropdown" id="userDropdown">
        <div class="user-dropdown-content">
          <div class="user-details">
            <strong class="user-name">Usuário</strong>
            <small class="user-email">email@exemplo.com</small>
          </div>
          <hr>
          <a href="#" id="logoutLink">
            <i class="fas fa-sign-out-alt"></i> Sair
          </a>
        </div>
      </div>
    </div>
  `;

  header.insertAdjacentHTML("beforeend", userMenuHTML);

  // Configurar eventos
  const userInfoBtn = document.getElementById("userInfoBtn");
  const logoutLink = document.getElementById("logoutLink");

  if (userInfoBtn) {
    userInfoBtn.addEventListener("click", toggleUserMenu);
  }

  if (logoutLink) {
    logoutLink.addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  // Carregar informações
  loadUserProfile();
}

// Função para mostrar/esconder menu
function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

// Fechar menu ao clicar fora
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("userDropdown");
  const userInfo = document.querySelector(".user-info");

  if (
    dropdown &&
    !dropdown.contains(event.target) &&
    userInfo &&
    !userInfo.contains(event.target)
  ) {
    dropdown.classList.remove("show");
  }
});

// Inicialização quando a página carrega
document.addEventListener("DOMContentLoaded", function () {
  // Verificar se estamos na página de login
  const isLogin = isLoginPage();

  // Se for página de login, desativar redirecionamento automático
  if (isLogin) window.blockLoginRedirect = true;

  // Verificar se Firebase está carregado
  if (typeof firebase === "undefined") {
    setTimeout(() => {
      if (typeof firebase !== "undefined") initializeAuth();
    }, 1000);
    return;
  }

  // Inicializar sistema de autenticação
  initializeAuth();

  if (!isLogin && !isPrintPage()) {
    setTimeout(() => protectPage(), 1000);
  }
});

// Exportar funções para uso global
window.logout = logout;
window.toggleUserMenu = toggleUserMenu;
window.isUserLoggedIn = isUserLoggedIn;
window.getUserInfo = getUserInfo;
window.loadUserProfile = loadUserProfile;
window.isLoginPage = isLoginPage;
