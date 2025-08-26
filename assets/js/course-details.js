(function () {
'use strict';
document.addEventListener("DOMContentLoaded", () => {
  // ==================================
  // 0. CONFIG (غيّر هذه القيم لموقعك)
  // ==================================
  const BRAND_NAME = "Your Brand Name"; // ✏️ غيّر للاسم الحقيقى
  const DOMAIN = "https://your-domain.com".replace(/\/+$/, ''); // ✏️ غيّر للدومين الحقيقى

  // ==================================
  // 1. HELPERS (دوال مساعدة عامة)
  // ==================================

  /**
   * عرض إشعار Toast
   * @param {string} message
   * @param {'danger'|'warning'|'success'|'info'} type
   */
  const showToast = (message, type = 'danger') => {
    const toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      console.error("Toast container not found!");
      return;
    }
    const toastId = `toast-${Date.now()}`;
    const toastHTML = `
      <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`;
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    try {
      const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
      toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
      toast.show();
    } catch (err) {
      console.warn('Bootstrap toast not available:', err);
      // كبديل بسيط نظهر الرسالة في console ثم نمسح العنصر بعد 5s
      setTimeout(() => { if (toastElement) toastElement.remove(); }, 5000);
    }
  };

  /**
   * توليد نجوم التقييم (fallback محلي)
   * يقبل رقم (يمكن تدويره خارجياً) ويعيد HTML لنجوم كاملة/فارغة
   * @param {number} rating
   * @returns {string}
   */
  const renderStars = (rating) => {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      stars += `<span class="bi ${i <= r ? "bi-star-fill text-warning" : "bi-star text-muted"}" aria-hidden="true"></span>`;
    }
    return stars;
  };

  /**
   * Helper لتحديث أو إنشاء meta tags (يدعم name و property)
   * @param {'name'|'property'} attrType
   * @param {string} key
   * @param {string|number} value
   */
  const setMeta = (attrType, key, value) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    const selector = `meta[${attrType}="${key}"]`;
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrType, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', String(value));
  };

  /**
   * تحديث Meta tags و Open Graph و Twitter (لا يضيف مكررات، بل يحدث)
   * @param {object} course
   */
  const updateMetaTags = (course) => {
    if (!course) return;
    document.title = `${course.title} | ${BRAND_NAME}`;
    setMeta('name', 'description', course.description);

    setMeta('property', 'og:title', course.title);
    setMeta('property', 'og:description', course.description);
    setMeta('property', 'og:type', course.price > 0 ? 'product' : 'article');
    setMeta('property', 'og:url', window.location.href);

    const imgPath = course.image && course.image.details ? course.image.details.replace(/^\/+/, '') : 'assets/img/course-fallback';
    const ogImage = `${DOMAIN}/${imgPath}-large.jpg`;
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:site_name', BRAND_NAME);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', course.title);
    setMeta('name', 'twitter:description', course.description);
    setMeta('name', 'twitter:image', ogImage);
  };


/**
 * إضافة JSON-LD 
 * @param {object} course
 * @param {{average:number,count:number}|null} realRatings
 */
