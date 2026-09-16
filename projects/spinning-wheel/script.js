(function () {
  "use strict";

  // Slice outcomes per wheel variant. The variant is declared by the page
  // itself via <body data-variant="...">; the wheel image/alt text lives in
  // each screen's own HTML since it's static per page. This config only
  // drives what a spin can land on: which result state to show, the CSS
  // rotation angle that visually lands the pointer on that slice, the
  // optional points value, and the screen-reader announcement.
  const SLICE_CONFIG = {
    default: [
      { state: "result-points", points: "120", angle: 1822.5, announcement: "You earned 120 points!" }
    ],
    "prize-draw": [
      { state: "result-points", points: "50", angle: 1822.5, announcement: "You earned 50 points!" },
      { state: "result-draw", angle: 1867.5, announcement: "You got 1 Prize Draw Entry! You have been entered into the prize draw." },
      { state: "result-points", points: "30", angle: 1912.5, announcement: "You earned 30 points!" },
      { state: "result-draw", angle: 1957.5, announcement: "You got 1 Prize Draw Entry! You have been entered into the prize draw." },
      { state: "result-points", points: "20", angle: 2002.5, announcement: "You earned 20 points!" },
      { state: "result-draw", angle: 2047.5, announcement: "You got 1 Prize Draw Entry! You have been entered into the prize draw." },
      { state: "result-points", points: "10", angle: 2092.5, announcement: "You earned 10 points!" },
      { state: "result-draw", angle: 2137.5, announcement: "You got 1 Prize Draw Entry! You have been entered into the prize draw." }
    ]
  };

  const variant = document.body.dataset.variant || "default";
  const slices = SLICE_CONFIG[variant] || SLICE_CONFIG.default;

  const sections = Array.from(document.querySelectorAll("[data-state]"));
  const termsCheckbox = document.getElementById("termsCheckbox");
  const termsError = document.getElementById("termsError");
  const spinNowButton = document.getElementById("spinNowButton");
  const dashboardButton = document.getElementById("dashboardButton");
  const wheelDisc = document.getElementById("wheelDisc");
  const wheelHub = document.getElementById("wheelHub");
  const pointsAmount = document.getElementById("pointsAmount");
  const announcement = document.getElementById("wheelAnnouncement");
  const spinSound = new Audio("../assets/spinning-sound.mp3");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const settlePause = 2000;
  let hasSpun = false;
  let revealTimer;

  function showState(name, focusTarget) {
    sections.forEach(function (section) {
      section.hidden = section.dataset.state !== name;
    });
    if (focusTarget) {
      window.requestAnimationFrame(function () { focusTarget.focus(); });
    }
  }

  function stopSound() {
    spinSound.pause();
    spinSound.currentTime = 0;
  }

  function resetWheel() {
    window.clearTimeout(revealTimer);
    stopSound();
    hasSpun = false;
    wheelHub.disabled = false;
    wheelHub.classList.remove("is-ticking");
    wheelDisc.classList.remove("is-spinning");
  }

  function showWelcome() {
    resetWheel();
    termsCheckbox.checked = false;
    termsError.hidden = true;
    showState("welcome");
    document.querySelector('[data-state="welcome"] h1').focus({ preventScroll: true });
  }

  spinNowButton.addEventListener("click", function () {
    if (!termsCheckbox.checked) {
      termsError.hidden = false;
      termsCheckbox.focus();
      return;
    }
    termsError.hidden = true;
    showState("play", wheelHub);
  });

  termsCheckbox.addEventListener("change", function () {
    if (termsCheckbox.checked) termsError.hidden = true;
  });

  dashboardButton.addEventListener("click", function () {
    announcement.textContent = "Dashboard navigation is not included in this standalone prototype.";
  });

  wheelHub.addEventListener("click", function () {
    if (hasSpun) return;
    hasSpun = true;
    wheelHub.disabled = true;

    function randomIndex(max) {
      if (window.crypto && window.crypto.getRandomValues) {
        const value = new Uint32Array(1);
        window.crypto.getRandomValues(value);
        return value[0] % max;
      }
      return Math.floor(Math.random() * max);
    }

    // ---- Dev helper (isolated, not part of normal navigation) ----
    // QA can force a specific slice with ?forceSlice=<index> (0-based, into
    // the variant's SLICE_CONFIG array above) to deterministically test a
    // given result without depending on chance. Omit the param for normal,
    // random behavior; this never affects page routing or file structure.
    const forcedIndex = parseInt(new URLSearchParams(window.location.search).get("forceSlice"), 10);
    const outcome = Number.isInteger(forcedIndex) && slices[forcedIndex]
      ? slices[forcedIndex]
      : (slices.length === 1 ? slices[0] : slices[randomIndex(slices.length)]);

    if (pointsAmount && outcome.points) pointsAmount.textContent = outcome.points;
    wheelDisc.style.setProperty("--spin-angle", outcome.angle + "deg");

    function revealPrize() {
      showState(outcome.state);
      announcement.textContent = outcome.announcement;
    }

    if (reducedMotion.matches) {
      stopSound();
      revealPrize();
      return;
    }

    spinSound.currentTime = 0;
    spinSound.play().catch(function () {
      // The animation remains usable when audio is blocked or unavailable.
    });

    let settled = false;
    let pointerFrame;
    let previousAngle = 0;
    let accumulatedAngle = 0;
    let nextBoundary = 45;
    let fallbackTimer;

    function tickPointerAtBoundaries() {
      const transform = window.getComputedStyle(wheelDisc).transform;
      const matrix = transform.match(/matrix\(([^)]+)\)/);
      if (matrix) {
        const values = matrix[1].split(",").map(Number);
        const angle = Math.atan2(values[1], values[0]) * 180 / Math.PI;
        let delta = angle - previousAngle;
        if (delta < -180) delta += 360;
        if (delta > 180) delta -= 360;
        accumulatedAngle += delta;
        previousAngle = angle;

        while (accumulatedAngle >= nextBoundary) {
          wheelHub.classList.remove("is-ticking");
          void wheelHub.offsetWidth;
          wheelHub.classList.add("is-ticking");
          nextBoundary += 45;
        }
      }
      pointerFrame = window.requestAnimationFrame(tickPointerAtBoundaries);
    }

    function finishSpin() {
      if (settled) return;
      settled = true;
      window.cancelAnimationFrame(pointerFrame);
      window.clearTimeout(fallbackTimer);
      stopSound();
      wheelHub.classList.remove("is-ticking");
      revealTimer = window.setTimeout(revealPrize, settlePause);
    }

    wheelDisc.addEventListener("transitionend", finishSpin, { once: true });
    fallbackTimer = window.setTimeout(finishSpin, 6200);
    wheelDisc.classList.add("is-spinning");
    pointerFrame = window.requestAnimationFrame(tickPointerAtBoundaries);
  });

  document.querySelectorAll(".main-page-button").forEach(function (button) {
    button.addEventListener("click", showWelcome);
  });

  showState("welcome");
}());
