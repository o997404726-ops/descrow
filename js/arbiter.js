const STATES = [
  { label: "Відкрите",          cls: "badge-await" },
  { label: "Очікує виконання",  cls: "badge-await" },
  { label: "Завершено",         cls: "badge-done"  },
  { label: "Повернуто",         cls: "badge-ref"   },
  { label: "Спір",              cls: "badge-disp"  },
];

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

async function registerAsArbiter() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    toast("⏳ Реєструємось...");
    const tx = await contract.registerAsArbiter();
    await tx.wait();
    document.getElementById("arbiterStatus").style.display = "flex";
    toast("✅ Ви успішно зареєстровані як арбітр!", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function checkArbitersCount() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const count = await contract.getArbitersCount();
    document.getElementById("arbiterCount").textContent =
      "👥 Зараз в пулі: " + count.toString() + " арбітр(ів)";
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

    // автозаповнення поля resolve
    document.getElementById("dealIdResolve").value = id;

  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function resolveDispute(favorBuyer) {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdResolve").value.trim();
    toast("⏳ Виносимо рішення...");
    const tx = await contract.resolveDispute(id, favorBuyer);
    await tx.wait();
    const winner = favorBuyer ? "замовника" : "виконавця";
    toast("⚖️ Рішення винесено на користь " + winner + "!", "success");
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
    }
  }
});