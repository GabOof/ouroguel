let currentUser = null;
let authInitialized = false;

function isLoginPage() {
  return window.location.pathname.includes("/pages/login.html");
}

function isPrintPage() {
  return window.location.pathname.includes("/pages/imprimir.html");
}

function getLoginPath() {
  return "/pages/login.html";
}

function getHomePath() {
  return "/index.html";
}

async function aguardarFirebaseAuth() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.auth || !window.db) {
    throw new Error("Firebase Auth ou Firestore não inicializado.");
  }

  return {
    auth: window.auth,
    db: window.db,
  };
}

function limparSessaoLocal() {
  localStorage.removeItem("userLoggedIn");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userId");
  localStorage.removeItem("userName");
  localStorage.removeItem("userRole");
}

function salvarSessaoLocal(user, userData = {}) {
  const nome = userData.nome || user.displayName || user.email.split("@")[0];
  const role = userData.role || "user";

  localStorage.setItem("userLoggedIn", "true");
  localStorage.setItem("userEmail", user.email);
  localStorage.setItem("userId", user.uid);
  localStorage.setItem("userName", nome);
  localStorage.setItem("userRole", role);

  return {
    id: user.uid,
    nome,
    email: user.email,
    role,
  };
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");

  if (!logoutBtn) {
    return;
  }

  const novoBotao = logoutBtn.cloneNode(true);
  logoutBtn.parentNode.replaceChild(novoBotao, logoutBtn);

  novoBotao.addEventListener("click", function (event) {
    event.preventDefault();
    logout();
  });
}

function updateUserBar(userInfo) {
  const userBar = document.getElementById("userBar");
  const userBarName = document.getElementById("userBarName");
  const userBarEmail = document.getElementById("userBarEmail");
  const userRoleText = document.getElementById("userRoleText");

  if (!userBar) {
    return;
  }

  if (!userInfo) {
    userBar.style.display = "none";
    return;
  }

  if (userBarName) {
    userBarName.textContent = userInfo.nome || "Usuário";
  }

  if (userBarEmail) {
    userBarEmail.textContent = userInfo.email || "";
  }

  if (userRoleText) {
    userRoleText.textContent =
      userInfo.role === "admin" ? "Administrador" : "Usuário";
  }

  userBar.style.display = "block";
  setupLogoutButton();
}

async function buscarOuCriarUsuario(user) {
  const { db } = await aguardarFirebaseAuth();

  const userRef = db.collection("usuarios").doc(user.uid);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const dados = userDoc.data();

    await userRef.update({
      ultimoLogin: new Date().toISOString(),
    });

    return dados;
  }

  const novoUsuario = {
    nome: user.displayName || user.email.split("@")[0],
    email: user.email,
    role: "user",
    status: "ativo",
    dataCriacao: new Date().toISOString(),
    ultimoLogin: new Date().toISOString(),
  };

  await userRef.set(novoUsuario);

  return novoUsuario;
}

async function initializeAuth() {
  if (authInitialized) {
    return;
  }

  try {
    const { auth } = await aguardarFirebaseAuth();

    authInitialized = true;

    auth.onAuthStateChanged(async function (user) {
      currentUser = user;

      if (user) {
        try {
          const userData = await buscarOuCriarUsuario(user);
          const userInfo = salvarSessaoLocal(user, userData);

          updateUserBar(userInfo);

          if (isLoginPage()) {
            window.location.replace(getHomePath());
          }
        } catch (error) {
          console.error("Erro ao carregar perfil do usuário:", error);

          const userInfo = salvarSessaoLocal(user, {
            nome: user.displayName || user.email.split("@")[0],
            role: "user",
          });

          updateUserBar(userInfo);

          if (isLoginPage()) {
            window.location.replace(getHomePath());
          }
        }

        return;
      }

      limparSessaoLocal();
      updateUserBar(null);

      if (!isLoginPage() && !isPrintPage()) {
        window.location.replace(getLoginPath());
      }
    });
  } catch (error) {
    console.error("Erro ao inicializar autenticação:", error);

    if (!isLoginPage() && !isPrintPage()) {
      window.location.replace(getLoginPath());
    }
  }
}

function isUserLoggedIn() {
  return !!currentUser || !!window.auth?.currentUser;
}

async function getUserInfo() {
  try {
    const { auth } = await aguardarFirebaseAuth();

    const user = auth.currentUser;

    if (!user) {
      return null;
    }

    const userData = await buscarOuCriarUsuario(user);

    return {
      id: user.uid,
      email: user.email,
      nome: userData.nome || user.displayName || user.email.split("@")[0],
      role: userData.role || "user",
    };
  } catch (error) {
    console.error("Erro ao buscar informações do usuário:", error);
    return null;
  }
}

async function loadUserProfile() {
  const userInfo = await getUserInfo();

  if (userInfo) {
    updateUserBar(userInfo);
  }
}

async function logout() {
  const confirmar = confirm("Deseja sair do sistema?");

  if (!confirmar) {
    return;
  }

  try {
    const { auth } = await aguardarFirebaseAuth();

    await auth.signOut();

    limparSessaoLocal();

    window.location.replace(getLoginPath());
  } catch (error) {
    console.error("Erro ao sair:", error);
    alert("Erro ao sair do sistema: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initializeAuth();
});

window.logout = logout;
window.isUserLoggedIn = isUserLoggedIn;
window.getUserInfo = getUserInfo;
window.loadUserProfile = loadUserProfile;
window.updateUserBar = updateUserBar;
window.initializeAuth = initializeAuth;
