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

    // Floating "Register" quick-action button (mobile-first): stays out of
    // the way while the hero/features are on screen, appears once the user
    // has scrolled past the hero, and hides again once the real form (or
    // the events section countdown) is already in view.
    var fab = document.getElementById('ysFabRegister');
    var regForm = document.getElementById('regForm');
    if (fab && regForm) {
      var hero = document.querySelector('.ys-hero');
      if (hero && 'IntersectionObserver' in window) {
        var heroObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            fab.classList.toggle('ys-fab-visible', !entry.isIntersecting);
          });
        }, { threshold: 0 });
        heroObserver.observe(hero);
      } else {
        fab.classList.add('ys-fab-visible');
      }
      var formObserver = ('IntersectionObserver' in window) && new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) fab.classList.remove('ys-fab-visible');
        });
      }, { threshold: 0.2 });
      if (formObserver) formObserver.observe(regForm);
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
