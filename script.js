/* ---------- estrellas de fondo ---------- */
const starsContainer = document.getElementById('stars');
const STAR_COUNT = 90;
for (let i = 0; i < STAR_COUNT; i++){
  const s = document.createElement('span');
  s.style.left = Math.random()*100 + '%';
  s.style.top = Math.random()*100 + '%';
  s.style.animationDelay = (Math.random()*4) + 's';
  s.style.width = s.style.height = (Math.random()*1.6 + 1) + 'px';
  starsContainer.appendChild(s);
}

/* ---------- nado de las ballenas (p5.js) + corazón sincronizado ---------- */
const stageEl = document.getElementById('whaleStage');
let p5Canvas = null;

const SWIM_CYCLE = 13000; // duración de cada ciclo de nado, en ms
let swimStart = null;
let heartProgress = 0;     // 0..1, qué tan visible está el corazón ahora mismo
let prevHeartProgress = 0;
let heartX = 0, heartY = 0;
let whaleAx = 0, whaleAy = 0; // posición actual de cada ballena (para clics y respiraderos)
let whaleBx = 0, whaleBy = 0;
let whaleScale = 1;
let sparkles = []; // corazoncitos que salen del respiradero al encontrarse
let rings = [];     // ondas en el agua al encontrarse

function easeInOutSine(v){ return -(Math.cos(Math.PI * v) - 1) / 2; }

// paletas ligeramente distintas para diferenciar a las dos ballenas
const PALETTE_A = { shade:[35,55,80],  belly:[160,175,195], pectoral:[50,75,105], tail:[45,65,90]  };
const PALETTE_B = { shade:[42,64,92],  belly:[172,186,205], pectoral:[60,88,120], tail:[54,76,102] };

function drawWhale(px, py, angulo, mirror, closeness, palette){
  push();
  translate(px, py);
  if (mirror) scale(-1, 1);
  scale(whaleScale);
  rotate(cos(angulo) * 0.05 + closeness * 0.12); // cabeceo natural + inclinación al acercarse

  // --- cola: dos lóbulos rellenos (curva orgánica), se calma al estar felices y juntas ---
  push();
  translate(-140, 2);
  rotate(sin(angulo * 1.5) * 0.25 * (1 - closeness * 0.5));
  noStroke();
  fill(palette.tail);
  beginShape();
  vertex(0, 0);
  bezierVertex(-30, -30, -50, -40, -60, -25);
  bezierVertex(-45, -10, -25, -5, 0, 0);
  endShape(CLOSE);
  beginShape();
  vertex(0, 0);
  bezierVertex(-30, 30, -50, 40, -60, 25);
  bezierVertex(-45, 10, -25, 5, 0, 0);
  endShape(CLOSE);
  pop();

  noStroke();

  // --- cuerpo (sombreado base) ---
  fill(palette.shade);
  beginShape();
  vertex(150, -5); // hocico
  bezierVertex(120, -55, -20, -65, -140, 2); // lomo
  bezierVertex(-80, 25, -20, 35, 20, 40);    // hacia la panza
  bezierVertex(80, 45, 140, 35, 150, -5);
  endShape(CLOSE);

  // --- panza clara ---
  fill(palette.belly);
  beginShape();
  vertex(130, 15);
  bezierVertex(90, 40, 20, 40, -30, 25);
  bezierVertex(-10, 15, 60, 15, 130, 15);
  endShape(CLOSE);

  // --- aleta pectoral: sube un poco al acercarse, como si se abrazaran ---
  push();
  translate(40, 15 - closeness * 12);
  rotate(sin(angulo) * 0.15 + 0.4 + closeness * 0.4);
  fill(palette.pectoral);
  beginShape();
  vertex(0, 0);
  bezierVertex(10, 30, -10, 70, -35, 80);
  bezierVertex(-25, 40, -15, 10, 0, 0);
  endShape(CLOSE);
  pop();

  // --- ojo: pequeño y profundo normalmente, sonriente cuando están felices y cerca ---
  if (closeness > 0.55){
    stroke(15, 20, 30);
    strokeWeight(1.8);
    noFill();
    arc(110, -8, 8, 8, PI, TWO_PI);
    noStroke();
  } else {
    fill(15, 20, 30);
    ellipse(110, -10, 4, 3);
  }

  // --- pliegues ventrales sutiles ---
  stroke(130, 145, 165, 80);
  strokeWeight(1.5);
  noFill();
  line(40, 28, 80, 26);
  line(20, 31, 70, 29);
  line(0, 32, 50, 31);
  noStroke();

  pop();
}

