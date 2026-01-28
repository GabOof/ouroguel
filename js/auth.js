console.log("🔐 Auth.js iniciando...");

// Variáveis globais para estado
let isInitialized = false;
let currentUser = null;

// Função para inicializar autenticação
async function initializeAuth() {
  try {
    // Aguardar Firebase estar pronto
    if (!window.db || !window.auth) {
      console.warn("⚠️ Firebase não está pronto. Tentando novamente...");
      setTimeout(initializeAuth, 100);
      return;
    }

    // Configurar observador de estado de autenticação
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      isInitialized = true;

      if (user) {
        console.log("✅ Usuário autenticado:", user.email);
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);

        // Se estiver na página de login, redirecionar para index
        if (window.location.pathname.includes("login.html")) {
          console.log("↪️ Redirecionando para sistema...");
          window.location.href = "index.html";
        }

        // Carregar informações do usuário
        loadUserProfile();
        addUserMenu();
      } else {
        console.log("❌ Nenhum usuário autenticado");
        localStorage.removeItem("userLoggedIn");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");

        // Se NÃO estiver na página de login, redirecionar para login
        if (
          !window.location.pathname.includes("login.html") &&
          !window.location.pathname.includes("imprimir.html")
        ) {
          console.log("🔒 Acesso negado. Redirecionando para login...");
          // Pequeno delay para evitar loop
          setTimeout(() => {
            if (!auth.currentUser) {
              window.location.href = "login.html";
            }
          }, 100);
        }
      }
    });

    console.log("✅ Auth inicializado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inicializar auth:", error);
  }
}

// Função para verificar se usuário está logado (síncrona)
function isUserLoggedIn() {
  return !!currentUser || !!auth?.currentUser;
}

// Função para verificar login e proteger páginas
function protectPage() {
  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.includes("login.html");
  const isPrintPage = currentPath.includes("imprimir.html");

  console.log(`📍 Página atual: ${currentPath}`);
  console.log(`🔐 Usuário logado: ${isUserLoggedIn()}`);

  // Se não é página de login/imprimir e não tem usuário logado
  if (!isLoginPage && !isPrintPage && !isUserLoggedIn()) {
    console.log("🚫 Acesso negado! Redirecionando para login...");
    window.location.href = "login.html";
    return false;
  }

  // Se é página de login e já está logado
  if (isLoginPage && isUserLoggedIn()) {
    console.log("✅ Já logado! Redirecionando para sistema...");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

// Função para logout
function logout() {
  if (!auth) {
    console.error("Auth não disponível");
    return;
  }

  if (confirm("Deseja sair do sistema?")) {
    auth
      .signOut()
      .then(() => {
        console.log("👋 Logout realizado");
        localStorage.clear();
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Erro ao fazer logout:", error);
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
    console.error("Erro ao obter informações do usuário:", error);
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

    console.log("👤 Perfil carregado:", userInfo.email);
  }
}

// Função para adicionar menu do usuário
function addUserMenu() {
  // Verificar se já existe
  if (document.querySelector(".user-menu")) return;

  const header = document.querySelector(".header .container");
  if (!header) {
    console.warn("Header não encontrado para adicionar menu");
    return;
  }

  // Criar menu do usuário
  const userMenuHTML = `
        <div class="user-menu">
            <div class="user-info" onclick="toggleUserMenu()">
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
                    <a href="#" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </a>
                </div>
            </div>
        </div>
    `;

  header.insertAdjacentHTML("beforeend", userMenuHTML);

  // Carregar informações
  loadUserProfile();
}

// Função para mostrar/esconder menu
function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
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

// Adicionar botão de logout no rodapé (alternativo)
function addLogoutButton() {
  const footer = document.querySelector(".footer .container");
  if (footer && !footer.querySelector(".logout-btn")) {
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn btn-small btn-secondary logout-btn";
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
    logoutBtn.onclick = logout;
    logoutBtn.style.marginTop = "10px";
    footer.appendChild(logoutBtn);
  }
}

// Inicialização quando a página carrega
document.addEventListener("DOMContentLoaded", function () {
  console.log("📄 DOM carregado - Iniciando verificação de autenticação");

  // Verificar se Firebase está carregado
  if (typeof firebase === "undefined") {
    console.error("❌ Firebase não está carregado!");
    return;
  }

  // Inicializar sistema de autenticação
  initializeAuth();

  // Adicionar botão de logout simples
  addLogoutButton();

  // Proteger página após inicialização
  setTimeout(() => {
    protectPage();
  }, 500);
});

// Exportar funções para uso global
window.logout = logout;
window.toggleUserMenu = toggleUserMenu;
window.isUserLoggedIn = isUserLoggedIn;
window.getUserInfo = getUserInfo;
window.loadUserProfile = loadUserProfile;
