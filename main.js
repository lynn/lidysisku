const langs = ["en", "ja", "jbo"];

const gismuRegex =
  /^([bcdfghjklmnprstvxz][aeiou][bcdfghjklmnprstvxz][bcdfghjklmnprstvxz][aeiou]|[bcdfghjklmnprstvxz][bcdfghjklmnprstvxz][aeiou][bcdfghjklmnprstvxz][aeiou])$/;

const wordTypes = [
  "bu-letteral",
  "cmavo",
  "cmavo-compound",
  "cmevla",
  "experimental cmavo",
  "experimental gismu",
  "fu'ivla",
  "gismu",
  "lujvo",
  "obsolete cmavo",
  "obsolete cmevla",
  "obsolete fu'ivla",
  "obsolete zei-lujvo",
  "zei-lujvo",
];

let lang = "en";

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

const getTheme = () => lget("theme") ?? (prefersDark ? "dark" : "light");

function queryLink(query) {
  const a = document.createElement("a");
  a.appendChild(document.createTextNode(query));
  a.href = "#" + encodeURIComponent(query);
  return a;
}

function jvsLink(lemma, votes) {
  const a = document.createElement("a");
  a.href = "https://jbovlaste.lojban.org/dict/" + lemma;
  a.className = "jvs";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.innerText =
    votes > 999 ? "official" : votes >= 0 ? "+" + votes : "−" + -votes;
  return a;
}

function renderResults(results, mark) {
  return results.flatMap((e) => {
    const dt = document.createElement("dt");
    const [lemma, type, selmaho, votes, definition] = e[1];
    const rafsi = RAFSI.get(lemma) ?? [];
    const obsolete = type >= 9 && type <= 12;
    let extra =
      (type === 4 || type === 5 ? "*" : "") +
      (rafsi.length ? " " + rafsi.join(" ") : "");
    const lemmaLink = queryLink(lemma);
    if (obsolete) {
      lemmaLink.className = "obsolete";
    }
    dt.appendChild(lemmaLink);
    if (extra) {
      const i = document.createElement("i");
      i.appendChild(document.createTextNode(extra));
      dt.appendChild(i);
    }
    if (selmaho) {
      const a = document.createElement("a");
      a.className = "selmaho";
      a.href = "#" + selmaho;
      a.appendChild(document.createTextNode(selmaho));
      dt.appendChild(a);
    }
    dt.appendChild(jvsLink(lemma, votes));
    const dd = document.createElement("dd");
    dd.appendChild(document.createTextNode(definition));
    if (mark) dd.innerHTML = dd.innerHTML.replace(mark, "<mark>$&</mark>");
    dd.innerHTML = dd.innerHTML.replace(
      /([\$=])([a-z]+)_?\{?(\d+)\}?\$?/g,
      (_, v, w, d) => `${v === "=" ? "=" : ""}<i>${w}</i><sub>${d}</sub>`
    );
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
      console.log(e);
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
    window.history.replaceState(null, null, "?" + lang);
    return;
  }
  window.history.replaceState(null, null, "?" + lang + "#" + trimmed);
  trimmed = trimmed.replaceAll("’", "'");
  const natural = trimmed.replace(/[^\s\p{L}\d'\-]/gu, "").toLowerCase();
  const apostrophized = natural.replaceAll("h", "'");
  const words = natural.split(/\s+/);
  const lex = { ja: natural, en: `\\b${natural}e?s?\\b` };
  const full = new RegExp(lex[lang] ?? `\\b${natural}\\b`, "ui");
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
        if (full.test(lemma)) score += 8;
        if (full.test(definition)) score += 8;
        if (gismuRegex.test(lemma)) score += type === 5 ? 1 : 5;
        score += Math.min(votes, 5);
      }
      results.push([score, entry]);
    }
  }
  results.sort((a, b) => b[0] - a[0]);
  if (!isSelmahoQuery && results.length > 100) {
    results.length = 100;
  }
  document
    .getElementById("results")
    .replaceChildren(
      ...renderResults(results, isGlob || isSelmahoQuery ? undefined : full)
    );
}

function setDark(dark) {
  lset("theme", dark ? "dark" : "light");
  const icon = dark ? "moon" : "sun";
  const html = `<i class="fa-solid fa-fw fa-${icon}"></i>`;
  document.getElementById("lightswitch").innerHTML = html;
  document.body.className = dark ? "dark" : "";
}

function searchFor(query) {
  const search = document.getElementById("search");
  search.value = query;
  go();
  search.focus();
}

window.addEventListener("DOMContentLoaded", () => {
  let interval = undefined;
  setDark(getTheme() === "dark");
  setTimeout(() => {
    document.body.style.transition = "color 0.2s,background-color 0.2s";
  }, 0);
  document.getElementById("lightswitch").addEventListener("click", () => {
    setDark(document.body.className !== "dark");
  });

  const search = document.getElementById("search");
  document
    .getElementById("clear")
    .addEventListener("click", () => searchFor(""));

  function setSearchFromHistory() {
    return (search.value = decodeURIComponent(
      location.href.split("#")[1] || ""
    ));
  }
  function setLang(newLang) {
    const query = setSearchFromHistory();

    lang = langs.includes(newLang) ? newLang : "en";
    window.history.replaceState(null, null, "?" + lang);
    lset("lang", lang);
    search.placeholder = "loading...";
    search.disabled = true;
    fetch(`./jvs-${lang}.json`, {
      headers: { accept: "application/json; charset=utf8;" },
    })
      .then((res) => res.json())
      .then((data) => {
        jvs = data;
        search.value = query;
        search.placeholder = "sisyvla";
        search.disabled = false;
        go();
        search.focus();
      });
    for (const e of document.getElementsByClassName("lang")) {
      e.className =
        lang === e.attributes["data-lang"].value ? "lang active" : "lang";
    }
  }

  const fromParam = window.location.search.replace("?", "");
  setLang(fromParam || lget("lang") || "en");
  function goDebounced() {
    window.clearTimeout(interval);
    interval = window.setTimeout(go, 15);
  }
  search.addEventListener("input", goDebounced);
  window.addEventListener("popstate", () => (setSearchFromHistory(), go()));

  for (const e of document.getElementsByClassName("lang")) {
    e.addEventListener("click", () => {
      setLang(e.attributes["data-lang"].value);
    });
  }

  // if ("serviceWorker" in navigator) {
  //   let registration;
  //   const registerServiceWorker = async () => {
  //     registration = await navigator.serviceWorker.register(
  //       "./service-worker.js"
  //     );
  //   };
  //   registerServiceWorker();
  // }
});
