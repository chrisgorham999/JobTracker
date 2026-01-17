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

// Admin user IDs - add your admin UIDs here
const ADMIN_UIDS = [
    'H9Iu95HshTNjQ86JZlH36hHsBw02'  // Replace with your actual UID from Firebase Console
];

// Check if current user is admin
function isAdmin() {
    return currentUser && ADMIN_UIDS.includes(currentUser.uid);
}

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
        title: 'Task',
        fields: [
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'task', label: 'Task', type: 'text', required: true }
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
        updateAdminUI();
        loadAllData();
    } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// Update UI based on admin status
function updateAdminUI() {
    const adminElements = document.querySelectorAll('.admin-only');
    if (isAdmin()) {
        adminElements.forEach(el => el.classList.remove('hidden'));
        document.body.classList.add('is-admin');
    } else {
        adminElements.forEach(el => el.classList.add('hidden'));
        document.body.classList.remove('is-admin');
    }
}

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
        // All authenticated users can see all data
        const snapshot = await db.collection(category).get();

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

// Track collapsed state for county groups and activity dates
const collapsedCounties = new Set();
const collapsedDates = new Set();

// Helper function to create a task line item
function createTaskItem(item, category) {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';

    const adminActions = isAdmin() ? `
        <div class="task-actions">
            <button class="btn-icon btn-edit-task" data-id="${item.id}" aria-label="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
            <button class="btn-icon btn-delete-task" data-id="${item.id}" aria-label="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    ` : '';

    taskItem.innerHTML = `
        <span class="task-text">${escapeHtml(item.task)}</span>
        ${adminActions}
    `;

    if (isAdmin()) {
        // Edit button
        taskItem.querySelector('.btn-edit-task').addEventListener('click', () => {
            openModal(category, item);
        });

        // Delete button
        taskItem.querySelector('.btn-delete-task').addEventListener('click', () => {
            showDeleteConfirm(async () => {
                try {
                    await db.collection(category).doc(item.id).delete();
                    loadData(category);
                } catch (error) {
                    alert('Error deleting: ' + error.message);
                }
            });
        });
    }

    return taskItem;
}

// Helper function to create a permit card
function createPermitCard(item, category) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const adminActions = isAdmin() ? `
        <div class="card-actions">
            <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
            <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
        </div>
    ` : '';

    card.innerHTML = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(item.permitNumber)}</span>
            <span class="status-badge status-${item.status?.toLowerCase().replace(' ', '-')}">${escapeHtml(item.status)}</span>
        </div>
        <div class="card-details">
            <p><strong>Customer:</strong> ${escapeHtml(item.customerName)}</p>
            <p><strong>Phone:</strong> <a href="tel:${escapeHtml(item.customerPhone)}">${escapeHtml(item.customerPhone)}</a></p>
            <p><strong>Address:</strong> ${escapeHtml(item.address)}</p>
            <p><strong>Submitted:</strong> ${escapeHtml(item.dateSubmitted)}</p>
            ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
        </div>
        <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
        ${adminActions}
    `;

    if (isAdmin()) {
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
    }

    return card;
}

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

    // For permits, group by county
    if (category === 'permits') {
        // Group items by county
        const groupedByCounty = {};
        items.forEach(item => {
            const county = item.county || 'Unknown';
            if (!groupedByCounty[county]) {
                groupedByCounty[county] = [];
            }
            groupedByCounty[county].push(item);
        });

        // Sort counties alphabetically
        const sortedCounties = Object.keys(groupedByCounty).sort();

        sortedCounties.forEach(county => {
            const countyItems = groupedByCounty[county];
            const isCollapsed = collapsedCounties.has(county);

            // Create county group container
            const groupDiv = document.createElement('div');
            groupDiv.className = 'county-group';

            // Create collapsible header
            const header = document.createElement('div');
            header.className = `county-header ${isCollapsed ? 'collapsed' : ''}`;
            header.innerHTML = `
                <span class="county-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="county-name">${escapeHtml(county)}</span>
                <span class="county-count">(${countyItems.length})</span>
            `;
            header.addEventListener('click', () => {
                if (collapsedCounties.has(county)) {
                    collapsedCounties.delete(county);
                } else {
                    collapsedCounties.add(county);
                }
                renderList(category, items);
            });
            groupDiv.appendChild(header);

            // Create content container
            const content = document.createElement('div');
            content.className = `county-content ${isCollapsed ? 'collapsed' : ''}`;

            // Add permit cards for this county
            countyItems.forEach(item => {
                const card = createPermitCard(item, category);
                content.appendChild(card);
            });

            groupDiv.appendChild(content);
            listElement.appendChild(groupDiv);
        });
        return;
    }

    // For activity, group by date with collapsible sections
    if (category === 'activity') {
        // Group items by date
        const groupedByDate = {};
        items.forEach(item => {
            const date = item.date || 'No Date';
            if (!groupedByDate[date]) {
                groupedByDate[date] = [];
            }
            groupedByDate[date].push(item);
        });

        // Sort dates in descending order (most recent first)
        const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
            return new Date(b) - new Date(a);
        });

        sortedDates.forEach(date => {
            const dateItems = groupedByDate[date];
            const isCollapsed = collapsedDates.has(date);

            // Format the date for display
            const displayDate = date !== 'No Date'
                ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : 'No Date';

            // Create date group container
            const groupDiv = document.createElement('div');
            groupDiv.className = 'date-group';

            // Create collapsible header
            const header = document.createElement('div');
            header.className = `date-header ${isCollapsed ? 'collapsed' : ''}`;
            header.innerHTML = `
                <span class="date-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="date-name">${escapeHtml(displayDate)}</span>
                <span class="date-count">${dateItems.length} task${dateItems.length !== 1 ? 's' : ''}</span>
            `;
            header.addEventListener('click', () => {
                if (collapsedDates.has(date)) {
                    collapsedDates.delete(date);
                } else {
                    collapsedDates.add(date);
                }
                renderList(category, items);
            });
            groupDiv.appendChild(header);

            // Create content container
            const content = document.createElement('div');
            content.className = `date-content ${isCollapsed ? 'collapsed' : ''}`;

            // Add task items for this date
            dateItems.forEach(item => {
                const taskItem = createTaskItem(item, category);
                content.appendChild(taskItem);
            });

            groupDiv.appendChild(content);
            listElement.appendChild(groupDiv);
        });
        return;
    }

    // For other categories (vehicles, bills), render normally
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        let cardContent = '';

        switch (category) {
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
        }

        if (isAdmin()) {
            cardContent += `
                <div class="card-actions">
                    <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                    <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
                </div>
            `;
        }

        card.innerHTML = cardContent;

        if (isAdmin()) {
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
        }

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
