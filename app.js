// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEhlQs9DfEsiC8okNbu9p-pYewPALFvPg",
  authDomain: "jobtracker-582b9.firebaseapp.com",
  projectId: "jobtracker-582b9",
  storageBucket: "jobtracker-582b9.firebasestorage.app",
  messagingSenderId: "419043976290",
  appId: "1:419043976290:web:b1ec09ed4dfda93ab59d3b"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetForm = document.getElementById('reset-form');
const authMessage = document.getElementById('auth-message');
const modal = document.getElementById('modal');
const deleteModal = document.getElementById('delete-modal');
const loading = document.getElementById('loading');

// Current user
let currentUser = null;
let deleteCallback = null;

// Form field configurations for each category
const formConfigs = {
    permits: {
        title: 'Permit',
        fields: [
            { name: 'permitNumber', label: 'Permit Number', type: 'text', required: true },
            { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
            { name: 'customerPhone', label: 'Customer Phone', type: 'tel', required: true },
            { name: 'county', label: 'County', type: 'select', options: ['Wicomico', 'Worcester', 'Somerset', 'Dorchester', 'Talbot', 'Caroline', "Queen Anne's", 'Kent', 'Cecil', 'Harford', 'Sussex DE', 'Kent DE', 'New Castle DE'], required: true },
            { name: 'address', label: 'Address', type: 'text', required: true },
            { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'In Progress', 'Completed', 'Denied'], required: true },
            { name: 'dateSubmitted', label: 'Date Submitted', type: 'date', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    vehicles: {
        title: 'Vehicle',
        fields: [
            { name: 'vehicleName', label: 'Vehicle Name/ID', type: 'text', required: true },
            { name: 'make', label: 'Make', type: 'text', required: true },
            { name: 'model', label: 'Model', type: 'text', required: true },
            { name: 'year', label: 'Year', type: 'number', required: true },
            { name: 'licensePlate', label: 'License Plate', type: 'text', required: true },
            { name: 'mileage', label: 'Current Mileage', type: 'number', required: false },
            { name: 'lastService', label: 'Last Service Date', type: 'date', required: false },
            { name: 'status', label: 'Status', type: 'select', options: ['Active', 'In Service', 'Out of Service'], required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    bills: {
        title: 'Bill',
        fields: [
            { name: 'vendor', label: 'Vendor/Company', type: 'text', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
            { name: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', required: true },
            { name: 'dueDate', label: 'Due Date', type: 'date', required: true },
            { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Paid', 'Overdue'], required: true },
            { name: 'category', label: 'Category', type: 'select', options: ['Utilities', 'Insurance', 'Supplies', 'Equipment', 'Services', 'Other'], required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    activity: {
        title: 'Activity',
        fields: [
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'jobSite', label: 'Job Site/Location', type: 'text', required: true },
            { name: 'description', label: 'Work Description', type: 'textarea', required: true },
            { name: 'hoursWorked', label: 'Hours Worked', type: 'number', step: '0.5', required: true },
            { name: 'workers', label: 'Workers/Crew', type: 'text', required: false },
            { name: 'equipment', label: 'Equipment Used', type: 'text', required: false },
            { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false }
        ]
    }
};

// Show/Hide Loading
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

// Show Message
function showMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.className = `message ${isError ? 'error' : 'success'}`;
    authMessage.classList.remove('hidden');
    setTimeout(() => authMessage.classList.add('hidden'), 5000);
}

// Auth Form Switching
document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    resetForm.classList.add('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    resetForm.classList.add('hidden');
});

document.getElementById('show-reset').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
});

document.getElementById('show-login-from-reset').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    resetForm.classList.add('hidden');
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showMessage(error.message, true);
    }

    hideLoading();
});

// Sign Up
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
        showMessage('Passwords do not match', true);
        hideLoading();
        return;
    }

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        showMessage('Account created successfully!');
    } catch (error) {
        showMessage(error.message, true);
    }

    hideLoading();
});

// Reset Password
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const email = document.getElementById('reset-email').value;

    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset email sent! Check your inbox.');
        loginForm.classList.remove('hidden');
        resetForm.classList.add('hidden');
    } catch (error) {
        showMessage(error.message, true);
    }

    hideLoading();
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    showLoading();
    await auth.signOut();
    hideLoading();
});

// Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadAllData();
    } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active panel
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
        document.getElementById(`${tabId}-tab`).classList.remove('hidden');
    });
});

