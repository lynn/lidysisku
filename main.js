const langs = ["en", "ja", "jbo"];
const gismuRegex =
  /^([bcdfghjklmnprstvxz][aeiou][bcdfghjklmnprstvxz][bcdfghjklmnprstvxz][aeiou]|[bcdfghjklmnprstvxz][bcdfghjklmnprstvxz][aeiou][bcdfghjklmnprstvxz][aeiou])$/;

const etymoSources = ["Chinese", "English", "Hindi", "Spanish", "Russian", "Arabic"];

let lang = "en";
let etymo = {};
let notes = {};
let boxnotes = {};

const RESULT_BATCH = 50;
let shownKey = "";
let shownCount = 0;
let matchPartial = false;
let showMoreResults = () => false;

function lget(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function lset(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

const prefersDark = () =>
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const getTheme = () => lget("theme") ?? (prefersDark() ? "dark" : "light");

function queryLink(query, className) {
  const a = document.createElement("a");
  a.appendChild(document.createTextNode(query));
  if (className) a.className = className;
  a.href = "#" + encodeURIComponent(query);
  return a;
}

function jvsLink(lemma, votes) {
  const a = document.createElement("a");
  a.href = "https://lensisku.lojban.org/en/valsi/" + lemma;
  a.className = "jvs";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.innerText =
    votes > 999 ? "official" : votes >= 0 ? "+" + votes : "−" + -votes;
  return a;
}

const renderMath = (html) =>
  html.replace(
    /([\$=])([a-z]+)_?\{?(\d+)\}?\$?/g,
    (_, v, w, d) => `${v === "=" ? "=" : ""}<i>${w}</i><sub>${d}</sub>`
  );

function renderNote(className, text) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  div.innerHTML = renderMath(div.innerHTML).replace(
    /\{([\w' .,-]+)\}/g,
    (_, word) => queryLink(word).outerHTML
  );
  return div;
}

function renderEtymology(lemma) {
  const ety = document.createElement("div");
  ety.className = "etymo";
  etymo[lemma].split(" ").forEach((w, k) => {
    if (k) ety.appendChild(document.createTextNode(", "));
    else ety.appendChild(document.createTextNode("Etymology: "));
    const span = document.createElement("span");
    span.title = etymoSources[k] ?? "";
    span.appendChild(document.createTextNode(w));
    ety.appendChild(span);
  });
  return ety;
}

function appendNotes(dd, text, ety) {
  const div = renderNote("notes", text);
  dd.appendChild(div);
  if (ety) {
    div.appendChild(ety);
    return; // never clamp, or the etymology would be cut off
  }
  if (text.length <= 300 && text.split("\n").length <= 3) return;
  div.classList.add("clamped");
  const more = document.createElement("button");
  more.className = "more";
  more.textContent = "Show more...";
  more.addEventListener("click", () => {
    div.classList.remove("clamped");
    more.remove();
  });
  dd.appendChild(more);
}

function renderResults(results, mark, query) {
  return results.flatMap((e) => {
    const dt = document.createElement("dt");
    const [lemma, type, selmaho, votes, definition] = e[1];
    const rafsi = RAFSI.get(lemma) ?? [];
    const obsolete = type >= 9 && type <= 12;
    const experimental = type === 4 || type === 5;
    dt.appendChild(queryLink(lemma, obsolete ? "obsolete" : ""));
    const extra = [experimental ? "*" : "", ...rafsi].join(" ");
    if (extra) {
      const i = document.createElement("i");
      i.appendChild(document.createTextNode(extra));
      dt.appendChild(i);
    }
    if (selmaho) dt.appendChild(queryLink(selmaho, "selmaho"));
    dt.appendChild(jvsLink(lemma, votes));
    const dd = document.createElement("dd");
    dd.appendChild(document.createTextNode(definition));
    if (mark) dd.innerHTML = dd.innerHTML.replace(mark, "<mark>$&</mark>");
    dd.innerHTML = renderMath(dd.innerHTML);
    const boxnote = boxnotes[lemma]?.[lang];
    if (boxnote) dd.appendChild(renderNote("boxnote", boxnote));
    const ety =
      query && lemma === query && etymo[lemma]
        ? renderEtymology(lemma)
        : undefined;
    if (notes[lemma] || ety) appendNotes(dd, notes[lemma] ?? "", ety);
    return [dt, dd];
  });
}

function analyzeLujvo(words) {
  if (words.length === 1) {
    const valsi = words[0].replaceAll("h", "'");
    const selrafsi = searchSelrafsiFromRafsi(valsi);
    if (selrafsi) {
      return [[], "← " + queryLink(selrafsi).outerHTML];
    } else {
      try {
        lujvoParts = getVeljvo(valsi);
        let result = "← " + queryLink(lujvoParts.join(" ")).outerHTML;
        const [optimal, _] = getLujvo(lujvoParts);
        if (optimal !== valsi) {
          result += " → " + queryLink(optimal).outerHTML;
        }
        return [lujvoParts, result];
      } catch (e) {
        return [[], ""];
      }
    }
  } else if (words.length > 1) {
    try {
      const [lujvo, _] = getLujvo(words);
      return [[], "→ " + queryLink(lujvo).outerHTML, lujvo];
    } catch (e) {
      return [[], ""];
    }
  }
}

function makeGlobRegex(query) {
  const reBody = query
    .replaceAll("V", "[aeiou]")
    .replaceAll("C", "[bcdfgjklmnprstvxz]")
    .replaceAll("?", ".")
    .replaceAll(/\*+/g, ".*");
  return new RegExp("^" + reBody + "$", "i");
}

function go() {
  const search = document.getElementById("search");
  const lujvoResult = document.getElementById("lujvo_result");

  let trimmed = search.value.trim();
  lujvoResult.innerHTML = "";
  if (!trimmed) {
    document.getElementById("results").replaceChildren();
    shownKey = "";
    showMoreResults = () => false;
    window.history.replaceState(null, null, "?" + lang);
    return;
  }
  window.history.replaceState(null, null, "?" + lang + "#" + trimmed);
  if (!jvs) return; // setLang searches again once the dictionary arrives
  trimmed = trimmed.replaceAll("’", "'");
  const natural = trimmed.replace(/[^\s\p{L}\d'\-]/gu, "").toLowerCase();
  const apostrophized = natural.replaceAll("h", "'");
  const words = natural.split(/\s+/);
  const lex = { ja: natural, en: `\\b${natural}e?s?\\b` };
  const whole = new RegExp(lex[lang] ?? `\\b${natural}\\b`, "ui");
  const full =
    matchPartial && lang !== "ja" ? new RegExp(`\\b${natural}`, "ui") : whole;
  const x1is = new RegExp("1\\}?\\$ (is (a |[$x2_{} ]+|[a-z/ ]+)?)?" + natural);
  const isGlob = /^[?*VCa-z']+$/.test(trimmed) && /[?*VC]/.test(trimmed);
  const globRe = isGlob ? makeGlobRegex(trimmed) : undefined;
  const isSelmahoQuery = /^[A-Z][A-Zabch0-9*]*$/.test(trimmed) && !isGlob;
  const [lujvoParts, lujvoInfo, lujvoWord] = analyzeLujvo(words);
  lujvoResult.innerHTML = lujvoInfo;
  if (lujvoWord) words.unshift(lujvoWord);
  let results = [];
  for (const entry of jvs) {
    const [lemma, type, selmaho, votes, definition] = entry;
    let score = 0;
    let i = -1;
    let j = -1;
    if (votes < -1) continue; // really bad words
    if (lemma.length > 70) continue; // joke words
    const inLemma =
      !isGlob && (lemma.includes(natural) || lemma.includes(apostrophized));
    const matches = isSelmahoQuery
      ? selmaho &&
        (trimmed === selmaho || trimmed === selmaho.replaceAll(/[\d*]/g, ""))
      : isGlob
      ? globRe.test(lemma)
      : (i = words.indexOf(lemma)) > -1 ||
        (j = lujvoParts.indexOf(lemma)) > -1 ||
        inLemma ||
        full.test(definition);
    if (matches) {
      if (isSelmahoQuery) {
        score = /\*/.test(selmaho) ? 70000 : 71000;
      } else if (i > -1) {
        score = 90000 - i;
      } else if (j > -1) {
        score = 80000 - j;
      } else {
        if (definition.length > 400) score -= 100;
        if (type >= 9 && type <= 12) score -= 100; // obsolete
        if (inLemma) score += 5;
        if (x1is.test(definition)) score += 7;
        if (lemma === natural || lemma === apostrophized) score += 100;
        if (whole.test(lemma)) score += 8;
        if (whole.test(definition)) score += 8;
        if (gismuRegex.test(lemma)) score += type === 5 ? 1 : 5;
        score += Math.min(votes, 5);
      }
      results.push([score, entry]);
    }
  }
  results.sort((a, b) => b[0] - a[0]);
  const list = document.getElementById("results");
  const render = (from, to) =>
    renderResults(
      results.slice(from, to),
      isGlob || isSelmahoQuery ? undefined : full,
      gismuRegex.test(natural) ? natural : undefined
    );
  // Redraws of the same search (e.g. when notes arrive) keep what's loaded.
  const key = lang + matchPartial + "#" + trimmed;
  const count = key === shownKey ? shownCount : RESULT_BATCH;
  shownKey = key;
  shownCount = Math.min(count, results.length);
  list.replaceChildren(...render(0, shownCount));
  showMoreResults = () => {
    if (shownCount >= results.length) return false;
    list.append(...render(shownCount, shownCount + RESULT_BATCH));
    shownCount = Math.min(shownCount + RESULT_BATCH, results.length);
    return true;
  };
  fillPage();
}

function bindOption(id, key, apply) {
  const box = document.getElementById(id);
  box.checked = lget(key) === "on";
  apply(box.checked);
  box.addEventListener("change", () => {
    lset(key, box.checked ? "on" : "off");
    apply(box.checked);
  });
}

function fillPage() {
  const margin = 1500;
  const bottom = () => document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  while (bottom() < margin && showMoreResults());
}

const themeIcons = {
  sun: '<circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  moon: '<path fill="currentColor" d="M21.5 14.5A10 10 0 1 1 9.5 2.5a8 8 0 0 0 12 12z"/>',
};

function setDark(dark) {
  lset("theme", dark ? "dark" : "light");
  const icon = dark ? "moon" : "sun";
  const html = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${themeIcons[icon]}</svg>`;
  document.getElementById("lightswitch").innerHTML = html;
  document.body.className = dark ? "dark" : "";
}

function setSearchFromHistory() {
  const query = decodeURIComponent(location.href.split("#")[1] || "");
  return (document.getElementById("search").value = query);
}

function setLang(newLang) {
  const search = document.getElementById("search");

  lang = langs.includes(newLang) ? newLang : "en";
  window.history.replaceState(null, null, "?" + lang);
  lset("lang", lang);
  search.placeholder = "loading...";
  search.focus();
  jvs = undefined;
  notes = {};
  const requested = lang;
  fetch(`./jvs-${lang}.json`, {
    headers: { accept: "application/json; charset=utf8;" },
  })
    .then((res) => res.json())
    .then((data) => {
      if (lang !== requested) return;
      jvs = data;
      search.placeholder = "sisyvla";
      go();
      return fetch(`./notes-${requested}.json`);
    })
    .then((res) => res && res.json())
    .then((data) => {
      if (!data || lang !== requested) return;
      notes = data;
      go();
    })
    .catch(() => {});
  for (const e of document.getElementsByClassName("lang")) {
    e.className =
      lang === e.attributes["data-lang"].value ? "lang active" : "lang";
  }
}

let goInterval = undefined;
function goDebounced() {
  window.clearTimeout(goInterval);
  goInterval = window.setTimeout(go, 15);
}

window.addEventListener("DOMContentLoaded", () => {
  setDark(getTheme() === "dark");
  setTimeout(() => {
    document.body.style.transition = "color 0.2s,background-color 0.2s";
  }, 0);
  document.getElementById("lightswitch").addEventListener("click", () => {
    setDark(document.body.className !== "dark");
  });

  fetch("./etymo.json", {
    headers: { accept: "application/json; charset=utf8;" },
  })
    .then((res) => res.json())
    .then((data) => {
      etymo = data;
      if (jvs) go();
    })
    .catch(() => {});

  fetch("./boxnotes.json")
    .then((res) => res.json())
    .then((data) => {
      boxnotes = data;
      if (jvs) go();
    })
    .catch(() => {});

  setSearchFromHistory();
  setLang(window.location.search.replace("?", "") || lget("lang") || "en");
  bindOption("show_notes", "notes", (on) => {
    document.getElementById("results").classList.toggle("no-notes", !on);
    fillPage();
  });
  bindOption("match_partial", "partial", (on) => {
    matchPartial = on;
    go();
  });
  document.getElementById("search").addEventListener("input", goDebounced);
  window.addEventListener("scroll", fillPage, { passive: true });
  window.addEventListener("resize", fillPage);
  window.addEventListener("popstate", () => (setSearchFromHistory(), go()));

  for (const e of document.getElementsByClassName("lang")) {
    e.addEventListener("click", () => {
      setLang(e.attributes["data-lang"].value);
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js");
  }
});
