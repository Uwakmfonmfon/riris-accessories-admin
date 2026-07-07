// ===== SUPABASE SETUP =====
const SUPABASE_URL = 'https://vfjkaishjrxzhqcfeamd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmamthaXNoanJ4emhxY2ZlYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzI1NjQsImV4cCI6MjA5ODMwODU2NH0.6v7b1jMx8H_L9qfiz6nUdY-yAlb-sJXUG7Z_EK72kIM';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CAT_LABELS = { jewelry: 'Jewelry', bags: 'Bags', watches: 'Watches', other: 'Other' };

// ===== STATE =====
let currentImageUrl = null; // holds the Supabase Storage public URL after upload
let allProducts = [];

// ===== AUTH =====
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

  btn.disabled = false;
  btn.textContent = 'Sign In →';

  if (error) {
    errEl.textContent = 'Incorrect email or password.';
    errEl.style.display = 'block';
    return;
  }

  enterAdmin(email);
}

async function doSignOut() {
  await supabase.auth.signOut();
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
}

function enterAdmin(email) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'flex';
  document.getElementById('headerEmail').textContent = email;
  loadProducts();
}

// Check for existing session on page load
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    enterAdmin(session.user.email);
  }
}

// ===== PRODUCTS =====
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Failed to load products');
    return;
  }

  allProducts = data || [];
  renderTable();
  updateStats();
}

function renderTable() {
  const tbody = document.getElementById('productsTableBody');
  document.getElementById('sidebarCount').textContent = allProducts.length;

  if (!allProducts.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">✦</div><p>No products yet. Add your first one!</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = allProducts.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="thumb">
            ${p.image_url
              ? `<img src="${p.image_url}" alt="${p.name}" onerror="this.parentElement.innerHTML='✦'">`
              : '✦'}
          </div>
          <span class="product-name-cell">${p.name}</span>
        </div>
      </td>
      <td><span class="cat-badge cat-${p.category}">${CAT_LABELS[p.category] || p.category}</span></td>
      <td><strong>₦${Number(p.price).toLocaleString()}</strong></td>
      <td><span class="stock-badge ${p.in_stock ? 'in-stock' : 'out-stock'}">${p.in_stock ? 'In Stock' : 'Sold Out'}</span></td>
      <td>
        <div class="tbl-btns">
          <button class="tbl-btn edit-btn" onclick="editProduct(${p.id})">✏️ Edit</button>
          <button class="tbl-btn del-btn" onclick="deleteProduct(${p.id}, this)">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateStats() {
  ['jewelry','bags','watches','other'].forEach(cat => {
    const el = document.getElementById(`s-${cat}`);
    if (el) el.textContent = allProducts.filter(p => p.category === cat).length;
  });
}

// ===== IMAGE UPLOAD — CLOUD VERSION =====
async function handleImageSelect(input) {
  const file = input.files[0];
  if (!file) return;

  // Validate
  if (!file.type.startsWith('image/')) {
    setUploadStatus('Not a valid image file.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setUploadStatus('Image too large — max 5MB.', 'error');
    return;
  }

  // Show local preview immediately so the owner sees feedback
  const localUrl = URL.createObjectURL(file);
  showPreview(localUrl);
  setUploadStatus('Uploading to cloud...', 'uploading');

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    setUploadStatus(`Upload failed: ${uploadError.message}`, 'error');
    clearImage();
    return;
  }

  // Get the permanent public URL
  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  currentImageUrl = urlData.publicUrl;

  // Update preview to the real cloud URL
  document.getElementById('imgPreview').src = currentImageUrl;
  setUploadStatus('✓ Image uploaded successfully', 'success');
  document.getElementById('clearImgBtn').style.display = 'inline-block';
}

function showPreview(url) {
  document.getElementById('uploadPlaceholder').style.display = 'none';
  const wrap = document.getElementById('imgPreviewWrap');
  wrap.style.display = 'block';
  document.getElementById('imgPreview').src = url;
}

function setUploadStatus(msg, type) {
  const el = document.getElementById('uploadStatus');
  el.textContent = msg;
  el.className = `upload-status ${type}`;
}

function clearImage() {
  currentImageUrl = null;
  document.getElementById('imgFileInput').value = '';
  document.getElementById('imgPreview').src = '';
  document.getElementById('imgPreviewWrap').style.display = 'none';
  document.getElementById('uploadPlaceholder').style.display = 'block';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('uploadStatus').className = 'upload-status';
  document.getElementById('clearImgBtn').style.display = 'none';
}

// Drag & drop support
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  // Assign to the file input so our handler runs
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById('imgFileInput');
  try { input.files = dt.files; } catch(e) {}
  handleImageSelect(input);
});

