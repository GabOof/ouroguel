// Variáveis globais
let clientes = [];
let clienteEditando = null;

// Inicialização quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", function () {
  carregarClientes();

  // Configurar formulário
  const form = document.getElementById("clienteForm");
  if (form) {
    form.addEventListener("submit", salvarCliente);
  }

  // Configurar data de nascimento
  const dataNascimento = document.getElementById("dataNascimento");
  if (dataNascimento) {
    // Define valor padrão para facilitar (opcional)
    dataNascimento.max = new Date().toISOString().split("T")[0];
  }

  // Configurar máscara para CPF/CNPJ
  const cpfInput = document.getElementById("cpf");
  if (cpfInput) {
    cpfInput.addEventListener("input", function (e) {
      let valor = e.target.value.replace(/\D/g, "");

      if (valor.length <= 11) {
        // Formato CPF
        valor = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else {
        // Formato CNPJ
        valor = valor.replace(
          /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
          "$1.$2.$3/$4-$5",
        );
      }

      e.target.value = valor.substring(0, 18);
    });
  }
});

// Função para salvar cliente
async function salvarCliente(event) {
  event.preventDefault();

  // Coletar dados do formulário
  const dadosCliente = {
    nome: document.getElementById("nome").value.trim(),
    dataNascimento: document.getElementById("dataNascimento").value,
    cpf: document.getElementById("cpf").value.trim(),
    identidade: document.getElementById("identidade").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    celular: document.getElementById("celular").value.trim(),
    email: document.getElementById("email").value.trim(),
    cep: document.getElementById("cep").value.trim(),
    endereco: document.getElementById("endereco").value.trim(),
    bairro: document.getElementById("bairro").value.trim(),
    cidade: document.getElementById("cidade").value.trim(),
    estado: document.getElementById("estado").value,
    naturalidade: document.getElementById("naturalidade").value.trim(),
    nomePai: document.getElementById("nomePai").value.trim(),
    nomeMae: document.getElementById("nomeMae").value.trim(),
    dataCadastro: new Date().toISOString(),
  };

  // Validações básicas
  if (!dadosCliente.nome) {
    mostrarMensagem("Erro", "Nome é obrigatório", "error");
    document.getElementById("nome").focus();
    return;
  }

  if (!dadosCliente.celular) {
    mostrarMensagem("Erro", "Celular é obrigatório", "error");
    document.getElementById("celular").focus();
    return;
  }

  if (!dadosCliente.cpf) {
    mostrarMensagem("Erro", "CPF/CNPJ é obrigatório", "error");
    document.getElementById("cpf").focus();
    return;
  }

  try {
    let resultado;

    if (clienteEditando) {
      // Atualizar cliente existente
      resultado = await db
        .collection("clientes")
        .doc(clienteEditando)
        .update(dadosCliente);
      mostrarMensagem("Sucesso", "Cliente atualizado com sucesso!");
    } else {
      // Adicionar novo cliente
      resultado = await db.collection("clientes").add(dadosCliente);
      mostrarMensagem("Sucesso", "Cliente cadastrado com sucesso!");
    }

    // Limpar formulário
    limparFormulario();

    // Recarregar lista
    carregarClientes();
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao salvar cliente: " + error.message,
      "error",
    );
  }
}