function spawnHeartSparkle(x, y){
  sparkles.push({
    x: x + random(-6, 6),
    y: y,
    vy: random(-0.9, -0.5),
    vx: random(-0.3, 0.3),
    size: random(6, 11),
    alpha: 255
  });
}

function updateSparkles(){
  for (let i = sparkles.length - 1; i >= 0; i--){
    const s = sparkles[i];
    s.x += s.vx;
    s.y += s.vy;
    s.alpha -= 4;
    drawHeart(s.x, s.y, s.size * 0.35, s.alpha / 255);
    if (s.alpha <= 0) sparkles.splice(i, 1);
  }
}

function updateRings(){
  for (let i = rings.length - 1; i >= 0; i--){
    const r = rings[i];
    r.radius += 2.2;
    r.alpha -= 5;
    noFill();
    stroke(200, 225, 255, r.alpha);
    strokeWeight(1.5);
    ellipse(r.x, r.y, r.radius * 2, r.radius * 0.6);
    noStroke();
    if (r.alpha <= 0) rings.splice(i, 1);
  }
}

function drawHeart(hx, hy, size, alpha){
  if (alpha <= 0) return;
  push();
  noStroke();
  fill(255, 159, 174, alpha * 255);
  translate(hx, hy);
  beginShape();
  vertex(0, -size * 0.3);
  bezierVertex(size * 0.5, -size * 1.1, size * 1.3, -size * 0.2, 0, size * 0.9);
  bezierVertex(-size * 1.3, -size * 0.2, -size * 0.5, -size * 1.1, 0, -size * 0.3);
  endShape(CLOSE);
  pop();
}

function setup(){
  const rect = stageEl.getBoundingClientRect();
  p5Canvas = createCanvas(rect.width, rect.height);
  p5Canvas.parent('whaleStage');
  angleMode(RADIANS);
}

function windowResized(){
  const rect = stageEl.getBoundingClientRect();
  resizeCanvas(rect.width, rect.height);
}

function draw(){
  // fondo marino con luz de superficie degradada
  background(10, 25, 55);
  const rows = height * 0.4;
  for (let i = 0; i < rows; i++){
    const a = map(i, 0, rows, 200, 0);
    stroke(30, 70, 120, a);
    line(0, i, width, i);
  }
  noStroke();

  // burbujas flotando
  fill(255, 255, 255, 50);
  const t0 = millis() / 1000;
  ellipse(width * 0.16, height * 0.22 + sin(t0) * 10, 15);
  ellipse(width * 0.5, height * 0.7 + cos(t0) * 15, 20);
  ellipse(width * 0.84, height * 0.3 + sin(t0) * 8, 12);

  if (swimStart === null) swimStart = millis();
  const elapsed = (millis() - swimStart) % SWIM_CYCLE;
  const t = elapsed / SWIM_CYCLE;

  let travel; // 0 = en los extremos, 1 = encontradas en el centro
  if (t < 0.42){
    travel = easeInOutSine(t / 0.42);
  } else if (t < 0.6){
    travel = 1;
  } else {
    travel = easeInOutSine(1 - (t - 0.6) / 0.4);
  }

  // escala de las ballenas según el ancho disponible, para que quepan bien
  whaleScale = constrain(width / 760, 0.42, 1.05);

  const baseY = height * 0.52;
  const angulo = millis() * 0.0022;

  const bodyReach = 210 * whaleScale; // qué tanto ocupa cada ballena desde su pivote
  const leftStart = -bodyReach;
  const rightStart = width + bodyReach;
  const meetLeftX = width / 2 - 62 * whaleScale;
  const meetRightX = width / 2 + 62 * whaleScale;

  whaleAx = leftStart + (meetLeftX - leftStart) * travel;
  whaleBx = rightStart + (meetRightX - rightStart) * travel;

  const bob = sin(angulo) * 26 * (1 - travel * 0.7);
  whaleAy = baseY + bob;
  whaleBy = baseY - bob;

  drawWhale(whaleAx, whaleAy, angulo, false, travel, PALETTE_A);
  drawWhale(whaleBx, whaleBy, angulo + PI, true, travel, PALETTE_B);

  heartProgress = Math.max(0, (travel - 0.8) / 0.2);
  heartX = width / 2;
  heartY = baseY - 60 * whaleScale;
  drawHeart(heartX, heartY, 24 * whaleScale * (0.6 + 0.4 * heartProgress), heartProgress);

  // el momento justo en que se encuentran: onda en el agua + corazoncitos del respiradero
  if (prevHeartProgress < 0.15 && heartProgress >= 0.15){
    rings.push({ x: heartX, y: baseY, radius: 20, alpha: 180 });
  }
  if (heartProgress > 0.3 && frameCount % 8 === 0){
    spawnHeartSparkle(whaleAx + 95 * whaleScale, whaleAy - 55 * whaleScale);
    spawnHeartSparkle(whaleBx - 95 * whaleScale, whaleBy - 55 * whaleScale);
  }
  prevHeartProgress = heartProgress;

  updateRings();
  updateSparkles();
}

