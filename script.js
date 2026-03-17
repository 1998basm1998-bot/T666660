// --- المتغيرات العامة والحالة ---
let state = {
    deck: [],
    player1Hand: [],
    player2Hand: [],
    board: [],
    turn: 1, // 1 أو 2
    mode: 'pvc', // pvc (كمبيوتر) أو pvp (لاعبين)
    leftEnd: null,
    rightEnd: null,
    scores: { p1: 0, p2: 0 },
    history: [] // لحفظ الحركات من أجل زر التراجع
};

let soundEnabled = true;

// --- توليد الصوت بدون ملفات ---
function playSound(type) {
    if (!soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        if (type === 'play') {
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {
        console.log("Audio API not supported");
    }
}

// --- التهيئة الأساسية ---
function initGame(mode) {
    state.mode = mode;
    startNewRound();
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
}

function startNewRound() {
    state.deck = createDeck();
    shuffleDeck(state.deck);
    state.player1Hand = state.deck.splice(0, 7);
    state.player2Hand = state.deck.splice(0, 7);
    state.board = [];
    state.leftEnd = null;
    state.rightEnd = null;
    state.history = [];
    
    // من يبدأ؟ صاحب أعلى دبل، وللتبسيط سنجعله اللاعب 1 دائماً في هذه النسخة
    state.turn = 1;
    
    updateUI();
    showMessage("بدأت جولة جديدة! دور اللاعب 1");
    saveHistory();
}

// إنشاء قطع الدومينو الـ 28
function createDeck() {
    let deck = [];
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
            deck.push({ val1: i, val2: j, isDouble: i === j });
        }
    }
    return deck;
}

// خلط القطع
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// --- منطق اللعب ---
// التحقق مما إذا كانت الحركة صحيحة
function isValidMove(domino) {
    if (state.board.length === 0) return true;
    return domino.val1 === state.leftEnd || domino.val1 === state.rightEnd || 
           domino.val2 === state.leftEnd || domino.val2 === state.rightEnd;
}

// لعب القطعة
function playDomino(player, index) {
    let hand = player === 1 ? state.player1Hand : state.player2Hand;
    let domino = hand[index];

    if (!isValidMove(domino)) {
        if (player === 1 || state.mode === 'pvp') {
            playSound('error');
            showMessage("حركة خاطئة! الأرقام لا تتطابق.");
        }
        return false;
    }

    saveHistory();

    // وضع القطعة على الطاولة (تحديد الاتجاه)
    if (state.board.length === 0) {
        state.board.push({ ...domino, playedVal1: domino.val1, playedVal2: domino.val2 });
        state.leftEnd = domino.val1;
        state.rightEnd = domino.val2;
    } else {
        // محاولة إضافتها لليمين أولاً
        if (domino.val1 === state.rightEnd) {
            state.board.push({ ...domino, playedVal1: domino.val1, playedVal2: domino.val2 });
            state.rightEnd = domino.val2;
        } else if (domino.val2 === state.rightEnd) {
            state.board.push({ ...domino, playedVal1: domino.val2, playedVal2: domino.val1 });
            state.rightEnd = domino.val1;
        } 
        // محاولة إضافتها لليسار
        else if (domino.val1 === state.leftEnd) {
            state.board.unshift({ ...domino, playedVal1: domino.val2, playedVal2: domino.val1 });
            state.leftEnd = domino.val2;
        } else if (domino.val2 === state.leftEnd) {
            state.board.unshift({ ...domino, playedVal1: domino.val1, playedVal2: domino.val2 });
            state.leftEnd = domino.val1;
        }
    }

    // إزالة القطعة من اليد
    hand.splice(index, 1);
    playSound('play');

    // التحقق من انتهاء الجولة
    if (hand.length === 0) {
        endRound(player);
        return true;
    }

    // تبديل الدور
    switchTurn();
    return true;
}

