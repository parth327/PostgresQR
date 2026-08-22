/**
 * Simple i18n helper for the public register page.
 * Adds English translations on top of the site's native Gujarati text.
 * Any element with data-i18n="key" gets its text (or innerHTML if the
 * translation contains HTML tags) replaced; data-i18n-placeholder="key"
 * swaps an input/textarea placeholder. Nothing here touches form field
 * `name` attributes or values, so submissions are unaffected either way.
 */
(function () {
  var translations = {
    gu: {
      'nav-brand': 'યુવા સંગમ ૨૦૨૬',
      'nav-home': 'મુખ્ય પૃષ્ઠ',
      'nav-about': 'ધ્યેય',
      'nav-features': 'વિશેષતાઓ',
      'nav-register': 'નોંધણી કરો',
      'nav-admin': 'એડમિન લોગિન',

      'hero-devgiri': 'રાષ્ટ્રીય સ્વયંસેવક સંઘ',
      'hero-branch': 'નરોડા ભાગ',
      'hero-subtitle': 'સાથે મળીને, રાષ્ટ્ર માટે...',

      'features-heading-highlight': 'શા માટે',
      'features-heading-text': ' યુવા સંગમમાં જોડાવું?',
      'feature-1-title': 'વ્યક્તિત્વ વિકાસ',
      'feature-1-desc': 'આપણા આંતરિક ગુણોને ખીલવીને એક ઉત્તમ અને પ્રભાવશાળી વ્યક્તિત્વનું નિર્માણ કરવું.',
      'feature-2-title': 'નેતૃત્વ ગુણ અને શિસ્ત',
      'feature-2-desc': 'જીવનમાં શિસ્તનું મહત્વ સમજીને રાષ્ટ્ર સેવા માટે નેતૃત્વ ક્ષમતા વિકસાવવી.',
      'feature-3-title': 'રાષ્ટ્રકાર્ય માટે પ્રેરણા',
      'feature-3-desc': 'દેશની ઉન્નતિ અને વિકાસ માટે સક્રિય યોગદાન આપવાની ઊર્જા અને પ્રેરણા મેળવવી.',
      'feature-4-title': 'સંસ્કારી અને સક્ષમ યુવક ઘડવાનો સંકલ્પ',
      'feature-4-desc': 'નૈતિક મૂલ્યો અને આધુનિક કૌશલ્યો સાથે સક્ષમ યુવા પેઢીનું ઘડતર કરવાનો અડગ નિર્ધાર.',

      'mission-title': 'આપણું ધ્યેય:',
      'mission-1-title': 'ધર્મ આપણી ઓળખ છે...',
      'mission-1-desc': 'આપણા સનાતન મૂલ્યો, કર્તવ્ય અને નૈતિકતા એ આપણી મૂળભૂત ઓળખ છે.',
      'mission-2-title': 'સંસ્કૃતિ આપણો વારસો છે...',
      'mission-2-desc': 'આપણી ભવ્ય સંસ્કૃતિ અને સમૃદ્ધ વારસો એ આપણું સૌથી મોટું ગૌરવ છે.',
      'mission-3-title': 'રાષ્ટ્ર આપણું કર્તવ્ય છે...',
      'mission-3-desc': 'રાષ્ટ્ર પ્રત્યે સમર્પણ અને દેશસેવા એ આપણું પરમ કર્તવ્ય છે.',

      'quote-text': '"યુવા કેવળ ભવિષ્ય નથી, વર્તમાનની શક્તિ છે.."',

      'footer-pillar-seva': 'સેવા',
      'footer-pillar-sanskar': 'સંસ્કાર',
      'footer-pillar-sangathan': 'સંગઠન',
      'footer-copyright': '© ૨૦૨૬ યુવા સંગમ. રાષ્ટ્ર સેવામાં સમર્પિત.',

      'event-details-title': 'ઇવેન્ટની વિગતો',
      'countdown-days': 'દિવસ',
      'countdown-hours': 'કલાક',
      'countdown-mins': 'મિનિટ',
      'countdown-secs': 'સેકન્ડ',
      'event-date-label': 'તારીખ:',
      'event-time-label': 'સમય:',
      'event-venue-label': 'સ્થળ:',
      'event-contact-label': 'સંપર્ક:',
      'event-invite-note': 'તમને આ ઇવેન્ટમાં સ્નેહપૂર્વક આમંત્રણ છે.',

      'reg-heading-badge': '🕉️ રાષ્ટ્રીય સ્વયંસેવક સંઘ - નરોડા ભાગ 🕉️',
      'reg-heading-title': 'યુવા સંગમ ૨૦૨૬',
      'reg-heading-subtitle': 'નમસ્તે મિત્રો, યુવા સંગમમાં જોડાવા માટે નીચે આપેલ માહિતી ભરશો!!!',

      'sec-1-title': 'વ્યક્તિગત માહિતી',
      'sec-2-title': 'સંપર્ક વિગતો',
      'sec-3-title': 'સરનામું',
      'sec-4-title': 'રુચિ અને જોડાણ',
      'sec-5-title': 'તમારો પ્રશ્ન',

      'lbl-name': '👤 પૂરું નામ',
      'ph-name': 'દા.ત. રમેશ પટેલ',
      'lbl-age': '🎂 ઉંમર',
      'ph-age': '15 - 100',
      'lbl-education': '🎓 અભ્યાસ',
      'ph-education': 'દા.ત. B.Tech Computer Science',
      'lbl-phone': '📱 ફોન નંબર',
      'ph-phone': 'દા.ત. 9876543210',
      'lbl-whatsapp': '💬 વોટ્સએપ નંબર (જો હોય તો)',
      'ph-whatsapp': 'દા.ત. 9876543210',
      'lbl-email': '📧 ઈમેલ',
      'hint-email': 'તમારો QR કોડ આ ઈમેલ પર મોકલવામાં આવશે.',
      'ph-email': 'દા.ત. name@example.com',
      'lbl-location': '📍 એરિયા',
      'lbl-location-other': '📍 અન્ય એરિયા',
      'ph-location-other': 'કૃપા કરીને તમારો એરિયા જણાવો',
      'lbl-pincode': '🏷️ પિનકોડ',
      'ph-pincode': 'દા.ત. 382330',
      'lbl-houseNumber': '🏠 ઘર નંબર',
      'ph-houseNumber': 'દા.ત. 12/A',
      'lbl-society': '🏘️ સોસાયટી',
      'ph-society': 'સોસાયટીનું નામ',
      'lbl-landmark': '🧭 લેન્ડમાર્ક',
      'ph-landmark': 'નજીકનું જાણીતું સ્થળ',
      'lbl-interest': '✨ રુચિનો વિષય',
      'lbl-joinMedium': '🤝 કયા માધ્યમથી યુવા સંગમ માં જોડાવાના છો?',
      'lbl-joinMedium-other': '✍️ અન્ય',
      'ph-joinMedium-other': 'કૃપા કરીને જણાવો',
      'lbl-rss-question': '💬 તમારા મનમાં સંઘ કે સંઘના કાર્ય વિશે જિજ્ઞાસા હોય તો આપ અહીંયા લખી શકો છો તમારા પ્રશ્નનો પ્રત્યુતર યુવાસંગમમાં અધિકારી દ્વારા મળશે.',
      'ph-rss-question': 'તમારો પ્રશ્ન અહીં લખો... (વૈકલ્પિક)',
      'opt-select': 'પસંદ કરો',
      'btn-submit': 'ક્લિક કરો અને તમારો ક્યુઆર કોડ જનરેટ કરો',
      'privacy-note': '🔒 તમારી માહિતી ફક્ત એડમિન જ QR કોડ સ્કેન કરીને જોઈ શકશે.'
    },
    en: {
      'nav-brand': 'Yuva Sangam 2026',
      'nav-home': 'Home',
      'nav-about': 'Mission',
      'nav-features': 'Features',
      'nav-register': 'Register',
      'nav-admin': 'Admin Login',

      'hero-devgiri': 'Rashtriya Swayamsevak Sangh',
      'hero-branch': 'Naroda Bhag',
      'hero-subtitle': 'Together, for the nation...',

      'features-heading-highlight': 'Why Join',
      'features-heading-text': ' Yuva Sangam?',
      'feature-1-title': 'Personality Development',
      'feature-1-desc': 'To build an excellent and influential personality by developing our inner qualities.',
      'feature-2-title': 'Leadership & Discipline',
      'feature-2-desc': 'Developing leadership qualities for national service by understanding the importance of discipline in life.',
      'feature-3-title': 'Inspiration for National Work',
      'feature-3-desc': 'Gaining the energy and inspiration to actively contribute to the progress and development of the nation.',
      'feature-4-title': 'Resolve to Build Cultured & Capable Youth',
      'feature-4-desc': 'A firm determination to build a capable youth generation with moral values and modern skills.',

      'mission-title': 'Our Mission:',
      'mission-1-title': 'Dharma is our identity...',
      'mission-1-desc': 'Our eternal values, duty, and morality are our core identity.',
      'mission-2-title': 'Culture is our heritage...',
      'mission-2-desc': 'Our glorious culture and rich heritage are our greatest pride.',
      'mission-3-title': 'Nation is our duty...',
      'mission-3-desc': 'Dedication towards the nation and national service is our supreme duty.',

      'quote-text': '"Youth is not just the future, they are the power of the present.."',

      'footer-pillar-seva': 'Service',
      'footer-pillar-sanskar': 'Values',
      'footer-pillar-sangathan': 'Organisation',
      'footer-copyright': '© 2026 Yuva Sangam - Naroda Bhag. Dedicated to National Service.',

      'event-details-title': 'Event Details',
      'countdown-days': 'Days',
      'countdown-hours': 'Hours',
      'countdown-mins': 'Mins',
      'countdown-secs': 'Secs',
      'event-date-label': 'Date:',
      'event-time-label': 'Time:',
      'event-venue-label': 'Venue:',
      'event-contact-label': 'Contact:',
      'event-invite-note': 'You are cordially invited to this event.',

      'reg-heading-badge': '🕉️ Rashtriya Swayamsevak Sangh - Naroda Bhag 🕉️',
      'reg-heading-title': 'Yuva Sangam 2026',
      'reg-heading-subtitle': 'Hello friends, please fill in the details below to join Yuva Sangam!!!',

      'sec-1-title': 'Personal Details',
      'sec-2-title': 'Contact Details',
      'sec-3-title': 'Address',
      'sec-4-title': 'Interest & Association',
      'sec-5-title': 'Your Question',

      'lbl-name': '👤 Full Name',
      'ph-name': 'e.g. Ramesh Patel',
      'lbl-age': '🎂 Age',
      'ph-age': '15 - 100',
      'lbl-education': '🎓 Education',
      'ph-education': 'e.g. B.Tech Computer Science',
      'lbl-phone': '📱 Phone Number',
      'ph-phone': 'e.g. 9876543210',
      'lbl-whatsapp': '💬 WhatsApp Number (if any)',
      'ph-whatsapp': 'e.g. 9876543210',
      'lbl-email': '📧 Email',
      'hint-email': 'Your QR code will be sent to this email.',
      'ph-email': 'e.g. name@example.com',
      'lbl-location': '📍 Area',
      'lbl-location-other': '📍 Other Area',
      'ph-location-other': 'Please tell us your area',
      'lbl-pincode': '🏷️ Pincode',
      'ph-pincode': 'e.g. 382330',
      'lbl-houseNumber': '🏠 House Number',
      'ph-houseNumber': 'e.g. 12/A',
      'lbl-society': '🏘️ Society',
      'ph-society': 'Name of society',
      'lbl-landmark': '🧭 Landmark',
      'ph-landmark': 'Nearest well-known place',
      'lbl-interest': '✨ Area of Interest',
      'lbl-joinMedium': '🤝 Through which medium will you join Yuva Sangam?',
      'lbl-joinMedium-other': '✍️ Other',
      'ph-joinMedium-other': 'Please specify',
      'lbl-rss-question': '💬 If you have any curiosity about the Sangh or its work, write it here. You will get a reply from an official at Yuva Sangam.',
      'ph-rss-question': 'Write your question here... (optional)',
      'opt-select': 'Select',
      'btn-submit': 'Click to generate your QR code',
      'privacy-note': '🔒 Only the admin can view your details, by scanning the QR code.'
    }
  };
  // Options with a fixed Gujarati value (submitted to the server) still get
  // an English label for readability; the `value` attribute is never touched.
  var optionLabels = {
    gu: {
      'કૃષ્ણા નગર': 'કૃષ્ણા નગર', 'કુબેરનગર': 'કુબેરનગર', 'સૈજપુર': 'સૈજપુર',
      'સરદારનગર': 'સરદારનગર', 'નરોડા': 'નરોડા', 'હરિદર્શન': 'હરિદર્શન', 'અન્ય': 'અન્ય',
      'સેવા': 'સેવા', 'પર્યાવરણ': 'પર્યાવરણ', 'વાંચન': 'વાંચન', 'લેખન': 'લેખન', 'વક્તા': 'વક્તા', 'રમત': 'રમત',
      'શાખા': 'શાખા', 'સાપ્તાહિક મિલન': 'સાપ્તાહિક મિલન'
    },
    en: {
      'કૃષ્ણા નગર': 'Krishna Nagar', 'કુબેરનગર': 'Kubernagar', 'સૈજપુર': 'Saijpur',
      'સરદારનગર': 'Sardarnagar', 'નરોડા': 'Naroda', 'હરિદર્શન': 'Haridarshan', 'અન્ય': 'Other',
      'સેવા': 'Service', 'પર્યાવરણ': 'Environment', 'વાંચન': 'Reading', 'લેખન': 'Writing', 'વક્તા': 'Speaking', 'રમત': 'Sports',
      'શાખા': 'Shakha', 'સાપ્તાહિક મિલન': 'Saptahik Milan'
    }
  };

  function applyLanguage(lang) {
    if (!translations[lang]) lang = 'gu';
    try { localStorage.setItem('ysLang', lang); } catch (e) {}
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'gu');

    var select = document.getElementById('ys-lang-select');
    if (select) select.value = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var text = translations[lang][key];
      if (text === undefined) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else if (/<[a-z][\s\S]*>/i.test(text)) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (translations[lang][key] !== undefined) el.placeholder = translations[lang][key];
    });

    // translate <option> labels based on their fixed (Gujarati) value,
    // while leaving `value`/`selected` — i.e. what gets submitted — intact
    document.querySelectorAll('select[data-i18n-options] option[value]').forEach(function (opt) {
      var v = opt.getAttribute('value');
      if (v && optionLabels[lang] && optionLabels[lang][v]) {
        opt.textContent = optionLabels[lang][v];
      }
    });
    document.querySelectorAll('option[data-i18n]').forEach(function (opt) {
      var key = opt.getAttribute('data-i18n');
      if (translations[lang][key] !== undefined) opt.textContent = translations[lang][key];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var saved = 'gu';
    try { saved = localStorage.getItem('ysLang') || 'gu'; } catch (e) {}
    var select = document.getElementById('ys-lang-select');
    if (select) {
      select.addEventListener('change', function (e) { applyLanguage(e.target.value); });
    }
    applyLanguage(saved);
  });

  window.ysApplyLanguage = applyLanguage;
})();
