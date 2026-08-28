const els = {
  track: document.getElementById('track'),
  tabs: document.getElementById('tabs'),
  dots: document.getElementById('dots'),
  count: document.getElementById('count'),
  prev: document.getElementById('prevBtn'),
  next: document.getElementById('nextBtn'),
  progress: document.getElementById('progress'),
  i18n: Array.from(document.querySelectorAll('[data-i18n]')),
  languagePicker: document.getElementById('languagePicker'),
  languageTrigger: document.getElementById('languageTrigger'),
  languageMenu: document.getElementById('languageMenu'),
  languageSearch: document.getElementById('languageSearch'),
  languageOptions: document.getElementById('languageOptions')
};

let slides = [];
let tabButtons = [];
let dotButtons = [];
let current = 0;
let localeConfig = null;
let activeLanguage = 'en';

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

function fallbackLanguage() {
  return localeConfig.defaultLanguage;
}

function languages() {
  return localeConfig.languages;
}

function languageFromQuery() {
  const requested = new URLSearchParams(window.location.search).get('lang');
  return languages().some((language) => language.code === requested) ? requested : fallbackLanguage();
}

async function loadLocale(lang) {
  return loadJson(`/locales/${lang}.json`);
}

async function initI18n(lang, resources, fallbackResources) {
  if (!window.i18next) return;
  await window.i18next.init({
    lng: lang,
    fallbackLng: fallbackLanguage(),
    resources: {
      [lang]: { translation: resources },
      [fallbackLanguage()]: { translation: fallbackResources }
    },
    interpolation: { escapeValue: false },
    returnObjects: true
  });
}

function t(key, fallback = '') {
  if (window.i18next?.isInitialized) {
    return window.i18next.t(key, { defaultValue: fallback, returnObjects: Array.isArray(fallback) || typeof fallback === 'object' });
  }
  return fallback;
}

function currentLanguageMeta() {
  return languages().find((language) => language.code === activeLanguage) || languages()[0];
}

function paragraphHtml(paragraphs) {
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
}

function renderSlide(slide, index) {
  const section = document.createElement('section');
  section.className = 'slide';
  section.dataset.title = slide.slug;
  section.innerHTML = `
    <div class="slide-inner">
      <div class="kicker">${String(index).padStart(2, '0')} / ${slide.kicker}</div>
      ${slide.headings.map((heading, headingIndex) => `<h${headingIndex === 0 && index === 0 ? '1' : '2'}>${heading}</h${headingIndex === 0 && index === 0 ? '1' : '2'}>`).join('')}
      <div class="story">${paragraphHtml(slide.paragraphs)}</div>
      ${slide.byline ? `<div class="byline"><strong>${slide.byline.name}</strong><br>${slide.byline.meta}</div>` : ''}
      ${slide.statline ? `<div class="statline">${slide.statline.map((item) => item.separator ? '<span class="sep">.</span>' : `<span>${item.label} <b>${item.value}</b></span>`).join('')}</div>` : ''}
      ${slide.buttons ? `<div class="cta-row">${slide.buttons.map((button) => `<a class="btn ${button.primary ? 'solid' : ''}" href="${button.href}" target="_blank" rel="noopener">${button.label}</a>`).join('')}</div>` : ''}
      ${index === 0 ? `<div class="swipehint">${t('ui.swipeHint', '<- swipe to continue ->')}</div>` : ''}
    </div>
  `;
  return section;
}

function updateLanguageLinks() {
  const language = currentLanguageMeta();
  els.languageTrigger.textContent = language.label;
  els.languageTrigger.title = language.name;
  Array.from(els.languageOptions.children).forEach((option) => {
    option.classList.toggle('active', option.dataset.lang === activeLanguage);
    option.setAttribute('aria-selected', option.dataset.lang === activeLanguage ? 'true' : 'false');
  });
}

function setLanguageMenu(open) {
  els.languageMenu.hidden = !open;
  els.languageTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    els.languageSearch.value = '';
    filterLanguageOptions('');
    els.languageSearch.focus();
  }
}

function filterLanguageOptions(query) {
  const normalized = query.trim().toLowerCase();
  Array.from(els.languageOptions.children).forEach((option) => {
    const haystack = option.dataset.search;
    option.hidden = normalized.length > 0 && !haystack.includes(normalized);
  });
}

function changeLanguage(lang) {
  const hash = window.location.hash || (slides[current] ? `#${slides[current].dataset.title}` : '');
  window.location.href = `?lang=${lang}${hash}`;
}

function renderLanguageSwitcher() {
  els.languageOptions.innerHTML = '';
  languages().forEach((language) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'language-option';
    option.dataset.lang = language.code;
    option.dataset.search = `${language.code} ${language.label} ${language.name} ${language.nativeName}`.toLowerCase();
    option.role = 'option';
    option.innerHTML = `<span><span class="native">${language.nativeName}</span><br>${language.name}</span><span class="code">${language.label}</span>`;
    option.addEventListener('click', () => changeLanguage(language.code));
    els.languageOptions.appendChild(option);
  });
}