// Função para carregar clientes
async function carregarClientes() {
  try {
    const clientesList = document.getElementById("clientesList");
    if (!clientesList) return;

    // Mostrar indicador de carregamento
    clientesList.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3498db;"></i>
                    <p>Carregando clientes...</p>
                </td>
            </tr>
        `;

    // Buscar clientes no Firestore
    const snapshot = await db.collection("clientes").orderBy("nome").get();

    if (snapshot.empty) {
      clientesList.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-message">
                        <i class="fas fa-users"></i>
                        <p>Nenhum cliente cadastrado ainda</p>
                    </td>
                </tr>
            `;
      return;
    }

    // Limpar array
    clientes = [];

    // Construir HTML da lista
    let html = "";
    snapshot.forEach((doc) => {
      const cliente = {
        id: doc.id,
        ...doc.data(),
      };
      clientes.push(cliente);

      html += `
                <tr>
                    <td>
                        <strong>${cliente.nome || ""}</strong>
                        ${cliente.email ? `<br><small>${cliente.email}</small>` : ""}
                    </td>
                    <td>${cliente.cpf || ""}</td>
                    <td>${cliente.celular || ""}</td>
                    <td>${cliente.cidade || ""}${cliente.estado ? "/" + cliente.estado : ""}</td>
                    <td>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            <button class="btn btn-small btn-primary" onclick="editarCliente('${cliente.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-small btn-success" onclick="selecionarClienteParaAluguel('${cliente.id}')">
                                <i class="fas fa-handshake"></i>
                            </button>
                            <button class="btn btn-small btn-danger" onclick="excluirCliente('${cliente.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    clientesList.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    document.getElementById("clientesList").innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar clientes</p>
                </td>
            </tr>
        `;
  }
}

// Função para buscar clientes
function buscarClientes() {
  const termo = document.getElementById("searchClientes").value.toLowerCase();
  const linhas = document.querySelectorAll("#clientesList tr");

  linhas.forEach((linha) => {
    const textoLinha = linha.textContent.toLowerCase();
    if (textoLinha.includes(termo)) {
      linha.style.display = "";
    } else {
      linha.style.display = "none";
    }
  });
}

// Função para editar cliente
async function editarCliente(clienteId) {
  try {
    const doc = await db.collection("clientes").doc(clienteId).get();

    if (doc.exists) {
      const cliente = doc.data();
      clienteEditando = clienteId;

      // Preencher formulário
      document.getElementById("nome").value = cliente.nome || "";
      document.getElementById("dataNascimento").value =
        cliente.dataNascimento || "";
      document.getElementById("cpf").value = cliente.cpf || "";
      document.getElementById("identidade").value = cliente.identidade || "";
      document.getElementById("telefone").value = cliente.telefone || "";
      document.getElementById("celular").value = cliente.celular || "";
      document.getElementById("email").value = cliente.email || "";
      document.getElementById("cep").value = cliente.cep || "";
      document.getElementById("endereco").value = cliente.endereco || "";
      document.getElementById("bairro").value = cliente.bairro || "";
      document.getElementById("cidade").value = cliente.cidade || "";
      document.getElementById("estado").value = cliente.estado || "";
      document.getElementById("naturalidade").value =
        cliente.naturalidade || "";
      document.getElementById("nomePai").value = cliente.nomePai || "";
      document.getElementById("nomeMae").value = cliente.nomeMae || "";

      // Alterar texto do botão
      const botaoSalvar = document.querySelector(
        '#clienteForm button[type="submit"]',
      );
      if (botaoSalvar) {
        botaoSalvar.innerHTML =
          '<i class="fas fa-sync-alt"></i> Atualizar Cliente';
      }

      // Rolagem suave até o formulário
      document.querySelector(".form-section").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      mostrarMensagem(
        "Informação",
        "Editando cliente. Modifique os dados e clique em Atualizar.",
      );
    }
  } catch (error) {
    console.error("Erro ao carregar cliente para edição:", error);
    mostrarMensagem(
      "Erro",
      "Não foi possível carregar o cliente para edição",
      "error",
    );
  }
}

// Função para excluir cliente
async function excluirCliente(clienteId) {
  if (!confirm("Tem certeza que deseja excluir este cliente?")) {
    return;
  }

  try {
    await db.collection("clientes").doc(clienteId).delete();
    mostrarMensagem("Sucesso", "Cliente excluído com sucesso!");
    carregarClientes();
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);
    mostrarMensagem(
      "Erro",
      "Erro ao excluir cliente: " + error.message,
      "error",
    );
  }
}

// Função para selecionar cliente para aluguel
function selecionarClienteParaAluguel(clienteId) {
  // Redirecionar para página de aluguel com o cliente pré-selecionado
  localStorage.setItem("clienteSelecionado", clienteId);
  window.location.href = "aluguel.html";
}

// Função para limpar formulário
function limparFormulario() {
  document.getElementById("clienteForm").reset();
  clienteEditando = null;

  // Restaurar texto do botão
  const botaoSalvar = document.querySelector(
    '#clienteForm button[type="submit"]',
  );
  if (botaoSalvar) {
    botaoSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Cliente';
  }

  // Focar no primeiro campo
  document.getElementById("nome").focus();
}

// Função para buscar CEP (opcional)
async function buscarCEP() {
  const cep = document.getElementById("cep").value.replace(/\D/g, "");

  if (cep.length !== 8) {
    return;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (!data.erro) {
      document.getElementById("endereco").value = data.logradouro || "";
      document.getElementById("bairro").value = data.bairro || "";
      document.getElementById("cidade").value = data.localidade || "";
      document.getElementById("estado").value = data.uf || "";

      // Focar no próximo campo
      const naturalidade = document.getElementById("naturalidade");
      if (naturalidade && !naturalidade.value) {
        naturalidade.value = `${data.localidade}/${data.uf}`;
      }

      document.getElementById("numero").focus();
    }
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
  }
}

// Configurar busca automática de CEP
document.addEventListener("DOMContentLoaded", function () {
  const cepInput = document.getElementById("cep");
  if (cepInput) {
    cepInput.addEventListener("blur", buscarCEP);
  }
});
