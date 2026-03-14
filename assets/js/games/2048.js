/* Simple 2048 implementation with Firestore coin awarding on game end/win */
'use strict';

const GRID_SIZE = 4;
let board = [];
let score = 0;
let best = Number(localStorage.getItem('2048_best')||0);
let prevState = null;

const $ = id => document.getElementById(id);

function initBoard(){
  board = Array.from({length: GRID_SIZE}, ()=>Array(GRID_SIZE).fill(0));
  score = 0; prevState = null;
  placeRandom(); placeRandom();
  render();
}

function placeRandom(){
  const empties=[];
  for(let r=0;r<GRID_SIZE;r++) for(let c=0;c<GRID_SIZE;c++) if(!board[r][c]) empties.push([r,c]);
  if(!empties.length) return false;
  const [r,c] = empties[Math.floor(Math.random()*empties.length)];
  board[r][c] = Math.random()<0.9?2:4; return true;
}

function cloneState(){ return { board: board.map(row=>row.slice()), score }; }

function restoreState(st){ if(!st) return; board = st.board.map(r=>r.slice()); score = st.score; render(); }

function compress(row){ const newRow=row.filter(v=>v); for(let i=newRow.length;i<GRID_SIZE;i++) newRow.push(0); return newRow; }

function moveLeft(){
  prevState = cloneState();
  let moved=false;
  for(let r=0;r<GRID_SIZE;r++){
    let row = board[r].slice();
    row = compress(row);
    for(let i=0;i<GRID_SIZE-1;i++){
      if(row[i] && row[i]===row[i+1]){ row[i]*=2; score+=row[i]; row.splice(i+1,1); row.push(0); }
    }
    row = compress(row);
    for(let c=0;c<GRID_SIZE;c++) if(board[r][c]!==row[c]) moved=true;
    board[r]=row;
  }
  if(moved){ placeRandom(); render(); autoEndChecks(); }
  return moved;
}

function rotateClockwise(){ board = board[0].map((_,i)=>board.map(row=>row[GRID_SIZE-1-i])); }

function move(dir){ // 0:left,1:up,2:right,3:down
  // normalize to left using rotations
  prevState = cloneState();
  const times = [0,1,2,3][dir];
  for(let t=0;t<times;t++) rotateClockwise();
  const moved = moveLeft();
  for(let t=0;t<(4-times)%4;t++) rotateClockwise();
  return moved;
}

function isGameOver(){
  for(let r=0;r<GRID_SIZE;r++) for(let c=0;c<GRID_SIZE;c++) if(!board[r][c]) return false;
  for(let r=0;r<GRID_SIZE;r++) for(let c=0;c<GRID_SIZE-1;c++) if(board[r][c]===board[r][c+1]) return false;
  for(let c=0;c<GRID_SIZE;c++) for(let r=0;r<GRID_SIZE-1;r++) if(board[r][c]===board[r+1][c]) return false;
  return true;
}

function autoEndChecks(){
  if(score>best){ best = score; localStorage.setItem('2048_best', String(best)); }
  if(board.flat().some(v=>v===2048)){ toast('¡Has conseguido 2048! +recompensa'); awardCoinsForScore(); }
  if(isGameOver()){ toast('Juego terminado'); awardCoinsForScore(); }
}

function awardCoinsForScore(){
  const coins = Math.floor(score/5000); if(coins<=0) return;
  if(!window.auth || !window.auth.currentUser) return;
  const uid = window.auth.currentUser.uid;
  (async ()=>{
    try{
      const userDoc = window.fsDoc(window.db, 'users', uid);
      const snap = await window.getDoc(userDoc);
      const prev = snap.exists()? (snap.data().coins||0) : 0;
      await window.setDoc(userDoc, { coins: prev + coins }, { merge: true });
      try{ await window.addDoc(window.collection(window.db, 'users', uid, 'activity'), { type:'game', game:'2048', coins, score, createdAt: new Date().toISOString() }); }catch(e){}
      toast(`+${coins} monedas añadidas a tu cuenta`,'good');
    }catch(e){ console.warn('awardCoins error',e); }
  })();
}

function render(){
  const gridEl = $('grid'); gridEl.innerHTML = '';
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      const v = board[r][c];
      const tile = document.createElement('div'); tile.className = 'tile ' + (v?('t'+v):'empty'); tile.textContent = v||'';
      gridEl.appendChild(tile);
    }
  }
  $('score').textContent = score;
  $('best').textContent = best;
}

function onKey(e){
  const key = e.key;
  let moved=false;
  if(key==='ArrowLeft' || key==='a' || key==='A') moved = move(0);
  if(key==='ArrowUp'   || key==='w' || key==='W') moved = move(1);
  if(key==='ArrowRight'|| key==='d' || key==='D') moved = move(2);
  if(key==='ArrowDown' || key==='s' || key==='S') moved = move(3);
  if(moved) autoEndChecks();
}

function undo(){ restoreState(prevState); }

// small toast helper (reuse site toast if present)
function toast(msg, type=''){ const t=document.createElement('div'); t.textContent=msg; t.className='toast show '+type; document.body.appendChild(t); setTimeout(()=>t.remove(),2200); }

document.addEventListener('DOMContentLoaded', ()=>{
  initBoard();
  document.addEventListener('keydown', onKey);
  $('btnNew').addEventListener('click', initBoard);
  $('btnUndo').addEventListener('click', undo);
  // wait for firebase ready and then try to award early if needed
  if(window.auth && window.auth.currentUser){ /* nothing */ }
  document.addEventListener('firebaseReady', ()=>{/*noop*/});
});
