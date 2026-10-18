// ========== FIREBASE IMPORTS ==========
// script.js
import { db, propertiesCol, requestsCol, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, formatPKR } from './config.js';
import { getDocs, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// ========== GLOBAL STATE ==========
let propertiesData = [];   // Loaded from Firebase
let currentLang = 'en';
let savedIds = JSON.parse(localStorage.getItem('ghar-saved-ids') || '[]');
let currentFilterState = {
    query: '',
    area: 'all',
    type: 'all',
    rooms: 'all',
    lineWaterOnly: false,
    maxLoadShedding: 'all',
    maxPrice: 100000,
    showSavedOnly: false
};
let swiperInstance = null;
let reviewsSwiperInstance = null;

// ========== LOAD DATA FROM FIREBASE ==========
async function loadPropertiesFromFirebase() {
    try {
        const q = query(propertiesCol, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        propertiesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`✅ Loaded ${propertiesData.length} properties from Firebase`);
    } catch (err) {
        console.error('❌ Firebase error:', err);
        try {
            const snapshot = await getDocs(propertiesCol);
            propertiesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ Loaded ${propertiesData.length} properties (fallback)`);
        } catch (err2) {
            console.error('❌ Fallback failed:', err2);
            propertiesData = [];
        }
    }
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    await loadPropertiesFromFirebase();

    initSwiper();
    initReviewsSwiper();
    renderFeaturedProperties();
    applyFilters();
    updateSavedBadge();
    setupLangToggle();
    calculateAffordableRent();
});

// ========== SWIPER INITIALIZATION ==========
function initSwiper() {
    swiperInstance = new Swiper('.featuredSwiper', {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: true,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '#nextFeatured',
            prevEl: '#prevFeatured',
        },
        breakpoints: {
            640: { slidesPerView: 2, spaceBetween: 20 },
            1024: { slidesPerView: 3, spaceBetween: 24 }
        }
    });
}

function initReviewsSwiper() {
    reviewsSwiperInstance = new Swiper('.reviewsSwiper', {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: true,
        navigation: {
            nextEl: '#nextReview',
            prevEl: '#prevReview',
        },
        breakpoints: {
            768: { slidesPerView: 2, spaceBetween: 20 },
            1024: { slidesPerView: 3, spaceBetween: 24 }
        }
    });
}

// ========== HELPERS ==========

function buildUtilityBadges(p) {
    const isUr = currentLang === 'ur';
    const waterLabel = p.water === 'line'
        ? (isUr ? 'میٹھا پانی' : 'Line Water')
        : (isUr ? 'ٹینکر' : 'Tanker');
    const waterClass = p.water === 'line' ? 'util-good' : 'util-bad';

    const lsLabel = p.loadShedding === 0
        ? (isUr ? 'زیرو لوڈشیڈنگ' : 'No Load-shed')
        : `${p.loadShedding}h ${isUr ? 'لوڈشیڈنگ' : 'Load-shed'}`;
    const lsClass = p.loadShedding <= 2 ? 'util-good' : (p.loadShedding <= 4 ? 'util-mid' : 'util-bad');

    const gasLabel = p.gas === 'high'
        ? (isUr ? 'گیس پریشر فل' : 'Gas Good')
        : (p.gas === 'low' ? (isUr ? 'گیس ہلکی' : 'Gas Low') : (isUr ? 'گیس نہیں' : 'No Gas'));
    const gasClass = p.gas === 'high' ? 'util-good' : (p.gas === 'low' ? 'util-mid' : 'util-bad');

    return `
      <div class="d-flex flex-wrap gap-1 mt-2">
        <span class="util-badge util-good"><i class="fa-solid fa-bed"></i> ${p.rooms} ${isUr ? 'کمرے' : 'Bed'}</span>
        <span class="util-badge ${waterClass}"><i class="fa-solid fa-droplet"></i> ${waterLabel}</span>
        <span class="util-badge ${lsClass}"><i class="fa-solid fa-bolt"></i> ${lsLabel}</span>
        <span class="util-badge ${gasClass}"><i class="fa-solid fa-fire"></i> ${gasLabel}</span>
      </div>
    `;
}

// ========== RENDER CARD ==========
function renderCardHTML(p) {
    const isSaved = savedIds.includes(p.id);
    const isUr = currentLang === 'ur';
    const titleDisplay = (isUr && p.titleUr) ? p.titleUr : p.title;
    const imgSrc = p.image || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80';

    return `
      <div class="col-md-6 col-xl-4">
        <article class="property-card">
          <div class="property-thumb-box">
            <img src="${imgSrc}" alt="${p.title || 'Property'}" loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80'" />
            ${p.verified ? `<span class="badge-verified-float"><i class="fa-solid fa-shield-check"></i> ${isUr ? 'ویڈیو تصدیق شدہ' : 'Verified'}</span>` : ''}
            ${p.video ? `<span class="badge-video-float" onclick="openVideoTour('${p.id}')"><i class="fa-solid fa-play"></i> Video Tour</span>` : ''}
            <button class="save-btn-float ${isSaved ? 'saved' : ''}" onclick="toggleSaveProperty('${p.id}', this)" title="Save Property">
              <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
          </div>

          <div class="p-4 d-flex flex-column flex-grow-1">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h4 class="fw-extrabold mb-0 text-dark">${formatPKR(p.rent)}<span class="fs-6 fw-normal text-muted">/mo</span></h4>
                <div class="text-muted small fw-semibold mt-1">
                  <i class="fa-solid fa-location-dot text-warning me-1"></i> ${p.area || 'Karachi'}, Karachi
                </div>
              </div>
              <button class="tts-speaker-btn" title="Read details aloud" onclick="speakProperty('${p.id}')">
                <i class="fa-solid fa-volume-high"></i>
              </button>
            </div>

            <h6 class="fw-bold text-dark mb-1 ${isUr ? 'urdu-text' : ''}">${titleDisplay || ''}</h6>
            <p class="text-muted small mb-2 flex-grow-1">${p.description || ''}</p>

            ${buildUtilityBadges(p)}

            <div class="border-top pt-3 mt-3 d-flex gap-2">
              <a href="https://wa.me/${p.whatsapp}?text=${encodeURIComponent('Assalam o Alaikum, I am interested in: ' + (p.title || '') + ' on Bakhshish Karaya.')}" target="_blank" class="btn btn-success btn-sm rounded-pill flex-grow-1 fw-bold d-inline-flex align-items-center justify-content-center gap-2">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
              <button class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="openAgreementFor('${p.id}')" title="Draft Agreement">
                <i class="fa-solid fa-file-signature"></i>
              </button>
            </div>
          </div>
        </article>
      </div>
    `;
}

// ========== RENDER FEATURED ==========
function renderFeaturedProperties() {
    const wrapper = document.getElementById('featuredSwiperWrapper');
    const verifiedList = propertiesData.filter(p => p.verified);

    if (verifiedList.length === 0) {
        wrapper.innerHTML = `<div class="swiper-slide"><div class="text-center py-5 text-muted">No verified properties yet.</div></div>`;
        if (swiperInstance) swiperInstance.update();
        return;
    }

    wrapper.innerHTML = verifiedList.map(p => `
      <div class="swiper-slide h-auto">
        ${renderCardHTML(p).replace('<div class="col-md-6 col-xl-4">', '<div class="h-100">').replace(/<\/div>$/, '')}
      </div>
    `).join('');
    if (swiperInstance) swiperInstance.update();
}

// ========== FILTERING ==========
// ========== SMART SEARCH & FILTERING ==========
function applyFilters() {
    const q = currentFilterState.query.toLowerCase().trim();
    const areaFilter = document.getElementById('filterAreaSelect').value;
    const lineWater = document.getElementById('lineWaterOnlyCheck').checked;
    const ls = document.getElementById('loadSheddingSelect').value;
    const maxPrice = Number(document.getElementById('rentRangeInput').value);

    // --- SMART SEARCH PARSER ---
    // Search query se variables nikalna (e.g., "Gulshan 2 room flat 35k")
    let searchArea = '';
    let searchRooms = 0;
    let searchMaxPrice = 0;
    let searchType = '';
    let remainingText = q;

    if (q) {
        // 1. Detect Price (e.g., 35k, 35,000, 35000)
        const priceMatch = q.match(/(\d+)\s*(k|hazar|thousand)?/);
        if (priceMatch) {
            let val = parseInt(priceMatch[1]);
            if (priceMatch[2] || val < 1000) {
                val = val * 1000; // Agar 'k' likha hai ya number 1000 se chota hai (e.g. 35)
            }
            // Agar price 5000 se zyada hai, toh isko budget samjho (warna wo rooms ho sakte hain)
            if (val >= 5000) {
                searchMaxPrice = val;
                remainingText = remainingText.replace(priceMatch[0], ' ');
            }
        }

        // 2. Detect Rooms (e.g., 2 room, 3 bed, 2 bedroom)
        const roomMatch = q.match(/(\d+)\s*(room|bed|bedroom|kamra|kamre)/i);
        if (roomMatch) {
            searchRooms = parseInt(roomMatch[1]);
            remainingText = remainingText.replace(roomMatch[0], ' ');
        } else {
            // Agar direct number likha ho (e.g., "Gulshan 2") jo price nahi hai
            const looseNumMatch = q.match(/\b([1-9]|10)\b/);
            if (looseNumMatch && (!searchMaxPrice || parseInt(looseNumMatch[1]) !== searchMaxPrice / 1000)) {
                searchRooms = parseInt(looseNumMatch[1]);
                remainingText = remainingText.replace(looseNumMatch[0], ' ');
            }
        }

        // 3. Detect Property Type
        if (q.includes('flat') || q.includes('apartment')) { searchType = 'flat'; remainingText = remainingText.replace(/flat|apartment/gi, ' '); }
        else if (q.includes('portion')) { searchType = 'portion'; remainingText = remainingText.replace(/portion/gi, ' '); }
        else if (q.includes('room')) { searchType = 'room'; remainingText = remainingText.replace(/room/gi, ' '); }
        else if (q.includes('house') || q.includes('bangla')) { searchType = 'house'; remainingText = remainingText.replace(/house|bangla/gi, ' '); }

        // 4. Detect Karachi Area (Common Areas)
        const karachiAreas = ['gulshan', 'dha', 'johar', 'nazimabad', 'north karachi', 'korangi', 'malir', 'clifton', 'pechs', 'saddar', 'gulistan'];
        for (let a of karachiAreas) {
            if (q.includes(a)) {
                searchArea = a;
                remainingText = remainingText.replace(new RegExp(a, 'gi'), ' ');
                break;
            }
        }

        // Baaki bacha hua text (e.g. "near disco bakery")
        remainingText = remainingText.replace(/\s+/g, ' ').trim();
    }

    // --- FILTERING LOGIC ---
    const filtered = propertiesData.filter(p => {
        // Schema mapping (naya aur purana)
        const pArea = (p.locationArea || p.area || '').toLowerCase();
        const pPrice = p.pricePKR || p.rent || 0;
        const pRooms = p.bedrooms || p.rooms || 0;
        const pWater = (p.utilities && p.utilities.waterSupply) ? p.utilities.waterSupply : (p.water || '');
        const pLs = (p.utilities && p.utilities.electricity === 'ke_uninterrupted') ? 0 : 2;
        const pType = (p.propertyType || p.type || '').toLowerCase();
        const pText = `${p.title} ${p.titleUrdu || p.titleUr || ''} ${pArea} ${p.description || ''} ${p.nearestLandmark || ''}`.toLowerCase();

        // 1. Apply Smart Search filters
        if (searchArea && !pArea.includes(searchArea)) return false;
        if (searchMaxPrice && pPrice > searchMaxPrice) return false;
        if (searchRooms && pRooms < searchRooms) return false;
        if (searchType && !pType.includes(searchType)) return false;
        if (remainingText && !pText.includes(remainingText)) return false;

        // 2. Apply Sidebar Filters
        if (areaFilter !== 'all' && !pArea.includes(areaFilter.toLowerCase())) return false;
        if (currentFilterState.type !== 'all' && !pType.includes(currentFilterState.type.toLowerCase())) return false;
        if (currentFilterState.rooms !== 'all' && pRooms < Number(currentFilterState.rooms)) return false;
        if (lineWater && !pWater.includes('line')) return false;
        if (ls !== 'all' && pLs > Number(ls)) return false;
        if (pPrice > maxPrice) return false;

        if (currentFilterState.showSavedOnly && !savedIds.includes(p.id)) return false;

        return true;
    });

    // --- RENDER RESULTS ---
    const grid = document.getElementById('propertiesGrid');
    const resultsCount = document.getElementById('resultsCount');

    resultsCount.innerText = filtered.length;

    // Search Query summary display (e.g. "Found 3 results for 2 Beds under 35k in Gulshan")
    let summaryText = "Homes Found";
    if (q) {
        summaryText = `Results for "${q}"`;
    }
    resultsCount.parentElement.innerHTML = `<span id="resultsCount">${filtered.length}</span> ${summaryText}`;

    if (filtered.length === 0) {
        grid.innerHTML = `
        <div class="col-12 text-center py-5">
          <div class="fs-1 text-muted mb-2"><i class="fa-solid fa-house-chimney-crack"></i></div>
          <h5 class="fw-bold">No properties match your smart search</h5>
          <p class="text-muted small">We couldn't find anything for "${q}". Try changing the budget or area.</p>
          <button class="btn btn-outline-gold btn-sm px-4 rounded-pill mt-3" onclick="resetFilters()">Clear Filters</button>
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(renderCardHTML).join('');
}

function setChipFilter(category, val, el) {
    currentFilterState[category] = val;
    const parent = el.parentElement;
    parent.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    applyFilters();
}

function updatePriceLabel(val) {
    document.getElementById('priceLabelDisplay').innerText = formatPKR(val);
}

function quickFilterArea(areaName) {
    const select = document.getElementById('filterAreaSelect');
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text.includes(areaName)) {
            select.selectedIndex = i;
            break;
        }
    }
    currentFilterState.query = '';
    document.getElementById('globalSearchInput').value = '';
    applyFilters();
    const el = document.getElementById('browseSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function resetFilters() {
    currentFilterState = {
        query: '', area: 'all', type: 'all', rooms: 'all',
        lineWaterOnly: false, maxLoadShedding: 'all', maxPrice: 100000, showSavedOnly: false
    };
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('filterAreaSelect').value = 'all';
    document.getElementById('lineWaterOnlyCheck').checked = false;
    document.getElementById('loadSheddingSelect').value = 'all';
    document.getElementById('rentRangeInput').value = 100000;
    updatePriceLabel(100000);
    document.querySelectorAll('.filter-chip').forEach(c => {
        if (c.innerText === 'All' || c.innerText === 'Any') {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });
    applyFilters();
}

function handleSearchKey(e) {
    if (e.key === 'Enter') applySearchQuery();
}

function applySearchQuery() {
    const query = document.getElementById('globalSearchInput').value;
    currentFilterState.query = query;
    applyFilters();
    const el = document.getElementById('browseSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ========== SAVED ==========
function toggleSaveProperty(id, btn) {
    if (savedIds.includes(id)) {
        savedIds = savedIds.filter(x => x !== id);
        if (btn) {
            btn.classList.remove('saved');
            const i = btn.querySelector('i');
            if (i) i.className = 'fa-regular fa-heart';
        }
    } else {
        savedIds.push(id);
        if (btn) {
            btn.classList.add('saved');
            const i = btn.querySelector('i');
            if (i) i.className = 'fa-solid fa-heart';
        }
    }
    localStorage.setItem('ghar-saved-ids', JSON.stringify(savedIds));
    updateSavedBadge();
    if (currentFilterState.showSavedOnly) applyFilters();
}

function updateSavedBadge() {
    document.getElementById('savedCounter').innerText = savedIds.length;
}

function filterSavedProperties() {
    currentFilterState.showSavedOnly = !currentFilterState.showSavedOnly;
    const btn = document.getElementById('savedIndicatorBtn');
    if (currentFilterState.showSavedOnly) {
        btn.classList.add('border', 'border-danger');
    } else {
        btn.classList.remove('border', 'border-danger');
    }
    applyFilters();
    const el = document.getElementById('browseSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ========== TTS ==========
function speakProperty(id) {
    if (!('speechSynthesis' in window)) {
        alert("Text-to-Speech is not supported in this browser.");
        return;
    }
    window.speechSynthesis.cancel();
    const p = propertiesData.find(item => item.id === id);
    if (!p) return;

    const isUr = currentLang === 'ur';
    let text = '';
    if (isUr) {
        text = `${p.titleUr || p.title}۔ کرایہ ${p.rent} روپے ماہانہ۔ ${p.rooms} کمرے۔ پانی کی صورتحال: ${p.water === 'line' ? 'میٹھی لائن کا پانی موجود ہے' : 'ٹینکر پر انحصار'}۔ کے الیکٹرک لوڈ شیڈنگ ${p.loadShedding} گھنٹے۔ سوئی گیس ${p.gas === 'high' ? 'بہترین' : 'کم'}۔`;
    } else {
        text = `${p.title}. Monthly rent is PKR ${p.rent}. It has ${p.rooms} rooms and ${p.baths || 2} bathrooms. Water: ${p.water === 'line' ? 'sweet line water available' : 'requires tanker'}. K-Electric load shedding is ${p.loadShedding} hours daily. Gas pressure is ${p.gas}.`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isUr ? 'ur-PK' : 'en-PK';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

// ========== VOICE SEARCH ==========
let recognition = null;
function toggleVoiceSearch() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = document.getElementById('heroMicBtn');
    if (!SpeechRec) {
        alert("Voice recognition requires Google Chrome or an updated browser.");
        return;
    }
    if (mic.classList.contains('active-listening')) {
        if (recognition) recognition.stop();
        mic.classList.remove('active-listening');
        return;
    }
    recognition = new SpeechRec();
    recognition.lang = currentLang === 'ur' ? 'ur-PK' : 'en-PK';
    recognition.interimResults = false;
    mic.classList.add('active-listening');

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('globalSearchInput').value = transcript;
        currentFilterState.query = transcript;
        applyFilters();
        const el = document.getElementById('browseSection');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        mic.classList.remove('active-listening');
    };
    recognition.onerror = function () { mic.classList.remove('active-listening'); };
    recognition.onend = function () { mic.classList.remove('active-listening'); };
    recognition.start();
}

// ========== LANGUAGE TOGGLE ==========
function setupLangToggle() {
    const btn = document.getElementById('langToggleBtn');
    btn.addEventListener('click', () => {
        if (currentLang === 'en') {
            currentLang = 'ur';
            btn.innerText = 'EN';
            document.querySelectorAll('.lang-en').forEach(el => el.classList.add('d-none'));
            document.querySelectorAll('.lang-ur').forEach(el => el.classList.remove('d-none'));
        } else {
            currentLang = 'en';
            btn.innerText = 'اردو';
            document.querySelectorAll('.lang-ur').forEach(el => el.classList.add('d-none'));
            document.querySelectorAll('.lang-en').forEach(el => el.classList.remove('d-none'));
        }
        applyFilters();
        renderFeaturedProperties();
    });
}

// ========== VIDEO TOUR ==========
let currentVideoId = null;
function openVideoTour(id) {
    const p = propertiesData.find(item => item.id === id);
    if (!p || !p.video) return;
    currentVideoId = id;
    document.getElementById('videoModalTitle').innerText = p.title;
    document.getElementById('videoModalArea').innerText = `${p.area}, Karachi • Owner: ${p.owner || 'N/A'}`;
    const player = document.getElementById('modalVideoPlayer');
    player.src = p.video;
    player.load();
    player.play().catch(() => { });
    const modal = new bootstrap.Modal(document.getElementById('videoTourModal'));
    modal.show();
}

function stopModalVideo() {
    const player = document.getElementById('modalVideoPlayer');
    player.pause();
    player.currentTime = 0;
}

function bookCallForCurrent() {
    stopModalVideo();
    const modalEl = document.getElementById('videoTourModal');
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
    alert("A live video call booking request has been sent to the verified owner. They will call you on your WhatsApp.");
}

// ========== AGREEMENT ==========
let currentStep = 1;

function openAgreementFor(id) {
    const p = propertiesData.find(x => x.id === id);
    if (p) {
        document.getElementById('agAddress').value = `${p.title}, ${p.area}, Karachi`;
        document.getElementById('agRent').value = p.rent;
        document.getElementById('agDeposit').value = p.rent * 2;
        document.getElementById('agLandlord').value = p.owner || '';
    }
    currentStep = 1;
    showAgreementStep(1);
    const modal = new bootstrap.Modal(document.getElementById('agreementModal'));
    modal.show();
}

function showAgreementStep(step) {
    document.getElementById('agreementStep1').classList.add('d-none');
    document.getElementById('agreementStep2').classList.add('d-none');
    document.getElementById('agreementStep3').classList.add('d-none');
    document.getElementById('stepPill1').classList.toggle('active', step >= 1);
    document.getElementById('stepPill2').classList.toggle('active', step >= 2);
    document.getElementById('stepPill3').classList.toggle('active', step >= 3);
    document.getElementById(`agreementStep${step}`).classList.remove('d-none');
    document.getElementById('agPrevBtn').disabled = (step === 1);
    if (step === 3) {
        document.getElementById('agNextBtn').classList.add('d-none');
        document.getElementById('agPrintBtn').classList.remove('d-none');
    } else {
        document.getElementById('agNextBtn').classList.remove('d-none');
        document.getElementById('agPrintBtn').classList.add('d-none');
    }
}

function nextAgreementStep() {
    if (currentStep < 3) { currentStep++; showAgreementStep(currentStep); }
}
function prevAgreementStep() {
    if (currentStep > 1) { currentStep--; showAgreementStep(currentStep); }
}

function printAgreementDocument() {
    const landlord = document.getElementById('agLandlord').value || '________________';
    const landlordCnic = document.getElementById('agLandlordCnic').value || '________________';
    const tenant = document.getElementById('agTenant').value || '________________';
    const tenantCnic = document.getElementById('agTenantCnic').value || '________________';
    const addr = document.getElementById('agAddress').value || '________________';
    const rent = document.getElementById('agRent').value || '________';
    const deposit = document.getElementById('agDeposit').value || '________';
    const startDate = document.getElementById('agStartDate').value || '________';
    const months = document.getElementById('agMonths').value || '11';
    const notice = document.getElementById('agNotice').value || '1';

    const printContainer = document.getElementById('printableAgreement');
    printContainer.innerHTML = `
      <div style="font-family: Georgia, serif; max-width: 800px; margin: 0 auto; line-height: 1.8; color: #111;">
        <h2 style="text-align: center; border-bottom: 2px solid #b38b1d; padding-bottom: 8px; margin-bottom: 20px;">
          RENTAL TENANCY AGREEMENT (KARACHI, SINDH)
        </h2>
        <p>This Tenancy Deed is executed on this <strong>${startDate}</strong> at Karachi, by and between:</p>
        <p><strong>LANDLORD:</strong> <strong>${landlord}</strong>, holding CNIC No: <strong>${landlordCnic}</strong>, hereinafter called the First Party.</p>
        <p><strong>TENANT:</strong> <strong>${tenant}</strong>, holding CNIC No: <strong>${tenantCnic}</strong>, hereinafter called the Second Party.</p>
        <p>WHEREAS the First Party is the lawful owner/representative of property situated at: <strong>${addr}</strong> and agrees to rent the premises for a fixed tenure of <strong>${months} months</strong>.</p>
        <h5 style="margin-top: 18px;">TERMS AND CONDITIONS:</h5>
        <ol style="padding-left: 20px;">
          <li><strong>Monthly Rent:</strong> The monthly rent is fixed at <strong>PKR ${Number(rent).toLocaleString()}</strong>, payable by or before the 5th of each calendar month.</li>
          <li><strong>Security Deposit:</strong> A refundable security deposit of <strong>PKR ${Number(deposit).toLocaleString()}</strong> has been received by the First Party, refundable upon termination minus pending bills/damages.</li>
          <li><strong>Utilities:</strong> K-Electric bills, Sui Southern Gas bills, and Karachi Water & Sewerage Board/tanker charges shall be promptly borne and cleared by the Tenant.</li>
          <li><strong>Notice Period:</strong> Either party can terminate this agreement by serving <strong>${notice} month(s)</strong> written prior notice.</li>
          <li><strong>Usage:</strong> The premises shall be used exclusively for peaceful residential purposes with zero subletting permitted.</li>
        </ol>
        <div style="display: flex; justify-content: space-between; margin-top: 70px;">
          <div>________________________<br><strong>LANDLORD SIGNATURE</strong><br>CNIC: ${landlordCnic}</div>
          <div>________________________<br><strong>TENANT SIGNATURE</strong><br>CNIC: ${tenantCnic}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
          <div>________________________<br>Witness 1 (Name & CNIC)</div>
          <div>________________________<br>Witness 2 (Name & CNIC)</div>
        </div>
      </div>
    `;
    printContainer.classList.remove('d-none');
    window.print();
    setTimeout(() => printContainer.classList.add('d-none'), 1000);
}

// ========== LIST PROPERTY (Frontend Form) ==========
async function handleNewPropertySubmit(e) {
    e.preventDefault();
    const { addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const newListing = {
        title: document.getElementById('lpTitle').value,
        titleUr: document.getElementById('lpTitle').value,
        area: document.getElementById('lpArea').value,
        type: document.getElementById('lpType').value,
        rent: Number(document.getElementById('lpRent').value),
        rooms: Number(document.getElementById('lpRooms').value),
        baths: 2,
        water: document.getElementById('lpWater').value,
        loadShedding: 2,
        gas: document.getElementById('lpGas').value,
        landmarks: ["Near Main Road"],
        verified: false,           // Needs video verification
        cnicVerified: false,
        image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80",
        video: "",
        owner: "Property Owner",
        whatsapp: document.getElementById('lpPhone').value.replace(/[^0-9]/g, ''),
        description: "Freshly listed home in " + document.getElementById('lpArea').value + " ready for verification.",
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(propertiesCol, newListing);
        await loadPropertiesFromFirebase();
        applyFilters();
        renderFeaturedProperties();

        const modalEl = document.getElementById('listPropertyModal');
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
        document.getElementById('newPropertyForm').reset();

        alert("Zabardast! Your property has been submitted for verification. Our team will contact you on WhatsApp.");
    } catch (err) {
        console.error('Error adding property:', err);
        alert("Could not submit property. Please try again.");
    }
}

// ========== AFFORDABILITY CALCULATOR LOGIC ==========
let calculatedRentBudget = 35000;
function calculateAffordableRent() {
    const income = Number(document.getElementById('calcIncome').value || 0);
    const bills = Number(document.getElementById('calcBills').value || 0);
    const ratio = Number(document.getElementById('calcRatio').value || 35);
    document.getElementById('ratioDisplay').innerText = ratio + '%';

    let maxAllowable = Math.max(5000, Math.round((income * (ratio / 100)) - (bills * 0.4)));
    calculatedRentBudget = maxAllowable;
    document.getElementById('calcRentResult').innerText = formatPKR(maxAllowable);
}

function applyCalculatedBudget() {
    document.getElementById('rentRangeInput').value = calculatedRentBudget;
    updatePriceLabel(calculatedRentBudget);
    applyFilters();
    const el = document.getElementById('browseSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ========== CONTACT / SUPPORT FORM ==========
function handleSupportSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const msg = document.getElementById('contactMessage').value;
    const reason = document.getElementById('contactReason').value;

    alert(`Shukriya ${name}! Aapka message Bakhshish Karaaya team ko receive ho gaya hai. Hamari team jald hi ${phone} par rabta karegi.`);
    document.getElementById('supportContactForm').reset();
}

// ========== EXPOSE FUNCTIONS TO WINDOW ==========
window.toggleVoiceSearch = toggleVoiceSearch;
window.applySearchQuery = applySearchQuery;
window.handleSearchKey = handleSearchKey;
window.quickFilterArea = quickFilterArea;
window.setChipFilter = setChipFilter;
window.updatePriceLabel = updatePriceLabel;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.toggleSaveProperty = toggleSaveProperty;
window.filterSavedProperties = filterSavedProperties;
window.speakProperty = speakProperty;
window.openVideoTour = openVideoTour;
window.stopModalVideo = stopModalVideo;
window.bookCallForCurrent = bookCallForCurrent;
window.openAgreementFor = openAgreementFor;
window.nextAgreementStep = nextAgreementStep;
window.prevAgreementStep = prevAgreementStep;
window.printAgreementDocument = printAgreementDocument;
window.handleNewPropertySubmit = handleNewPropertySubmit;
window.calculateAffordableRent = calculateAffordableRent;
window.applyCalculatedBudget = applyCalculatedBudget;
window.handleSupportSubmit = handleSupportSubmit;