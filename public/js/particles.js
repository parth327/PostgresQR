// Saffron/gold ambient particle background + celebratory fireworks burst.
// Ported from the Yuva Sangam reference site (particle canvas + createFireworks)
// and reused here for both the ambient background and the success-page burst.
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let particles = [];
  const maxParticles = 45;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height + Math.random() * 50;
      this.size = Math.random() * 3 + 1;
      this.speedY = -(Math.random() * 1.5 + 0.5);
      this.speedX = Math.sin(Math.random() * 2 * Math.PI) * 0.4;
      const colors = [
        'rgba(255, 119, 0, ',  // Saffron
        'rgba(255, 196, 0, ',  // Gold
        'rgba(255, 153, 51, ', // Light Saffron
        'rgba(17, 128, 7, ',   // Green (tiranga accent)
      ];
      this.baseColor = colors[Math.floor(Math.random() * colors.length)];
      this.alpha = Math.random() * 0.5 + 0.3;
      this.fadeSpeed = Math.random() * 0.005 + 0.002;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.alpha -= this.fadeSpeed;
      if (this.alpha <= 0 || this.y < -10 || this.x < 0 || this.x > canvas.width) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.baseColor + this.alpha + ')';
      ctx.shadowBlur = this.size * 2;
      ctx.shadowColor = 'rgba(255, 196, 0, 0.5)';
      ctx.fill();
    }
  }

  for (let i = 0; i < maxParticles; i++) particles.push(new Particle());

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0;
    particles.forEach((p) => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  // Confetti-style firework burst — call window.createFireworks() on success.
  function createFireworks() {
    for (let i = 0; i < 45; i++) {
      setTimeout(() => {
        const burst = new Particle();
        burst.x = window.innerWidth / 2 + (Math.random() - 0.5) * 150;
        burst.y = window.innerHeight / 2 + (Math.random() - 0.5) * 150;
        burst.speedY = (Math.random() - 0.5) * 8;
        burst.speedX = (Math.random() - 0.5) * 8;
        burst.size = Math.random() * 6 + 2.5;
        burst.alpha = 1.0;
        burst.fadeSpeed = 0.012;
        particles.push(burst);
        setTimeout(() => {
          const idx = particles.indexOf(burst);
          if (idx > -1) particles.splice(idx, 1);
        }, 2000);
      }, i * 15);
    }
  }
  window.createFireworks = createFireworks;

  // ---- Ambient background audio, with a small toggle button ----
  const audioPlayer = document.getElementById('ambient-audio');
  const audioToggle = document.getElementById('audio-toggle');
  const volOnIcon = document.querySelector('.volume-on');
  const volOffIcon = document.querySelector('.volume-off');
  let isPlaying = false;
  let userDisabled = false; // true only if user explicitly muted via the toggle

  function setIcons(playing) {
    if (volOnIcon) volOnIcon.classList.toggle('hidden', !playing);
    if (volOffIcon) volOffIcon.classList.toggle('hidden', playing);
  }

  function playMusic(unmute) {
    if (!audioPlayer) return;
    if (unmute) audioPlayer.muted = false;
    const p = audioPlayer.play();
    if (p !== undefined) {
      p.then(() => {
        isPlaying = !audioPlayer.muted;
        setIcons(isPlaying);
      }).catch(() => {
        isPlaying = false;
        setIcons(false);
      });
    }
  }

  function pauseMusic() {
    if (!audioPlayer) return;
    audioPlayer.pause();
    isPlaying = false;
    setIcons(false);
  }

  if (audioPlayer) {
    audioPlayer.volume = 0.35;
    // Muted autoplay is always allowed by browsers, so this starts silently.
    playMusic(false);
    setIcons(false); // show "off" icon until the user actually hears sound

    // Browsers require a real user gesture before unmuted sound can play.
    // Unmute (and start, if needed) on the first genuine interaction.
    const autoPlayEvents = ['click', 'touchstart', 'keydown'];
    function unmuteOnFirstInteraction() {
      autoPlayEvents.forEach((ev) => window.removeEventListener(ev, unmuteOnFirstInteraction));
      if (userDisabled) return; // user already turned it off on purpose
      playMusic(true);
    }
    autoPlayEvents.forEach((ev) => window.addEventListener(ev, unmuteOnFirstInteraction, { once: true }));
  }

  if (audioToggle) {
    audioToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isPlaying) {
        userDisabled = true;
        pauseMusic();
      } else {
        userDisabled = false;
        playMusic(true);
      }
    });
  }
});
