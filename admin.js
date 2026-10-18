import { db, propertiesCol, requestsCol, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from './config.js';
import { doc, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('imageUploadStatus');
    const previewEl = document.getElementById('imagePreviewInline');
    const hiddenInput = document.getElementById('propImage');

    statusEl.textContent = 'Uploading to Cloudinary...';
    statusEl.className = 'text-warning';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const res = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

        // Save secure_url + public_id (public_id delete ke liye zaroori)
        hiddenInput.value = data.secure_url;
        hiddenInput.dataset.publicId = data.public_id;   // 👈 DELETE ke liye
        hiddenInput.dataset.resourceType = data.resource_type || 'image';

        previewEl.src = data.secure_url;
        previewEl.style.display = 'block';

        statusEl.textContent = '✓ Uploaded successfully';
        statusEl.className = 'text-success';

        updatePreview();   // Live preview bhi update
    } catch (err) {
        console.error('Cloudinary upload error:', err);
        statusEl.textContent = '✗ Upload failed: ' + err.message;
        statusEl.className = 'text-danger';
        Swal.fire({
            icon: 'error',
            title: 'Image Upload Failed',
            text: err.message + ' — Check Cloudinary cloud name & preset.',
            confirmButtonColor: '#c9a227',
        });
    }
}

// URL manually paste karne ka option
function setImageFromUrl(url) {
    if (!url) return;
    document.getElementById('propImage').value = url;
    document.getElementById('propImage').dataset.publicId = '';  // purani image ka public_id clear
    const previewEl = document.getElementById('imagePreviewInline');
    previewEl.src = url;
    previewEl.style.display = 'block';
    updatePreview();
}
// ================= GLOBAL STATE =================
let allProperties = [];
let deleteTargetId = null;

// Expose functions to window for onclick handlers
window.loadProperties = loadProperties;
window.renderAdminTable = renderAdminTable;
window.showSection = showSection;
window.editProperty = editProperty;
window.deleteProperty = deleteProperty;
window.confirmDelete = confirmDelete;
window.resetForm = resetForm;
window.updatePreview = updatePreview;
window.toggleVerified = toggleVerified;

// ================= UI HELPERS =================
function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function showSection(section) {
    // Hide all sections
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('propertiesSection').style.display = 'none';
    document.getElementById('addPropertySection').style.display = 'none';

    // Remove active from all nav links
    document.querySelectorAll('.admin-sidebar .nav-link').forEach(l => l.classList.remove('active'));

    if (section === 'dashboard') {
        document.getElementById('dashboardSection').style.display = 'block';
        document.querySelectorAll('.admin-sidebar .nav-link')[0].classList.add('active');
        renderRecentTable();
    } else if (section === 'properties') {
        document.getElementById('propertiesSection').style.display = 'block';
        document.querySelectorAll('.admin-sidebar .nav-link')[1].classList.add('active');
        renderAdminTable();
    } else if (section === 'addProperty') {
        document.getElementById('addPropertySection').style.display = 'block';
        document.querySelectorAll('.admin-sidebar .nav-link')[2].classList.add('active');
        resetForm();
    }
}

// ================= FIREBASE CRUD =================