// سحب قطعة
function drawTile() {
    let hand = state.turn === 1 ? state.player1Hand : state.player2Hand;
    
    // التحقق مما إذا كان لديه حركة (حسب القوانين الصارمة لا يسحب إلا إذا لم يكن لديه حركة)
    let hasMove = hand.some(isValidMove);
    if (hasMove) {
        showMessage("لا يمكنك السحب، لديك قطعة قابلة للعب!");
        playSound('error');
        return;
    }

    if (state.deck.length > 0) {
        saveHistory();
        hand.push(state.deck.pop());
        playSound('play');
        updateUI();
        showMessage(`اللاعب ${state.turn} سحب قطعة`);
    } else {
        showMessage("لا توجد قطع في السحب!");
        playSound('error');
    }
}

// تمرير الدور
function passTurn() {
    let hand = state.turn === 1 ? state.player1Hand : state.player2Hand;
    if (hand.some(isValidMove)) {
        showMessage("لا يمكنك التمرير، لديك قطعة قابلة للعب!");
        playSound('error');
        return;
    }
    if (state.deck.length > 0) {
        showMessage("يجب عليك السحب أولاً!");
        playSound('error');
        return;
    }

    saveHistory();
    showMessage(`اللاعب ${state.turn} مرر دوره.`);
    
    // تحقق من حالة الإغلاق (Block) - إذا مرر كلا اللاعبين مرتين متتاليتين
    // للتبسيط: سنتحقق مما إذا كان الخصم أيضا لا يملك حركة
    let oppHand = state.turn === 1 ? state.player2Hand : state.player1Hand;
    if (!oppHand.some(isValidMove)) {
        endRound('block');
        return;
    }

    switchTurn();
}

function switchTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    updateUI();
    
    if (state.turn === 1) {
        showMessage("دورك الآن (اللاعب 1)");
    } else {
        showMessage(state.mode === 'pvc' ? "دور الكمبيوتر..." : "دور اللاعب 2");
        if (state.mode === 'pvc') {
            setTimeout(playCPU, 1000); // تأخير لتبدو كأنها حركة حقيقية
        }
    }
}

// ذكاء اصطناعي بسيط للكمبيوتر
function playCPU() {
    if (state.turn !== 2 || state.mode !== 'pvc') return;

    let playableIndexes = [];
    state.player2Hand.forEach((domino, index) => {
        if (isValidMove(domino)) playableIndexes.push(index);
    });

    if (playableIndexes.length > 0) {
        // نختار قطعة قابلة للعب عشوائياً (يمكن تطويرها لاحقاً لاختيار القطعة ذات النقاط الأعلى)
        let indexToPlay = playableIndexes[Math.floor(Math.random() * playableIndexes.length)];
        playDomino(2, indexToPlay);
    } else {
        if (state.deck.length > 0) {
            drawTile();
            setTimeout(playCPU, 1000); // يحاول اللعب بعد السحب
        } else {
            passTurn();
        }
    }
}

// إنهاء الجولة
function endRound(winner) {
    let p1Points = state.player1Hand.reduce((sum, d) => sum + d.val1 + d.val2, 0);
    let p2Points = state.player2Hand.reduce((sum, d) => sum + d.val1 + d.val2, 0);

    let actualWinner = winner;
    if (winner === 'block') {
        if (p1Points < p2Points) actualWinner = 1;
        else if (p2Points < p1Points) actualWinner = 2;
        else actualWinner = 'تعادل';
    }

    let msg = "";
    if (actualWinner === 1) {
        msg = "🎉 مبروك! فاز اللاعب 1 الجولة.";
        state.scores.p1++;
    } else if (actualWinner === 2) {
        msg = "فاز اللاعب 2 بهذه الجولة.";
        state.scores.p2++;
    } else {
        msg = "تعادل! أغلقت اللعبة وتساوت النقاط.";
    }

    msg += ` (نقاط متبقية: لـ 1= ${p1Points} ، لـ 2= ${p2Points})`;
    showMessage(msg);
    updateUI(true); // reveal hands
}

