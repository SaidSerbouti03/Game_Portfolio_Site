// ══════════════════════════════════════════
// CV VIEWER — shows a PDF inside the page, with zoom, print
// and download, like the PDF viewers on other sites.
//
// Needs  js/vendor/pdf.min.js  (pdf.js, Apache-2.0) loaded first.
// The worker file (pdf.worker.min.js) is found next to it.
//
// Markup (see snippets/about-cv-section.html):
//   <section class="cv-viewer" id="cv"
//            data-pdf="../assets/cv-said-serbouti.pdf"
//            data-heading="Resume"
//            data-filename="Said-Serbouti-CV.pdf"></section>
// ══════════════════════════════════════════

(function () {
  var viewers = document.querySelectorAll('.cv-viewer[data-pdf]');
  if (!viewers.length) return;

  var ZOOM_MIN = 0.6;
  var ZOOM_MAX = 3;
  var ZOOM_STEP = 0.2;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(label, className, ariaLabel) {
    var b = el('button', className, label);
    b.type = 'button';
    if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
    return b;
  }

  // If anything fails, the visitor still gets a way to read the CV,
  // and the message says why (the details also go to the console).
  function showFallback(root, url, reason) {
    root.textContent = '';
    var p = el('p', 'cv-status');
    p.appendChild(document.createTextNode((reason || 'The CV could not be displayed here.') + ' '));
    var link = el('a', null, 'Open the PDF');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    p.appendChild(link);
    root.appendChild(p);
  }

  function explain(error, url) {
    if (window.location.protocol === 'file:') {
      return 'This page was opened as a local file, and browsers block PDFs there. ' +
             'Open the site through a local server (for example VS Code Live Server).';
    }
    if (error && error.name === 'MissingPDFException') {
      return 'The PDF file was not found at ' + url + '. Check the file name and the assets folder.';
    }
    return 'The PDF could not be loaded' + (error && error.message ? ' (' + error.message + ').' : '.');
  }

  function init(root) {
    var url = root.dataset.pdf;

    if (typeof pdfjsLib === 'undefined') {
      console.error('[cv-viewer] pdf.js not loaded: check that js/vendor/pdf.min.js exists and is linked before cv-viewer.js');
      showFallback(root, url, 'The PDF viewer library is missing (js/vendor/pdf.min.js).');
      return;
    }

    // The worker lives in the same folder as pdf.min.js
    var libScript = document.querySelector('script[src$="pdf.min.js"]');
    if (libScript) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = libScript.src.replace('pdf.min.js', 'pdf.worker.min.js');
    }

    // ── Build the viewer ──
    root.textContent = '';

    if (root.dataset.heading) {
      root.appendChild(el('h3', 'cv-viewer__heading', root.dataset.heading));
    }

    var toolbar = el('div', 'cv-toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'CV viewer controls');

    var zoomOut = button('−', 'cv-btn cv-btn--icon', 'Zoom out');
    var zoomLabel = el('span', 'cv-zoom-label', '100%');
    zoomLabel.setAttribute('aria-live', 'polite');
    var zoomIn = button('+', 'cv-btn cv-btn--icon', 'Zoom in');
    var fit = button('Fit width', 'cv-btn', 'Fit to width');
    var count = el('span', 'cv-count');
    var spacer = el('span', 'cv-spacer');
    var print = button('Print', 'cv-btn', 'Print the CV');

    var download = el('a', 'cv-btn', 'Download');
    download.href = url;
    download.setAttribute('download', root.dataset.filename || '');

    [zoomOut, zoomLabel, zoomIn, fit, count, spacer, print, download].forEach(function (node) {
      toolbar.appendChild(node);
    });

    var pagesEl = el('div', 'cv-pages');
    pagesEl.setAttribute('role', 'document');
    pagesEl.setAttribute('aria-label', 'Curriculum vitae');
    var status = el('p', 'cv-status', 'Loading CV…');
    pagesEl.appendChild(status);

    root.appendChild(toolbar);
    root.appendChild(pagesEl);

    // ── Zoom: pages are drawn once, zoom only changes their CSS width ──
    var zoom = 1;

    function setZoom(value) {
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
      pagesEl.style.setProperty('--cv-zoom', zoom);
      zoomLabel.textContent = Math.round(zoom * 100) + '%';
      zoomOut.disabled = zoom <= ZOOM_MIN;
      zoomIn.disabled = zoom >= ZOOM_MAX;
    }

    zoomOut.addEventListener('click', function () { setZoom(zoom - ZOOM_STEP); });
    zoomIn.addEventListener('click', function () { setZoom(zoom + ZOOM_STEP); });
    fit.addEventListener('click', function () { setZoom(1); });
    print.addEventListener('click', function () { window.print(); });
    setZoom(1);

    // ── Draw the pages ──
    pdfjsLib.getDocument(url).promise.then(function (pdf) {
      count.textContent = pdf.numPages + (pdf.numPages === 1 ? ' page' : ' pages');

      // Drawn once at a fixed, sharp width: enough for zoom and for printing
      var pixelWidth = pdf.numPages > 4 ? 1600 : 2400;
      var jobs = [];

      for (var n = 1; n <= pdf.numPages; n++) {
        jobs.push(drawPage(pdf, n, pixelWidth));
      }

      return Promise.all(jobs).then(function (canvases) {
        pagesEl.textContent = '';
        canvases.forEach(function (canvas) { pagesEl.appendChild(canvas); });
      });
    }).catch(function (error) {
      console.error('[cv-viewer]', error);
      showFallback(root, url, explain(error, url));
    });
  }

  function drawPage(pdf, number, pixelWidth) {
    return pdf.getPage(number).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: pixelWidth / base.width });

      var canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'CV, page ' + number + ' of ' + pdf.numPages);

      return page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
      }).promise.then(function () { return canvas; });
    });
  }

  viewers.forEach(init);
})();