// READ: Load all properties
async function loadProperties() {
    showLoading(true);
    try {
        const q = query(propertiesCol, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        allProperties = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        updateStats();
        renderAdminTable();
        renderRecentTable();
        document.getElementById('sidebarCount').innerText = allProperties.length;
    } catch (err) {
        console.error('Error loading properties:', err);
        // Fallback: load without ordering if createdAt doesn't exist
        try {
            const snapshot = await getDocs(propertiesCol);
            allProperties = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            updateStats();
            renderAdminTable();
            renderRecentTable();
            document.getElementById('sidebarCount').innerText = allProperties.length;
        } catch (err2) {
            Swal.fire({
                icon: 'error',
                title: 'Connection Error',
                text: 'Could not load properties from Firebase. Check your internet and Firestore rules.',
                confirmButtonColor: '#c9a227'
            });
        }
    } finally {
        showLoading(false);
    }
}

// CREATE: Add new property
async function addProperty(data) {
    showLoading(true);
    try {
        const docRef = await addDoc(propertiesCol, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        Swal.fire({
            icon: 'success',
            title: 'Property Added!',
            text: 'The listing has been saved to Firebase.',
            confirmButtonColor: '#c9a227',
            timer: 2000,
            showConfirmButton: false
        });
        await loadProperties();
        showSection('properties');
        return docRef.id;
    } catch (err) {
        console.error('Error adding property:', err);
        Swal.fire({
            icon: 'error',
            title: 'Save Failed',
            text: 'Could not save to Firebase. Check Firestore rules.',
            confirmButtonColor: '#c9a227'
        });
        throw err;
    } finally {
        showLoading(false);
    }
}

// UPDATE: Edit existing property
async function updateProperty(id, data) {
    showLoading(true);
    try {
        const docRef = doc(db, 'properties', id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
        Swal.fire({
            icon: 'success',
            title: 'Updated!',
            text: 'Property details have been updated in Firebase.',
            confirmButtonColor: '#c9a227',
            timer: 2000,
            showConfirmButton: false
        });
        await loadProperties();
        showSection('properties');
    } catch (err) {
        console.error('Error updating property:', err);
        Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: 'Could not update the property.',
            confirmButtonColor: '#c9a227'
        });
        throw err;
    } finally {
        showLoading(false);
    }
}

// DELETE: Remove property
async function deleteProperty(id) {
    deleteTargetId = id;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

async function confirmDelete() {
    const id = deleteTargetId;
    if (!id) return;

    const modalEl = document.getElementById('deleteConfirmModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showLoading(true);
    try {
        await deleteDoc(doc(db, 'properties', id));
        Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Property removed from Firebase.',
            confirmButtonColor: '#c9a227',
            timer: 1500,
            showConfirmButton: false
        });
        await loadProperties();
    } catch (err) {
        console.error('Error deleting property:', err);
        Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: 'Could not delete the property.',
            confirmButtonColor: '#c9a227'
        });
    } finally {
        showLoading(false);
        deleteTargetId = null;
    }
}

// ================= RENDER FUNCTIONS =================

function updateStats() {
    const total = allProperties.length;
    const verified = allProperties.filter(p => p.verified).length;
    const pending = allProperties.filter(p => !p.verified).length;
    const withVideo = allProperties.filter(p => p.video && p.video.length > 0).length;

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statVerified').innerText = verified;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('statVideo').innerText = withVideo;
}

function renderRecentTable() {
    const tbody = document.getElementById('recentTableBody');
    const recent = allProperties.slice(0, 5);
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No properties yet. Add your first listing!</td></tr>';
        return;
    }
    tbody.innerHTML = recent.map(p => `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <img src="${p.image || 'https://via.placeholder.com/60x45'}" class="table-thumb" alt="">
              <span class="fw-semibold">${p.title}</span>
            </div>
          </td>
          <td><span class="text-muted">${p.area}</span></td>
          <td class="fw-bold">PKR ${Number(p.rent).toLocaleString()}</td>
          <td>
            ${p.verified
            ? '<span class="badge-verified"><i class="fa-solid fa-shield-check me-1"></i>Verified</span>'
            : '<span class="badge-unverified"><i class="fa-solid fa-clock me-1"></i>Pending</span>'}
          </td>
        </tr>
      `).join('');
}

