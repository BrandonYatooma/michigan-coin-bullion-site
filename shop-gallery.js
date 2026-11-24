/* ==========================================================================
   Shop photo viewer
   Shopify's Buy Button only shows each coin's first photo and doesn't let
   visitors enlarge it. This script makes every coin photo clickable: it
   opens a full-screen viewer with ALL of that coin's photos from Shopify,
   arrows/thumbnails to switch between them, and click-to-zoom.
   It reads photos straight from your Shopify collection, so new photos you
   upload in Shopify show up here automatically.
   ========================================================================== */
(function () {
  var SHOP_DOMAIN = '1jnh9c-ig.myshopify.com';
  var STOREFRONT_TOKEN = '1f175549d043d404518b486874dedbf8';
  var COLLECTION_ID = '290906734650';

  var photosByTitle = {};   // "1885-CC Morgan Dollar..." -> [{src, alt}]
  var photosLoaded = false;

  /* ---------------------------------------------------------------- styles */
  var css = '' +
    '.mcb-lb{position:fixed;inset:0;z-index:2147483000;background:rgba(3,20,48,.94);display:none;flex-direction:column;align-items:center;justify-content:center;padding:56px 16px 16px;}' +
    '.mcb-lb.open{display:flex;}' +
    '.mcb-lb__title{position:absolute;top:16px;left:20px;right:70px;color:#f7f5ef;font-family:"Roboto Slab",Georgia,serif;font-size:1.05rem;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.mcb-lb__stage{position:relative;flex:1;width:100%;max-width:1100px;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0;}' +
    '.mcb-lb__img{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in;transition:transform .2s ease;user-select:none;-webkit-user-drag:none;background:#fff;}' +
    '.mcb-lb__img.zoomed{cursor:zoom-out;transform:scale(2.5);transition:none;}' +
    '.mcb-lb__btn{position:absolute;background:rgba(247,245,239,.12);border:1px solid rgba(217,178,76,.5);color:#f7f5ef;width:48px;height:48px;border-radius:50%;font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;}' +
    '.mcb-lb__btn:hover{background:rgba(184,145,47,.35);}' +
    '.mcb-lb__close{top:10px;right:14px;}' +
    '.mcb-lb__prev{left:6px;top:50%;transform:translateY(-50%);}' +
    '.mcb-lb__next{right:6px;top:50%;transform:translateY(-50%);}' +
    '.mcb-lb__thumbs{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;justify-content:center;}' +
    '.mcb-lb__thumb{width:64px;height:64px;object-fit:cover;border:2px solid transparent;opacity:.6;cursor:pointer;background:#fff;}' +
    '.mcb-lb__thumb.active{border-color:#d9b24c;opacity:1;}' +
    '.mcb-lb__hint{color:#8fa0bd;font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;margin-top:10px;}' +
    '@media (max-width:600px){.mcb-lb__prev,.mcb-lb__next{width:40px;height:40px;font-size:22px;}.mcb-lb__thumb{width:52px;height:52px;}}';
  var styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  /* ---------------------------------------------------------------- viewer */
  var lb = document.createElement('div');
  lb.className = 'mcb-lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Coin photos');
  lb.innerHTML =
    '<div class="mcb-lb__title"></div>' +
    '<button class="mcb-lb__btn mcb-lb__close" aria-label="Close photos">&times;</button>' +
    '<div class="mcb-lb__stage">' +
      '<button class="mcb-lb__btn mcb-lb__prev" aria-label="Previous photo">&#8249;</button>' +
      '<img class="mcb-lb__img" alt="">' +
      '<button class="mcb-lb__btn mcb-lb__next" aria-label="Next photo">&#8250;</button>' +
    '</div>' +
    '<div class="mcb-lb__thumbs"></div>' +
    '<div class="mcb-lb__hint">Click photo to zoom</div>';
  document.body.appendChild(lb);

  var lbTitle = lb.querySelector('.mcb-lb__title');
  var lbImg = lb.querySelector('.mcb-lb__img');
  var lbThumbs = lb.querySelector('.mcb-lb__thumbs');
  var lbPrev = lb.querySelector('.mcb-lb__prev');
  var lbNext = lb.querySelector('.mcb-lb__next');
  var lbStage = lb.querySelector('.mcb-lb__stage');
  var current = [], index = 0, lastFocus = null;

  function show(i) {
    index = (i + current.length) % current.length;
    lbImg.classList.remove('zoomed');
    lbImg.style.transformOrigin = '';
    var photo = current[index];
    lbImg.alt = photo.alt || lbTitle.textContent;
    // Show a quick preview right away, then swap in the sharp version once it has downloaded.
    lbImg.src = photo.preview || photo.src;
    var want = index;
    var sharp = new Image();
    sharp.onload = function () { if (index === want && lb.classList.contains('open')) lbImg.src = sharp.src; };
    sharp.src = photo.large || photo.src;
    var thumbs = lbThumbs.children;
    for (var t = 0; t < thumbs.length; t++) thumbs[t].classList.toggle('active', t === index);
    var many = current.length > 1;
    lbPrev.style.display = lbNext.style.display = many ? '' : 'none';
    lbThumbs.style.display = many ? '' : 'none';
  }

  function open(title, photos, startIndex) {
    current = photos;
    lbTitle.textContent = title;
    lbThumbs.innerHTML = '';
    photos.forEach(function (p, i) {
      var th = document.createElement('img');
      th.className = 'mcb-lb__thumb';
      th.src = p.thumb || p.src;
      th.alt = 'Photo ' + (i + 1);
      th.tabIndex = 0;
      th.addEventListener('click', function () { show(i); });
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter') show(i); });
      lbThumbs.appendChild(th);
    });
    lastFocus = document.activeElement;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(startIndex || 0);
    lb.querySelector('.mcb-lb__close').focus();
  }

  function close() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.classList.remove('zoomed');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  lb.querySelector('.mcb-lb__close').addEventListener('click', close);
  lbPrev.addEventListener('click', function () { show(index - 1); });
  lbNext.addEventListener('click', function () { show(index + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbStage) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });

  // Click to zoom in where you clicked; move the mouse to look around; click again to zoom out.
  function setOrigin(e) {
    var r = lbImg.getBoundingClientRect();
    var x = ((e.clientX - r.left) / r.width) * 100;
    var y = ((e.clientY - r.top) / r.height) * 100;
    lbImg.style.transformOrigin = Math.max(0, Math.min(100, x)) + '% ' + Math.max(0, Math.min(100, y)) + '%';
  }
  lbImg.addEventListener('click', function (e) {
    if (lbImg.classList.contains('zoomed')) { lbImg.classList.remove('zoomed'); return; }
    setOrigin(e);
    lbImg.classList.add('zoomed');
  });
  lbImg.addEventListener('mousemove', function (e) {
    if (lbImg.classList.contains('zoomed')) setOrigin(e);
  });

  // Swipe left/right on phones
  var touchX = null;
  lbStage.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lbStage.addEventListener('touchend', function (e) {
    if (touchX === null || lbImg.classList.contains('zoomed')) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  /* ---------------------------------------------------- load photos from Shopify */
  function sizedUrl(src, size) {
    // Shopify CDN: add _{size} before the extension for a smaller thumbnail
    return src.replace(/(\.(?:jpe?g|png|gif|webp))(\?|$)/i, '_' + size + '$1$2');
  }

  function loadPhotos() {
    if (photosLoaded || !window.ShopifyBuy || !window.ShopifyBuy.buildClient) return;
    photosLoaded = true;
    var client = window.ShopifyBuy.buildClient({ domain: SHOP_DOMAIN, storefrontAccessToken: STOREFRONT_TOKEN });
    var gid = 'gid://shopify/Collection/' + COLLECTION_ID;
    client.collection.fetchWithProducts(gid, { productsFirst: 250 }).then(function (collection) {
      (collection && collection.products || []).forEach(function (product) {
        photosByTitle[product.title.trim()] = (product.images || []).map(function (img) {
          var src = img.src || img.url;
          return {
            src: src,
            preview: sizedUrl(src, '600x600'),
            large: sizedUrl(src, '2048x2048'),   // sharp enough to zoom, much smaller than the original
            thumb: sizedUrl(src, '160x160'),
            alt: img.altText || product.title
          };
        });
      });
    }).catch(function () { photosLoaded = false; });
  }

  /* ------------------------------------- make the coin photos in Shopify's cards clickable */
  function photosFor(card, clickedImg) {
    var titleEl = card && card.querySelector('.shopify-buy__product__title');
    var title = (titleEl ? titleEl.textContent : clickedImg.alt || '').trim();
    var photos = photosByTitle[title];
    if (!photos || !photos.length) {
      // Fallback (photos still loading): show the card's own photo, full size
      var full = clickedImg.src.replace(/_\d+x\d+(\.(?:jpe?g|png|gif|webp))/i, '$1');
      photos = [{ src: full, preview: clickedImg.src, large: sizedUrl(full, '2048x2048'), thumb: clickedImg.src, alt: title }];
    }
    return { title: title, photos: photos };
  }

  function hookFrame(frame) {
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body || doc.__mcbHooked) return;
    doc.__mcbHooked = true;

    var s = doc.createElement('style');
    s.textContent = '.shopify-buy__product-img-wrapper img{cursor:zoom-in;transition:opacity .15s ease;}' +
                    '.shopify-buy__product-img-wrapper img:hover{opacity:.88;}';
    (doc.head || doc.body).appendChild(s);

    doc.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.shopify-buy__product-img-wrapper img, .shopify-buy__product-img-wrapper');
      if (!img) return;
      if (img.tagName !== 'IMG') img = img.querySelector('img');
      if (!img) return;
      e.preventDefault();
      e.stopPropagation();
      var card = img.closest('.shopify-buy__product');
      var info = photosFor(card, img);
      open(info.title, info.photos, 0);
    }, true);
  }

  function scan() {
    loadPhotos();
    var frames = document.querySelectorAll('iframe[name^="frame-productSet"], iframe[name^="frame-product-"]');
    for (var i = 0; i < frames.length; i++) hookFrame(frames[i]);
  }

  // Shopify builds its cards after the page loads (and again when paging), so keep checking.
  setInterval(scan, 700);
  scan();
})();