// Modal Functions
function openModal(category, editData = null) {
    const config = formConfigs[category];
    const modalTitle = document.getElementById('modal-title');
    const modalFields = document.getElementById('modal-fields');
    const modalForm = document.getElementById('modal-form');

    modalTitle.textContent = editData ? `Edit ${config.title}` : `Add ${config.title}`;
    modalFields.innerHTML = '';

    config.fields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = field.label;
        label.setAttribute('for', `field-${field.name}`);
        div.appendChild(label);

        let input;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
        } else if (field.type === 'select') {
            input = document.createElement('select');
            field.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type;
            if (field.step) input.step = field.step;
        }

        input.id = `field-${field.name}`;
        input.name = field.name;
        input.required = field.required;

        if (editData && editData[field.name]) {
            input.value = editData[field.name];
        }

        div.appendChild(input);
        modalFields.appendChild(div);
    });

    // Store category and edit data on form
    modalForm.dataset.category = category;
    modalForm.dataset.editId = editData ? editData.id : '';

    modal.classList.remove('hidden');
}

function closeModal() {
    // Blur any focused input to dismiss keyboard
    if (document.activeElement) {
        document.activeElement.blur();
    }
    modal.classList.add('hidden');
    document.getElementById('modal-form').reset();
}

// Modal Event Listeners
document.querySelector('.modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-cancel').addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Add buttons
document.getElementById('add-permit-btn').addEventListener('click', () => openModal('permits'));
document.getElementById('add-vehicle-btn').addEventListener('click', () => openModal('vehicles'));
document.getElementById('add-bill-btn').addEventListener('click', () => openModal('bills'));
document.getElementById('add-activity-btn').addEventListener('click', () => openModal('activity'));

// Helper function to add timeout to promises
function withTimeout(promise, ms) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), ms)
    );
    return Promise.race([promise, timeout]);
}

// Form Submit
document.getElementById('modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const category = form.dataset.category;
    const editId = form.dataset.editId;
    const config = formConfigs[category];

    const data = {
        userId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    config.fields.forEach(field => {
        const input = document.getElementById(`field-${field.name}`);
        data[field.name] = input.value;
    });

    // Close modal first for better UX
    closeModal();
    showLoading();

    try {
        if (editId) {
            data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            delete data.createdAt;
            await withTimeout(db.collection(category).doc(editId).update(data), 15000);
        } else {
            await withTimeout(db.collection(category).add(data), 15000);
        }
        await withTimeout(loadData(category), 10000);
    } catch (error) {
        alert('Error saving data: ' + error.message);
        console.error('Save error:', error);
    }
    hideLoading();
});

// Delete Confirmation
function showDeleteConfirm(callback) {
    deleteCallback = callback;
    deleteModal.classList.remove('hidden');
}

document.getElementById('cancel-delete').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteCallback = null;
});

document.getElementById('confirm-delete').addEventListener('click', async () => {
    if (deleteCallback) {
        showLoading();
        await deleteCallback();
        hideLoading();
    }
    deleteModal.classList.add('hidden');
    deleteCallback = null;
});

// Load Data Functions
async function loadAllData() {
    showLoading();
    await Promise.all([
        loadData('permits'),
        loadData('vehicles'),
        loadData('bills'),
        loadData('activity')
    ]);
    hideLoading();
}

async function loadData(category) {
    if (!currentUser) return;

    const listElement = document.getElementById(`${category}-list`);
    listElement.innerHTML = '<p class="loading-text">Loading...</p>';

    try {
        const snapshot = await db.collection(category)
            .where('userId', '==', currentUser.uid)
            .get();

        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        // Sort items based on category
        if (category === 'permits') {
            // Sort permits alphabetically by customer last name
            items.sort((a, b) => {
                const getLastName = (name) => {
                    if (!name) return '';
                    const parts = name.trim().split(/\s+/);
                    return parts[parts.length - 1].toLowerCase();
                };
                return getLastName(a.customerName).localeCompare(getLastName(b.customerName));
            });
        } else {
            // Sort other categories by createdAt descending
            items.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
        }

        renderList(category, items);

        // Update county filter for permits
        if (category === 'permits') {
            updateCountyFilter(items);
        }
    } catch (error) {
        listElement.innerHTML = `<p class="error-text">Error loading data: ${error.message}</p>`;
    }
}

function updateCountyFilter(items) {
    const select = document.getElementById('permit-sort');
    const counties = [...new Set(items.map(item => item.county).filter(Boolean))].sort();

    // Preserve current selection
    const currentValue = select.value;

    select.innerHTML = '<option value="all">All Counties</option>';
    counties.forEach(county => {
        const option = document.createElement('option');
        option.value = county;
        option.textContent = county;
        select.appendChild(option);
    });

    // Restore selection if still valid
    if (counties.includes(currentValue) || currentValue === 'all') {
        select.value = currentValue;
    }
}

// County filter event
document.getElementById('permit-sort').addEventListener('change', () => {
    loadData('permits');
});

