/**
 * Behaviour for the new landing section on the public register page:
 * mobile nav drawer toggle + fade-in-on-scroll for the sections below
 * the hero. Purely additive/cosmetic — does not touch the registration
 * form logic in register.ejs.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var navToggle = document.getElementById('ys-nav-toggle');
    var navLinks = document.querySelector('.ys-nav-links');

    if (navToggle && navLinks) {
      navToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
      });
      navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          navToggle.classList.remove('active');
          navLinks.classList.remove('active');
        });
      });
      document.addEventListener('click', function (e) {
        if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
          navToggle.classList.remove('active');
          navLinks.classList.remove('active');
        }
      });
    }

    var revealEls = document.querySelectorAll('.ys-reveal');
    if (revealEls.length && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('ys-revealed');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(function (el) { observer.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('ys-revealed'); });
    }
  });
})();
