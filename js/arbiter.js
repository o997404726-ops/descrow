const STATES = [
  { label: "Відкрите",         cls: "badge-open"  },
  { label: "Очікує виконання", cls: "badge-await" },
  { label: "Завершено",        cls: "badge-done"  },
  { label: "Повернуто",        cls: "badge-ref"   },
  { label: "Спір",             cls: "badge-disp"  },
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
    await checkArbiterStatus();
    await loadDisputedDeals();
  } catch(e) { toast("❌ " + e.message, "error"); }
}

async function checkArbiterStatus() {
  if (!contract) return;
  try {
    const signer = await connectWallet();
    const addr = await signer.getAddress();
    const active = await contract.isActiveArbiter(addr);
    const statusEl = document.getElementById("arbiterStatus");
    const btnJoin = document.getElementById("btnJoin");
    const btnLeave = document.getElementById("btnLeave");
    const btnRejoin = document.getElementById("btnRejoin");

    if (active) {
      statusEl.style.display = "flex";
      statusEl.textContent = "Ви активний арбітр — отримуєте справи";
      btnJoin.style.display = "none";
      btnLeave.style.display = "inline-flex";
      btnRejoin.style.display = "none";
    } else {
      const isReg = await contract.isArbiter(addr).catch(() => false);
      if (isReg) {
        statusEl.style.display = "flex";
        statusEl.textContent = "Ви вийшли з пулу — не отримуєте справи";
        btnJoin.style.display = "none";
        btnLeave.style.display = "none";
        btnRejoin.style.display = "inline-flex";
      } else {
        statusEl.style.display = "none";
        btnJoin.style.display = "inline-flex";
        btnLeave.style.display = "none";
        btnRejoin.style.display = "none";
      }
    }

    const count = await contract.getActiveArbitersCount();
    document.getElementById("arbiterCount").textContent =
      "Активних арбітрів у пулі: " + count.toString();
  } catch(e) { console.error(e); }
}

async function registerAsArbiter() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    toast("⏳ Реєструємось...");
    const tx = await contract.registerAsArbiter();
    await tx.wait();
    toast("✅ Ви зареєстровані як арбітр!", "success");
    await checkArbiterStatus();
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function removeFromPool() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    toast("⏳ Виходимо з пулу...");
    const tx = await contract.removeFromPool();
    await tx.wait();
    toast("Ви вийшли з пулу арбітрів.", "success");
    await checkArbiterStatus();
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function rejoinPool() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    toast("⏳ Повертаємось в пул...");
    const tx = await contract.rejoinPool();
    await tx.wait();
    toast("✅ Ви повернулись в пул арбітрів!", "success");
    await checkArbiterStatus();
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function loadDisputedDeals() {
  if (!contract) return;
  try {
    const signer = await connectWallet();
    const myAddr = (await signer.getAddress()).toLowerCase();
    const ids = await contract.getDisputedDeals();
    const container = document.getElementById("disputedDealsList");

    if (ids.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px;">Активних спорів немає</div>';
      return;
    }

    container.innerHTML = "";
    for (const id of ids) {
      const [buyer, seller, arbiter, amount, state, taskHash, workHash, disputeReason] =
        await contract.getDeal(id.toString());

      const isMyCase = arbiter.toLowerCase() === myAddr;
      const eth = ethers.utils.formatEther(amount);

      const taskLink = taskHash
        ? `<a href="https://gateway.pinata.cloud/ipfs/${taskHash}" target="_blank" style="color:var(--choco);font-size:12px;">Переглянути ТЗ →</a>`
        : '<span style="color:var(--muted);font-size:12px;">ТЗ не додано</span>';

      const workLink = workHash
        ? `<a href="https://gateway.pinata.cloud/ipfs/${workHash}" target="_blank" style="color:var(--choco);font-size:12px;">Переглянути роботу →</a>`
        : '<span style="color:var(--muted);font-size:12px;">Роботу не здано</span>';

      container.innerHTML += `
  <div class="deal-card" style="margin-bottom:12px;">
    <div class="deal-top">
      <div>
        <div class="deal-id">
          Справа #${id}
          ${isMyCase ? '<span style="background:#513229;color:white;padding:2px 10px;border-radius:4px;font-size:10px;margin-left:8px;vertical-align:middle;">ВАШ КЕЙС</span>' : ''}
        </div>
        <div class="deal-amount">${eth} <span>ETH</span></div>
      </div>
      <span class="badge badge-disp">Спір</span>
    </div>
    <div class="deal-parties">
      <div><div class="party-label">Замовник</div><div class="party-addr">${shortAddr(buyer)}</div></div>
      <div><div class="party-label">Виконавець</div><div class="party-addr">${shortAddr(seller)}</div></div>
      <div><div class="party-label">Арбітр</div><div class="party-addr">${isMyCase ? '<strong>Ви</strong>' : shortAddr(arbiter)}</div></div>
    </div>
    ${disputeReason ? `<div style="margin-top:10px;font-size:12px;color:var(--muted);">Причина: <strong style="color:var(--text)">${disputeReason}</strong></div>` : ''}
    <div style="display:flex;gap:16px;margin-top:10px;">
      <div>${taskLink}</div>
      <div>${workLink}</div>
    </div>
    ${isMyCase ? `
    <div class="btn-row" style="margin-top:12px;">
      <button class="btn btn-outline" onclick="resolveDispute(${id}, true)" style="font-size:12px;padding:8px 14px;">На користь замовника</button>
      <button class="btn btn-primary" onclick="resolveDispute(${id}, false)" style="font-size:12px;padding:8px 14px;">На користь виконавця</button>
    </div>` : ''}
  </div>`;
    }
  } catch(e) { console.error(e); }
}

async function getDeal() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdView").value.trim();
    const [buyer, seller, arbiter, amount, state, taskHash, workHash, disputeReason] =
      await contract.getDeal(id);
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
      ? `<a href="https://gateway.pinata.cloud/ipfs/${taskHash}" target="_blank" style="color:var(--choco);font-size:13px;font-weight:600;">Переглянути ТЗ →</a>`
      : '<span style="color:var(--muted);font-size:12px;">ТЗ не додано</span>';
    const workLink = workHash
      ? `<a href="https://gateway.pinata.cloud/ipfs/${workHash}" target="_blank" style="color:var(--choco);font-size:13px;font-weight:600;">Переглянути роботу →</a>`
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
        ${disputeReason ? `<div style="margin-top:10px;font-size:12px;color:var(--muted);">Причина спору: <strong>${disputeReason}</strong></div>` : ''}
        <div style="display:flex;gap:24px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
          <div><div class="party-label">ТЗ</div>${taskLink}</div>
          <div><div class="party-label">Робота</div>${workLink}</div>
        </div>
      </div>`;

    document.getElementById("dealIdResolve").value = id;
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function resolveDispute(dealId, favorBuyer) {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = dealId !== undefined ? dealId : document.getElementById("dealIdResolve").value.trim();
    toast("⏳ Виносимо рішення...");
    const tx = await contract.resolveDispute(id, favorBuyer);
    await tx.wait();
    const winner = favorBuyer ? "замовника" : "виконавця";
    toast("⚖️ Рішення винесено на користь " + winner + "!", "success");
    await loadDisputedDeals();
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
      await checkArbiterStatus();
      await loadDisputedDeals();
    }
  }
});