function renderList(category, items) {
    const listElement = document.getElementById(`${category}-list`);

    // Apply county filter for permits
    if (category === 'permits') {
        const filterValue = document.getElementById('permit-sort').value;
        if (filterValue !== 'all') {
            items = items.filter(item => item.county === filterValue);
        }
    }

    if (items.length === 0) {
        listElement.innerHTML = '<p class="empty-text">No entries yet. Click "+ Add" to create one.</p>';
        return;
    }

    listElement.innerHTML = '';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        let cardContent = '';

        switch (category) {
            case 'permits':
                cardContent = `
                    <div class="card-header">
                        <span class="card-title">${escapeHtml(item.permitNumber)}</span>
                        <span class="status-badge status-${item.status?.toLowerCase().replace(' ', '-')}">${escapeHtml(item.status)}</span>
                    </div>
                    <div class="card-details">
                        <p><strong>Customer:</strong> ${escapeHtml(item.customerName)}</p>
                        <p><strong>Phone:</strong> <a href="tel:${escapeHtml(item.customerPhone)}">${escapeHtml(item.customerPhone)}</a></p>
                        <p><strong>County:</strong> ${escapeHtml(item.county)}</p>
                        <p><strong>Address:</strong> ${escapeHtml(item.address)}</p>
                        <p><strong>Submitted:</strong> ${escapeHtml(item.dateSubmitted)}</p>
                        ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                    <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
                `;
                break;

            case 'vehicles':
                cardContent = `
                    <div class="card-header">
                        <span class="card-title">${escapeHtml(item.vehicleName)}</span>
                        <span class="status-badge status-${item.status?.toLowerCase().replace(' ', '-')}">${escapeHtml(item.status)}</span>
                    </div>
                    <div class="card-details">
                        <p><strong>Vehicle:</strong> ${escapeHtml(item.year)} ${escapeHtml(item.make)} ${escapeHtml(item.model)}</p>
                        <p><strong>License:</strong> ${escapeHtml(item.licensePlate)}</p>
                        ${item.mileage ? `<p><strong>Mileage:</strong> ${escapeHtml(item.mileage)}</p>` : ''}
                        ${item.lastService ? `<p><strong>Last Service:</strong> ${escapeHtml(item.lastService)}</p>` : ''}
                        ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                    <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
                `;
                break;

            case 'bills':
                cardContent = `
                    <div class="card-header">
                        <span class="card-title">${escapeHtml(item.vendor)}</span>
                        <span class="status-badge status-${item.status?.toLowerCase()}">${escapeHtml(item.status)}</span>
                    </div>
                    <div class="card-details">
                        <p><strong>Description:</strong> ${escapeHtml(item.description)}</p>
                        <p><strong>Amount:</strong> $${parseFloat(item.amount).toFixed(2)}</p>
                        <p><strong>Due Date:</strong> ${escapeHtml(item.dueDate)}</p>
                        <p><strong>Category:</strong> ${escapeHtml(item.category)}</p>
                        ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                    <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
                `;
                break;

            case 'activity':
                cardContent = `
                    <div class="card-header">
                        <span class="card-title">${escapeHtml(item.date)}</span>
                        <span class="hours-badge">${escapeHtml(item.hoursWorked)} hrs</span>
                    </div>
                    <div class="card-details">
                        <p><strong>Location:</strong> ${escapeHtml(item.jobSite)}</p>
                        <p><strong>Work:</strong> ${escapeHtml(item.description)}</p>
                        ${item.workers ? `<p><strong>Crew:</strong> ${escapeHtml(item.workers)}</p>` : ''}
                        ${item.equipment ? `<p><strong>Equipment:</strong> ${escapeHtml(item.equipment)}</p>` : ''}
                        ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                    <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
                `;
                break;
        }

        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
            </div>
        `;

        card.innerHTML = cardContent;

        // Edit button
        card.querySelector('.btn-edit').addEventListener('click', () => {
            openModal(category, item);
        });

        // Delete button
        card.querySelector('.btn-danger').addEventListener('click', () => {
            showDeleteConfirm(async () => {
                try {
                    await db.collection(category).doc(item.id).delete();
                    loadData(category);
                } catch (error) {
                    alert('Error deleting: ' + error.message);
                }
            });
        });

        listElement.appendChild(card);
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format Firestore timestamp
function formatDate(timestamp) {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Dismiss keyboard when tapping outside input fields
document.addEventListener('click', (e) => {
    const activeElement = document.activeElement;
    const isInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT'
    );

    if (isInput) {
        const clickedOnInput = e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.tagName === 'SELECT' ||
            e.target.tagName === 'LABEL';

        if (!clickedOnInput) {
            activeElement.blur();
        }
    }
});

// Invite button - Share functionality
document.getElementById('invite-btn').addEventListener('click', async () => {
    const shareData = {
        title: 'Job Tracker',
        text: 'Check out Job Tracker - a simple app to track permits, vehicles, bills, and daily activity!',
        url: 'https://chrisgorham999.github.io/JobTracker'
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback for browsers that don't support Web Share API
            await navigator.clipboard.writeText(shareData.url);
            alert('Link copied to clipboard! Share it with others.');
        }
    } catch (error) {
        // User cancelled or error occurred
        if (error.name !== 'AbortError') {
            console.error('Error sharing:', error);
        }
    }
});