// --- التحديثات الرسومية ---
function updateUI(revealAll = false) {
    // تحديث المعلومات
    document.getElementById('current-turn-info').innerText = `الدور: اللاعب ${state.turn}`;
    document.getElementById('boneyard-info').innerText = `السحب: ${state.deck.length}`;
    document.getElementById('p2-count').innerText = `(${state.player2Hand.length} قطع)`;

    // رسم الطاولة
    const tableDiv = document.getElementById('table');
    tableDiv.innerHTML = '';
    state.board.forEach(domino => {
        let domEl = createDominoElement(domino.playedVal1, domino.playedVal2, domino.isDouble);
        tableDiv.appendChild(domEl);
    });

    // رسم يد اللاعب 1
    const p1HandDiv = document.getElementById('player1-hand');
    p1HandDiv.innerHTML = '';
    state.player1Hand.forEach((domino, idx) => {
        let domEl = createDominoElement(domino.val1, domino.val2, domino.isDouble);
        domEl.onclick = () => { if (state.turn === 1) playDomino(1, idx); };
        p1HandDiv.appendChild(domEl);
    });

    // رسم يد اللاعب 2
    const p2HandDiv = document.getElementById('player2-hand');
    p2HandDiv.innerHTML = '';
    state.player2Hand.forEach((domino, idx) => {
        if (state.mode === 'pvp' || revealAll) {
            let domEl = createDominoElement(domino.val1, domino.val2, domino.isDouble);
            domEl.onclick = () => { if (state.turn === 2 && state.mode === 'pvp') playDomino(2, idx); };
            p2HandDiv.appendChild(domEl);
        } else {
            // كمبيوتر - إخفاء القطع
            let hiddenDomEl = document.createElement('div');
            hiddenDomEl.className = 'domino hidden';
            p2HandDiv.appendChild(hiddenDomEl);
        }
    });

    // تعطيل/تفعيل الأزرار حسب الدور
    let isP1 = state.turn === 1;
    let isPvP_P2 = state.turn === 2 && state.mode === 'pvp';
    let canAct = isP1 || isPvP_P2;

    document.getElementById('btn-draw').disabled = !canAct;
    document.getElementById('btn-pass').disabled = !canAct;
}

// مساعدة لإنشاء عنصر دومينو HTML
function createDominoElement(topVal, bottomVal, isDouble) {
    let dom = document.createElement('div');
    dom.className = 'domino' + (isDouble ? ' double' : '');
    
    let top = document.createElement('div');
    top.className = 'domino-half';
    top.innerText = topVal; // يمكن استبدالها بنقاط لاحقاً
    
    let divider = document.createElement('div');
    divider.className = 'domino-divider';
    
    let bottom = document.createElement('div');
    bottom.className = 'domino-half';
    bottom.innerText = bottomVal;

    dom.appendChild(top);
    dom.appendChild(divider);
    dom.appendChild(bottom);
    return dom;
}

function showMessage(msg) {
    document.getElementById('message-area').innerText = msg;
}

// --- ميزات إضافية (تلميح، تراجع، حفظ، ثيم) ---
function showHint() {
    if (state.turn !== 1) return; // تلميح للاعب الأول فقط
    const handDivs = document.getElementById('player1-hand').children;
    let found = false;
    
    state.player1Hand.forEach((domino, idx) => {
        if (isValidMove(domino)) {
            handDivs[idx].classList.add('hint');
            setTimeout(() => handDivs[idx].classList.remove('hint'), 2000);
            found = true;
        }
    });

    if (!found) {
        showMessage("لا توجد قطع مطابقة. عليك السحب أو التمرير.");
    }
}

function saveHistory() {
    // حفظ نسخة عميقة من الحالة الحالية (Deep Copy)
    let stateCopy = JSON.parse(JSON.stringify(state));
    // لا نحتاج لحفظ كل التاريخ داخل التاريخ لمنع التضخم
    stateCopy.history = []; 
    state.history.push(stateCopy);
}