const addSchemaMarkup = (course, realRatings = null) => {
  if (!course) return;
  const scriptId = `jsonld-course-${course.id || 'unknown'}`;
  const existing = document.getElementById(scriptId);
  if (existing) existing.remove();

  const imgPath = course.image?.details?.replace(/^\/+/, '') || 'assets/img/course-fallback';
  const imageUrl = `${DOMAIN}/${imgPath}-large.jpg`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": course.title,
    "description": course.description,
    "url": window.location.href,
    "image": imageUrl,
    "datePublished": course.date || undefined,
    "educationalLevel": course.level || undefined,
    "instructor": course.instructor ? { "@type": "Person", "name": course.instructor } : undefined,
    "provider": {
      "@type": "Organization",
      "name": BRAND_NAME,
      "sameAs": DOMAIN
    },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "price": (typeof course.price === 'number' ? course.price.toFixed(2) : undefined),
      "priceCurrency": (typeof course.price === 'number' ? "USD" : undefined),
      "availability": "https://schema.org/OnlineOnly",
      "category": course.category || undefined
    },

  "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "courseWorkload": (course.lessons) ? `PT${Number(course.lessons)}H` : undefined
    },
    "mainEntity": (Array.isArray(course.faq) && course.faq.length > 0) ? {
      "@type": "FAQPage",
      "mainEntity": course.faq.map(item => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer
        }
      }))
    } : undefined
  };

  if (realRatings && Number(realRatings.count) > 0 && Number(realRatings.average) >= 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": Number(Number(realRatings.average).toFixed(2)),
      "bestRating": 5,
      "ratingCount": Number(realRatings.count)
    };
  }

  const cleanSchema = JSON.parse(JSON.stringify(schema));
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = scriptId;
  script.textContent = JSON.stringify(cleanSchema, null, 2);
  document.head.appendChild(script);
};


  /**
   * إضافة سكيما BreadcrumbList ديناميكياً
   * @param {object} course
   */
  const addBreadcrumbSchema = (course) => {
    if (!course) return;
    const scriptId = 'jsonld-breadcrumb';
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove(); // أزل القديم إن وجد

    const homeUrl = new URL('../../index.html', window.location.href).href;
    const coursesUrl = new URL('../index.html', window.location.href).href;

    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": homeUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Courses",
          "item": coursesUrl
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": course.title,
          "item": window.location.href // الرابط الحالي
        }
      ]
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = scriptId;
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  };

  // ==================================
  // 2. PRESENTATION HELPERS (ترطيب أجزاء الواجهة)
  // ==================================

  const renderHeader = (course) => {
    const headerContainer = document.getElementById("course-header");
    if (!headerContainer || !course) return;

    const headerHTML = `
      <div class="text-center border-dark my-2">
        <h1 class="display-4 fw-bold text-warning mb-0">${course.title}</h1>
        <nav class="d-flex flex-column justify-content-between" aria-label="breadcrumb">
          <ol class="breadcrumb justify-content-center py-2 mb-0">
            <li class="breadcrumb-item my-1">
              <a class="text-decoration-none" href="../../index.html">
                <span class="h4 my-1">Home</span>
              </a>
            </li>
            <li class="breadcrumb-item my-1">
              <a class="text-decoration-none" href="../index.html">
                <span class="h4 my-1">Courses</span>
              </a>
            </li>
            <li class="breadcrumb-item active my-1" aria-current="page">
              <span class="text-secondary h4 my-1">${course.title}</span>
            </li>
          </ol>
        </nav>
      </div>
    `;
    headerContainer.innerHTML = headerHTML;
  };

  /**
   * يرطب كل محتوى الصفحة الديناميكي بناءً على بيانات الكورس
   * @param {object} course 
   */
  function hydratePageContent(course) {
    // 1. بطاقة المعلومات الجانبية (Sidebar Card)
    const imageCardContainer = document.getElementById('course-card-image');
    const priceCardContainer = document.getElementById('course-card-price');
    const metaCardContainer = document.getElementById('course-card-meta');
    const fallbackImage = '../../assets/img/course-fallback.jpg';
    const imageDetails = course.image?.details?.replace(/^\/+/, '');
    const imageBase = imageDetails ? `../../${imageDetails}` : null;
    
    if (imageCardContainer) {
      imageCardContainer.innerHTML = imageBase
        ? `<picture>
    <source 
        srcset="${imageBase}-small.webp 800w, ${imageBase}-large.webp 1200w" 
        sizes="(min-width: 1200px) 750px, (min-width: 992px) 630px, 90vw"
        type="image/webp">
    <source 
        srcset="${imageBase}-small.jpg 800w, ${imageBase}-large.jpg 1200w"
        sizes="(min-width: 1200px) 750px, (min-width: 992px) 630px, 90vw"
        type="image/jpeg">
    <img 
        src="${imageBase}-large.jpg" 
        alt="${course.title}" 
        class="img-fluid rounded shadow" 
        width="600" height="400"
        onerror="this.onerror=null; this.src='${fallbackImage}';"
        loading="eager" 
        fetchpriority="high" 
        decoding="async">
</picture>`
        : `<img src="${fallbackImage}" class="card-img-top" alt="${course.title}">`;
    }
    if (priceCardContainer) {
      priceCardContainer.textContent = course.price === 0 ? 'Free' : `$${(Number(course.price) || 0).toFixed(2)}`;
    }
    if (metaCardContainer) {
      metaCardContainer.innerHTML = `
        <li class="mb-2"><span class="bi bi-person-video icon-gold me-2" aria-hidden="true"></span><strong>Instructor:</strong> ${course.instructor || '—'}</li>
        <li class="mb-2"><span class="bi bi-bar-chart-fill icon-gold me-2" aria-hidden="true"></span><strong>Category:</strong> ${course.category || '—'} | <strong>Level:</strong> ${course.level || '—'}</li>
        <li class="mb-2">
          <div class="d-flex flex-wrap align-items-center">
            <span class="me-3 mb-1"><span class="bi bi-people-fill icon-gold me-2" aria-hidden="true"></span> ${Number(course.students || 0).toLocaleString()} Students</span>
            <span class="me-3 mb-1"><span class="bi bi-book-fill icon-gold me-2" aria-hidden="true"></span> ${course.lessons ?? '0'} Lessons</span>
            <span class="mb-1"><strong>Rating:</strong> <span id="rating-display" class="placeholder-glow"><span class="placeholder col-4"></span></span></span>
          </div>
        </li>
        <li class="mb-2"><span class="bi bi-patch-check-fill icon-gold me-2" aria-hidden="true"></span><strong>Last Updated:</strong> ${course.date ? new Date(course.date).toLocaleDateString() : '—'}</li>
      `;
    }

    // 2. ماذا ستتعلم (Learning Objectives)
    const loList = document.getElementById('what-youll-learn-list');
    if (loList) {
      if (Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0) {
        loList.innerHTML = course.learningObjectives.map(item =>
          `<li class="col-md-6 mb-2"><span class="bi bi-check-circle-fill text-success me-2" aria-hidden="true"></span><span>${item}</span></li>`
        ).join('');
      } else {
        loList.closest('section')?.style.setProperty('display', 'none');
      }
    }

    // 3. المنهج (Curriculum)
    const curriculumAccordion = document.getElementById('curriculum-accordion');
    if (curriculumAccordion) {
      if (Array.isArray(course.curriculum) && course.curriculum.length > 0) {
        curriculumAccordion.innerHTML = course.curriculum.map((section, index) => `
          <div class="accordion-item">
            <h3 class="accordion-header">
              <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#section-${index}">${section.title}</button>
            </h3>
            <div id="section-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#curriculum-accordion">
              <div class="accordion-body"><ul class="list-group list-group-flush">${Array.isArray(section.lessons) ? section.lessons.map(lesson => `<li class="list-group-item"><span class="bi bi-play-circle-fill me-2" aria-hidden="true"></span>${lesson}</li>`).join('') : ''}</ul></div>
            </div>
          </div>`).join('');
      } else {
        curriculumAccordion.closest('section')?.style.setProperty('display', 'none');
      }
    }

    // 4. الأسئلة الشائعة (FAQ)
    const faqAccordion = document.getElementById('faq-accordion');
    if (faqAccordion) {
      if (Array.isArray(course.faq) && course.faq.length > 0) {
        faqAccordion.innerHTML = course.faq.map((item, index) => `
          <div class="accordion-item">
            <h3 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq-${index}">${item.question}</button>
            </h3>
            <div id="faq-${index}" class="accordion-collapse collapse" data-bs-parent="#faq-accordion">
              <div class="accordion-body">${item.answer}</div>
            </div>
          </div>`).join('');
      } else {
        faqAccordion.closest('section')?.style.setProperty('display', 'none');
      }
    }
  }

  // ==================================
  // 3. MAIN LOGIC
  // ==================================
  const initializePage = () => {
    // التأكد من وجود بيانات الكورسات (COURSE_DATA) — RatingSystem يمكن أن يُحمّل لاحقاً
    if (typeof COURSE_DATA === 'undefined') {
      console.error("Critical dependency (COURSE_DATA) is missing.");
      showToast('Error loading page components.', 'danger');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const courseIdRaw = params.get("id");
    if (!courseIdRaw) {
      const content = document.getElementById("content");
      if (content) content.innerHTML = '<p class="text-center text-danger">Course ID not specified.</p>';
      showToast('⚠ Course ID not specified.', 'danger');
      return;
    }
    const courseId = parseInt(courseIdRaw, 10);

    // إيجاد الكورس
    const course = COURSE_DATA.courses.find(c => {
      // tolerates numeric id or string numeric
      return Number(c.id) === courseId;
    });

    if (!course) {
      const content = document.getElementById("content");
      if (content) content.innerHTML = '<p class="text-center text-warning">The requested course was not found.</p>';
      showToast('⚠️ The requested course was not found.', 'warning');
      return;
    }

    // --- Render static parts immediately ---
    renderHeader(course);
    updateMetaTags(course);
    addBreadcrumbSchema(course); //  ✅  **استدعاء وظيفة Breadcrumb الجديدة**

    // --- unified hydration (التوجيه الأول) ---
    hydratePageContent(course);

    // لا نضيف JSON-LD الآن - سنضيفه بعد الحصول على تقييمات حقيقية إن وُجدت

    // --- Populate Skeleton / Primary content slots (image, description, meta) ---
    const imageContainer = document.getElementById('course-image-container');
    const descriptionPlaceholder = document.getElementById('course-description-placeholder');
    const metaInfoContainer = document.getElementById('course-meta-info');

    // Image: responsive picture with fallback
    const fallbackImage = '../../assets/img/course-fallback.jpg';
    const imageDetails = course.image && course.image.details ? course.image.details.replace(/^\/+/, '') : null;
    const imageBase = imageDetails ? `../../${imageDetails}` : null;
    if (imageContainer) {
      if (imageBase) {
        imageContainer.innerHTML = `
          <picture>
            <source srcset="${imageBase}-small.webp 800w, ${imageBase}-large.webp 1200w" sizes="(max-width: 991px) 95vw, 50vw" type="image/webp">
            <source srcset="${imageBase}-small.jpg 800w, ${imageBase}-large.jpg 1200w" sizes="(max-width: 991px) 95vw, 50vw" type="image/jpeg">
            <img src="${imageBase}-large.jpg" alt="${course.title}" class="img-fluid rounded shadow" 
                 width="600" height="400"
                 onerror="this.onerror=null; this.src='${fallbackImage}';"
                 loading="eager" fetchpriority="high" decoding="async">
          </picture>
        `;
      } else {
        imageContainer.innerHTML = `<img src="${fallbackImage}" alt="${course.title}" class="img-fluid rounded shadow">`;
      }
    }

    // Description: استخدم textContent لأمان أكبر (إذا تريد دعم HTML، غيرها لاحقاً)
    if (descriptionPlaceholder) {
      descriptionPlaceholder.classList.remove('placeholder-glow');
      descriptionPlaceholder.textContent = course.description || '';
    }

    // Meta Info: students/lessons/rating في نفس السطر (تم تعديلها لكي يظهر التقييم بجانب الأرقام)
    const priceDisplay = Number(course.price) === 0
      ? `<span class="text-success">Free</span>`
      : `<span class="text-success">$${(Number(course.price) || 0).toFixed(2)}</span>`;
    if (metaInfoContainer) {
      const studentsText = course.students ? Number(course.students).toLocaleString() : '0';
      const lessonsText = course.lessons !== undefined ? course.lessons : '0';
      metaInfoContainer.innerHTML = `
        <p class="text-light mb-1"><strong>Instructor:</strong> ${course.instructor || '—'}</p>
        <p class="text-light mb-1"><strong>Category:</strong> ${course.category || '—'} | <strong>Level:</strong> ${course.level || '—'}</p>
        <p class="text-light mb-1">
          <span class="me-3"><span class="bi bi-people-fill icon-gold me-2" aria-hidden="true"></span> ${studentsText} Students</span>
          <span class="me-3"><span class="bi bi-book-fill icon-gold me-2" aria-hidden="true"></span> ${lessonsText} Lessons</span>
          <span><strong>Rating:</strong> <span id="rating-display" class="placeholder-glow"><span class="placeholder col-4"></span></span></span>
        </p>
        <p class="fs-4 fw-bold text-light mb-2">Price: ${priceDisplay}</p>
        <a href="#" class="btn btn-warning btn-lg mt-2" id="enroll-btn">Enroll Now</a>
      `;
    }

    // DOM references for ratings & interactions (بعد أن أنشأنا metaInfoContainer)
    const ratingStarsContainer = document.getElementById('user-rating-stars');
    const ratingDisplay = document.getElementById('rating-display');
    const ratingFeedbackText = document.getElementById('rating-feedback-text');


    // ============================
    //  تجهيز أزرار الشراء الديناميكية (Snipcart)
    // ============================
    const enrollBtn = document.getElementById('enroll-btn');
    const giftBtn = document.getElementById('gift-btn');

    const setupPurchaseButtons = (course) => {

      if (!enrollBtn || !giftBtn) return;

      if (course.price > 0) {
        // --- حالة الكورس المدفوع ---
        const imagePathForCart = course.image?.card?.replace(/^\/+/, '') || 'assets/img/course-fallback';
        const courseImageForCart = `${DOMAIN}/${imagePathForCart}-small.jpg`;

        // 1. جهّز زر الشراء العادي
        enrollBtn.classList.add('snipcart-add-item');
        enrollBtn.setAttribute('data-item-id', course.id);
        enrollBtn.setAttribute('data-item-name', course.title);
        enrollBtn.setAttribute('data-item-price', course.price);
        enrollBtn.setAttribute('data-item-url', window.location.href);
        enrollBtn.setAttribute('data-item-description', course.description);
        enrollBtn.setAttribute('data-item-image', courseImageForCart);


        // 2. جهّز زر الهدية مع خصم محسوب
        giftBtn.classList.add('snipcart-add-item');
        giftBtn.setAttribute('data-item-id', `${course.id}-gift-v2`);
        giftBtn.setAttribute('data-item-name', `${course.title} (Gift)`);
        giftBtn.setAttribute('data-item-price', course.price);
        giftBtn.setAttribute('data-item-url', window.location.href);
        giftBtn.setAttribute('data-item-description', course.description);
        giftBtn.setAttribute('data-item-image', courseImageForCart);
        
        // --- ✅ الحسابات الدقيقة هنا ---
        const DISCOUNT_PERCENTAGE = 20;
        const discountAmount = course.price * (DISCOUNT_PERCENTAGE / 100); // حساب قيمة الخصم
        
        // بناء السلسلة الحسابية الصحيحة
        const priceModifierString = `true[-${discountAmount.toFixed(2)}]`;
        
        giftBtn.setAttribute('data-item-custom1-options', priceModifierString);
        giftBtn.setAttribute('data-item-custom1-name', `Gift Purchase (${DISCOUNT_PERCENTAGE}% off)`);
        
      } else {
        // --- حالة الكورس المجاني ---
        enrollBtn.textContent = 'Start Learning Now';
        enrollBtn.classList.remove('btn-warning');
        enrollBtn.classList.add('btn-success');
        
        giftBtn.style.display = 'none'; // أخفِ زر الهدية
      }
    };

    // استدعاء الوظيفة
    setupPurchaseButtons(course);


    // ============================
    // تحميل التقييمات الحقيقية وتحديث السكيما بعدها
    // ============================
    const loadRealRatings = async () => {
      try {
        if (typeof RatingSystem === 'undefined' || !RatingSystem.fetchRatings) {
          throw new Error('RatingSystem not available');
        }

        const dynamicRatings = await RatingSystem.fetchRatings(courseId);

        if (ratingDisplay) {
          // إزالة placeholder class
          ratingDisplay.className = '';
          if (dynamicRatings && Number(dynamicRatings.count) > 0) {
            const starsHtml = (RatingSystem.renderStars && typeof RatingSystem.renderStars === 'function')
              ? RatingSystem.renderStars(dynamicRatings.average)
              : renderStars(Math.round(dynamicRatings.average));
            ratingDisplay.innerHTML = `${starsHtml} <span class="ms-2">(${dynamicRatings.count} ratings)</span>`;
          } else {
            const starsHtml = (RatingSystem.renderStars && typeof RatingSystem.renderStars === 'function')
              ? RatingSystem.renderStars(0)
              : renderStars(0);
            ratingDisplay.innerHTML = `${starsHtml} <span class="ms-2">(No ratings yet)</span>`;
          }
        }

        // إضافة السكيما (مع aggregateRating إن وُجد)
        addSchemaMarkup(course, (dynamicRatings && Number(dynamicRatings.count) > 0) ? dynamicRatings : null);

      } catch (error) {
        console.warn('Failed to load ratings or RatingSystem unavailable:', error);
        if (ratingDisplay) {
          ratingDisplay.className = '';
          const starsHtml = (typeof RatingSystem !== 'undefined' && RatingSystem.renderStars)
            ? RatingSystem.renderStars(0)
            : renderStars(0);
          ratingDisplay.innerHTML = `${starsHtml} <span class="ms-2">(No ratings yet)</span>`;
        }
        // fallback: سكيما بدون aggregateRating
        addSchemaMarkup(course, null);
      }
    };

    // ============================
    // إعداد النجوم التفاعلية (إن وُجد RatingSystem وإلا نعرض fallback ثابت)
    // ============================
    const setupInteractiveRatings = () => {
      if (!ratingStarsContainer) return;

      // إذا RatingSystem يدعم render & initializeStarEvents، نستخدمها
      if (typeof RatingSystem !== 'undefined' && RatingSystem.renderStars && RatingSystem.initializeStarEvents) {
        // نجوم تفاعلية ابتدائية (تمرير true لتمكين hover/interactive إن كان النظام يدعم ذلك)
        ratingStarsContainer.innerHTML = RatingSystem.renderStars(0, true);

        RatingSystem.initializeStarEvents(ratingStarsContainer, async (ratingValue) => {
          // منع عدة نقرات متزامنة
          ratingStarsContainer.style.pointerEvents = 'none';
          if (ratingFeedbackText) ratingFeedbackText.textContent = 'Submitting your rating...';
          showToast('Submitting your rating...', 'info');

          if (enrollBtn) enrollBtn.setAttribute('aria-disabled', 'true');

          try {
            const result = await RatingSystem.submitRating(courseId, ratingValue);

            if (result && result.status === 'success') {
              showToast('Thank you for your rating!', 'success');
              if (ratingFeedbackText) ratingFeedbackText.textContent = 'Your rating has been submitted!';
              const updatedRatings = await RatingSystem.fetchRatings(courseId);
              if (ratingDisplay) {
                const starsHtml = RatingSystem.renderStars
                  ? RatingSystem.renderStars(updatedRatings.average)
                  : renderStars(Math.round(updatedRatings.average));
                ratingDisplay.innerHTML = `${starsHtml} <span class="ms-2">(${updatedRatings.count} ratings)</span>`;
              }
              addSchemaMarkup(course, updatedRatings);
              // عرض النجوم المختارة كـ static بعد الإرسال (disabled)
              ratingStarsContainer.innerHTML = RatingSystem.renderStars(ratingValue, false);
              ratingStarsContainer.style.pointerEvents = 'none';
              if (ratingFeedbackText) ratingFeedbackText.textContent = 'Thanks! You have rated this course.';
            } else {
              showToast(result && result.message ? result.message : 'An error occurred.', 'danger');
              if (ratingFeedbackText) ratingFeedbackText.textContent = `Error: ${result && result.message ? result.message : 'Could not submit rating.'}`;
              ratingStarsContainer.style.pointerEvents = 'auto';
            }
          } catch (err) {
            console.error('Error submitting rating:', err);
            showToast('Could not submit rating (network error).', 'danger');
            if (ratingFeedbackText) ratingFeedbackText.textContent = 'Network error: Could not submit rating.';
            ratingStarsContainer.style.pointerEvents = 'auto';
          } finally {
            if (enrollBtn) enrollBtn.removeAttribute('aria-disabled');
          }
        });

      } else {
        // fallback: نعرض نجوم ثابتة من الدالة المحلية ونشير لأن النظام غير متوفر حالياً
        ratingStarsContainer.innerHTML = renderStars(0);
        if (ratingFeedbackText) ratingFeedbackText.textContent = 'Rating system not available right now.';
      }
    };

    // ============================
    // انتظار تحميل RatingSystem (initial check + event + polling fallback)
    // ============================
    const waitForRatingSystem = () => {
      // حالة جاهزية سريعة
      if (typeof RatingSystem !== 'undefined' && RatingSystem.fetchRatings) {
        loadRealRatings();
        setupInteractiveRatings();
        return;
      }

      // استماع لحدث جاهزية إن وُجد (يوصى أن يطلقه ملف ratings-system.js بعد التعريف)
      const onReady = () => {
        window.removeEventListener('RatingSystemReady', onReady);
        loadRealRatings();
        setupInteractiveRatings();
      };
      window.addEventListener('RatingSystemReady', onReady);

      // polling fallback بدرجة أدنى للحفاظ على الأداء (500ms)
      const poll = setInterval(() => {
        if (typeof RatingSystem !== 'undefined' && RatingSystem.fetchRatings) {
          clearInterval(poll);
          window.removeEventListener('RatingSystemReady', onReady);
          loadRealRatings();
          setupInteractiveRatings();
        }
      }, 500);
    };

    // إطلاق انتظار التحميل (واحد فقط)
    waitForRatingSystem();
  }; // end initializePage

  // تشغيل البداية
  initializePage();
}); // DOMContentLoaded 
})();