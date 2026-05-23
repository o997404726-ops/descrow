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
      ? `<a href="https://gateway.pinata.cloud/ipfs/${taskHash}" target="_blank" style="color:var(--pink);font-size:12px;">📋 Переглянути ТЗ →</a>`
      : '<span style="color:var(--muted);font-size:12px;">ТЗ не додано</span>';
    const workLink = workHash
      ? `<a href="https://gateway.pinata.cloud/ipfs/${workHash}" target="_blank" style="color:var(--pink);font-size:12px;">📁 Переглянути роботу →</a>`
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
        <div style="display:flex;gap:16px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(251,207,232,0.3)">
          <div>${taskLink}</div>
          <div>${workLink}</div>
        </div>
      </div>`;
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function uploadToIPFS(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { "Authorization": "Bearer " + PINATA_JWT },
    body: formData
  });
  if (!res.ok) throw new Error("Помилка завантаження на IPFS");
  const data = await res.json();
  return data.IpfsHash;
}
async function acceptDeal() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdAccept").value.trim();
    toast("⏳ Приймаємо замовлення...");
    const tx = await contract.acceptDeal(id);
    await tx.wait();
    toast("✅ Замовлення прийнято! Тепер можна виконувати роботу.", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}
async function submitWork() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdSubmit").value.trim();
    const file = document.getElementById("workFile").files[0];
    if (!file) { toast("Оберіть файл", "error"); return; }

    toast("⏳ Завантажуємо файл на IPFS...");
    const ipfsHash = await uploadToIPFS(file);

    toast("⏳ Записуємо хеш в блокчейн...");
    const tx = await contract.submitWork(id, ipfsHash);
    await tx.wait();

    document.getElementById("ipfsResult").innerHTML = `
      <div class="deal-card" style="margin-top:16px">
        <div class="deal-id">✅ Роботу здано!</div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px;">
          IPFS хеш: <span style="font-family:monospace;color:var(--pink)">${ipfsHash}</span>
        </div>
        <div style="margin-top:8px">
          <a href="https://gateway.pinata.cloud/ipfs/${ipfsHash}" target="_blank" style="color:var(--pink);font-size:12px;">Переглянути файл →</a>
        </div>
      </div>`;

    toast("✅ Роботу здано і записано в блокчейн!", "success");
  } catch(e) { toast("❌ " + (e.reason || e.message), "error"); }
}

async function openDispute() {
  if (!contract) { toast("Спочатку підключи гаманець", "error"); return; }
  try {
    const id = document.getElementById("dealIdDispute").value.trim();
    toast("⏳ Відкриваємо спір...");
    const tx = await contract.openDispute(id);
    await tx.wait();
    toast("⚠️ Спір відкрито! Арбітр призначений автоматично.", "success");
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