function undoMove() {
    if (state.history.length === 0) {
        showMessage("لا يوجد حركات للتراجع عنها.");
        return;
    }
    // التراجع (نأخذ آخر حالة محفوظة)
    let prevState = state.history.pop();
    
    // إذا كان الخصم كمبيوتر، نتراجع عن حركته وحركتنا
    if (state.mode === 'pvc' && prevState.turn === 2 && state.history.length > 0) {
       prevState = state.history.pop();
    }

    let currentHistory = state.history; // الحفاظ على التاريخ المتبقي
    state = prevState;
    state.history = currentHistory;
    
    updateUI();
    showMessage("تم التراجع عن الحركة.");
}

function saveGame() {
    localStorage.setItem('dominoState', JSON.stringify(state));
    showMessage("تم حفظ اللعبة بنجاح!");
}

function loadGame() {
    let saved = localStorage.getItem('dominoState');
    if (saved) {
        state = JSON.parse(saved);
        updateUI();
        showMessage("تم تحميل اللعبة المحفوظة.");
    } else {
        showMessage("لا توجد لعبة محفوظة.");
    }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icons = soundEnabled ? '🔊' : '🔇';
    document.getElementById('btn-toggle-sound-start').innerText = 'الصوت: ' + icons;
    document.getElementById('btn-toggle-sound-game').innerText = icons;
}

// --- ربط الأزرار بالأحداث (Event Listeners) ---
window.onload = () => {
    // أزرار شاشة البداية
    document.getElementById('btn-pvc').onclick = () => initGame('pvc');
    document.getElementById('btn-pvp').onclick = () => initGame('pvp');
    document.getElementById('btn-reset-scores').onclick = () => {
        state.scores = { p1: 0, p2: 0 };
        alert("تمت تصفير النتائج.");
    };
    
    // أزرار التحكم باللعبة
    document.getElementById('btn-draw').onclick = drawTile;
    document.getElementById('btn-pass').onclick = passTurn;
    document.getElementById('btn-restart').onclick = startNewRound;
    document.getElementById('btn-new-game').onclick = () => {
        if(confirm('هل أنت متأكد أنك تريد إنهاء الجولة الحالية وبدء واحدة جديدة؟')) startNewRound();
    };

    // أزرار الخيارات العلوية
    document.getElementById('btn-hint').onclick = showHint;
    document.getElementById('btn-undo').onclick = undoMove;
    document.getElementById('btn-save').onclick = saveGame;
    document.getElementById('btn-load').onclick = loadGame;
    
    // أزرار الثيم والصوت
    document.getElementById('btn-toggle-theme-start').onclick = toggleTheme;
    document.getElementById('btn-toggle-theme-game').onclick = toggleTheme;
    document.getElementById('btn-toggle-sound-start').onclick = toggleSound;
    document.getElementById('btn-toggle-sound-game').onclick = toggleSound;

    // زر العودة للرئيسية
    document.getElementById('btn-back').onclick = () => {
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('start-screen').classList.add('active');
    };

    // النوافذ المنبثقة
    const rulesModal = document.getElementById('rules-modal');
    const scoresModal = document.getElementById('scores-modal');

    document.getElementById('btn-rules-start').onclick = () => rulesModal.classList.add('active');
    document.getElementById('btn-rules-game').onclick = () => rulesModal.classList.add('active');
    document.getElementById('close-rules').onclick = () => rulesModal.classList.remove('active');

    document.getElementById('btn-scores').onclick = () => {
        document.getElementById('score-text').innerText = `اللاعب 1: ${state.scores.p1} | اللاعب 2: ${state.scores.p2}`;
        scoresModal.classList.add('active');
    };
    document.getElementById('close-scores').onclick = () => scoresModal.classList.remove('active');
};
