// script.js — SNAC ANIME core logic (with custom anime support)

(function () {
  "use strict";

  const CUSTOM_KEY = "snac_custom_anime";

  const state = {
    search: "",
    genre: "all",
    language: "all",
    sort: "latest",
    section: "all",
  };

  const GENRES = ["Action", "Adventure", "Fantasy", "Romance", "Comedy", "Supernatural"];

  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function initials(title) {
    return title.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0].toUpperCase()).join("");
  }

  function safeTelegram(url) {
    if (typeof url === "string" && /^https?:\/\/t\.me\//i.test(url)) return url;
    return typeof DEFAULT_TELEGRAM !== "undefined" ? DEFAULT_TELEGRAM : "https://t.me/SNAC_hindi_anime";
  }
  function animeUrl(a) { return safeTelegram(a.telegramUrl); }

  // ---------- Custom anime merge ----------
  function getCustomAnime() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function getAllAnime() {
    const base = typeof animeList !== "undefined" ? animeList : [];
    const custom = getCustomAnime();
    const map = new Map();
    base.forEach((a) => map.set(a.id, a));
    custom.forEach((a) => {
      if (a._deleted) map.delete(a.id);
      else map.set(a.id, a);
    });
    return Array.from(map.values());
  }

  // ---------- Poster ----------
  function buildPoster(a) {
    const poster = a.poster && String(a.poster).trim();
    const wrapper = document.createElement("div");
    wrapper.className = "poster";

    const badges = document.createElement("div");
    badges.className = "poster-badges";
    if (a.language) {
      const p = document.createElement("span");
      p.className = "pill pill-lang";
      p.textContent = a.language;
      badges.appendChild(p);
    }
    if (a.status) {
      const p = document.createElement("span");
      p.className = "pill pill-status";
      p.textContent = a.status;
      badges.appendChild(p);
    }
    wrapper.appendChild(badges);

    if (a.rating) {
      const r = document.createElement("span");
      r.className = "pill pill-rating";
      r.textContent = "★ " + a.rating;
      wrapper.appendChild(r);
    }

    if (poster) {
      const img = document.createElement("img");
      img.alt = a.title + " poster";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = poster;
      img.addEventListener("load", () => img.classList.add("loaded"));
      img.addEventListener("error", () => { img.remove(); wrapper.appendChild(fallback(a)); });
      wrapper.appendChild(img);
    } else {
      wrapper.appendChild(fallback(a));
    }
    return wrapper;
  }

  function fallback(a) {
    const fb = document.createElement("div");
    fb.className = "poster-fallback";
    const init = document.createElement("div");
    init.className = "initials";
    init.textContent = initials(a.title);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = (a.year || "") + (a.status === "Movie" ? " • Movie" : "");
    fb.appendChild(init);
    fb.appendChild(sub);
    return fb;
  }

  // ---------- Card ----------
  function buildCard(a) {
    const card = document.createElement("article");
    card.className = "anime-card";
    card.dataset.id = a.id;
    card.appendChild(buildPoster(a));

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = a.title;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const genreSpan = document.createElement("span");
    genreSpan.className = "genre";
    genreSpan.textContent = (a.genre || []).join(" • ");
    meta.appendChild(genreSpan);
    if (a.year) {
      const y = document.createElement("span");
      y.textContent = "• " + a.year;
      meta.appendChild(y);
    }
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const details = document.createElement("button");
    details.className = "btn btn-details";
    details.type = "button";
    details.textContent = "Details";
    details.addEventListener("click", () => openModal(a.id));
    actions.appendChild(details);

    const tg = document.createElement("a");
    tg.className = "btn btn-tg";
    tg.href = animeUrl(a);
    tg.target = "_blank";
    tg.rel = "noopener noreferrer";
    tg.textContent = "Telegram";
    actions.appendChild(tg);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  // ---------- Filtering ----------
  function filteredList() {
    let list = getAllAnime();
    if (state.section === "trending") list = list.filter((a) => a.trending);
    if (state.section === "latest") list = list.filter((a) => a.latest);
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.titleBn || "").toLowerCase().includes(q) ||
          (a.genre || []).some((g) => g.toLowerCase().includes(q))
      );
    }
    if (state.genre !== "all") list = list.filter((a) => (a.genre || []).includes(state.genre));
    if (state.language !== "all")
      list = list.filter((a) => (a.language || "").toLowerCase() === state.language.toLowerCase());

    switch (state.sort) {
      case "latest": list.sort((a, b) => (b.year || 0) - (a.year || 0)); break;
      case "oldest": list.sort((a, b) => (a.year || 0) - (b.year || 0)); break;
      case "az": list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "za": list.sort((a, b) => b.title.localeCompare(a.title)); break;
      case "rating": list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    }
    return list;
  }

  function renderSection(containerId, list, emptyMsg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    if (!list.length) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="emoji">🔍</div><h3>কিছু পাওয়া যায়নি</h3>
        <p>${escapeHtml(emptyMsg || "অন্য কিছু লিখে আবার চেষ্টা করুন।")}</p>
      </div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((a) => frag.appendChild(buildCard(a)));
    el.appendChild(frag);
  }

  function renderAll() {
    const all = getAllAnime();
    const trending = all.filter((a) => a.trending).slice(0, 8);
    renderSection("trendingGrid", trending, "কোনো Trending Anime নেই।");

    const latest = all.filter((a) => a.latest).sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 8);
    renderSection("latestGrid", latest, "কোনো Latest Anime নেই।");

    renderSection("allGrid", filteredList(), "আপনার সার্চের সাথে কোনো Anime মেলেনি।");
    updateCount();
    renderCategories();
  }

  function updateCount() {
    const c = document.getElementById("filterCount");
    if (c) c.textContent = "মোট " + filteredList().length + " টি Anime";
  }

  function renderCategories() {
    const grid = document.getElementById("catGrid");
    if (!grid) return;
    const icons = { Action: "⚔️", Adventure: "🗺️", Fantasy: "✨", Romance: "💖", Comedy: "😂", Supernatural: "👻" };
    const all = getAllAnime();
    grid.innerHTML = "";
    GENRES.forEach((g) => {
      const count = all.filter((a) => (a.genre || []).includes(g)).length;
      const card = document.createElement("div");
      card.className = "cat-card";
      card.innerHTML = `
        <div class="cat-icon">${icons[g] || "🎬"}</div>
        <div class="cat-name">${g}</div>
        <div class="cat-count">${count} টি Anime</div>`;
      card.addEventListener("click", () => {
        state.genre = g;
        const gs = document.getElementById("genreSelect");
        if (gs) gs.value = g;
        renderAll();
        document.getElementById("all-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      grid.appendChild(card);
    });
  }

  // ---------- Modal ----------
  function openModal(id) {
    const a = getAllAnime().find((x) => x.id === id);
    if (!a) return;
    const overlay = document.getElementById("modalOverlay");
    if (!overlay) return;

    overlay.innerHTML = "";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const close = document.createElement("button");
    close.className = "modal-close";
    close.type = "button";
    close.setAttribute("aria-label", "বন্ধ করুন");
    close.textContent = "✕";
    close.addEventListener("click", closeModal);
    modal.appendChild(close);

    const posterWrap = document.createElement("div");
    posterWrap.className = "modal-poster";
    posterWrap.appendChild(buildPoster(a));
    modal.appendChild(posterWrap);

    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = `
      <h2>${escapeHtml(a.title)}</h2>
      ${a.titleBn ? `<div class="sub-title">${escapeHtml(a.titleBn)}</div>` : ""}
      <div class="modal-tags">
        ${(a.genre || []).map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join("")}
        ${a.year ? `<span class="tag">${a.year}</span>` : ""}
        ${a.language ? `<span class="tag">${escapeHtml(a.language)}</span>` : ""}
        ${a.status ? `<span class="tag">${escapeHtml(a.status)}</span>` : ""}
        ${a.rating ? `<span class="tag">★ ${a.rating}</span>` : ""}
      </div>
      <p class="desc">${escapeHtml(a.description || "")}</p>
      <a class="btn btn-tg" href="${escapeHtml(animeUrl(a))}" target="_blank" rel="noopener noreferrer">
        ✈️ Telegram-এ দেখুন
      </a>
    `;
    modal.appendChild(body);
    overlay.appendChild(modal);
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    close.focus();
  }

  function closeModal() {
    const overlay = document.getElementById("modalOverlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---------- Setup ----------
  function setupMobileMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobileMenu");
    if (!btn || !menu) return;
    menu.style.display = "none";
    btn.addEventListener("click", () => {
      const isOpen = menu.style.display !== "none";
      menu.style.display = isOpen ? "none" : "flex";
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", () => (menu.style.display = "none")));
  }

  function setupFilters() {
    const genreSel = document.getElementById("genreSelect");
    const langSel = document.getElementById("languageSelect");
    const sortSel = document.getElementById("sortSelect");
    const secSel = document.getElementById("sectionSelect");
    const search = document.getElementById("filterSearch");
    const clearBtn = document.getElementById("clearFilters");

    if (genreSel) genreSel.addEventListener("change", (e) => { state.genre = e.target.value; renderAll(); });
    if (langSel) langSel.addEventListener("change", (e) => { state.language = e.target.value; renderAll(); });
    if (sortSel) sortSel.addEventListener("change", (e) => { state.sort = e.target.value; renderAll(); });
    if (secSel) secSel.addEventListener("change", (e) => { state.section = e.target.value; renderAll(); });
    if (search) search.addEventListener("input", (e) => { state.search = e.target.value; renderAll(); });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        state.search = ""; state.genre = "all"; state.language = "all"; state.sort = "latest"; state.section = "all";
        if (genreSel) genreSel.value = "all";
        if (langSel) langSel.value = "all";
        if (sortSel) sortSel.value = "latest";
        if (secSel) secSel.value = "all";
        if (search) search.value = "";
        const navSearch = document.getElementById("navSearch");
        if (navSearch) navSearch.value = "";
        renderAll();
      });
    }
  }

  function setupNavSearch() {
    const navSearch = document.getElementById("navSearch");
    const filterSearch = document.getElementById("filterSearch");
    const mSearch = document.getElementById("mobileSearch");
    function apply(v) {
      state.search = v;
      renderAll();
      document.getElementById("all-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (navSearch) {
      navSearch.addEventListener("input", (e) => {
        if (filterSearch) filterSearch.value = e.target.value;
        apply(e.target.value);
      });
    }
    if (mSearch) {
      mSearch.addEventListener("input", (e) => {
        if (filterSearch) filterSearch.value = e.target.value;
        if (navSearch) navSearch.value = e.target.value;
        apply(e.target.value);
      });
    }
    const explore = document.getElementById("exploreBtn");
    if (explore) {
      explore.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("all-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function setupToTop() {
    const btn = document.getElementById("toTop");
    if (!btn) return;
    window.addEventListener("scroll", () => btn.classList.toggle("show", window.scrollY > 500));
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function setupModalEvents() {
    const overlay = document.getElementById("modalOverlay");
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  document.addEventListener("DOMContentLoaded", () => {
    state.sort = "latest";
    renderAll();
    setupFilters();
    setupNavSearch();
    setupMobileMenu();
    setupToTop();
    setupModalEvents();
  });

  window.SNAC = { openModal, closeModal };
})();