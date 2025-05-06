// public/script/script.js

console.log('script.js carregado');

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM totalmente carregado');

  // ——————————————————————————
  // referências de DOM
  // ——————————————————————————
  const menu         = document.getElementById('menu');
  const queueDiv     = document.getElementById('queue');
  const gameDiv      = document.getElementById('game');
  const btnLocal     = document.getElementById('btn-local');
  const btnOnline    = document.getElementById('btn-online');
  const myNameSpan   = document.getElementById('myName');
  const playerSymEl  = document.getElementById('playerSymbol');
  const oppNameEl    = document.getElementById('opponentName');
  const boardEl      = document.getElementById('board');
  const cells        = Array.from(document.querySelectorAll('.cell'));
  const statusText   = document.getElementById('status');
  const turnPlayer   = document.getElementById('turnPlayer');
  const rematchBtn   = document.getElementById('rematchBtn');
  const colorXInput  = document.getElementById('colorX');
  const colorOInput  = document.getElementById('colorO');
  const musicSelect  = document.getElementById('musicSelect');
  const toggleMusic  = document.getElementById('toggleMusic');
  const winningLine  = document.getElementById('winning-line');

  // chat
  const chatContainer = document.getElementById('chatContainer');
  const chatLog       = document.getElementById('chatLog');
  const chatForm      = document.getElementById('chatForm');
  const chatInput     = document.getElementById('chatInput');

  // checa se encontrou tudo
  if (!menu || !btnLocal || !btnOnline || !chatForm) {
    console.error('Faltam elementos no DOM (confira IDs de menu, botões e chat)');
    return;
  }
  console.log('Referências de DOM OK');

  // ——————————————————————————
  // estado do jogo
  // ——————————————————————————
  let gameState     = Array(9).fill('');
  let currentPlayer = 'X';
  let gameActive    = false;
  let roomId        = null;
  let mySymbol      = null;
  let socket        = null; // só no modo online

  // ——————————————————————————
  // áudio
  // ——————————————————————————
  let audio = new Audio(`musicas/${musicSelect.value}`);
  let isPlaying = false;
  musicSelect.addEventListener('change', () => {
    audio.pause();
    audio = new Audio(`musicas/${musicSelect.value}`);
    if (isPlaying) audio.play();
  });
  toggleMusic.addEventListener('click', () => {
    if (!isPlaying) {
      audio.play(); toggleMusic.textContent = '⏸️ Pausar';
    } else {
      audio.pause(); toggleMusic.textContent = '▶️ Tocar';
    }
    isPlaying = !isPlaying;
  });

  // ——————————————————————————
  // helpers de UI
  // ——————————————————————————
  function updateStatus(msg) { statusText.innerHTML = msg; }
  function updateTurn(msg)   { turnPlayer.textContent = msg; }

  function checkWin() {
    const wins = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return wins.find(c => c.every(i => gameState[i] === currentPlayer));
  }

  function drawWinningLine(combo) {
    if (!combo) return;
    const [i1,,i2] = combo;
    const rB = boardEl.getBoundingClientRect();
    const r1 = cells[i1].getBoundingClientRect();
    const r2 = cells[i2].getBoundingClientRect();
    const cx1 = r1.left + r1.width/2, cy1 = r1.top + r1.height/2;
    const cx2 = r2.left + r2.width/2, cy2 = r2.top + r2.height/2;
    const x1 = cx1 - rB.left, y1 = cy1 - rB.top;
    const x2 = cx2 - rB.left, y2 = cy2 - rB.top;
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const angle  = Math.atan2(dy, dx) * 180/Math.PI;
    const mx = (x1 + x2)/2, my = (y1 + y2)/2;

    winningLine.style.display   = 'block';
    winningLine.style.width     = `${length}px`;
    winningLine.style.left      = `${mx - length/2}px`;
    winningLine.style.top       = `${my - 3}px`;
    winningLine.style.transform = `rotate(${angle}deg)`;
  }

  function resetBoard() {
    gameState.fill('');
    cells.forEach(c => {
      c.textContent = '';
      c.style.color = '';
      c.disabled = false;
    });
    winningLine.style.display = 'none';
  }

  // ——————————————————————————
  // modos de jogo
  // ——————————————————————————
  function setupLocal() {
    console.log('Modo LOCAL');
    menu.hidden = queueDiv.hidden = true;
    gameDiv.hidden = false;
    chatContainer.hidden = true;
    roomId = mySymbol = null;
    currentPlayer = 'X'; gameActive = true;
    resetBoard();
    updateStatus(`Vez de: ${currentPlayer}`);
    rematchBtn.hidden = true;

    cells.forEach((cell, i) => {
      cell.onclick = () => {
        if (!gameActive || cell.textContent) return;
        gameState[i] = currentPlayer;
        cell.textContent = currentPlayer;
        cell.style.color =
          currentPlayer === 'X' ? colorXInput.value : colorOInput.value;
        const combo = checkWin();
        if (combo) {
          updateStatus(`Jogador ${currentPlayer} venceu!`);
          gameActive = false;
          drawWinningLine(combo);
          rematchBtn.hidden = false;
        } else if (!gameState.includes('')) {
          updateStatus('Empate!');
          gameActive = false;
          rematchBtn.hidden = false;
        } else {
          currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
          updateStatus(`Vez de: ${currentPlayer}`);
        }
      };
    });

    rematchBtn.onclick = setupLocal;
  }

  function setupOnline() {
    console.log('Modo ONLINE');
    menu.hidden = queueDiv.hidden = true;
    gameDiv.hidden = false;
    chatContainer.hidden = false;
    currentPlayer = 'X'; gameActive = true;
    resetBoard();
    updateStatus(`Vez de: ${currentPlayer}`);
    rematchBtn.hidden = true;

    // jogadas
    cells.forEach((cell, i) => {
      cell.onclick = () => {
        if (!gameActive || cell.textContent || currentPlayer !== mySymbol) return;
        socket.emit('playMove', { roomId, index: i });
      };
    });
    rematchBtn.onclick = () => {
      socket.emit('rematchRequest', { roomId });
      rematchBtn.disabled = true;
    };

    // chat
    chatForm.onsubmit = e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text || !roomId) return;
      socket.emit('sendMessage', { roomId, text });
      chatInput.value = '';
    };
  }

  // ——————————————————————————
  // socket.io “lazy load”
  // ——————————————————————————
  function loadSocketIoClient() {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/socket.io/socket.io.js';
      s.onload  = res;
      s.onerror = () => rej(new Error('Não carregou socket.io'));
      document.head.appendChild(s);
    });
  }

  function hookSocketEvents() {
    socket.on('startGame', ({ roomId: r, symbol, opponent }) => {
      roomId = r; mySymbol = symbol;
      playerSymEl.textContent = symbol;
      oppNameEl.textContent  = opponent;
      setupOnline();
    });

    socket.on('movePlayed', ({ index, player }) => {
      // mesmo código de update de célula que você já tinha
      gameState[index] = player;
      const c = cells[index];
      c.textContent = player;
      c.style.color =
        player === 'X' ? colorXInput.value : colorOInput.value;
      c.disabled = true;
      const combo = checkWin();
      if (combo) {
        updateStatus(`Jogador ${player} venceu!`);
        gameActive = false;
        drawWinningLine(combo);
        rematchBtn.hidden = false;
      } else if (!gameState.includes('')) {
        updateStatus('Empate!');
        gameActive = false;
        rematchBtn.hidden = false;
      } else {
        currentPlayer = player === 'X' ? 'O' : 'X';
        updateStatus(`Vez de: ${currentPlayer}`);
      }
    });

    socket.on('rematchStart', () => {
      mySymbol = mySymbol === 'X' ? 'O' : 'X';
      setupOnline();
    });

    socket.on('receiveMessage', ({ from, text }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="author">${from}:</span>
                      <span class="message">${text}</span>`;
      chatLog.appendChild(li);
      chatLog.scrollTop = chatLog.scrollHeight;
    });
  }

  // ——————————————————————————
  // binding de eventos de menu
  // ——————————————————————————
  console.log('Registrando botões do menu');
  btnLocal.addEventListener('click', setupLocal);

  btnOnline.addEventListener('click', async () => {
    if (!socket) {
      try {
        await loadSocketIoClient();
        socket = io(window.location.origin);
        hookSocketEvents();
      } catch (err) {
        return alert('Falha ao carregar modo online');
      }
    }

    const nome = prompt('Digite seu nome (até 15 caracteres):', '');
    if (!nome || nome.length > 15) return alert('Nome inválido');
    myNameSpan.textContent = nome;
    socket.emit('joinQueue', { name: nome });
    queueDiv.hidden = false;
    menu.hidden     = true;
  });

  console.log('script.js totalmente inicializado');
});
