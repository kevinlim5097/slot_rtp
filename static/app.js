// Local storage key
const KEY = "slot_spins_v1";

// State
let spins = []; // {bet, win, ts}
let balanceSeries = []; // cumulative balance after each spin

// Elements
const rtpEl = document.getElementById("rtp");
const jackpotNEl = document.getElementById("jackpotN");
const betEl = document.getElementById("bet");
const winEl = document.getElementById("win");
const quickZeroBtn = document.getElementById("quickZero");
const addSpinBtn = document.getElementById("addSpin");
const undoLastBtn = document.getElementById("undoLast");
const clearAllBtn = document.getElementById("clearAll");

const totalSpinsEl = document.getElementById("totalSpins");
const totalBetEl = document.getElementById("totalBet");
const totalWinEl = document.getElementById("totalWin");
const actualRTPEl = document.getElementById("actualRTP");

const pSoFarEl = document.getElementById("pSoFar");
const pAt5000El = document.getElementById("pAt5000");
const pRemainTo5000El = document.getElementById("pRemainTo5000");

const recentListEl = document.getElementById("recentList");
const canvas = document.getElementById("trendCanvas");
const ctx = canvas.getContext("2d");

// Utils
const clampN = (n, min) => isFinite(n) && n >= min ? n : min;
const fmtRM = (n) => (Math.round(n * 100) / 100).toFixed(2);
const fmtPct = (x) => (Math.round(x * 1000) / 10).toFixed(1) + "%";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) spins = JSON.parse(raw);
  } catch(e) {
    spins = [];
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(spins));
}

function addSpin(bet, win) {
  spins.push({ bet: Number(bet), win: Number(win), ts: Date.now() });
  save();
  refresh();
}

function undoLast() {
  if (spins.length > 0) {
    spins.pop();
    save();
    refresh();
  }
}

function clearAll() {
  if (confirm("确定清空全部记录？此操作不可恢复。")) {
    spins = [];
    save();
    refresh();
  }
}

// Math
function probAtLeastOneJackpot(N, spinsCount) {
  N = clampN(Number(N), 1);
  spinsCount = clampN(Number(spinsCount), 0);
  // P = 1 - (1 - 1/N)^spinsCount
  const p = 1 - Math.pow(1 - 1 / N, spinsCount);
  return Math.max(0, Math.min(1, p));
}

// Recompute stats and UI
function refresh() {
  // Totals
  const totalSpins = spins.length;
  const totalBet = spins.reduce((s, r) => s + (Number(r.bet) || 0), 0);
  const totalWin = spins.reduce((s, r) => s + (Number(r.win) || 0), 0);
  const actualRTP = totalBet > 0 ? (totalWin / totalBet) : 0;

  totalSpinsEl.textContent = totalSpins;
  totalBetEl.textContent = fmtRM(totalBet);
  totalWinEl.textContent = fmtRM(totalWin);
  actualRTPEl.textContent = totalBet > 0 ? fmtPct(actualRTP) : "0%";

  // Probabilities
  const N = clampN(Number(jackpotNEl.value), 1);
  const pSoFar = probAtLeastOneJackpot(N, totalSpins);
  const pAt5000 = probAtLeastOneJackpot(N, 5000);
  const remain = Math.max(0, 5000 - totalSpins);
  const pRemain = probAtLeastOneJackpot(N, remain);
  pSoFarEl.textContent = fmtPct(pSoFar);
  pAt5000El.textContent = fmtPct(pAt5000);
  pRemainTo5000El.textContent = fmtPct(pRemain);

  // Recent list
  renderRecent();

  // Balance series
  buildBalanceSeries();
  drawChart();
}

function renderRecent() {
  const last = spins.slice(-20).reverse();
  if (last.length === 0) {
    recentListEl.innerHTML = '<div class="hint">暂无记录</div>';
    return;
  }
  recentListEl.innerHTML = "";
  last.forEach((r, i) => {
    const idx = spins.length - i;
    const row = document.createElement("div");
    row.className = "rec-row";
    const dt = new Date(r.ts);
    const timeStr = dt.toLocaleString();
    const pnl = (Number(r.win) || 0) - (Number(r.bet) || 0);
    row.innerHTML = `
      <div class="mono">#${spins.length - i}</div>
      <div>时间：${timeStr}</div>
      <div>下注：RM ${fmtRM(r.bet)}</div>
      <div>中奖：RM ${fmtRM(r.win)} <span style="opacity:.7">（盈亏：RM ${fmtRM(pnl)}）</span></div>
    `;
    recentListEl.appendChild(row);
  });
}

function buildBalanceSeries() {
  let bal = 0;
  balanceSeries = spins.map(r => {
    bal += (Number(r.win) || 0) - (Number(r.bet) || 0);
    return bal;
  });
}

// Minimal Canvas Line Chart (no external libs)
function drawChart() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Axes padding
  const padL = 50, padR = 20, padT = 10, padB = 30;

  // Axes
  ctx.save();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  // X axis
  ctx.beginPath();
  ctx.moveTo(padL, h - padB);
  ctx.lineTo(w - padR, h - padB);
  ctx.stroke();
  // Y axis
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, h - padB);
  ctx.stroke();

  // No data
  if (balanceSeries.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("暂无数据", padL + 10, (h - padB) / 2);
    ctx.restore();
    return;
  }

  // Scale
  const xs = balanceSeries.map((_, i) => i + 1);
  const ys = balanceSeries;

  const xMin = 1, xMax = xs[xs.length - 1];
  const yMin = Math.min(0, Math.min(...ys));
  const yMax = Math.max(0, Math.max(...ys));

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xToPx = (x) => padL + (x - xMin) / (xMax - xMin || 1) * plotW;
  const yToPx = (y) => (h - padB) - (y - yMin) / (yMax - yMin || 1) * plotH;

  // Grid lines
  ctx.strokeStyle = "#233049";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  // Y grid at 0
  const y0 = yToPx(0);
  ctx.beginPath();
  ctx.moveTo(padL, y0);
  ctx.lineTo(w - padR, y0);
  ctx.stroke();
  ctx.setLineDash([]);

  // Line
  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xToPx(xs[0]), yToPx(ys[0]));
  for (let i = 1; i < xs.length; i++) {
    ctx.lineTo(xToPx(xs[i]), yToPx(ys[i]));
  }
  ctx.stroke();

  // Last point
  const lastX = xToPx(xs[xs.length - 1]);
  const lastY = yToPx(ys[ys.length - 1]);
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px system-ui";
  ctx.fillText("局数", (w - padR) - 24, (h - padB) + 20);
  ctx.fillText("余额 (RM)", padL - 44, padT + 10);
  ctx.restore();
}

// Events
quickZeroBtn.addEventListener("click", () => {
  winEl.value = "0";
  winEl.focus();
});

addSpinBtn.addEventListener("click", () => {
  const bet = Number(betEl.value);
  const win = Number(winEl.value);
  if (!(bet > 0) || !(win >= 0)) {
    alert("请输入有效的下注与中奖金额（中奖可为 0）。");
    return;
    }
  addSpin(bet, win);
  // Reset win to 0 for speed
  winEl.value = "0";
});

undoLastBtn.addEventListener("click", undoLast);
clearAllBtn.addEventListener("click", clearAll);

rtpEl.addEventListener("input", refresh);
jackpotNEl.addEventListener("input", refresh);

// Init
load();
refresh();
