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

function setDark(dark) {
  const sunOrMoon = dark ? "moon" : "sun";
  document.getElementById("lightswitch").innerHTML = 
    `<i class="fa-solid fa-fw fa-${sunOrMoon}"></i>`;
  document.body.className = dark ? "dark" : "";
  localStorage.setItem("theme", dark ? "dark" : "light");
}

window.addEventListener("DOMContentLoaded", () => {
  let lang = "en";
  let interval = undefined;

  const theme =
    localStorage.getItem("theme") ??
    (window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  setDark(theme === "dark");
  setTimeout(() => {
    document.body.style.transition = "color 0.2s,background-color 0.2s";
  }, 0);
  document.getElementById("lightswitch").addEventListener("click", () => {
    setDark(document.body.className !== "dark");
  });
  const search = document.getElementById("search");
  const lujvoResult = document.getElementById("lujvo_result");
  document.getElementById("clear").addEventListener("click", () => {
    search.value = "";
    go();
    search.focus();
  });

  function go() {
    const trimmed = search.value.trim();
    lujvoResult.innerHTML = "";
    if (!trimmed) {
      document.getElementById("results").replaceChildren();
      window.history.replaceState(null, null, "?" + lang);
      return;
    }
    window.history.replaceState(null, null, "?" + lang + "#" + trimmed);
    const noU2019 = trimmed.replaceAll("’", "'");
    const natural = noU2019.replace(/[^\s\p{L}\d'\-]/gu, "").toLowerCase();
    const apostrophized = natural.replaceAll("h", "'");
    const words = natural.split(/\s+/);
    const specialPatterns = { ja: natural, en: `\\b${natural}e?s?\\b` };
    const full = new RegExp(specialPatterns[lang] ?? `\\b${natural}\\b`, "ui");
    const x1isMatch = new RegExp(
      "1\\}?\\$ (is (a |[$x2_{} ]+|[a-z/ ]+)?)?" + natural
    );
    let lujvoParts = [];
    let results = [];
    const isSelmahoQuery =
      /^[A-Zh0-9*]+$/.test(trimmed) && !/^[?*VC]+$/.test(trimmed);
    const isGlob = /[?*VC]/.test(trimmed);
    if (!isSelmahoQuery && !isGlob) {
      if (words.length === 1) {
        const selrafsi = searchSelrafsiFromRafsi(apostrophized);
        if (selrafsi) {
          lujvoResult.innerHTML = "← " + selrafsi;
        } else {
          try {
            lujvoParts = getVeljvo(apostrophized);
            lujvoResult.innerHTML = "← " + lujvoParts.join(" ");
          } catch (e) {
            lujvoParts = [];
            lujvoResult.innerHTML = "";
          }
        }
      } else if (words.length > 1) {
        try {
          const [lujvo, _] = getLujvo(words);
          lujvoResult.innerHTML = "→ " + lujvo;
          words.unshift(lujvo);
        } catch (e) {
          lujvoResult.innerHTML = "";
        }
      }
    }
    let globRe = undefined;
    if (isGlob) {
      const reBody = trimmed
        .replaceAll("V", "[aeiou]")
        .replaceAll("C", "[bcdfgjklmnprstvxz]")
        .replaceAll("?", ".")
        .replaceAll(/\*+/g, ".*");
      globRe = new RegExp("^" + reBody + "$", "i");
    }
    for (const entry of jvs) {
      const [lemma, type, definition] = entry;
      let score = 0;
      let i = -1;
      let j = -1;
      if (lemma.length > 70) continue; // joke words
      const inLemma =
        !isGlob && (lemma.includes(natural) || lemma.includes(apostrophized));
      const matches = isSelmahoQuery
        ? typeof type === "string" &&
          (trimmed === type || trimmed === type.replaceAll(/[\d*]/g, ""))
        : isGlob
        ? globRe.test(lemma)
        : (i = words.indexOf(lemma)) > -1 ||
          (j = lujvoParts.indexOf(lemma)) > -1 ||
          inLemma ||
          full.test(definition);
      if (matches) {
        if (isSelmahoQuery) {
          score = /\*/.test(type) ? 70000 : 71000;
        } else if (i > -1) {
          score = 90000 - i;
        } else if (j > -1) {
          score = 80000 - j;
        } else {
          if (definition.length > 400) score -= 100;
          if (type >= 9 && type <= 12) score -= 100; // obsolete
          if (inLemma) score += 5;
          if (x1isMatch.test(definition)) score += 7;
          if (lemma === natural || lemma === apostrophized) score += 100;
          if (full.test(lemma)) score += 8;
          if (full.test(definition)) score += 8;
          if (gismuRegex.test(lemma)) score += type === 5 ? 1 : 5;
        }
        results.push([score, entry]);
      }
    }
    results.sort((a, b) => b[0] - a[0]);
    if (!isSelmahoQuery && results.length > 100) {
      results.length = 100;
    }
    document.getElementById("results").replaceChildren(
      ...results.flatMap((e) => {
        const dt = document.createElement("dt");
        const [lemma, type, definition] = e[1];
        const rafsi = RAFSI.get(lemma) ?? [];
        const obsolete = type >= 9 && type <= 12;
        let extra =
          (type === 4 || type === 5 ? "*" : "") +
          (rafsi.length ? " → " + rafsi.join(" ") : "");
        const lemmaLink = document.createElement("a");
        lemmaLink.href = "#" + lemma;
        lemmaLink.appendChild(document.createTextNode(lemma));
        if (obsolete) {
          lemmaLink.className = "obsolete";
        }
        dt.appendChild(lemmaLink);
        if (extra) {
          const i = document.createElement("i");
          i.appendChild(document.createTextNode(extra));
          dt.appendChild(i);
        }
        if (typeof type === "string") {
          const a = document.createElement("a");
          a.className = "selmaho";
          a.href = "#" + type;
          a.appendChild(document.createTextNode(type));
          dt.appendChild(a);
        }
        const jvs = document.createElement("a");
        jvs.href = "https://jbovlaste.lojban.org/dict/" + lemma;
        jvs.target = "_blank";
        jvs.rel = "noopener noreferrer";
        jvs.innerHTML = '<i class="fa-solid fa-square-arrow-up-right"></i>';
        dt.appendChild(jvs);
        const dd = document.createElement("dd");
        dd.appendChild(document.createTextNode(definition));
        if (!isGlob && !isSelmahoQuery)
          dd.innerHTML = dd.innerHTML.replace(full, "<mark>$&</mark>");
        dd.innerHTML = dd.innerHTML.replace(
          /([\$=])(\w+)_\{?(\d+)\}?\$?/g,
          (_, v, w, d) => `${v === "=" ? "=" : ""}<i>${w}</i><sub>${d}</sub>`
        );
        return [dt, dd];
      })
    );
  }
  function setSearchFromHistory() {
    return (search.value = decodeURIComponent(
      location.href.split("#")[1] || ""
    ));
  }
  function setLang(newLang) {
    const query = setSearchFromHistory();

    lang = langs.includes(newLang) ? newLang : "en";
    window.history.replaceState(null, null, "?" + lang);
    localStorage.setItem("lang", lang);
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
  setLang(fromParam ? fromParam : localStorage.getItem("lang") ?? "en");

  function goDebounced() {
    window.clearTimeout(interval);
    interval = window.setTimeout(go, 15);
  }
  search.addEventListener("keyup", goDebounced);
  search.addEventListener("paste", goDebounced);
  window.addEventListener("popstate", () => {
    setSearchFromHistory();
    go();
  });

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