function mousePressed(){
  if (!p5Canvas) return;
  const hitRadius = 95 * whaleScale;
  const dA = dist(mouseX, mouseY, whaleAx, whaleAy);
  const dB = dist(mouseX, mouseY, whaleBx, whaleBy);
  if (dA < hitRadius || dB < hitRadius){
    triggerSurprise();
  }
}

/* ---------- música: se reproduce sola en cuanto ella toca la pantalla de inicio ---------- */
const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const songInput = document.getElementById('songInput');
const songName = document.getElementById('songName');
const songLabel = document.getElementById('songLabel');

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

// nombre del archivo de tu canción: colócalo junto a index.html con este mismo nombre
audio.src = "Nights in white satinThe Moody Blues LYRICS (SUBTITULADA AL ESPAÑOL).mp3";

songInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  songName.textContent = file.name;
  audio.play().then(() => { playIcon.innerHTML = ICON_PAUSE; }).catch(() => {});
});

playBtn.addEventListener('click', () => {
  if (audio.paused){
    audio.play();
    playIcon.innerHTML = ICON_PAUSE;
  } else {
    audio.pause();
    playIcon.innerHTML = ICON_PLAY;
  }
});

/* ---------- pantalla de inicio: arranca la música con el primer toque ---------- */
const startOverlay = document.getElementById('startOverlay');

startOverlay.addEventListener('click', () => {
  audio.play().then(() => {
    playIcon.innerHTML = ICON_PAUSE;
  }).catch((err) => {
    // si por alguna razón el navegador aún bloquea la reproducción,
    // ella puede darle al botón de play manualmente, que ya queda visible
    console.warn('No se pudo reproducir automáticamente:', err);
  });
  startOverlay.classList.add('hidden');
}, { once: true });

/* ---------- sorpresa al tocar las ballenas ---------- */
const bubbleLayer = document.getElementById('bubbleLayer');
const notePanel = document.getElementById('notePanel');
const noteBackdrop = document.getElementById('noteBackdrop');
const noteClose = document.getElementById('noteClose');
const heroHint = document.getElementById('heroHint');

function launchBubbles(){
  const canvasRect = stageEl.getBoundingClientRect();
  const originX = canvasRect.left + heartX;
  const originY = canvasRect.top + heartY;

  const COUNT = 16;
  for (let i = 0; i < COUNT; i++){
    const b = document.createElement('span');
    b.className = 'bubble-heart';
    b.textContent = '♥';
    const size = 10 + Math.random() * 16;
    const dx = (Math.random() - 0.5) * 220;
    const rot = (Math.random() - 0.5) * 60;
    const delay = Math.random() * 0.25;
    b.style.left = originX + (Math.random() - 0.5) * 30 + 'px';
    b.style.top = originY + 'px';
    b.style.fontSize = size + 'px';
    b.style.setProperty('--dx', dx + 'px');
    b.style.setProperty('--rot', rot + 'deg');
    b.style.animationDelay = delay + 's';
    bubbleLayer.appendChild(b);
    setTimeout(() => b.remove(), 2200);
  }
}

function openNote(){
  notePanel.classList.add('open');
  noteBackdrop.classList.add('open');
  notePanel.setAttribute('aria-hidden', 'false');
  if (heroHint) heroHint.style.opacity = 0;
}

function closeNote(){
  notePanel.classList.remove('open');
  noteBackdrop.classList.remove('open');
  notePanel.setAttribute('aria-hidden', 'true');
}

function triggerSurprise(){
  launchBubbles();
  openNote();
}

noteClose.addEventListener('click', closeNote);
noteBackdrop.addEventListener('click', closeNote);