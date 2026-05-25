const STATES = [
  { label: "Відкрите",          cls: "badge-await" },
  { label: "Очікує виконання",  cls: "badge-await" },
  { label: "Завершено",         cls: "badge-done"  },
  { label: "Повернуто",         cls: "badge-ref"   },
  { label: "Спір",              cls: "badge-disp"  },
];

const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIyZGRhNDgzZC02YmNiLTQxYjYtOThjYy01MDhmNjNhNGExNWYiLCJlbWFpbCI6Im85OTc0MDQ3MjZAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImVhNTQ4MGQwMjFlNmM4MDJmZDIwIiwic2NvcGVkS2V5U2VjcmV0IjoiNDA0OTFmZGI2OTE3MTAzODk4ZDU5ZTRmZGNlZWU0MTI2ZDAwOTM3NDg2MGMwOWYzMGQ0ZjQwM2E2OWJhOThhNiIsImV4cCI6MTgxMTAwNDQzMH0.ghbgSX_NnOOH4jDW56rMpoLnMmuj_h_MxWQGz9Nt4xM";

let contract;

function toast(msg, type = "loading") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "show " + type;
  if (type !== "loading") setTimeout(() => { el.className = ""; }, 4000);
}

function shortAddr(a) { return a.slice(0,6) + "..." + a.slice(-4); }

async function handleConnect() {
  try {
    const signer = await connectWallet();
    contract = await getContract();
    const addr = await signer.getAddress();
    const btn = document.getElementById("connectBtn");
    btn.textContent = "✅ " + shortAddr(addr);
    btn.classList.add("connected");
    toast("Гаманець підключено!", "success");
  } catch(e) { toast("❌ " + e.message, "error"); }
}

async function uploadTaskToIPFS(name, desc, deadline) {
  const data = JSON.stringify({
    projectName: name,
    description: desc,
    deadline: deadline,
    createdAt: new Date().toISOString()
  });
  const blob = new Blob([data], { type: "application/json" });
  const formData = new FormData();
  formData.append("file", blob, "task.json");
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { "Authorization": "Bearer " + PINATA_JWT },
    body: formData
  });
  if (!res.ok) throw new Error("Помилка завантаження ТЗ на IPFS");
  const json = await res.json();
  return json.IpfsHash;
}

async function createDeal() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const name     = document.getElementById("projectName").value.trim();
    const desc     = document.getElementById("projectDesc").value.trim();
    const deadline = document.getElementById("deadline").value;
    const amount   = document.getElementById("amount").value.trim();

    if (!name || !desc || !amount) {
      toast("Заповніть всі обов'язкові поля", "error"); return;
    }

    toast("⏳ Завантажуємо ТЗ на IPFS...");
    const ipfsHash = await uploadTaskToIPFS(name, desc, deadline);

    toast("⏳ Підписуємо транзакцію...");
    const tx = await contract.createDeal(ipfsHash, {
      value: ethers.utils.parseEther(amount)
    });

    toast("⏳ Очікуємо підтвердження блокчейну...");
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "DealCreated");
    const dealId = event ? event.args[0].toString() : "?";

   document.getElementById("createResult").innerHTML = `
  <div class="deal-card" style="margin-top:16px">
    <div class="deal-id">Замовлення #${dealId} створено!</div>
    <div class="deal-amount" style="font-size:16px;margin-top:4px;">${name}</div>
    <div style="font-size:13px;color:var(--muted);margin-top:8px;">
      Заблоковано: <strong style="color:var(--text)">${amount} ETH</strong>
      &nbsp;·&nbsp; Дедлайн: <strong style="color:var(--text)">${deadline || "не вказано"}</strong>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
      ТЗ збережено на IPFS — виконавці бачать замовлення в списку відкритих
    </div>
    <div style="margin-top:8px">
      <a href="https://gateway.pinata.cloud/ipfs/${ipfsHash}" target="_blank" style="color:var(--choco);font-size:12px;">Переглянути ТЗ →</a>
    </div>
  </div>`;

    toast("✅ Замовлення #" + dealId + " створено!", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function getDeal() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdView").value.trim();
    const [buyer, seller, arbiter, amount, state, taskHash, workHash] = await contract.getDeal(id);
    if (buyer === "0x0000000000000000000000000000000000000000") {
      document.getElementById("dealResult").innerHTML =
        '<div style="color:var(--muted);font-size:13px;margin-top:12px;">Замовлення не знайдено</div>';
      return;
    }
    const s = STATES[state] || { label: "Невідомо", cls: "" };
    const eth = ethers.utils.formatEther(amount);
    const arbiterText = arbiter === "0x0000000000000000000000000000000000000000"
      ? "Не призначено" : arbiter;

    const taskLink = taskHash
      ? `<a href="https://gateway.pinata.cloud/ipfs/${taskHash}" target="_blank" style="color:var(--pink);font-size:13px;font-weight:600;">📋 Переглянути ТЗ →</a>`
      : '<span style="color:var(--muted);font-size:12px;">ТЗ не додано</span>';

    const workLink = workHash
      ? `<a href="https://gateway.pinata.cloud/ipfs/${workHash}" target="_blank" style="color:var(--pink);font-size:13px;font-weight:600;">📁 Переглянути роботу →</a>`
      : '<span style="color:var(--muted);font-size:12px;">Роботу ще не здано</span>';

    document.getElementById("dealResult").innerHTML = `
      <div class="deal-card">
        <div class="deal-top">
          <div>
            <div class="deal-id">Замовлення #${id}</div>
            <div class="deal-amount">${eth} <span>ETH</span></div>
          </div>
          <span class="badge ${s.cls}">${s.label}</span>
        </div>
        <div class="deal-parties">
          <div><div class="party-label">Замовник</div><div class="party-addr">${buyer}</div></div>
          <div><div class="party-label">Виконавець</div><div class="party-addr">${seller}</div></div>
          <div><div class="party-label">Арбітр</div><div class="party-addr">${arbiterText}</div></div>
        </div>
        <div style="display:flex;gap:24px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(251,207,232,0.3);">
          <div>
            <div class="party-label">Технічне завдання</div>
            ${taskLink}
          </div>
          <div>
            <div class="party-label">Результат роботи</div>
            ${workLink}
          </div>
        </div>
      </div>`;
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function confirmDelivery() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdConfirm").value.trim();
    toast("⏳ Підтверджуємо...");
    const tx = await contract.confirmDelivery(id);
    await tx.wait();
    toast("✅ Роботу підтверджено! Кошти виплачено виконавцю.", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function cancelDeal() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdCancel").value.trim();
    toast("⏳ Скасовуємо...");
    const tx = await contract.cancelDeal(id);
    await tx.wait();
    toast("↩️ Замовлення скасовано. Кошти повернуто.", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function openDispute() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdDispute").value.trim();
    const reason = document.getElementById("disputeReason").value.trim();
    if (!reason) { toast("Вкажіть причину спору", "error"); return; }
    toast("⏳ Відкриваємо спір...");
    const tx = await contract.openDispute(id, reason);
    await tx.wait();
    toast("Спір відкрито! Арбітр призначений автоматично.", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

window.addEventListener("load", async () => {
  if (window.ethereum) {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      const signer = await connectWallet();
      contract = await getContract();
      const addr = await signer.getAddress();
      const btn = document.getElementById("connectBtn");
      btn.textContent = "✅ " + shortAddr(addr);
      btn.classList.add("connected");
      const today = new Date().toISOString().split('T')[0];
      document.getElementById("deadline").min = today;
    }
  }
});