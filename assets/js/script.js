// Complete Course Platform: Dynamic Content + Working Filters
(function () {
  "use strict";

  // === CONFIGURATION ===
  const CONFIG = {
    AUTO_APPLY: true,
    CARDS_PER_PAGE: 6,
    DEBOUNCE_DELAY: 300
  };

  // === UTILITIES ===
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => { clearTimeout(timeout); func(...args); };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Throttling function for performance optimization
  const throttle = (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // === CONTENT MANAGEMENT ===
  const ContentManager = {
    addCourse: (courseData) => {
      const newId = Math.max(...COURSE_DATA.courses.map(c => c.id)) + 1;
      const newCourse = {
        id: newId,
        ...courseData,
        date: new Date().toISOString().split('T')[0]
      };
      COURSE_DATA.courses.push(newCourse);
      ContentManager.updateCategoryCounts();
      return newCourse;
    },

    editCourse: (courseId, updatedData) => {
      const index = COURSE_DATA.courses.findIndex(c => c.id === courseId);
      if (index !== -1) {
        COURSE_DATA.courses[index] = { ...COURSE_DATA.courses[index], ...updatedData };
        ContentManager.updateCategoryCounts();
        return COURSE_DATA.courses[index];
      }
      return null;
    },

    deleteCourse: (courseId) => {
      const index = COURSE_DATA.courses.findIndex(c => c.id === courseId);
      if (index !== -1) {
        const deleted = COURSE_DATA.courses.splice(index, 1)[0];
        ContentManager.updateCategoryCounts();
        return deleted;
      }
      return null;
    },

    updateCategoryCounts: () => {
      Object.keys(COURSE_DATA.categories).forEach(cat => {
        COURSE_DATA.categories[cat].count = COURSE_DATA.courses.filter(c => c.category === cat).length;
      });
    },

    getCourses: () => COURSE_DATA.courses,
    getCourse: (id) => COURSE_DATA.courses.find(c => c.id === parseInt(id))
  };


  // === COURSE CARD GENERATOR ===
  function createCourseCard(course) {
    const priceDisplay = course.price === 0 ? 'Free' : `$${course.price.toFixed(2)}`;
    const priceClass = course.price === 0 ? 'text-success' : 'text-primary';
    
    const imageBase = `../${course.image.card}`; 
    const finalFallbackImage = '../assets/img/course-fallback.jpg';

    return `
      <div class="col-12 col-md-6 col-lg-4 mb-4">
        <div class="card h-100 shadow-sm course-card" 
              data-rating="${course.rating}" 
              data-students="${course.students}" 
              data-date="${course.date}" 
              data-category="${course.category}" 
              data-level="${course.level}">
          <div class="course-card-img-container">
            <picture>
              <source srcset="${imageBase}-small.webp 350w, ${imageBase}-large.webp 700w" 
                      sizes="(max-width: 767px) 95vw, (max-width: 991px) 48vw, 32vw" 
                      type="image/webp">
              
              <source srcset="${imageBase}-small.jpg 350w, ${imageBase}-large.jpg 700w"
                      sizes="(max-width: 767px) 95vw, (max-width: 991px) 48vw, 32vw"
                      type="image/jpeg">
              
              <img class="img-fluid card-img-top" 
                    src="${imageBase}-large.jpg"  
                    alt="${course.title}" 
                    onerror="this.onerror=null; this.src='${finalFallbackImage}';"
                    width="400" height="210"
                    loading="lazy" fetchpriority="low" decoding="async">
            </picture>
            <span class="badge bg-${COURSE_DATA.categories[course.category]?.color || 'success'} course-category">${course.category}</span>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <p class="text-muted mb-0">${course.level}</p>
              <p class="price-text-gradient fw-bold ${priceClass} mb-0">${priceDisplay}</p>
            </div>
            <h3 class="card-title">${course.title}</h3>
            <div class="text-muted d-flex card-meta gap-3 border-top pt-2 mt-2">
              <span><span class="bi bi-people-fill icon-gold me-1" aria-hidden="true"></span> ${course.students} Students</span>
              <span><span class="bi bi-book-fill  icon-gold me-1" aria-hidden="true"></span> ${course.lessons} Lessons</span>
            </div>
          </div>
          <div class="course-card-overlay">
            <div class="d-flex align-items-center mb-2">
              <p class="mb-0 me-5">${course.level}</p>
              <p class="price-text-gradient fw-bold ${priceClass} mb-0 ms-5">${priceDisplay}</p>
            </div>
            <h3 class="card-title">${course.title}</h3>
            <div class="d-flex card-meta gap-3 border-top pt-2 mt-2">
              <span><span class="bi bi-people-fill  icon-gold me-1" aria-hidden="true"></span> ${course.students} Students</span>
              <span><span class="bi bi-book-fill  icon-gold me-1" aria-hidden="true"></span> ${course.lessons} Lessons</span>
            </div>
            <p class="course-description mb-2">${course.description}</p>
            <a class="btn btn-light" href="../course/course-details/index.html?id=${course.id}">View Detail</a>
          </div>
        </div>
      </div>
    `;
  }

  function optimizeVisibleImages() {
    const cards = qsa('.course-card');
    const visibleCards = cards.slice(0, 3);
    visibleCards.forEach(card => {
      const img = qs('img', card);
      if (img) {
        img.loading = 'eager';
        img.fetchPriority = 'high';
        img.decoding = 'async';
      }
    });
  }


  // === SETUP FUNCTIONS FOR UI BEHAVIORS ===
  
  /**
   * Initializes the smart floating filter button behavior (hide on scroll down, show on scroll up).
   */
  function setupFloatingButton() {
    const fab = document.getElementById('floatingFilterBtn');
    if (!fab) return;

    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 100) {
        fab.classList.remove('is-hidden');
        return;
      }

      if (currentScrollY > lastScrollY) {
        fab.classList.add('is-hidden');
      } else {
        fab.classList.remove('is-hidden');
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', throttle(handleScroll, 150)); // Using throttle
  }

    /**
     * Makes the entire filter list item clickable for a better user experience.
     * Handles clicks intelligently to avoid double-toggling the input.
     * @param {string} containerSelector - The CSS selector for the filter list container.
     */
    function setupFilterItemClickBehavior(containerSelector) {
        const filterContainer = qs(containerSelector);
        if (!filterContainer) return;

        filterContainer.addEventListener('click', (e) => {
            const targetItem = e.target.closest('.list-group-item, .form-check');
            if (!targetItem) return;

            const input = targetItem.querySelector('.form-check-input');
            if (!input || input.disabled) return;

            // === The Smart Logic Starts Here ===

            // Check if the click was directly on the input element itself.
            if (e.target !== input) {
                // If the click was on the row/label, we handle the state change manually.
                e.preventDefault(); // Prevent default action (e.g., of a label).
                
                if (input.type === 'checkbox') {
                    input.checked = !input.checked;
                } else if (input.type === 'radio') {
                    input.checked = true;
                }
            }
            // If the click WAS on the input, we let the browser handle the check/uncheck.
            // We do nothing here and proceed to the next step.

            // === End of Smart Logic ===

            // Now, trigger our filter system.
            // A minimal delay ensures the browser has finished its default action if any.
            setTimeout(() => {
                input.dispatchEvent(new Event('change', { bubbles: true }));

                // Smartly close offcanvas ONLY if the event came from within it.
                const offcanvasElement = document.getElementById('offcanvas-filters');
                if (offcanvasElement && offcanvasElement.contains(filterContainer)) {
                    const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasElement);
                    if (offcanvasInstance) {
                        offcanvasInstance.hide();
                    }
                }
            }, 10); // A tiny 10ms delay is enough.
        });
    }

    /**
     * Finds and closes the mobile filter offcanvas menu.
     */
    function closeMobileFilters() {
        const offcanvasElement = document.getElementById('offcanvas-filters');
        // Get the Bootstrap instance of the offcanvas
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasElement);
        // If an instance exists, hide it
        if (offcanvasInstance) {
            offcanvasInstance.hide();
        }
    }


  // === MAIN FILTER & SORT SYSTEM ===
  document.addEventListener("DOMContentLoaded", () => {
    const resultsCol = qs(".course-content-area");
    const container = resultsCol ? qs(".row", resultsCol) : null;
    
    if (!resultsCol || !container) {
      console.error("Course container not found.");
      return;
    }

    // Get all control elements
    const resetBtn = qs('button[aria-label="Reset all filters"]');
    const applyBtn = qs('button[aria-label="Apply selected filters"]');
    const sortBtn = qs('button[id^="sortDropdown"]');
    const sortMenu = sortBtn ? sortBtn.closest(".dropdown") : null;
    const sortItems = sortMenu ? qsa(".dropdown-item", sortMenu) : [];
    const resultsText = qs("p.results-status-text", resultsCol);
    const searchInput = qs("#search-input");
    const loadingSpinner = qs("#loading-spinner");
    const categoriesRoot = qs("#categories-list");
    const mobileCategoriesRoot = qs("#mobile-categories-list");

    // State
    let currentSort = { type: "average ratings" };
    let currentPage = 1;

    // === INITIALIZE UI BEHAVIORS ===
    setupFloatingButton();
    // Apply the clickable item behavior to both desktop and mobile filter lists
setupFilterItemClickBehavior('#categories-list');
setupFilterItemClickBehavior('.course-sidebar .filter-block ul');
setupFilterItemClickBehavior('.course-sidebar .rating-filter-list');
setupFilterItemClickBehavior('#mobileFilters');


    // Get default sort text
    const defaultSortText = (() => {
      if (!sortBtn) return "Average Ratings";
      const label = sortBtn.querySelector(".sort-label");
      const txt = (label ? label.textContent : sortBtn.textContent || "").trim();
      return txt || "Average Ratings";
    })();


    // === FILTER & RENDER FUNCTIONS ===
    function readFilters() {
      const minRating = parseInt((qs("input[name='ratingFilter']:checked")?.value || "0"), 10) || 0;
      const searchTerm = (searchInput?.value || "").toLowerCase().trim();
      const activeCategories = categoriesRoot
        ? qsa(".form-check-input:checked", categoriesRoot).map(cb => cb.value)
        : [];
      const selectedLevel = (qs("input[name='levelFilter']:checked")?.value || "").trim();
      return { minRating, searchTerm, activeCategories, selectedLevel };
    }

    function applySort(courses) {
      const list = [...courses]; // نسخة جديدة
      const sortType = (currentSort.type || "").toLowerCase();

      switch (sortType) {
        case "title a-z":
          return list.sort((a, b) => a.title.localeCompare(b.title));
        case "title z-a":
          return list.sort((a, b) => b.title.localeCompare(a.title));
        case "price low to high":
          return list.sort((a, b) => a.price - b.price);
        case "price high to low":
          return list.sort((a, b) => b.price - a.price);
        case "popular":
          return list.sort((a, b) => b.students - a.students);
        case "newly published":
          return list.sort((a, b) => new Date(b.date) - new Date(a.date));
        case "average ratings":
        default:
          return list.sort((a, b) => b.rating - a.rating);
      }
    }

    function updateSortUI() {
      if (!sortBtn) return;
      const label = sortBtn.querySelector(".sort-label");
      const match = sortItems.find(it => (it.innerText || "").trim().toLowerCase() === (currentSort.type || "").toLowerCase());
      const text = match ? (match.innerText || "").trim() : defaultSortText;
      
      if (label) label.textContent = text; 
      else sortBtn.textContent = text;
      
      sortItems.forEach(it => it.classList.remove("active"));
      if (match) match.classList.add("active");
    }

    function updateCategoryCounts(filteredCourses) {
      // Calculate category counts from filtered courses
      const counts = {};
      Object.keys(COURSE_DATA.categories).forEach(cat => {
        counts[cat] = filteredCourses.filter(c => c.category === cat).length;
      });

      // Update both desktop and mobile category lists
      const updateCountsInList = (list) => {
        if (!list) return;
        qsa('.list-group-item', list).forEach(item => {
          const checkbox = qs('.form-check-input', item);
          const span = qs('span', item);
          if (checkbox && span) {
            const count = counts[checkbox.value] || 0;
            span.innerText = count.toString();
            
            // Disable empty categories
            if (count === 0) {
              item.classList.add('text-muted');
              checkbox.disabled = true;
            } else {
              item.classList.remove('text-muted');
              checkbox.disabled = false;
            }
          }
        });
      };

      updateCountsInList(categoriesRoot);
      updateCountsInList(mobileCategoriesRoot);
    }

    function renderPagination(totalItems) {
      const paginationBar = qs("#pagination-bar");
      if (!paginationBar) return;

      paginationBar.innerHTML = "";

      const perPage = CONFIG.CARDS_PER_PAGE || 6;
      const totalPages = Math.max(0, Math.ceil(totalItems / perPage));

      // If no pagination needed
      if (totalPages <= 1) return;

      // Ensure currentPage is valid
      if (typeof currentPage !== "number" || currentPage < 1) currentPage = 1;
      if (currentPage > totalPages) currentPage = totalPages;

      const fragment = document.createDocumentFragment();

      const makePageItem = (label, page, opts = {}) => {
        const li = document.createElement("li");
        li.className = `page-item${opts.disabled ? " disabled" : ""}${opts.active ? " active" : ""}`;

        const a = document.createElement("a");
        a.className = "page-link";
        a.href = "#";
        a.innerText = String(label);
        a.setAttribute("role", "button");
        a.setAttribute("aria-label", opts.ariaLabel || `Go to page ${page}`);
        if (opts.active) a.setAttribute("aria-current", "page");
        if (opts.rel) a.rel = opts.rel;

        a.addEventListener("click", (e) => {
          e.preventDefault();
          if (opts.disabled) return;
          if (currentPage === page) return;
          currentPage = page;
          // Re-render (false = don't reset page inside processAndRender)
          if (typeof processAndRender === "function") {
            processAndRender(false);
          } else {
            // fallback: try renderCourses if present
            if (typeof renderCourses === "function") renderCourses();
          }
          // scroll to top of results (optional UX nicety)
          const resultsTop = qs(".course-content-area");
          if (resultsTop) resultsTop.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        li.appendChild(a);
        return li;
      };

      // Prev
      fragment.appendChild(makePageItem("‹", Math.max(1, currentPage - 1), { disabled: currentPage === 1, ariaLabel: "Previous page", rel: "prev" }));

      // Smart page windowing: show first, last, and nearby pages with ellipsis
      const delta = 2; // how many pages around current to show
      const range = [];
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
          range.push(i);
        }
      }

      let last = 0;
      for (const i of range) {
        if (i - last > 1) {
          // insert ellipsis
          const ell = document.createElement("li");
          ell.className = "page-item disabled";
          const span = document.createElement("span");
          span.className = "page-link";
          span.innerText = "...";
          span.setAttribute("aria-hidden", "true");
          ell.appendChild(span);
          fragment.appendChild(ell);
        }
        fragment.appendChild(makePageItem(i, i, { active: i === currentPage }));
        last = i;
      }

      // Next
      fragment.appendChild(makePageItem("›", Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages, ariaLabel: "Next page", rel: "next" }));

      // Append to DOM
      paginationBar.appendChild(fragment);
    }

    function toggleSpinner(show) {
      if (!loadingSpinner) return;

      if (show) {
        loadingSpinner.style.opacity = 0;
        loadingSpinner.style.display = "flex";
        requestAnimationFrame(() => {
          loadingSpinner.style.transition = "opacity 0.3s ease";
          loadingSpinner.style.opacity = 1;
        });
      } else {
        loadingSpinner.style.transition = "opacity 0.3s ease";
        loadingSpinner.style.opacity = 0;
        setTimeout(() => {
          loadingSpinner.style.display = "none";
        }, 300); // يجب أن تتطابق المدة مع مدة الانتقال في CSS
      }
    }

    function updateURL() {
      const filters = readFilters();
      const params = new URLSearchParams();

      if (filters.activeCategories.length > 0) {
        params.set('categories', filters.activeCategories.join(','));
      }
      if (filters.minRating > 0) {
        params.set('rating', filters.minRating);
      }
      if (filters.selectedLevel && filters.selectedLevel.toLowerCase() !== 'all') {
        params.set('level', filters.selectedLevel);
      }
      if (filters.searchTerm) {
        params.set('search', filters.searchTerm);
      }

      const newUrl = params.toString() ? 
        `${window.location.pathname}?${params.toString()}` : 
        window.location.pathname;
      
      history.replaceState({path: newUrl}, '', newUrl);
    }

    function processAndRender(resetPage = false) {
      toggleSpinner(true);
      
      if (resetPage) currentPage = 1;

      setTimeout(() => {
        const filters = readFilters();
        
        // Start with all courses
        let allCourses = ContentManager.getCourses();
        
        // Apply filters EXCEPT category (for count calculation)
        let preFiltered = allCourses.filter(course => {
          if (course.rating < filters.minRating) return false;
          if (filters.searchTerm) {
            const titleMatch = course.title.toLowerCase().includes(filters.searchTerm);
            const tagMatch = course.tags && course.tags.some(tag => tag.toLowerCase().includes(filters.searchTerm));
            if (!titleMatch && !tagMatch) {
              return false;
            }
          }
          if (filters.selectedLevel && 
              filters.selectedLevel !== "" && 
              filters.selectedLevel.toLowerCase() !== "all" && 
              course.level !== filters.selectedLevel) return false;
          return true;
        });
        
        // Update category counts based on pre-filtered results
        updateCategoryCounts(preFiltered);
        
        // Now apply category filter
        let filtered = preFiltered.filter(course => {
          return filters.activeCategories.length === 0 || 
                 filters.activeCategories.includes(course.category);
        });
        
        // Apply sorting
        filtered = applySort([...filtered]);
        
        // Pagination
        const total = filtered.length;
        const start = (currentPage - 1) * CONFIG.CARDS_PER_PAGE;
        const end = start + CONFIG.CARDS_PER_PAGE;
        const pageItems = filtered.slice(start, end);

        // Render results (التوجيه الثاني: تحسين عرض النتائج باستخدام DocumentFragment)
        container.innerHTML = "";
        if (pageItems.length === 0) {
          container.innerHTML = `
            <div class="col-12 text-center my-5">
              <span class="bi bi-search fs-1  icon-gold mb-3" aria-hidden="true"></span>
              <h3 class="text-warning">No courses match your criteria</h3>
              <p class="text-light">Try adjusting your search or filter settings</p>
            </div>
          `;
        } else {
          const fragment = document.createDocumentFragment();
          pageItems.forEach((course, index) => {
            const courseHTML = createCourseCard(course);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = courseHTML;
            const courseElement = tempDiv.firstElementChild;
            
            // Add staggered animation
            courseElement.style.animationDelay = `${index * 0.1}s`;
            fragment.appendChild(courseElement);
          });
          container.appendChild(fragment); // إضافة كل الكروت مرة واحدة
          optimizeVisibleImages();
        }

        // Update results text
        if (resultsText) {
          const displayStart = total ? start + 1 : 0;
          const displayEnd = Math.min(end, total);
          resultsText.innerText = `Showing ${displayStart}-${displayEnd} of ${total} results`;
        }

        renderPagination(total);
        updateURL();
        toggleSpinner(false);
      }, 30);
    }

    // === RESET FUNCTIONS ===
    function resetFilterInputs(rootElement) {
      const root = rootElement || document;
      qsa(".form-check-input", root).forEach(input => {
        if (input.type === "radio") {
          const isRating = input.name === 'ratingFilter' && input.value === '0';
          const isLevel = input.name === 'levelFilter' && (input.value === "" || input.value.toLowerCase() === 'all');
          input.checked = isRating || isLevel;
        } else {
          input.checked = false;
        }
      });
    }

    function performReset() {
      if (searchInput) searchInput.value = "";
      const mobileSearch = qs("#search-input-mobile");
      if (mobileSearch) mobileSearch.value = "";

      // استخدام الوظيفة المساعدة لإعادة تعيين الفلاتر
      resetFilterInputs(document); // لإعادة تعيين الفلاتر الرئيسية
      const mobileFilters = qs("#mobileFilters");
      if (mobileFilters) {
        resetFilterInputs(mobileFilters); // لإعادة تعيين فلاتر الموبايل
      }

      currentSort.type = (defaultSortText || "average ratings").trim().toLowerCase();
      updateSortUI();
      processAndRender(true);
    }

    // === EVENT LISTENERS ===
    if (resetBtn) resetBtn.addEventListener("click", performReset);
    if (applyBtn && !CONFIG.AUTO_APPLY) {
      applyBtn.addEventListener("click", () => processAndRender(true));
    }
    if (CONFIG.AUTO_APPLY) {
      if (applyBtn) applyBtn.disabled = true;
      
      // Search input with debouncing
      if (searchInput) {
        const debouncedSearch = debounce(() => processAndRender(true), CONFIG.DEBOUNCE_DELAY);
        searchInput.addEventListener("input", debouncedSearch);
      }
      
      // Filter inputs
      qsa(".form-check-input").forEach(input => {
        input.addEventListener("change", () => processAndRender(true));
      });
    }
    sortItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        currentSort.type = (item.innerText || "").trim().toLowerCase();
        updateSortUI();
        processAndRender(true);
      });
    });

    // Mobile Sync & Buttons
    const mobileSearch = qs("#search-input-mobile");
    if (mobileSearch && searchInput) {
      mobileSearch.addEventListener("input", () => {
        searchInput.value = mobileSearch.value;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }


    // Mobile buttons
    qs("#mobileApply")?.addEventListener("click", () => {
        processAndRender(true); // 1. Apply the filters
        closeMobileFilters();   // 2. Close the panel
    });

    qs("#mobileReset")?.addEventListener("click", () => {
        performReset();         // 1. Reset the filters
        closeMobileFilters();   // 2. Close the panel
    });

    // === INITIALIZATION ===
    updateSortUI();
    // Apply URL filters if any
    const params = new URLSearchParams(window.location.search);
    if (params.has('categories') || params.has('rating') || params.has('level') || params.has('search')) {
      // ... (logic remains the same)
    }
    processAndRender(true);
  });

  // === PUBLIC API ===
  window.CourseManager = {
    updateCourse: (id, updates) => {
      const course = ContentManager.editCourse(id, updates);
      if (course) {
        // Re-trigger the filter system
        const event = new Event('change', { bubbles: true });
        document.dispatchEvent(event);
        console.log('Course updated:', course);
      }
      return course;
    },

    addNewCourse: (courseData) => {
      const course = ContentManager.addCourse(courseData);
      const event = new Event('change', { bubbles: true });
      document.dispatchEvent(event);
      console.log('Course added:', course);
      return course;
    },

    removeCourse: (id) => {
      const course = ContentManager.deleteCourse(id);
      if (course) {
        const event = new Event('change', { bubbles: true });
        document.dispatchEvent(event);
        console.log('Course removed:', course);
      }
      return course;
    },

    getCourses: () => ContentManager.getCourses(),
    
    bulkUpdate: (updates) => {
      updates.forEach(update => {
        if (update.id) {
          ContentManager.editCourse(update.id, update);
        }
      });
      const event = new Event('change', { bubbles: true });
      document.dispatchEvent(event);
    }
  };

  // Quick helpers
  window.quickAddCourse = (title, category, price = 0) => {
    return CourseManager.addNewCourse({
      title,
      category,
      price,
      level: "Beginner",
      students: 0,
      lessons: 1,
      rating: 5,
      description: `Learn about ${title.toLowerCase()}`,
      image: { card: "assets/img/course-large" }, // <-- كائن مع خاصية card (بدون امتداد)
      instructor: "New Instructor",
      tags: [title.toLowerCase().replace(/\s+/g, '-')]
    });
  };

  console.log('Complete Course Platform loaded! 🎉');
  console.log('Available functions:');
  console.log('- CourseManager.updateCourse(id, {title: "New Title"})');
  console.log('- CourseManager.addNewCourse({...})');
  console.log('- quickAddCourse("Course Name", "Category", 25.99)');

})();
