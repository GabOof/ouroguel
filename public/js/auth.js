// auth.js
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

// Função para atualizar a barra do usuário
function updateUserBar(userInfo) {
  const userBarName = document.getElementById("userBarName");
  const userBarEmail = document.getElementById("userBarEmail");
  const userRoleText = document.getElementById("userRoleText");
  const userBar = document.getElementById("userBar");

  if (!userBar) return; // Se não tem barra de usuário na página

  if (userInfo) {
    // Atualizar nome
    if (userBarName) userBarName.textContent = userInfo.nome || "Usuário";

    // Atualizar email
    if (userBarEmail) userBarEmail.textContent = userInfo.email || "";

    // Atualizar role
    if (userRoleText) {
      const roleDisplay =
        userInfo.role === "admin" ? "Administrador" : "Usuário";
      userRoleText.textContent = roleDisplay;
    }

    // Mostrar a barra
    userBar.style.display = "block";
  } else {
    // Esconder a barra se não tem usuário
    userBar.style.display = "none";
  }
}

// Função para inicializar autenticação
async function initializeAuth() {
  try {
    if (isInitialized) return;

    if (!window.db || !window.auth) {
      setTimeout(initializeAuth, 500);
      return;
    }

    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      isInitialized = true;

      if (user) {
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);

        // Carregar informações do usuário do Firestore
        try {
          const userDoc = await db.collection("usuarios").doc(user.uid).get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            const nome =
              userData.nome || user.displayName || user.email.split("@")[0];

            localStorage.setItem("userName", nome);
            localStorage.setItem("userRole", userData.role || "user");

            // Atualizar barra do usuário
            updateUserBar({
              nome: nome,
              email: user.email,
              role: userData.role || "user",
            });
          } else {
            // Criar documento do usuário se não existir
            const userData = {
              nome: user.displayName || user.email.split("@")[0],
              email: user.email,
              role: "user",
              dataCriacao: new Date().toISOString(),
            };

            await db.collection("usuarios").doc(user.uid).set(userData);

            localStorage.setItem("userName", userData.nome);
            localStorage.setItem("userRole", "user");

            // Atualizar barra do usuário
            updateUserBar({
              nome: userData.nome,
              email: user.email,
              role: "user",
            });
          }
        } catch (error) {
          console.error("Erro ao carregar dados do usuário:", error);

          // Fallback para dados básicos
          const nome = user.displayName || user.email.split("@")[0];
          localStorage.setItem("userName", nome);
          localStorage.setItem("userRole", "user");

          updateUserBar({
            nome: nome,
            email: user.email,
            role: "user",
          });
        }

        // Redirecionar se estiver na página de login
        if (isLoginPage() && !window.blockLoginRedirect) {
          setTimeout(() => {
            window.location.href = "../index.html";
          }, 1000);
          return;
        }
      } else {
        // Usuário não logado
        localStorage.removeItem("userLoggedIn");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("userRole");

        // Esconder barra do usuário
        updateUserBar(null);

        // Redirecionar se não estiver na página de login
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
        nome: data.nome || user.displayName || user.email.split("@")[0],
        role: data.role || "user",
      };
    }

    const userData = {
      nome: user.displayName || user.email.split("@")[0],
      email: user.email,
      role: "user",
      dataCriacao: new Date().toISOString(),
    };

    await db.collection("usuarios").doc(user.uid).set(userData);

    return {
      id: user.uid,
      email: user.email,
      nome: user.displayName || user.email.split("@")[0],
      role: "user",
    };
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }
}

// Função para carregar perfil do usuário (mantida para compatibilidade)
async function loadUserProfile() {
  const userInfo = await getUserInfo();
  if (userInfo) {
    updateUserBar(userInfo);
  }
}

// Inicialização quando a página carrega
document.addEventListener("DOMContentLoaded", function () {
  const isLogin = isLoginPage();

  if (isLogin) window.blockLoginRedirect = true;

  if (typeof firebase === "undefined") {
    setTimeout(() => {
      if (typeof firebase !== "undefined") initializeAuth();
    }, 1000);
    return;
  }

  initializeAuth();

  if (!isLogin && !isPrintPage()) {
    setTimeout(() => protectPage(), 1000);
  }
});

// Adicione esta função no auth.js
function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    // Remove listeners antigos para não duplicar
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

    // Adiciona listener novo
    newLogoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      logout(); // Chama a função logout do auth.js
    });
  }
}

// E modifique a função updateUserBar para configurar o botão:
function updateUserBar(userInfo) {
  const userBarName = document.getElementById("userBarName");
  const userBarEmail = document.getElementById("userBarEmail");
  const userRoleText = document.getElementById("userRoleText");
  const userBar = document.getElementById("userBar");

  if (!userBar) return;

  if (userInfo) {
    if (userBarName) userBarName.textContent = userInfo.nome || "Usuário";
    if (userBarEmail) userBarEmail.textContent = userInfo.email || "";

    if (userRoleText) {
      const roleDisplay =
        userInfo.role === "admin" ? "Administrador" : "Usuário";
      userRoleText.textContent = roleDisplay;
    }

    userBar.style.display = "block";

    // Configurar botão de logout
    setupLogoutButton();
  } else {
    userBar.style.display = "none";
  }
}

// Exportar funções para uso global
window.logout = logout;
window.isUserLoggedIn = isUserLoggedIn;
window.getUserInfo = getUserInfo;
window.loadUserProfile = loadUserProfile;
window.isLoginPage = isLoginPage;
window.updateUserBar = updateUserBar; // Exportar a nova função