function renderContent() {
  const content = {
    meta: t('meta', {}),
    slides: t('slides', [])
  };
  const language = currentLanguageMeta();
  document.documentElement.lang = activeLanguage;
  document.documentElement.dir = language.dir;
  document.title = content.meta.title;
  document.querySelector('meta[name="description"]').setAttribute('content', content.meta.description);
  const searchLanguage = t('ui.searchLanguage', 'Search language');
  els.languageSearch.placeholder = searchLanguage;
  els.languageSearch.setAttribute('aria-label', searchLanguage);
  els.tabs.setAttribute('aria-label', t('ui.chapters', 'Chapters'));
  els.prev.setAttribute('aria-label', t('ui.previous', 'Previous'));
  els.next.setAttribute('aria-label', t('ui.next', 'Next'));
  els.i18n.forEach((node) => {
    node.textContent = t(node.dataset.i18n, node.textContent);
  });

  els.track.innerHTML = '';
  els.tabs.innerHTML = '';
  els.dots.innerHTML = '';
  slides = content.slides.map((slide, index) => {
    const section = renderSlide(slide, index);
    els.track.appendChild(section);

    const tab = document.createElement('button');
    tab.innerHTML = `<span class="idx">${String(index).padStart(2, '0')}</span> ${slide.title}`;
    tab.addEventListener('click', () => goTo(index));
    els.tabs.appendChild(tab);

    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.setAttribute('aria-label', `${t('ui.goTo', 'Go to')} ${slide.title}`);
    dot.addEventListener('click', () => goTo(index));
    els.dots.appendChild(dot);
    return section;
  });

  tabButtons = Array.from(els.tabs.children);
  dotButtons = Array.from(els.dots.children);
  current = Math.max(0, slides.findIndex((slide) => slide.dataset.title === window.location.hash.replace('#', '')));
  if (current < 0) current = 0;
  updateLanguageLinks();
  render();
}

function render() {
  const directionMultiplier = currentLanguageMeta().dir === 'rtl' ? 1 : -1;
  els.track.style.transform = `translateX(${directionMultiplier * current * 100}%)`;
  slides.forEach((slide, index) => slide.classList.toggle('active', index === current));
  tabButtons.forEach((button, index) => button.classList.toggle('active', index === current));
  dotButtons.forEach((dot, index) => dot.classList.toggle('active', index === current));
  els.count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  els.progress.style.width = `${slides.length > 1 ? (current / (slides.length - 1)) * 100 : 0}%`;
  els.prev.disabled = current === 0;
  els.next.disabled = current === slides.length - 1;
  tabButtons[current]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  history.replaceState(null, '', `?lang=${activeLanguage}#${slides[current].dataset.title}`);
  updateLanguageLinks();
}

function goTo(index) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  render();
}

els.prev.addEventListener('click', () => goTo(current - 1));
els.next.addEventListener('click', () => goTo(current + 1));
window.addEventListener('keydown', (event) => {
  const isRtl = currentLanguageMeta().dir === 'rtl';
  if (event.key === 'ArrowRight') goTo(isRtl ? current - 1 : current + 1);
  if (event.key === 'ArrowLeft') goTo(isRtl ? current + 1 : current - 1);
});

let touchStartX = null;
let touchStartY = null;
els.track.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}, { passive: true });
els.track.addEventListener('touchend', (event) => {
  if (touchStartX === null) return;
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
    const movingForward = currentLanguageMeta().dir === 'rtl' ? dx > 0 : dx < 0;
    goTo(movingForward ? current + 1 : current - 1);
  }
  touchStartX = null;
  touchStartY = null;
}, { passive: true });

async function boot() {
  localeConfig = await loadJson('/locales/config.json');
  renderLanguageSwitcher();
  activeLanguage = languageFromQuery();
  let resources;
  try {
    resources = await loadLocale(activeLanguage);
  } catch {
    activeLanguage = fallbackLanguage();
    resources = await loadLocale(fallbackLanguage());
  }
  const fallbackResources = activeLanguage === fallbackLanguage() ? resources : await loadLocale(fallbackLanguage());
  await initI18n(activeLanguage, resources, fallbackResources);
  renderContent();
}

els.languageTrigger.addEventListener('click', () => setLanguageMenu(els.languageMenu.hidden));
els.languageSearch.addEventListener('input', (event) => filterLanguageOptions(event.target.value));
document.addEventListener('click', (event) => {
  if (!els.languagePicker.contains(event.target)) setLanguageMenu(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setLanguageMenu(false);
});

boot();