function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    const searchQuery = (document.getElementById('adminSearchInput')?.value || '').toLowerCase();
    const areaFilter = document.getElementById('adminAreaFilter')?.value || 'all';
    const statusFilter = document.getElementById('adminStatusFilter')?.value || 'all';

    let filtered = allProperties.filter(p => {
        // Search
        if (searchQuery) {
            const match = (p.title || '').toLowerCase().includes(searchQuery) ||
                (p.area || '').toLowerCase().includes(searchQuery) ||
                (p.owner || '').toLowerCase().includes(searchQuery);
            if (!match) return false;
        }
        // Area
        if (areaFilter !== 'all' && p.area !== areaFilter) return false;
        // Status
        if (statusFilter === 'verified' && !p.verified) return false;
        if (statusFilter === 'pending' && p.verified) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No properties match your filters.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
          <td><img src="${p.image || 'https://via.placeholder.com/60x45'}" class="table-thumb" alt=""></td>
          <td>
            <div class="fw-semibold">${p.title}</div>
            <small class="text-muted">${p.owner || 'N/A'}</small>
          </td>
          <td><span class="text-muted">${p.area}</span></td>
          <td><span class="text-capitalize">${p.type}</span></td>
          <td class="fw-bold">PKR ${Number(p.rent).toLocaleString()}</td>
          <td>${p.rooms}</td>
          <td>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" ${p.verified ? 'checked' : ''}
                     onchange="toggleVerified('${p.id}', this.checked)">
            </div>
          </td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-primary rounded-circle p-2" style="width:34px;height:34px;" onclick="editProperty('${p.id}')" title="Edit">
                <i class="fa-solid fa-pen" style="font-size:0.75rem;"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger rounded-circle p-2" style="width:34px;height:34px;" onclick="deleteProperty('${p.id}')" title="Delete">
                <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
}

// ================= TOGGLE VERIFIED =================
async function toggleVerified(id, checked) {
    try {
        const docRef = doc(db, 'properties', id);
        await updateDoc(docRef, {
            verified: checked,
            updatedAt: serverTimestamp()
        });
        const idx = allProperties.findIndex(p => p.id === id);
        if (idx !== -1) allProperties[idx].verified = checked;
        updateStats();
        renderRecentTable();
    } catch (err) {
        console.error('Error toggling verified:', err);
        Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: 'Could not update verification status.',
            confirmButtonColor: '#c9a227'
        });
        // Revert checkbox
        renderAdminTable();
    }
}

// ================= EDIT PROPERTY =================
function editProperty(id) {
    const p = allProperties.find(x => x.id === id);
    if (!p) return;

    document.getElementById('editPropertyId').value = p.id;
    document.getElementById('propTitle').value = p.title || '';
    document.getElementById('propTitleUr').value = p.titleUr || '';
    document.getElementById('propArea').value = p.area || 'Gulshan-e-Iqbal';
    document.getElementById('propType').value = p.type || 'flat';
    document.getElementById('propRent').value = p.rent || '';
    document.getElementById('propRooms').value = p.rooms || 2;
    document.getElementById('propBaths').value = p.baths || 2;
    document.getElementById('propWater').value = p.water || 'line';
    document.getElementById('propLoadShedding').value = p.loadShedding || 2;
    document.getElementById('propGas').value = p.gas || 'high';
    document.getElementById('propDescription').value = p.description || '';
    document.getElementById('propOwner').value = p.owner || '';
    document.getElementById('propWhatsapp').value = p.whatsapp || '';
    document.getElementById('propVideo').value = p.video || '';
    document.getElementById('propVerified').checked = p.verified !== false;
    document.getElementById('propCnicVerified').checked = p.cnicVerified || false;

    // ✅ Image assignment sirf YAHAN
    const imageInput = document.getElementById('propImage');
    imageInput.value = p.image || '';
    imageInput.dataset.publicId = p.imagePublicId || '';
    imageInput.dataset.resourceType = p.imageResourceType || 'image';

    const previewEl = document.getElementById('imagePreviewInline');
    if (p.image) {
        previewEl.src = p.image;
        previewEl.style.display = 'block';
    } else {
        previewEl.style.display = 'none';
    }

    // ✅ URL field mein bhi dikhao (agar Cloudinary URL hai)
    document.getElementById('propImageUrl').value = '';

    document.getElementById('formTitle').innerText = 'Edit Property';
    document.getElementById('saveBtnText').innerText = 'Update Property';
    showSection('addProperty');
    updatePreview();
}

// ================= RESET FORM =================
function resetForm() {
    document.getElementById('propertyForm').reset();
    document.getElementById('editPropertyId').value = '';
    document.getElementById('formTitle').innerText = 'Add New Property';
    document.getElementById('saveBtnText').innerText = 'Save Property';
    // Reset defaults
    const imageInput = document.getElementById('propImage');
    imageInput.value = '';
    imageInput.dataset.publicId = '';
    imageInput.dataset.resourceType = '';
    document.getElementById('imagePreviewInline').style.display = 'none';
    document.getElementById('imageUploadStatus').textContent = '';
    document.getElementById('propType').value = 'flat';
    document.getElementById('propRooms').value = 2;
    document.getElementById('propBaths').value = 2;
    document.getElementById('propWater').value = 'line';
    document.getElementById('propLoadShedding').value = 2;
    document.getElementById('propGas').value = 'high';
    document.getElementById('propVerified').checked = true;
    document.getElementById('propCnicVerified').checked = false;
    updatePreview();
}