// ===== SAVE PRODUCT =====
async function saveProduct() {
  const name = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const cat = document.getElementById('pCat').value;
  const desc = document.getElementById('pDesc').value.trim();
  const inStock = document.getElementById('pInStock').checked;
  const editingId = document.getElementById('editingId').value;
  const errEl = document.getElementById('formErrorMsg');
  const btn = document.getElementById('saveBtn');

  errEl.style.display = 'none';
  if (!name) { showFormError('Product name is required.'); return; }
  if (!price || price <= 0) { showFormError('Enter a valid price.'); return; }
  if (!cat) { showFormError('Please select a category.'); return; }

  // Check if image is still uploading
  const status = document.getElementById('uploadStatus');
  if (status.classList.contains('uploading')) {
    showFormError('Please wait for the image to finish uploading.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    name,
    price,
    category: cat,
    description: desc || null,
    image_url: currentImageUrl,
    in_stock: inStock,
  };

  let dbError;

  if (editingId) {
    const { error } = await supabase.from('products').update(payload).eq('id', parseInt(editingId));
    dbError = error;
  } else {
    const { error } = await supabase.from('products').insert(payload);
    dbError = error;
  }

  btn.disabled = false;
  btn.textContent = '💾 Save Product';

  if (dbError) {
    showFormError(`Save failed: ${dbError.message}`);
    return;
  }

  showToast(editingId ? 'Product updated ✓' : 'Product added ✓');
  resetForm();
  await loadProducts();
  showPanel('products');
}

function showFormError(msg) {
  const el = document.getElementById('formErrorMsg');
  el.textContent = msg;
  el.style.display = 'block';
}

// ===== EDIT =====
function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  document.getElementById('formPanelTitle').textContent = 'Edit Product';
  document.getElementById('editingId').value = id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pCat').value = p.category;
  document.getElementById('pDesc').value = p.description || '';
  document.getElementById('pInStock').checked = p.in_stock;

  if (p.image_url) {
    currentImageUrl = p.image_url;
    showPreview(p.image_url);
    document.getElementById('clearImgBtn').style.display = 'inline-block';
    setUploadStatus('✓ Existing image loaded', 'success');
  } else {
    clearImage();
  }

  showPanel('add');
}

// ===== DELETE =====
async function deleteProduct(id, btn) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  btn.disabled = true;
  btn.textContent = '...';
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    showToast('Delete failed: ' + error.message);
    btn.disabled = false;
    btn.textContent = '🗑️ Delete';
    return;
  }
  showToast('Product deleted');
  await loadProducts();
}

// ===== FORM RESET =====
function resetForm() {
  document.getElementById('formPanelTitle').textContent = 'Add New Product';
  document.getElementById('editingId').value = '';
  document.getElementById('pName').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pCat').value = '';
  document.getElementById('pDesc').value = '';
  document.getElementById('pInStock').checked = true;
  document.getElementById('formErrorMsg').style.display = 'none';
  clearImage();
}

// ===== PANELS =====
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  if (name !== 'add') resetForm();
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== INIT =====
checkSession();