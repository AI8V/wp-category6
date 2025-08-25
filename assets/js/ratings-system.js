'use strict';

/**
 * @file ratings-system.js
 * @description وحدة مستقلة لإدارة نظام التقييمات (جلب وإرسال) مع كاش محسّن
 */
const RatingSystem = (function () {

  const API_URL = "https://script.google.com/macros/s/AKfycbyu88YR5217U9w5iUPDbaC03gv9kpP8tkeSjglEyMrkAFaVuV-p11CKDKPghi_dj2sG3A/exec"; 

  // === CACHE SYSTEM ===
  const cache = {
    data: new Map(),
    DURATION: 5 * 60 * 1000, // 5 minutes
    
    get(key) {
      const item = this.data.get(key);
      if (item && Date.now() - item.timestamp < this.DURATION) {
        return item.value;
      }
      this.data.delete(key);
      return null;
    },
    
    set(key, value) {
      this.data.set(key, {
        value: value,
        timestamp: Date.now()
      });
    },
    
    clear() {
      this.data.clear();
    },
    
    cleanup() {
      const now = Date.now();
      for (const [key, item] of this.data.entries()) {
        if (now - item.timestamp >= this.DURATION) {
          this.data.delete(key);
        }
      }
    }
  };

  setInterval(() => cache.cleanup(), 10 * 60 * 1000);

  // === HELPER FUNCTIONS ===
  
  /**
   * جلب مع إعادة المحاولة + مهلة زمنية عبر AbortController
   */
  async function fetchWithRetry(url, options = {}, maxRetries = 2, timeoutMs = 8000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        console.warn(`Attempt ${attempt + 1} failed:`, error.message);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  /**
   * جلب التقييمات
   */
  async function fetchRatings(courseId) {
    if (!courseId) {
      console.error("RatingSystem: fetchRatings called without a courseId.");
      return { average: 0, count: 0 };
    }

    const cacheKey = `ratings_${courseId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`Using cached ratings for course ${courseId}`);
      return cached;
    }

    try {
      const response = await fetchWithRetry(`${API_URL}?action=getRatings&courseId=${courseId}`);
      const data = await response.json();
      
      const ratings = {
        average: Math.max(0, Math.min(5, parseFloat(data.average) || 0)),
        count: Math.max(0, parseInt(data.count) || 0)
      };
      
      cache.set(cacheKey, ratings);
      return ratings;
    } catch (error) {
      console.error("RatingSystem: Failed to fetch ratings:", error);
      return { average: 0, count: 0 };
    }
  }

  /**
   * إرسال تقييم
   */
  async function submitRating(courseId, ratingValue) {
    if (!courseId || !ratingValue || ratingValue < 1 || ratingValue > 5) {
      return { status: "error", message: "Invalid course ID or rating value" };
    }

    let userIP = 'unknown';
    try {
      const ipResponse = await fetchWithRetry('https://api.ipify.org?format=json', {}, 1);
      if (ipResponse.ok) {
        const ipData = await ipResponse.json();
        userIP = ipData.ip || 'unknown';
      }
    } catch {
      console.warn("RatingSystem: Could not fetch user IP.");
    }
    
    try {
      const response = await fetchWithRetry(`${API_URL}?userIP=${userIP}`, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'addRating', courseId, rating: ratingValue }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = JSON.parse(await response.text());
      
      if (result.status === 'success') {
        cache.data.delete(`ratings_${courseId}`);
        console.log(`Cache cleared for course ${courseId} after successful rating`);
      }
      return result;
    } catch (error) {
      console.error("RatingSystem: Failed to submit rating:", error);
      return { status: "error", message: `Submit failed: ${error.message}` };
    }
  }

  /**
   * رسم النجوم مع دعم الأنصاف
   */
  const renderStars = (rating, isInteractive = false) => {
    let starsHTML = "";
    const numericRating = parseFloat(rating) || 0;
    const roundedRating = Math.round(numericRating * 2) / 2;
    
    for (let i = 1; i <= 5; i++) {
      let starClass = "bi-star text-muted";
      if (i <= roundedRating) {
        starClass = "bi-star-fill text-warning";
      } else if (i - 0.5 === roundedRating) {
        starClass = "bi-star-half text-warning";
      }
      
      const interactive = isInteractive
        ? `class="bi ${starClass} rating-star" style="cursor:pointer; transition:color .2s" role="button" tabindex="${i===1?'0':'-1'}" aria-label="Rate ${i} stars" data-value="${i}"`
        : `class="bi ${starClass}"`;
      
      starsHTML += `<i ${interactive}></i>`;
    }
    return starsHTML;
  };

  /**
   * تهيئة أحداث النجوم
   */
  function initializeStarEvents(container, onClickCallback) {
    if (!container) {
      console.warn("RatingSystem: No container provided for star events");
      return;
    }

    let currentSelection = 0;
    let isSubmitting = false;

    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('rating-star') && !isSubmitting) {
        currentSelection = parseInt(e.target.dataset.value, 10);
        if (currentSelection >= 1 && currentSelection <= 5) {
          isSubmitting = true;
          container.style.pointerEvents = 'none';
          updateStarsDisplay(container, currentSelection);
          if (onClickCallback) {
            onClickCallback(currentSelection).finally(() => {
              isSubmitting = false;
              container.style.pointerEvents = '';
            });
          }
        }
      }
    });

    container.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('rating-star') && !isSubmitting) {
        updateStarsDisplay(container, parseInt(e.target.dataset.value, 10));
      }
    });

    container.addEventListener('mouseout', () => {
      if (!isSubmitting) {
        updateStarsDisplay(container, currentSelection);
      }
    });

    container.addEventListener('keydown', (e) => {
      if (isSubmitting) return;
      const focused = e.target;
      if (focused.classList.contains('rating-star')) {
        let newValue = currentSelection;
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            newValue = Math.min(5, currentSelection + 1); e.preventDefault(); break;
          case 'ArrowLeft':
          case 'ArrowDown':
            newValue = Math.max(1, currentSelection - 1); e.preventDefault(); break;
          case 'Enter':
          case ' ':
            if (currentSelection > 0) focused.click();
            e.preventDefault(); break;
        }
        if (newValue !== currentSelection) {
          currentSelection = newValue;
          updateStarsDisplay(container, newValue);
          container.querySelector(`[data-value="${newValue}"]`)?.focus();
        }
      }
    });
  }

  /**
   * تحديث عرض النجوم
   */
  function updateStarsDisplay(container, rating) {
    container.querySelectorAll('.rating-star').forEach((star) => {
      const starValue = parseInt(star.dataset.value, 10);
      star.classList.remove('bi-star', 'bi-star-fill', 'bi-star-half', 'text-muted', 'text-warning');
      if (starValue <= rating) {
        star.classList.add('bi-star-fill', 'text-warning');
      } else {
        star.classList.add('bi-star', 'text-muted');
      }
    });
  }

  /**
   * تنسيق نص التقييم
   */
  function formatRatingText(average, count) {
    if (count === 0) return "No ratings yet";
    return `${average.toFixed(1)} ★ (${count} rating${count > 1 ? 's' : ''})`;
  }

  function isValidRating(ratings) {
    return ratings &&
           typeof ratings.average === 'number' &&
           typeof ratings.count === 'number' &&
           ratings.count > 0 &&
           ratings.average > 0;
  }

  // === PUBLIC API ===
  return {
    fetchRatings,
    submitRating,
    renderStars,
    initializeStarEvents,
    formatRatingText,
    isValidRating,
    clearCache: () => cache.clear(),
    getCacheInfo: () => ({ size: cache.data.size, duration: cache.DURATION }),
    configure: (options = {}) => {
      if (options.cacheDuration && typeof options.cacheDuration === 'number') {
        cache.DURATION = options.cacheDuration;
      }
    }
  };
})();

// تصدير للاستخدام في بيئات مختلفة
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RatingSystem;
} else if (typeof window !== 'undefined') {
  window.RatingSystem = RatingSystem;
  window.dispatchEvent(new Event('RatingSystemReady'));
}

console.log('RatingSystem loaded successfully! 🌟');
