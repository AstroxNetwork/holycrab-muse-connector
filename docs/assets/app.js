/* Docs behaviour: TOC scroll-spy and copy buttons. No dependencies. */
(function () {
  "use strict";

  // ── Copy buttons on every <pre> ──────────────────────────────────
  document.querySelectorAll("pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.className = "copy";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      var text = pre.querySelector("code");
      text = text ? text.innerText : pre.innerText;
      navigator.clipboard.writeText(text).then(
        function () {
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = "Copy"; }, 1400);
        },
        function () { btn.textContent = "Failed"; }
      );
    });
    pre.appendChild(btn);
  });

  // ── Highlight the section currently in view ──────────────────────
  var links = Array.prototype.slice.call(document.querySelectorAll("nav.toc a"));
  if (!links.length || !("IntersectionObserver" in window)) return;

  var byId = {};
  links.forEach(function (a) {
    var id = a.getAttribute("href").slice(1);
    if (id) byId[id] = a;
  });

  var visible = new Set();
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      // Topmost heading currently on screen wins.
      var first = null;
      Object.keys(byId).forEach(function (id) {
        if (visible.has(id) && !first) first = id;
      });
      if (!first) return;
      links.forEach(function (a) { a.classList.remove("active"); });
      if (byId[first]) byId[first].classList.add("active");
    },
    { rootMargin: "-72px 0px -70% 0px", threshold: 0 }
  );

  Object.keys(byId).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();
