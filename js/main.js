async function aguardarFirebase() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.db || !window.auth) {
    throw new Error("Firebase Auth ou Firestore não inicializado.");
  }

  const user = await new Promise((resolve, reject) => {
    const unsubscribe = window.auth.onAuthStateChanged((usuario) => {
      unsubscribe();

      if (usuario) {
        resolve(usuario);
      } else {
        reject(new Error("Usuário não autenticado no Firebase Auth."));
      }
    });
  });

  return window.db;
}

function formatarData(data) {
  if (!data) return "";

  const dataObj = data.toDate ? data.toDate() : new Date(data);
  return dataObj.toLocaleDateString("pt-BR");
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function escaparHTML(valor) {
  const div = document.createElement("div");
  div.textContent = String(valor || "");
  return div.innerHTML;
}

function mostrarMensagem(titulo, mensagem, tipo = "success") {
  const mensagensAntigas = document.querySelectorAll(".alert-flutuante");
  mensagensAntigas.forEach((msg) => msg.remove());

  const tituloSeguro = escaparHTML(titulo);
  const mensagemSegura = escaparHTML(mensagem);

  const icone =
    tipo === "success"
      ? "check-circle"
      : tipo === "info"
        ? "info-circle"
        : tipo === "warning"
          ? "exclamation-triangle"
          : "exclamation-circle";

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${tipo} alert-flutuante`;

  alertDiv.innerHTML = `
    <i class="fas fa-${icone}"></i>
    <div>
      <strong>${tituloSeguro}</strong>
      <p>${mensagemSegura}</p>
    </div>
    <button type="button" aria-label="Fechar mensagem" onclick="this.parentElement.remove()" style="background:none; border:none; cursor:pointer;">
      <i class="fas fa-times"></i>
    </button>
  `;

  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    max-width: 400px;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 5000);
}

if (!document.querySelector("#alert-styles")) {
  const style = document.createElement("style");
  style.id = "alert-styles";
  style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .alert-flutuante {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
    `;
  document.head.appendChild(style);
}

async function carregarClientesParaSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const db = await aguardarFirebase();

    while (select.options.length > 1) {
      select.remove(1);
    }

    const snapshot = await db.collection("clientes").get();

    if (snapshot.empty) {
      return;
    }

    snapshot.forEach((doc) => {
      const cliente = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${cliente.nome} - ${cliente.cpf || ""}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    mostrarMensagem("Erro", "Não foi possível carregar os clientes", "error");
  }
}

async function carregarEquipamentosParaSelect(
  selectId,
  apenasDisponiveis = true,
) {
  const select = document.getElementById(selectId);

  if (!select) {
    return;
  }

  try {
    const db = await aguardarFirebase();

    while (select.options.length > 1) {
      select.remove(1);
    }

    let query = db.collection("equipamentos");

    if (apenasDisponiveis) {
      query = query.where("status", "==", "disponivel");
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return;
    }

    snapshot.forEach((doc) => {
      const equipamento = doc.data();

      if (equipamento.ativo === false) {
        return;
      }

      const option = document.createElement("option");
      option.value = doc.id;

      const nome =
        equipamento.nomeEquipamento ||
        equipamento.nome ||
        "Equipamento sem nome";
      const quantidade = equipamento.quantidadeDisponivel || 0;

      option.textContent = `${nome} (${quantidade} disp.)`;
      option.dataset.equipamento = JSON.stringify({
        id: doc.id,
        nomeEquipamento: nome,
        quantidadeDisponivel: quantidade,
        valorDiaria: equipamento.valorDiaria || 0,
        status: equipamento.status || "",
      });

      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar equipamentos:", error);

    mostrarMensagem(
      "Erro",
      "Não foi possível carregar os equipamentos",
      "error",
    );
  }
}

async function buscarClientePorId(clienteId) {
  try {
    const db = await aguardarFirebase();

    const doc = await db.collection("clientes").doc(clienteId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    return null;
  }
}

async function buscarEquipamentoPorId(equipamentoId) {
  try {
    const db = await aguardarFirebase();

    const doc = await db.collection("equipamentos").doc(equipamentoId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar equipamento:", error);
    return null;
  }
}

function validarCPFCNPJ(valor) {
  const limpo = valor.replace(/\D/g, "");

  if (limpo.length === 11) {
    return validarCPF(limpo);
  }

  if (limpo.length === 14) {
    return validarCNPJ(limpo);
  }

  return false;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, "");

  if (cpf.length !== 11) return false;

  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, "");

  if (cnpj.length !== 14) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

function formatarCPFCNPJ(valor) {
  const limpo = valor.replace(/\D/g, "");

  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (limpo.length === 14) {
    return limpo.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  return valor;
}

function formatarTelefone(valor) {
  const limpo = valor.replace(/\D/g, "");

  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  return valor;
}

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function aplicarCapsLockCampo(campo) {
  if (!campo) return;

  const tag = campo.tagName.toLowerCase();
  const type = (campo.getAttribute("type") || "text").toLowerCase();

  const tiposIgnorados = [
    "email",
    "password",
    "number",
    "date",
    "datetime-local",
    "time",
    "month",
    "week",
    "range",
    "checkbox",
    "radio",
    "file",
    "hidden",
    "submit",
    "button",
    "reset",
  ];

  if (tag === "select" || tag === "button") return;
  if (tiposIgnorados.includes(type)) return;
  if (campo.dataset.noCapslock === "true") return;
  if (campo.classList.contains("no-capslock")) return;

  const inicio = campo.selectionStart;
  const fim = campo.selectionEnd;

  campo.value = campo.value.toUpperCase();

  try {
    campo.setSelectionRange(inicio, fim);
  } catch (error) {
    // Alguns campos não permitem manipular cursor.
  }
}

function aplicarCapsLockAutomatico() {
  const campos = document.querySelectorAll("input, textarea");

  campos.forEach((campo) => {
    campo.addEventListener("input", function () {
      aplicarCapsLockCampo(this);
    });

    campo.addEventListener("blur", function () {
      aplicarCapsLockCampo(this);
    });
  });
}

function formatarCPF(valor) {
  const numeros = somenteNumeros(valor).substring(0, 11);

  if (numeros.length <= 3) {
    return numeros;
  }

  if (numeros.length <= 6) {
    return numeros.replace(/(\d{3})(\d+)/, "$1.$2");
  }

  if (numeros.length <= 9) {
    return numeros.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  }

  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
}

function formatarRG(valor) {
  const limpo = String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const letras = limpo.replace(/[^A-Z]/g, "").substring(0, 2);
  const numeros = limpo.replace(/\D/g, "").substring(0, 8);

  let resultado = letras;

  if (letras.length === 2 && numeros.length > 0) {
    resultado += "-";
  }

  if (numeros.length <= 2) {
    resultado += numeros;
  } else if (numeros.length <= 5) {
    resultado += numeros.replace(/(\d{2})(\d+)/, "$1.$2");
  } else {
    resultado += numeros.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
  }

  return resultado;
}

function aplicarMascaraCPF() {
  const camposCPF = document.querySelectorAll(
    '#cpf, input[data-mask="cpf"], input[placeholder*="CPF"]',
  );

  camposCPF.forEach((campo) => {
    campo.setAttribute("maxlength", "14");

    campo.addEventListener("input", function () {
      this.value = formatarCPF(this.value);
    });

    campo.addEventListener("blur", function () {
      this.value = formatarCPF(this.value);
    });
  });
}

function aplicarMascaraRG() {
  const camposRG = document.querySelectorAll(
    '#identidade, #rg, input[data-mask="rg"], input[placeholder*="RG"], input[placeholder*="Identidade"], input[placeholder*="identidade"]',
  );

  camposRG.forEach((campo) => {
    campo.setAttribute("maxlength", "13");

    campo.addEventListener("input", function () {
      this.value = formatarRG(this.value);
    });

    campo.addEventListener("blur", function () {
      this.value = formatarRG(this.value);
    });
  });
}

function aplicarMascaraTelefone() {
  const camposTelefone = document.querySelectorAll(
    'input[type="tel"], input[placeholder*="telefone"], input[placeholder*="Telefone"], input[placeholder*="celular"], input[placeholder*="Celular"]',
  );

  camposTelefone.forEach((campo) => {
    campo.addEventListener("input", function () {
      this.value = formatarTelefone(this.value).substring(0, 15);
    });

    campo.addEventListener("blur", function () {
      this.value = formatarTelefone(this.value).substring(0, 15);
    });
  });
}

function aplicarAcessibilidadeFoco() {
  const elementos = document.querySelectorAll(
    "input, select, textarea, button",
  );

  elementos.forEach((elemento) => {
    elemento.addEventListener("focus", function () {
      this.style.outline = "3px solid #3498db";
      this.style.outlineOffset = "2px";
    });

    elemento.addEventListener("blur", function () {
      this.style.outline = "";
      this.style.outlineOffset = "";
    });
  });
}

function configurarCamposData() {
  const dataAtual = new Date().toISOString().split("T")[0];

  const camposDataAtual = document.querySelectorAll(
    'input[type="date"][data-default-today="true"]',
  );

  camposDataAtual.forEach((campo) => {
    if (!campo.value) {
      campo.value = dataAtual;
    }

    campo.style.fontSize = "18px";
    campo.style.padding = "12px";
  });

  const camposData = document.querySelectorAll('input[type="date"]');

  camposData.forEach((campo) => {
    campo.style.fontSize = "18px";
    campo.style.padding = "12px";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  configurarCamposData();

  aplicarCapsLockAutomatico();

  aplicarMascaraCPF();
  aplicarMascaraRG();
  aplicarMascaraTelefone();

  aplicarAcessibilidadeFoco();
});
