async function aguardarFirebase() {
  if (window.firebaseReady) {
    await window.firebaseReady;
  }

  if (!window.db) {
    throw new Error("Firestore não foi inicializado.");
  }

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

document.addEventListener("DOMContentLoaded", function () {
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

  const camposCPF = document.querySelectorAll(
    'input[placeholder*="CPF"], input[placeholder*="cnpj"]',
  );
  camposCPF.forEach((campo) => {
    campo.addEventListener("input", function (e) {
      let valor = e.target.value;
      const limpo = valor.replace(/\D/g, "");

      if (limpo.length <= 11) {
        valor = limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else {
        valor = limpo.replace(
          /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
          "$1.$2.$3/$4-$5",
        );
      }

      e.target.value = valor.substring(0, 18);
    });
  });

  const camposTelefone = document.querySelectorAll(
    'input[type="tel"], input[placeholder*="telefone"], input[placeholder*="celular"]',
  );
  camposTelefone.forEach((campo) => {
    campo.addEventListener("input", function (e) {
      let valor = e.target.value.replace(/\D/g, "");

      if (valor.length <= 10) {
        valor = valor.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
      } else {
        valor = valor.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      }

      e.target.value = valor.substring(0, 15);
    });
  });

  const todosInputs = document.querySelectorAll(
    "input, select, textarea, button",
  );
  todosInputs.forEach((elemento) => {
    elemento.addEventListener("focus", function () {
      this.style.outline = "3px solid #3498db";
      this.style.outlineOffset = "2px";
    });

    elemento.addEventListener("blur", function () {
      this.style.outline = "";
      this.style.outlineOffset = "";
    });
  });
});