// ================= LIVE PREVIEW =================
function updatePreview() {
    const title = document.getElementById('propTitle').value || 'Property Title';
    const rent = document.getElementById('propRent').value || '0';
    const area = document.getElementById('propArea').value;
    const rooms = document.getElementById('propRooms').value || '2';
    const water = document.getElementById('propWater').value;
    const loadShedding = document.getElementById('propLoadShedding').value || '2';
    const image = document.getElementById('propImage').value;

    document.getElementById('previewTitle').innerText = title;
    document.getElementById('previewRent').innerHTML = `PKR ${Number(rent).toLocaleString()}<span class="fs-6 fw-normal text-muted">/mo</span>`;
    document.getElementById('previewArea').innerText = area;
    document.getElementById('previewRooms').innerText = rooms;

    const waterBadge = document.getElementById('previewWaterBadge');
    waterBadge.innerHTML = water === 'line'
        ? '<i class="fa-solid fa-droplet me-1"></i>Line Water'
        : '<i class="fa-solid fa-truck me-1"></i>Tanker';

    const loadBadge = document.getElementById('previewLoadBadge');
    loadBadge.innerHTML = loadShedding === '0'
        ? '<i class="fa-solid fa-bolt me-1"></i>No Load-shed'
        : `<i class="fa-solid fa-bolt me-1"></i>${loadShedding}h Load-shed`;

    if (image && image.startsWith('http')) {
        document.getElementById('previewImage').src = image;
    } else {
        document.getElementById('previewImage').src = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&auto=format&fit=crop&q=60';
    }
}

// Attach preview listeners
document.addEventListener('DOMContentLoaded', () => {
    const previewFields = ['propTitle', 'propRent', 'propArea', 'propRooms', 'propWater', 'propLoadShedding', 'propImage'];
    previewFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        }
    });

    // Load initial data
    loadProperties();
});

// ================= FORM SUBMIT =================
document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('editPropertyId').value;
    const imageInput = document.getElementById('propImage');

    const data = {
        title: document.getElementById('propTitle').value.trim(),
        titleUr: document.getElementById('propTitleUr').value.trim() || document.getElementById('propTitle').value.trim(),
        area: document.getElementById('propArea').value,
        type: document.getElementById('propType').value,
        rent: Number(document.getElementById('propRent').value),
        rooms: Number(document.getElementById('propRooms').value),
        baths: Number(document.getElementById('propBaths').value),
        water: document.getElementById('propWater').value,
        loadShedding: Number(document.getElementById('propLoadShedding').value),
        gas: document.getElementById('propGas').value,
        description: document.getElementById('propDescription').value.trim(),
        owner: document.getElementById('propOwner').value.trim(),
        whatsapp: document.getElementById('propWhatsapp').value.replace(/[^0-9]/g, ''),
        video: document.getElementById('propVideo').value.trim(),
        verified: document.getElementById('propVerified').checked,
        cnicVerified: document.getElementById('propCnicVerified').checked,
        landmarks: ["Near Main Road"],
        // ✅ Sirf ek baar image
        image: imageInput.value.trim(),
        imagePublicId: imageInput.dataset.publicId || '',
        imageResourceType: imageInput.dataset.resourceType || 'image',
    };

    // Validate
    if (!data.title || !data.rent || !data.owner || !data.whatsapp || !data.image) {
        Swal.fire({
            icon: 'warning',
            title: 'Missing Fields',
            text: 'Please fill all required fields (Title, Rent, Owner, WhatsApp, Image).',
            confirmButtonColor: '#c9a227'
        });
        return;
    }

    try {
        if (editId) {
            await updateProperty(editId, data);
        } else {
            await addProperty(data);
        }
    } catch (err) {
        // Error already handled in add/update functions
    }
});

// ================= EXPORT MODULE FUNCTIONS =================
// Make sure functions are available globally
window.loadProperties = loadProperties;
window.renderAdminTable = renderAdminTable;
window.showSection = showSection;
window.editProperty = editProperty;
window.deleteProperty = deleteProperty;
window.confirmDelete = confirmDelete;
window.resetForm = resetForm;
window.updatePreview = updatePreview;
window.toggleVerified = toggleVerified;
window.addProperty = addProperty;
window.updateProperty = updateProperty;
window.handleImageUpload = handleImageUpload;
window.setImageFromUrl = setImageFromUrl;
