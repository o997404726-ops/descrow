const CONTRACT_ADDRESS = "0x833382c3dD47E80e05985eF2C2A59476D1eeee15";

const ABI = [
  "function createDeal(string taskHash) payable returns (uint256)",
  "function acceptDeal(uint256 dealId)",
  "function submitWork(uint256 dealId, string workHash)",
  "function confirmDelivery(uint256 dealId)",
  "function cancelDeal(uint256 dealId)",
  "function openDispute(uint256 dealId)",
  "function resolveDispute(uint256 dealId, bool favorBuyer)",
  "function registerAsArbiter()",
  "function getDeal(uint256 dealId) view returns (address, address, address, uint256, uint8, string, string)",
  "function getBalance() view returns (uint256)",
  "function getArbitersCount() view returns (uint256)",
  "event DealCreated(uint256 indexed dealId, address indexed buyer, uint256 amount, string taskHash)",
  "event DealAccepted(uint256 indexed dealId, address indexed seller)",
  "event WorkSubmitted(uint256 indexed dealId, string workHash)",
  "event DisputeOpened(uint256 indexed dealId, address indexed openedBy, address indexed assignedArbiter)"
];

async function getContract() {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask не знайдено");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  return provider.getSigner();
}