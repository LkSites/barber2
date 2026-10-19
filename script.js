
const WHATSAPP_NUMBER = "5555999999999";

const $ = id => document.getElementById(id);

const form = $("bookingForm");
const dateInput = $("date");
const timeInput = $("time");
const filterDate = $("filterDate");
const list = $("appointmentsList");

const SERVICES = {
  "Corte masculino": { price: 40, duration: 40 },
  "Barba premium": { price: 25, duration: 25 },
  "Cabelo + barba": { price: 60, duration: 60 }
};

const STORAGE_KEY = "barberClubAppointmentsV1";

let appointments = loadAppointments();

function loadAppointments() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAppointments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  if (!date) return "";
  return date.split("-").reverse().join("/");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

dateInput.min = localDate();
filterDate.value = localDate();

function getDuration(service) {
  return SERVICES[service]?.duration || 30;
}

function getEndTime(start, duration) {
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function generateTimes() {
  timeInput.innerHTML = "";

  const selectedDate = dateInput.value;
  if (!selectedDate) {
    timeInput.add(new Option("Selecione uma data primeiro", ""));
    return;
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  const chosenDate = new Date(year, month - 1, day);

  if (chosenDate.getDay() === 0) {
    timeInput.add(new Option("Fechado aos domingos", ""));
    return;
  }

  timeInput.add(new Option("Selecione um horário", ""));

  const service = $("service").value;
  const duration = getDuration(service);
  const barber = $("barber").value;

  let count = 0;

  for (let minutes = 9 * 60; minutes < 19 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    const start = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const end = getEndTime(start, duration);

    if (Number(end.split(":")[0]) > 19 ||
        (end.endsWith(":00") && Number(end.split(":")[0]) > 19)) {
      continue;
    }

    const slotDate = new Date(year, month - 1, day, hour, minute);
    if (slotDate <= new Date()) continue;

    const conflict = appointments.some(item => {
      if (item.date !== selectedDate) return false;
      if (["Cancelado", "Concluído"].includes(item.status)) return false;
      if (item.barber !== barber) return false;

      const existingEnd = getEndTime(item.time, getDuration(item.service));
      return overlaps(start, end, item.time, existingEnd);
    });

    if (!conflict) {
      timeInput.add(new Option(start, start));
      count++;
    }
  }

  if (count === 0) {
    timeInput.innerHTML = "";
    timeInput.add(new Option("Nenhum horário disponível", ""));
  }
}

dateInput.addEventListener("change", generateTimes);
$("service").addEventListener("change", generateTimes);
$("barber").addEventListener("change", generateTimes);

document.querySelectorAll(".choose-service").forEach(button => {
  button.addEventListener("click", () => {
    $("service").value = button.dataset.service;
    generateTimes();
    $("agendar").scrollIntoView({ behavior: "smooth" });
  });
});

function getFormData() {
  return {
    name: $("name").value.trim(),
    phone: $("phone").value.trim(),
    service: $("service").value,
    barber: $("barber").value,
    date: dateInput.value,
    time: timeInput.value,
    notes: $("notes").value.trim()
  };
}

function validate(data) {
  if (!form.reportValidity()) return false;

  if (!data.service || !SERVICES[data.service]) {
    alert("Selecione um serviço válido.");
    return false;
  }

  if (!data.date || data.date < localDate()) {
    alert("Escolha uma data válida.");
    return false;
  }

  if (!data.time) {
    alert("Escolha um horário.");
    return false;
  }

  const [year, month, day] = data.date.split("-").map(Number);
  if (new Date(year, month - 1, day).getDay() === 0) {
    alert("A barbearia não atende aos domingos.");
    return false;
  }

  const end = getEndTime(data.time, getDuration(data.service));
  if (end > "19:00") {
    alert("Esse serviço termina depois do horário de atendimento.");
    return false;
  }

  const conflict = appointments.some(item => {
    if (item.date !== data.date) return false;
    if (["Cancelado", "Concluído"].includes(item.status)) return false;
    if (item.barber !== data.barber) return false;

    const existingEnd = getEndTime(item.time, getDuration(item.service));
    return overlaps(
      data.time, end,
      item.time, existingEnd
    );
  });

  if (conflict) {
    alert("Esse horário acabou de ser ocupado. Escolha outro.");
    generateTimes();
    return false;
  }

  return true;
}

function buildWhatsAppMessage(data) {
  return [
    "Olá! Gostaria de solicitar um agendamento na Barber Club.",
    "",
    `Nome: ${data.name}`,
    `Telefone: ${data.phone}`,
    `Serviço: ${data.service}`,
    `Barbeiro: ${data.barber}`,
    `Data: ${formatDate(data.date)}`,
    `Horário: ${data.time}`,
    data.notes ? `Observações: ${data.notes}` : "",
    "",
    "Por favor, confirme a disponibilidade."
  ].filter(Boolean).join("\n");
}

function openWhatsApp(data) {
  if (WHATSAPP_NUMBER === "5555999999999") {
    alert("Configure o número real no início do arquivo script.js.");
    return;
  }

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(data))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function submitAppointment(sendWhatsApp) {
  const data = getFormData();

  if (!validate(data)) return;

  const appointment = {
    ...data,
    id: (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`),
    status: "Pendente",
    createdAt: new Date().toISOString()
  };

  appointments.push(appointment);
  saveAppointments();
  renderAgenda();
  generateTimes();

  $("bookingMessage").textContent =
    "Solicitação registrada neste navegador. O horário ainda precisa ser confirmado pela barbearia.";

  if (sendWhatsApp) {
    openWhatsApp(data);
  } else {
    $("painel").scrollIntoView({ behavior: "smooth" });
  }

  form.reset();
  dateInput.min = localDate();
  dateInput.value = localDate();
  generateTimes();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  submitAppointment(false);
});

$("sendWhatsApp").addEventListener("click", () => {
  submitAppointment(true);
});

filterDate.addEventListener("change", renderAgenda);
$("statusFilter").addEventListener("change", renderAgenda);

function updateStatus(id, status) {
  const appointment = appointments.find(item => item.id === id);
  if (!appointment) return;

  appointment.status = status;
  saveAppointments();
  renderAgenda();
  generateTimes();
}

function deleteAppointment(id) {
  if (!confirm("Deseja excluir este agendamento permanentemente deste navegador?")) {
    return;
  }

  appointments = appointments.filter(item => item.id !== id);
  saveAppointments();
  renderAgenda();
  generateTimes();
}

function renderAgenda() {
  const date = filterDate.value || localDate();
  const selectedStatus = $("statusFilter").value;

  const dayAppointments = appointments
    .filter(item => item.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));

  $("agendaTitle").textContent = `Agendamentos de ${formatDate(date)}`;

  $("totalCount").textContent = dayAppointments.length;
  $("pendingCount").textContent =
    dayAppointments.filter(item => item.status === "Pendente").length;
  $("confirmedCount").textContent =
    dayAppointments.filter(item => item.status === "Confirmado").length;
  $("completedCount").textContent =
    dayAppointments.filter(item => item.status === "Concluído").length;

  const visible = dayAppointments.filter(item =>
    selectedStatus === "todos" || item.status === selectedStatus
  );

  if (visible.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum agendamento encontrado</h3>
        <p>Não há agendamentos para esta data e filtro.</p>
      </div>`;
    return;
  }

  list.innerHTML = visible.map(item => `
    <article class="appointment">
      <div class="appointment-time">${escapeHTML(item.time)}</div>
      <div class="appointment-info">
        <h3>${escapeHTML(item.name)}</h3>
        <p><strong>Serviço:</strong> ${escapeHTML(item.service)}
          — R$ ${SERVICES[item.service].price.toFixed(2).replace(".", ",")}</p>
        <p><strong>Barbeiro:</strong> ${escapeHTML(item.barber)}</p>
        <p><strong>Telefone:</strong> ${escapeHTML(item.phone)}</p>
        ${item.notes ? `<p><strong>Observações:</strong> ${escapeHTML(item.notes)}</p>` : ""}
        <span class="status ${item.status.toLowerCase()}">
          ${escapeHTML(item.status)}
        </span>

        <div class="appointment-actions">
          ${item.status === "Pendente" ? `
            <button class="action-btn" data-action="Confirmado" data-id="${escapeHTML(item.id)}">Confirmar</button>
          ` : ""}
          ${item.status === "Confirmado" ? `
            <button class="action-btn" data-action="Concluído" data-id="${escapeHTML(item.id)}">Concluir</button>
          ` : ""}
          ${!["Cancelado", "Concluído"].includes(item.status) ? `
            <button class="action-btn danger" data-action="Cancelado" data-id="${escapeHTML(item.id)}">Cancelar</button>
          ` : ""}
          <button class="action-btn danger" data-delete="${escapeHTML(item.id)}">Excluir</button>
        </div>
      </div>
    </article>
  `).join("");
}

list.addEventListener("click", event => {
  const statusButton = event.target.closest("[data-action]");
  const deleteButton = event.target.closest("[data-delete]");

  if (statusButton) {
    updateStatus(statusButton.dataset.id, statusButton.dataset.action);
  }

  if (deleteButton) {
    deleteAppointment(deleteButton.dataset.delete);
  }
});

generateTimes();
renderAgenda();
