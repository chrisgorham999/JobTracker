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
const storage = firebase.storage();

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const pendingApprovalContainer = document.getElementById('pending-approval-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetForm = document.getElementById('reset-form');
const authMessage = document.getElementById('auth-message');
const modal = document.getElementById('modal');
const legalModal = document.getElementById('legal-modal');
const legalTitle = document.getElementById('legal-title');
const legalBody = document.getElementById('legal-body');
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

// Check if user is approved or is an admin
async function checkUserApproval(user) {
    if (!user) return { approved: false, pending: false };

    // Admins always bypass approval
    if (ADMIN_UIDS.includes(user.uid)) {
        return { approved: true, pending: false, isAdmin: true };
    }

    try {
        // Check if user is in approvedUsers collection
        const approvedDoc = await db.collection('approvedUsers').doc(user.uid).get();
        if (approvedDoc.exists) {
            return { approved: true, pending: false };
        }

        // Check if user is in pendingUsers collection
        const pendingDoc = await db.collection('pendingUsers').doc(user.uid).get();
        if (pendingDoc.exists) {
            return { approved: false, pending: true };
        }

        // User is not in either collection (edge case - shouldn't happen)
        // Treat as orphaned
        return { approved: false, pending: false, orphaned: true };
    } catch (error) {
        console.error('Error checking user approval:', error);
        return { approved: false, pending: false, error: true };
    }
}

// Flag an item for follow up
async function flagForFollowUp(category, itemId, itemTitle) {
    if (!currentUser) return;

    try {
        await db.collection('followups').add({
            category: category,
            itemId: itemId,
            itemTitle: itemTitle,
            flaggedBy: currentUser.uid,
            flaggedByEmail: currentUser.email,
            flaggedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Item flagged for follow up!');
    } catch (error) {
        alert('Error flagging item: ' + error.message);
        console.error('Flag error:', error);
    }
}

// Dismiss a follow up (admin only)
async function dismissFollowUp(followupId) {
    if (!isAdmin()) return;

    try {
        await db.collection('followups').doc(followupId).delete();
        loadFollowUps();
    } catch (error) {
        alert('Error dismissing follow up: ' + error.message);
        console.error('Dismiss error:', error);
    }
}

// Load follow ups for all users on Home tab
async function loadFollowUps() {
    const followupsList = document.getElementById('followups-list');
    const followupsCount = document.getElementById('followups-count');

    try {
        const snapshot = await db.collection('followups').orderBy('flaggedAt', 'desc').get();

        const followups = [];
        snapshot.forEach(doc => {
            followups.push({ id: doc.id, ...doc.data() });
        });

        followupsCount.textContent = followups.length;

        if (followups.length === 0) {
            followupsList.innerHTML = '<p class="empty-text">No flagged items.</p>';
            return;
        }

        followupsList.innerHTML = '';

        for (const followup of followups) {
            const item = document.createElement('div');
            item.className = 'followup-item';

            const categoryLabel = followup.category.charAt(0).toUpperCase() + followup.category.slice(1);
            const flaggedDate = followup.flaggedAt ?
                followup.flaggedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) :
                'Unknown';

            // Only show dismiss button for admins
            const dismissButton = isAdmin() ?
                `<button class="btn btn-small btn-dismiss" data-id="${followup.id}">Dismiss</button>` : '';

            item.innerHTML = `
                <div class="followup-content">
                    <span class="followup-category">${escapeHtml(categoryLabel)}</span>
                    <span class="followup-title">${escapeHtml(followup.itemTitle)}</span>
                    <span class="followup-meta">Flagged by ${escapeHtml(followup.flaggedByEmail)} on ${flaggedDate}</span>
                </div>
                <div class="followup-actions">
                    <button class="btn btn-small btn-view" data-category="${followup.category}" data-id="${followup.itemId}">View</button>
                    ${dismissButton}
                </div>
            `;

            // View button - switch to the relevant tab
            item.querySelector('.btn-view').addEventListener('click', () => {
                const tabBtn = document.querySelector(`[data-tab="${followup.category}"]`);
                if (tabBtn) tabBtn.click();
            });

            // Dismiss button (only for admins)
            const dismissBtn = item.querySelector('.btn-dismiss');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    dismissFollowUp(followup.id);
                });
            }

            followupsList.appendChild(item);
        }
    } catch (error) {
        console.error('Error loading follow ups:', error);
    }
}

// Load pending users for admin approval (admin only)
async function loadPendingUsers() {
    if (!isAdmin()) return;

    const pendingList = document.getElementById('pending-users-list');
    const pendingCount = document.getElementById('pending-count');

    try {
        const snapshot = await db.collection('pendingUsers').orderBy('signupDate', 'desc').get();

        const pendingUsers = [];
        snapshot.forEach(doc => {
            pendingUsers.push({ id: doc.id, ...doc.data() });
        });

        pendingCount.textContent = pendingUsers.length;

        if (pendingUsers.length === 0) {
            pendingList.innerHTML = '<p class="empty-text">No pending user approvals.</p>';
            return;
        }

        pendingList.innerHTML = '';

        for (const user of pendingUsers) {
            const item = document.createElement('div');
            item.className = 'pending-user-item';

            const signupDate = user.signupDate ?
                user.signupDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) :
                'Unknown';

            item.innerHTML = `
                <div class="pending-user-content">
                    <span class="pending-user-email">${escapeHtml(user.email)}</span>
                    <span class="pending-user-meta">Signed up on ${signupDate}</span>
                </div>
                <div class="pending-user-actions">
                    <button class="btn btn-small btn-approve" data-uid="${user.uid}">Approve</button>
                    <button class="btn btn-small btn-danger btn-reject" data-uid="${user.uid}">Reject</button>
                </div>
            `;

            // Approve button
            item.querySelector('.btn-approve').addEventListener('click', () => {
                approvePendingUser(user.uid, user.email, user.signupDate);
            });

            // Reject button
            item.querySelector('.btn-reject').addEventListener('click', () => {
                rejectPendingUser(user.uid, user.email);
            });

            pendingList.appendChild(item);
        }
    } catch (error) {
        console.error('Error loading pending users:', error);
        pendingList.innerHTML = `<p class="error-text">Error loading pending users: ${error.message}</p>`;
    }
}

// Approve a pending user (admin only)
async function approvePendingUser(uid, email, signupDate) {
    if (!isAdmin()) return;

    if (!confirm(`Approve user ${email}?`)) return;

    showLoading();
    try {
        // Add to approvedUsers collection
        await db.collection('approvedUsers').doc(uid).set({
            uid: uid,
            email: email,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: currentUser.uid,
            signupDate: signupDate
        });

        // Remove from pendingUsers collection
        await db.collection('pendingUsers').doc(uid).delete();

        // Reload the pending users list
        loadPendingUsers();

        alert(`User ${email} has been approved!`);
    } catch (error) {
        alert('Error approving user: ' + error.message);
        console.error('Approval error:', error);
    }
    hideLoading();
}

// Reject a pending user (admin only)
async function rejectPendingUser(uid, email) {
    if (!isAdmin()) return;

    if (!confirm(`Reject user ${email}? This will remove their account access.`)) return;

    showLoading();
    try {
        // Remove from pendingUsers collection
        await db.collection('pendingUsers').doc(uid).delete();

        // Reload the pending users list
        loadPendingUsers();

        alert(`User ${email} has been rejected.`);
    } catch (error) {
        alert('Error rejecting user: ' + error.message);
        console.error('Rejection error:', error);
    }
    hideLoading();
}

// Form field configurations for each category
const formConfigs = {
    permits: {
        title: 'Permit',
        fields: [
            { name: 'permitType', label: 'Permit Type', type: 'select', options: ['County Permit', 'City Permit'], required: true },
            { name: 'permitNumber', label: 'Permit Number', type: 'text', required: true },
            { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
            { name: 'customerPhone', label: 'Customer Phone', type: 'tel', required: true },
            { name: 'county', label: 'County', type: 'select', options: ['Wicomico', 'Worcester', 'Somerset', 'Dorchester', 'Talbot', 'Caroline', "Queen Anne's", 'Kent', 'Cecil', 'Harford', 'Sussex DE', 'Kent DE', 'New Castle DE', 'Accomack VA', 'Northampton VA'], required: true, disableIf: { field: 'permitType', value: 'City Permit' } },
            { name: 'city', label: 'City', type: 'text', required: false, requiredIf: { field: 'permitType', value: 'City Permit' } },
            { name: 'address', label: 'Address', type: 'text', required: true },
            { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'In Progress', 'Completed', 'Denied'], required: true },
            { name: 'dateSubmitted', label: 'Date Submitted', type: 'date', required: true },
            { name: 'image', label: 'Photo', type: 'file', accept: 'image/*', required: false },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    vehicles: {
        title: 'Vehicle',
        fields: [
            { name: 'driver', label: 'Driver', type: 'text', required: true },
            { name: 'year', label: 'Year', type: 'number', required: true },
            { name: 'make', label: 'Make', type: 'text', required: true },
            { name: 'model', label: 'Model', type: 'text', required: true },
            { name: 'vin', label: 'VIN', type: 'text', required: true },
            { name: 'licensePlate', label: 'License Plate #', type: 'text', required: true },
            { name: 'lastRegistrationDate', label: 'Last Registration', type: 'month', required: false },
            { name: 'registrationRenewalDate', label: 'Registration Renewal', type: 'month', required: false }
        ]
    },
    bills: {
        title: 'Bill/Expense',
        fields: [
            { name: 'entryType', label: 'Type', type: 'select', options: ['Bill', 'Expense'], required: true },
            { name: 'vendor', label: 'Vendor', type: 'text', required: true },
            { name: 'invoiceNumber', label: 'Invoice #', type: 'text', required: false },
            { name: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', required: true },
            { name: 'paymentMethod', label: 'Payment Method', type: 'select', options: ['Cash', 'Check', 'Credit Card'], required: true },
            { name: 'checkNumber', label: 'Check Number', type: 'text', required: false, showIf: { field: 'paymentMethod', value: 'Check' } },
            { name: 'status', label: 'Status', type: 'select', options: ['Unpaid', 'Paid'], required: true },
            { name: 'paidOn', label: 'Paid On', type: 'date', required: false, showIf: { field: 'status', value: 'Paid' } },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    activity: {
        title: 'Task',
        fields: [
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'task', label: 'Task', type: 'text', required: true }
        ]
    },
    deposits: {
        title: 'Deposit',
        fields: [
            { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
            { name: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', required: true },
            { name: 'checkNumber', label: 'Check Number', type: 'text', required: true },
            { name: 'depositDate', label: 'Deposit Date', type: 'date', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    inspections: {
        title: 'Inspection',
        fields: [
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'countyTown', label: 'County/Town', type: 'text', required: true },
            { name: 'address', label: 'Address', type: 'text', required: true },
            { name: 'job', label: 'Job', type: 'text', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ]
    },
    licenses: {
        title: 'Business License',
        fields: [
            { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: true },
            { name: 'licenseNumber', label: 'License Number', type: 'text', required: true },
            { name: 'expirationDate', label: 'Expiration Date', type: 'date', required: true },
            { name: 'image', label: 'Photo', type: 'file', accept: 'image/*', required: false },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false }
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

// Legal links (login screen)
const privacyLink = document.getElementById('open-privacy');
const termsLink = document.getElementById('open-terms');
const legalCloseBtn = document.getElementById('legal-close-btn');
const legalCloseX = document.getElementById('legal-close');

if (privacyLink) {
    privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        openLegalModal('privacy');
    });
}

if (termsLink) {
    termsLink.addEventListener('click', (e) => {
        e.preventDefault();
        openLegalModal('terms');
    });
}

if (legalCloseBtn) legalCloseBtn.addEventListener('click', closeLegalModal);
if (legalCloseX) legalCloseX.addEventListener('click', closeLegalModal);

if (legalModal) {
    legalModal.addEventListener('click', (e) => {
        if (e.target === legalModal) closeLegalModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && legalModal && !legalModal.classList.contains('hidden')) {
        closeLegalModal();
    }
});

// reCAPTCHA v2 site key
const RECAPTCHA_SITE_KEY = '6LcBrU4sAAAAAPvJzPw5NoZTSoO04v2GGI2xBF6M';

// Legal content (shown on login screen)
const LEGAL_CONTACT_EMAIL = 'redonx99@gmail.com';

function openLegalModal(kind) {
    if (!legalModal || !legalTitle || !legalBody) return;

    const effectiveDate = 'February 4, 2026';

    if (kind === 'privacy') {
        legalTitle.textContent = 'Privacy Policy';
        legalBody.innerHTML = `
            <p><strong>Effective date:</strong> ${effectiveDate}</p>
            <p>JobTracker ("we," "our," or "us") respects your privacy. This Privacy Policy explains what information we collect and how we use it when you use the app.</p>

            <h4>Information we collect</h4>
            <ul>
                <li><strong>Account information</strong> (e.g., email address) used for authentication.</li>
                <li><strong>App content</strong> you create (permits, vehicles, bills, deposits, inspections, licenses, tasks, and related notes).</li>
                <li><strong>Uploaded files</strong> you attach (e.g., photos) stored in Firebase Storage.</li>
            </ul>

            <h4>How we use information</h4>
            <ul>
                <li>To provide and maintain the service (login, data sync, file uploads).</li>
                <li>To improve reliability and troubleshoot issues.</li>
                <li>To operate basic security measures (e.g., abuse prevention).</li>
            </ul>

            <h4>Sharing</h4>
            <p>We do not sell your data. We share information only with service providers necessary to operate the app (such as Firebase/Google services) or when required by law.</p>

            <h4>Data retention</h4>
            <p>Data is kept until deleted by an admin or as part of configured cleanup routines. Uploaded files associated with deleted records are deleted best-effort.</p>

            <h4>Your choices</h4>
            <p>You can request deletion or ask questions by contacting us.</p>

            <h4>Contact</h4>
            <p>If you have questions about this Privacy Policy, contact <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>.</p>
        `;
    } else {
        legalTitle.textContent = 'Terms of Use';
        legalBody.innerHTML = `
            <p><strong>Effective date:</strong> ${effectiveDate}</p>
            <p>By using JobTracker, you agree to these Terms of Use.</p>

            <h4>Use of the service</h4>
            <ul>
                <li>You are responsible for activity under your account.</li>
                <li>Do not use the app for unlawful purposes.</li>
                <li>Do not attempt to disrupt or abuse the service.</li>
            </ul>

            <h4>Data and uploads</h4>
            <p>You retain ownership of the content you submit. You grant us permission to store and process that content to provide the service.</p>

            <h4>Availability</h4>
            <p>The service is provided "as is" without warranties. We may modify or discontinue features at any time.</p>

            <h4>Limitation of liability</h4>
            <p>To the maximum extent permitted by law, we are not liable for indirect damages, lost profits, or data loss.</p>

            <h4>Changes</h4>
            <p>We may update these terms from time to time. Continued use means you accept the updated terms.</p>

            <h4>Contact</h4>
            <p>If you have questions about these Terms, contact <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>.</p>
        `;
    }

    legalModal.classList.remove('hidden');
}

function closeLegalModal() {
    if (!legalModal) return;
    legalModal.classList.add('hidden');
}

// reCAPTCHA widget IDs
let loginRecaptchaId = null;
let signupRecaptchaId = null;

// Initialize reCAPTCHA widgets
window.onRecaptchaLoad = function() {
    // Render login reCAPTCHA
    loginRecaptchaId = grecaptcha.render('login-recaptcha', {
        'sitekey': RECAPTCHA_SITE_KEY,
        'theme': 'dark'
    });

    // Render signup reCAPTCHA
    signupRecaptchaId = grecaptcha.render('signup-recaptcha', {
        'sitekey': RECAPTCHA_SITE_KEY,
        'theme': 'dark'
    });
};

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check reCAPTCHA
    const recaptchaResponse = grecaptcha.getResponse(loginRecaptchaId);
    if (!recaptchaResponse) {
        showMessage('Please complete the CAPTCHA', true);
        return;
    }

    showLoading();

    try {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showMessage(error.message, true);
        grecaptcha.reset(loginRecaptchaId);
    }

    hideLoading();
});

// Google Sign-In (Firebase Auth)
const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        showLoading();
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await auth.signInWithPopup(provider);
            } catch (popupErr) {
                // Fallback for environments that block popups
                await auth.signInWithRedirect(provider);
            }
        } catch (error) {
            showMessage(error.message || 'Google sign-in failed', true);
        }
        hideLoading();
    });
}

// Sign Up
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
        showMessage('Passwords do not match', true);
        return;
    }

    // Check reCAPTCHA
    const recaptchaResponse = grecaptcha.getResponse(signupRecaptchaId);
    if (!recaptchaResponse) {
        showMessage('Please complete the CAPTCHA', true);
        return;
    }

    showLoading();

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Check if user is an admin (admins bypass approval)
        if (!ADMIN_UIDS.includes(user.uid)) {
            // Add to pendingUsers collection
            await db.collection('pendingUsers').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                signupDate: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });

            // Sign out immediately so onAuthStateChanged doesn't grant access
            await auth.signOut();

            showMessage('Account created successfully! Your account is pending admin approval. You will be notified once approved.');
        } else {
            // Admin users bypass approval
            showMessage('Account created successfully!');
        }
        grecaptcha.reset(signupRecaptchaId);
    } catch (error) {
        showMessage(error.message, true);
        grecaptcha.reset(signupRecaptchaId);
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

// Pending approval logout
document.getElementById('pending-logout-btn').addEventListener('click', async () => {
    showLoading();
    await auth.signOut();
    hideLoading();
});

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;

        // Check approval status
        const approvalStatus = await checkUserApproval(user);

        if (!approvalStatus.approved) {
            // User is pending or not approved
            authContainer.classList.add('hidden');
            appContainer.classList.add('hidden');

            // Show pending approval container
            pendingApprovalContainer.classList.remove('hidden');

            // Update pending message
            const pendingMessage = document.getElementById('pending-message');
            if (approvalStatus.pending) {
                pendingMessage.textContent = 'Your account is awaiting admin approval. You will be notified once approved.';
            } else if (approvalStatus.orphaned) {
                // If a user signs in with Google and has not been seen before, mark them as pending
                try {
                    await db.collection('pendingUsers').doc(user.uid).set({
                        uid: user.uid,
                        email: user.email,
                        signupDate: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'pending',
                        authProvider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || 'google'
                    }, { merge: true });
                    pendingMessage.textContent = 'Your account is awaiting admin approval. You will be notified once approved.';
                } catch (e) {
                    pendingMessage.textContent = 'Your account needs approval. Please contact an administrator.';
                }
            } else if (approvalStatus.error) {
                pendingMessage.textContent = 'Error checking approval status. Please try again later.';
            }

            return; // Don't proceed to app
        }

        // User is approved - proceed normally
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        pendingApprovalContainer.classList.add('hidden');
        updateAdminUI();
        Promise.all([autoFlagVehicleRenewals(), autoFlagLicenseExpirations()]).then(() => {
            loadFollowUps();
            loadPendingUsers();
        });
        loadAllData();
    } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        pendingApprovalContainer.classList.add('hidden');
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

    const conditionalFields = [];
    const disableableFields = [];

    config.fields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-group';

        // Handle conditional visibility
        if (field.showIf) {
            div.dataset.showIf = field.showIf.field;
            div.dataset.showIfValue = field.showIf.value;
            div.classList.add('conditional-field', 'hidden');
            conditionalFields.push(div);
        }

        // Handle conditional disable
        if (field.disableIf) {
            div.dataset.disableIf = field.disableIf.field;
            div.dataset.disableIfValue = field.disableIf.value;
            disableableFields.push({ div, fieldName: field.name });
        }

        // Handle conditional required
        if (field.requiredIf) {
            div.dataset.requiredIf = field.requiredIf.field;
            div.dataset.requiredIfValue = field.requiredIf.value;
        }

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
        } else if (field.type === 'file') {
            input = document.createElement('input');
            input.type = 'file';
            if (field.accept) input.accept = field.accept;
            // Show existing image if editing
            if (editData && editData[field.name]) {
                const preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.innerHTML = `
                    <img src="${editData[field.name]}" alt="Current photo" style="max-width: 100%; max-height: 150px; margin-bottom: 0.5rem; border-radius: 4px;">
                    <p style="font-size: 0.75rem; color: var(--text-muted);">Select a new file to replace</p>
                `;
                div.appendChild(label);
                div.appendChild(preview);
                div.appendChild(input);
                input.id = `field-${field.name}`;
                input.name = field.name;
                input.required = false;
                modalFields.appendChild(div);
                return; // Skip the normal append below
            }
        } else {
            input = document.createElement('input');
            input.type = field.type;
            if (field.step) input.step = field.step;
        }

        input.id = `field-${field.name}`;
        input.name = field.name;
        input.required = field.showIf ? false : field.required; // Conditional fields not required initially

        // Some mobile browsers can end up with an invalid/ancient year (e.g. year 0004) in date inputs.
        // Normalize any selected date to the current year if the year is < 1900.
        if (field.type === 'date') {
            const normalizeDateYear = () => {
                const v = input.value;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
                const y = parseInt(v.slice(0, 4), 10);
                if (y && y < 1900) {
                    const thisYear = new Date().getFullYear();
                    input.value = `${String(thisYear).padStart(4, '0')}${v.slice(4)}`;
                }
            };
            input.addEventListener('change', normalizeDateYear);
            input.addEventListener('blur', normalizeDateYear);
        }

        if (editData && editData[field.name] && field.type !== 'file') {
            const rawVal = editData[field.name];

            // Normalize dates for <input type="date"> to YYYY-MM-DD.
            // Older records may contain different formats (or Firestore Timestamp objects).
            if (field.type === 'date') {
                const toInputDate = (val) => {
                    if (!val) return '';
                    // Firestore Timestamp
                    if (typeof val === 'object' && typeof val.toDate === 'function') {
                        const d = val.toDate();
                        if (!isNaN(d)) return d.toISOString().slice(0, 10);
                    }
                    if (typeof val !== 'string') return '';

                    const s = val.trim();
                    // Already in correct format
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                        const y = parseInt(s.slice(0, 4), 10);
                        if (y && y < 1900) {
                            const thisYear = new Date().getFullYear();
                            return `${String(thisYear).padStart(4, '0')}${s.slice(4)}`;
                        }
                        return s;
                    }
                    // ISO datetime
                    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
                        const iso = s.slice(0, 10);
                        const y = parseInt(iso.slice(0, 4), 10);
                        if (y && y < 1900) {
                            const thisYear = new Date().getFullYear();
                            return `${String(thisYear).padStart(4, '0')}${iso.slice(4)}`;
                        }
                        return iso;
                    }
                    // Common US format MM/DD/YYYY
                    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (m) {
                        const mm = m[1].padStart(2, '0');
                        const dd = m[2].padStart(2, '0');
                        let yyyy = m[3];
                        const y = parseInt(yyyy, 10);
                        if (y && y < 1900) yyyy = String(new Date().getFullYear());
                        return `${yyyy}-${mm}-${dd}`;
                    }
                    // Last resort: let Date parse it
                    const d = new Date(s);
                    if (!isNaN(d)) {
                        const iso = d.toISOString().slice(0, 10);
                        const y = parseInt(iso.slice(0, 4), 10);
                        if (y && y < 1900) {
                            const thisYear = new Date().getFullYear();
                            return `${String(thisYear).padStart(4, '0')}${iso.slice(4)}`;
                        }
                        return iso;
                    }
                    return '';
                };

                const normalized = toInputDate(rawVal);
                if (normalized) input.value = normalized;
            } else {
                input.value = rawVal;
            }
        }

        div.appendChild(input);
        modalFields.appendChild(div);
    });

    // Set up conditional field visibility
    function updateConditionalFields() {
        conditionalFields.forEach(div => {
            const triggerField = document.getElementById(`field-${div.dataset.showIf}`);
            if (triggerField && triggerField.value === div.dataset.showIfValue) {
                div.classList.remove('hidden');
            } else {
                div.classList.add('hidden');
                // Clear the value when hidden
                const input = div.querySelector('input, select, textarea');
                if (input) input.value = '';
            }
        });

        // Handle disableable fields
        disableableFields.forEach(({ div, fieldName }) => {
            const triggerField = document.getElementById(`field-${div.dataset.disableIf}`);
            const input = document.getElementById(`field-${fieldName}`);
            if (triggerField && input) {
                if (triggerField.value === div.dataset.disableIfValue) {
                    input.disabled = true;
                    input.value = '';
                    input.required = false;
                } else {
                    input.disabled = false;
                    input.required = true;
                }
            }
        });

        // Handle conditional required fields
        const allFormGroups = modalFields.querySelectorAll('.form-group');
        allFormGroups.forEach(div => {
            if (div.dataset.requiredIf) {
                const triggerField = document.getElementById(`field-${div.dataset.requiredIf}`);
                const input = div.querySelector('input, select, textarea');
                if (triggerField && input) {
                    if (triggerField.value === div.dataset.requiredIfValue) {
                        input.required = true;
                    } else {
                        input.required = false;
                    }
                }
            }
        });
    }

    // Add change listeners to trigger fields
    conditionalFields.forEach(div => {
        const triggerField = document.getElementById(`field-${div.dataset.showIf}`);
        if (triggerField) {
            triggerField.addEventListener('change', updateConditionalFields);
        }
    });

    // Add change listeners for disableable fields
    disableableFields.forEach(({ div }) => {
        const triggerField = document.getElementById(`field-${div.dataset.disableIf}`);
        if (triggerField) {
            triggerField.addEventListener('change', updateConditionalFields);
        }
    });

    // Initial check for edit mode
    updateConditionalFields();

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
document.getElementById('add-deposit-btn').addEventListener('click', () => openModal('deposits'));
document.getElementById('add-inspection-btn').addEventListener('click', () => openModal('inspections'));
document.getElementById('add-license-btn').addEventListener('click', () => openModal('licenses'));
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

    // Collect file inputs separately
    let fileToUpload = null;
    let fileFieldName = null;

    config.fields.forEach(field => {
        const input = document.getElementById(`field-${field.name}`);
        if (field.type === 'file') {
            if (input.files && input.files[0]) {
                fileToUpload = input.files[0];
                fileFieldName = field.name;
            }
            // Don't overwrite existing image URL if no new file selected
        } else if (field.type === 'date') {
            let v = input.value;
            // Guard against ancient years like 0004-02-04
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                const y = parseInt(v.slice(0, 4), 10);
                if (y && y < 1900) {
                    const thisYear = new Date().getFullYear();
                    v = `${String(thisYear).padStart(4, '0')}${v.slice(4)}`;
                }
            }
            data[field.name] = v;
        } else {
            data[field.name] = input.value;
        }
    });

    // Close modal first for better UX
    closeModal();
    showLoading();

    try {
        // Upload file if present
        if (fileToUpload && fileFieldName) {
            const timestamp = Date.now();
            const fileName = `${category}/${timestamp}_${fileToUpload.name}`;
            const storageRef = storage.ref(fileName);
            await storageRef.put(fileToUpload);
            const downloadURL = await storageRef.getDownloadURL();
            data[fileFieldName] = downloadURL;
            // Store storage path for reliable server-side deletion on record delete
            data[`${fileFieldName}Path`] = fileName;
        }

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
        loadData('deposits'),
        loadData('inspections'),
        loadData('licenses'),
        loadData('activity')
    ]);
    hideLoading();
}

// Clean up activity items older than 90 days
async function cleanupOldActivities() {
    if (!isAdmin()) return; // Only admins can delete

    try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const cutoffDateStr = ninetyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

        const snapshot = await db.collection('activity').get();
        const batch = db.batch();
        let deleteCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.date && data.date < cutoffDateStr) {
                batch.delete(doc.ref);
                deleteCount++;
            }
        });

        if (deleteCount > 0) {
            await batch.commit();
            console.log(`Cleaned up ${deleteCount} activity items older than 90 days`);
        }
    } catch (error) {
        console.error('Error cleaning up old activities:', error);
    }
}

// Clean up paid bills older than 1 year (365 days)
async function cleanupOldPaidBills() {
    if (!isAdmin()) return; // Only admins can delete

    try {
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);

        const snapshot = await db.collection('bills').get();
        const batch = db.batch();
        let deleteCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            // Only delete paid bills
            if (data.status === 'Paid' && data.updatedAt) {
                const updatedDate = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                if (updatedDate < oneYearAgo) {
                    batch.delete(doc.ref);
                    deleteCount++;
                }
            }
        });

        if (deleteCount > 0) {
            await batch.commit();
            console.log(`Cleaned up ${deleteCount} paid bills older than 1 year`);
        }
    } catch (error) {
        console.error('Error cleaning up old paid bills:', error);
    }
}

async function loadData(category) {
    if (!currentUser) return;

    const listElement = document.getElementById(`${category}-list`);
    listElement.innerHTML = '<p class="loading-text">Loading...</p>';

    // Auto-cleanup old activity items when loading activity tab
    if (category === 'activity') {
        await cleanupOldActivities();
    }

    // Auto-cleanup paid bills older than 1 year when loading bills tab
    if (category === 'bills') {
        await cleanupOldPaidBills();
    }

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
        } else if (category === 'vehicles') {
            // Sort vehicles based on user selection
            const sortBy = document.getElementById('vehicle-sort').value;
            if (sortBy === 'renewalDate') {
                // Sort by registration renewal month (ascending - soonest first)
                items.sort((a, b) => {
                    const dateA = a.registrationRenewalDate ? new Date(a.registrationRenewalDate + '-01T00:00:00') : new Date('9999-12-31');
                    const dateB = b.registrationRenewalDate ? new Date(b.registrationRenewalDate + '-01T00:00:00') : new Date('9999-12-31');
                    return dateA - dateB;
                });
            } else if (sortBy === 'year') {
                // Sort by year (descending - newest first)
                items.sort((a, b) => {
                    const yearA = parseInt(a.year) || 0;
                    const yearB = parseInt(b.year) || 0;
                    return yearB - yearA;
                });
            }
        } else {
            // Sort other categories by createdAt descending
            items.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
        }

        renderList(category, items);
    } catch (error) {
        listElement.innerHTML = `<p class="error-text">Error loading data: ${error.message}</p>`;
    }
}

// Status filter event for permits
document.getElementById('permit-status-filter').addEventListener('change', () => {
    loadData('permits');
});

// Sort event for vehicles
document.getElementById('vehicle-sort').addEventListener('change', () => {
    loadData('vehicles');
});

// Track collapsed state for county groups, activity dates, and bill status
const collapsedCounties = new Set();
const collapsedDates = new Set();
const collapsedBillStatus = new Set();

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
    ` : `
        <div class="task-actions">
            <button class="btn-icon btn-flag-task" data-id="${item.id}" aria-label="Flag for Follow Up">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
            </button>
        </div>
    `;

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
    } else {
        // Flag button for non-admin users
        taskItem.querySelector('.btn-flag-task').addEventListener('click', () => {
            const title = `Task: ${item.task}`;
            flagForFollowUp(category, item.id, title);
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
    ` : `
        <div class="card-actions">
            <button class="btn btn-small btn-flag" data-id="${item.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                Flag for Follow Up
            </button>
        </div>
    `;

    const imageHtml = item.image ? `
        <div class="permit-image">
            <a href="${item.image}" target="_blank" rel="noopener">
                <img src="${item.image}" alt="Permit photo" class="permit-photo">
            </a>
        </div>
    ` : '';

    // Determine location display based on permit type
    const isCityPermit = item.permitType === 'City Permit';
    const locationHtml = isCityPermit
        ? `<p><strong>City:</strong> ${escapeHtml(item.city || 'N/A')}</p>`
        : `<p><strong>County:</strong> ${escapeHtml(item.county || 'N/A')}</p>${item.city ? `<p><strong>City:</strong> ${escapeHtml(item.city)}</p>` : ''}`;

    card.innerHTML = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(item.permitNumber)}</span>
            <span class="status-badge status-${item.status?.toLowerCase().replace(' ', '-')}">${escapeHtml(item.status)}</span>
        </div>
        <div class="card-details">
            <p><strong>Customer:</strong> ${escapeHtml(item.customerName)}</p>
            <p><strong>Phone:</strong> <a href="tel:${escapeHtml(item.customerPhone)}">${escapeHtml(item.customerPhone)}</a></p>
            ${locationHtml}
            <p><strong>Address:</strong> ${escapeHtml(item.address)}</p>
            <p><strong>Submitted:</strong> ${escapeHtml(item.dateSubmitted)}</p>
            ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
            ${imageHtml}
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
    } else {
        // Flag button for non-admin users
        card.querySelector('.btn-flag').addEventListener('click', () => {
            let title = `${item.permitNumber} - ${item.customerName}`;
            if (item.notes) title += ` | Notes: ${item.notes}`;
            flagForFollowUp(category, item.id, title);
        });
    }

    return card;
}

function renderList(category, items) {
    const listElement = document.getElementById(`${category}-list`);

    // Apply status filter for permits
    if (category === 'permits') {
        const filterValue = document.getElementById('permit-status-filter').value;
        if (filterValue !== 'all') {
            items = items.filter(item => item.status === filterValue);
        }
    }

    if (items.length === 0) {
        listElement.innerHTML = '<p class="empty-text">No entries yet. Click "+ Add" to create one.</p>';
        return;
    }

    listElement.innerHTML = '';

    // For permits, group by county (for County Permits) or city (for City Permits)
    if (category === 'permits') {
        // Separate permits by type
        const countyPermits = items.filter(item => item.permitType !== 'City Permit');
        const cityPermits = items.filter(item => item.permitType === 'City Permit');

        // Group county permits by county
        const groupedByCounty = {};
        countyPermits.forEach(item => {
            const county = item.county || 'Unknown';
            if (!groupedByCounty[county]) {
                groupedByCounty[county] = [];
            }
            groupedByCounty[county].push(item);
        });

        // Group city permits by city
        const groupedByCity = {};
        cityPermits.forEach(item => {
            const city = item.city || 'Unknown City';
            if (!groupedByCity[city]) {
                groupedByCity[city] = [];
            }
            groupedByCity[city].push(item);
        });

        // Sort counties alphabetically and render
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

        // Sort cities alphabetically and render
        const sortedCities = Object.keys(groupedByCity).sort();

        sortedCities.forEach(city => {
            const cityItems = groupedByCity[city];
            const cityKey = `city-${city}`;
            const isCollapsed = collapsedCounties.has(cityKey);

            // Create city group container
            const groupDiv = document.createElement('div');
            groupDiv.className = 'county-group city-permit-group';

            // Create collapsible header
            const header = document.createElement('div');
            header.className = `county-header ${isCollapsed ? 'collapsed' : ''}`;
            header.innerHTML = `
                <span class="county-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="county-name">${escapeHtml(city)} <small>(City)</small></span>
                <span class="county-count">(${cityItems.length})</span>
            `;
            header.addEventListener('click', () => {
                if (collapsedCounties.has(cityKey)) {
                    collapsedCounties.delete(cityKey);
                } else {
                    collapsedCounties.add(cityKey);
                }
                renderList(category, items);
            });
            groupDiv.appendChild(header);

            // Create content container
            const content = document.createElement('div');
            content.className = `county-content ${isCollapsed ? 'collapsed' : ''}`;

            // Add permit cards for this city
            cityItems.forEach(item => {
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

    // For bills, group by Unpaid Bills, Paid Bills, and Paid Expenses with collapsible sections
    if (category === 'bills') {
        const unpaidBills = items.filter(item => item.status === 'Unpaid' && item.entryType !== 'Expense');
        const paidBills = items.filter(item => item.status === 'Paid' && item.entryType !== 'Expense');
        const paidExpenses = items.filter(item => item.entryType === 'Expense' && item.status === 'Paid');

        // Render Unpaid Bills section
        const unpaidCollapsed = collapsedBillStatus.has('Unpaid');
        const unpaidGroup = document.createElement('div');
        unpaidGroup.className = 'bill-status-group';

        const unpaidHeader = document.createElement('div');
        unpaidHeader.className = `bill-status-header ${unpaidCollapsed ? 'collapsed' : ''}`;
        unpaidHeader.innerHTML = `
            <span class="status-toggle">${unpaidCollapsed ? '▶' : '▼'}</span>
            <span class="status-name">Unpaid Bills</span>
            <span class="status-count">(${unpaidBills.length})</span>
        `;
        unpaidHeader.addEventListener('click', () => {
            if (collapsedBillStatus.has('Unpaid')) {
                collapsedBillStatus.delete('Unpaid');
            } else {
                collapsedBillStatus.add('Unpaid');
            }
            renderList(category, items);
        });
        unpaidGroup.appendChild(unpaidHeader);

        const unpaidContent = document.createElement('div');
        unpaidContent.className = `bill-status-content ${unpaidCollapsed ? 'collapsed' : ''}`;
        if (unpaidBills.length === 0) {
            unpaidContent.innerHTML = '<p class="empty-text">No unpaid bills.</p>';
        } else {
            unpaidBills.forEach(item => {
                unpaidContent.appendChild(createBillCard(item, category));
            });
        }
        unpaidGroup.appendChild(unpaidContent);
        listElement.appendChild(unpaidGroup);

        // Render Paid Bills section
        const paidCollapsed = collapsedBillStatus.has('Paid');
        const paidGroup = document.createElement('div');
        paidGroup.className = 'bill-status-group';

        const paidHeader = document.createElement('div');
        paidHeader.className = `bill-status-header ${paidCollapsed ? 'collapsed' : ''}`;
        paidHeader.innerHTML = `
            <span class="status-toggle">${paidCollapsed ? '▶' : '▼'}</span>
            <span class="status-name">Paid Bills</span>
            <span class="status-count">(${paidBills.length})</span>
        `;
        paidHeader.addEventListener('click', () => {
            if (collapsedBillStatus.has('Paid')) {
                collapsedBillStatus.delete('Paid');
            } else {
                collapsedBillStatus.add('Paid');
            }
            renderList(category, items);
        });
        paidGroup.appendChild(paidHeader);

        const paidContent = document.createElement('div');
        paidContent.className = `bill-status-content ${paidCollapsed ? 'collapsed' : ''}`;
        if (paidBills.length === 0) {
            paidContent.innerHTML = '<p class="empty-text">No paid bills.</p>';
        } else {
            paidBills.forEach(item => {
                paidContent.appendChild(createBillCard(item, category));
            });
        }
        paidGroup.appendChild(paidContent);
        listElement.appendChild(paidGroup);

        // Render Paid Expenses section
        const expensesCollapsed = collapsedBillStatus.has('Expenses');
        const expensesGroup = document.createElement('div');
        expensesGroup.className = 'bill-status-group';

        const expensesHeader = document.createElement('div');
        expensesHeader.className = `bill-status-header ${expensesCollapsed ? 'collapsed' : ''}`;
        expensesHeader.innerHTML = `
            <span class="status-toggle">${expensesCollapsed ? '▶' : '▼'}</span>
            <span class="status-name">Paid Expenses</span>
            <span class="status-count">(${paidExpenses.length})</span>
        `;
        expensesHeader.addEventListener('click', () => {
            if (collapsedBillStatus.has('Expenses')) {
                collapsedBillStatus.delete('Expenses');
            } else {
                collapsedBillStatus.add('Expenses');
            }
            renderList(category, items);
        });
        expensesGroup.appendChild(expensesHeader);

        const expensesContent = document.createElement('div');
        expensesContent.className = `bill-status-content ${expensesCollapsed ? 'collapsed' : ''}`;
        if (paidExpenses.length === 0) {
            expensesContent.innerHTML = '<p class="empty-text">No paid expenses.</p>';
        } else {
            paidExpenses.forEach(item => {
                expensesContent.appendChild(createBillCard(item, category));
            });
        }
        expensesGroup.appendChild(expensesContent);
        listElement.appendChild(expensesGroup);

        return;
    }

    // For deposits, render with deposit cards
    if (category === 'deposits') {
        items.forEach(item => {
            const card = createDepositCard(item, category);
            listElement.appendChild(card);
        });
        return;
    }

    // For inspections, render with inspection cards
    if (category === 'inspections') {
        items.forEach(item => {
            const card = createInspectionCard(item, category);
            listElement.appendChild(card);
        });
        return;
    }

    // For licenses, render with license cards
    if (category === 'licenses') {
        items.forEach(item => {
            const card = createLicenseCard(item, category);
            listElement.appendChild(card);
        });
        return;
    }

    // For vehicles, render normally
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        let cardContent = '';

        // Check if registration is within 30 days
        const isRenewalSoon = isRegistrationWithin30Days(item.registrationRenewalDate);
        const renewalWarning = isRenewalSoon ? '<span class="renewal-warning">Renewal Due Soon!</span>' : '';

        cardContent = `
            <div class="card-header">
                <span class="card-title">${escapeHtml(item.driver)}</span>
                ${renewalWarning}
            </div>
            <div class="card-details">
                <p><strong>Vehicle:</strong> ${escapeHtml(item.year)} ${escapeHtml(item.make)} ${escapeHtml(item.model)}</p>
                <p><strong>VIN:</strong> ${escapeHtml(item.vin)}</p>
                <p><strong>License Plate:</strong> ${escapeHtml(item.licensePlate)}</p>
                <p><strong>Last Registration:</strong> ${formatMonth(item.lastRegistrationDate)}</p>
                <p><strong>Registration Renewal:</strong> ${formatMonth(item.registrationRenewalDate)}</p>
            </div>
            <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
        `;

        if (isAdmin()) {
            cardContent += `
                <div class="card-actions">
                    <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                    <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
                </div>
            `;
        } else {
            // Flag button for non-admin users
            cardContent += `
                <div class="card-actions">
                    <button class="btn btn-small btn-flag" data-id="${item.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                            <line x1="4" y1="22" x2="4" y2="15"></line>
                        </svg>
                        Flag for Follow Up
                    </button>
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
        } else {
            // Flag button for non-admin users
            card.querySelector('.btn-flag').addEventListener('click', () => {
                const title = `${item.driver} - ${item.year} ${item.make} ${item.model}`;
                flagForFollowUp(category, item.id, title);
            });
        }

        listElement.appendChild(card);
    });
}

// Helper function to create a bill card
function createBillCard(item, category) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const checkNumberLine = item.paymentMethod === 'Check' && item.checkNumber
        ? `<p><strong>Check #:</strong> ${escapeHtml(item.checkNumber)}</p>`
        : '';

    const paidOnLine = item.status === 'Paid' && item.paidOn
        ? `<p><strong>Paid On:</strong> ${new Date(item.paidOn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>`
        : '';

    let cardContent = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(item.vendor)}</span>
            <span class="status-badge status-${item.status?.toLowerCase()}">${escapeHtml(item.status)}</span>
        </div>
        <div class="card-details">
            <p><strong>Invoice #:</strong> ${escapeHtml(item.invoiceNumber)}</p>
            <p><strong>Amount:</strong> $${parseFloat(item.amount || 0).toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${escapeHtml(item.paymentMethod)}</p>
            ${checkNumberLine}
            ${paidOnLine}
            ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
        </div>
        <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
    `;

    if (isAdmin()) {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
            </div>
        `;
    } else {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-flag" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                        <line x1="4" y1="22" x2="4" y2="15"></line>
                    </svg>
                    Flag for Follow Up
                </button>
            </div>
        `;
    }

    card.innerHTML = cardContent;

    if (isAdmin()) {
        card.querySelector('.btn-edit').addEventListener('click', () => {
            openModal(category, item);
        });

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
    } else {
        card.querySelector('.btn-flag').addEventListener('click', () => {
            let title = `${item.vendor} - $${parseFloat(item.amount || 0).toFixed(2)}`;
            if (item.notes) title += ` | Notes: ${item.notes}`;
            flagForFollowUp(category, item.id, title);
        });
    }

    return card;
}

// Helper function to create a deposit card
function createDepositCard(item, category) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const depositDate = item.depositDate
        ? new Date(item.depositDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No Date';

    let cardContent = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(item.customerName)}</span>
            <span class="deposit-amount">$${parseFloat(item.amount || 0).toFixed(2)}</span>
        </div>
        <div class="card-details">
            <p><strong>Check #:</strong> ${escapeHtml(item.checkNumber)}</p>
            <p><strong>Deposit Date:</strong> ${depositDate}</p>
            ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
        </div>
        <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
    `;

    if (isAdmin()) {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
            </div>
        `;
    } else {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-flag" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                        <line x1="4" y1="22" x2="4" y2="15"></line>
                    </svg>
                    Flag for Follow Up
                </button>
            </div>
        `;
    }

    card.innerHTML = cardContent;

    if (isAdmin()) {
        card.querySelector('.btn-edit').addEventListener('click', () => {
            openModal(category, item);
        });

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
    } else {
        card.querySelector('.btn-flag').addEventListener('click', () => {
            let title = `${item.customerName} - $${parseFloat(item.amount || 0).toFixed(2)}`;
            if (item.notes) title += ` | Notes: ${item.notes}`;
            flagForFollowUp(category, item.id, title);
        });
    }

    return card;
}

// Helper function to create an inspection card
function createInspectionCard(item, category) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const inspectionDate = item.date
        ? new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : 'No Date';

    let cardContent = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(item.job)}</span>
            <span class="inspection-date">${inspectionDate}</span>
        </div>
        <div class="card-details">
            <p><strong>County/Town:</strong> ${escapeHtml(item.countyTown)}</p>
            <p><strong>Address:</strong> ${escapeHtml(item.address)}</p>
            ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
        </div>
        <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
    `;

    if (isAdmin()) {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
            </div>
        `;
    } else {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-flag" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                        <line x1="4" y1="22" x2="4" y2="15"></line>
                    </svg>
                    Flag for Follow Up
                </button>
            </div>
        `;
    }

    card.innerHTML = cardContent;

    if (isAdmin()) {
        card.querySelector('.btn-edit').addEventListener('click', () => {
            openModal(category, item);
        });

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
    } else {
        card.querySelector('.btn-flag').addEventListener('click', () => {
            let title = `${item.job} - ${item.address}`;
            if (item.notes) title += ` | Notes: ${item.notes}`;
            flagForFollowUp(category, item.id, title);
        });
    }

    return card;
}

// Helper function to create a license card
function createLicenseCard(item, category) {
    const card = document.createElement('div');
    card.className = 'item-card';

    // Check if license expires within 30 days
    const isExpiringSoon = isLicenseExpiringWithin30Days(item.expirationDate);
    const expirationWarning = isExpiringSoon ? '<span class="renewal-warning">Expiring Soon!</span>' : '';

    const expirationDateFormatted = item.expirationDate
        ? new Date(item.expirationDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No Date';

    const imageHtml = item.image ? `
        <div class="license-image">
            <a href="${item.image}" target="_blank" rel="noopener">
                <img src="${item.image}" alt="License photo" class="permit-photo">
            </a>
        </div>
    ` : '';

    let cardContent = `
        <div class="card-header">
            <span class="card-title">${escapeHtml(item.jurisdiction)}</span>
            ${expirationWarning}
        </div>
        <div class="card-details">
            <p><strong>License #:</strong> ${escapeHtml(item.licenseNumber)}</p>
            <p><strong>Expires:</strong> ${expirationDateFormatted}</p>
            ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
            ${imageHtml}
        </div>
        <div class="card-updated">Last updated: ${formatDate(item.updatedAt)}</div>
    `;

    if (isAdmin()) {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-edit" data-id="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-id="${item.id}">Delete</button>
            </div>
        `;
    } else {
        cardContent += `
            <div class="card-actions">
                <button class="btn btn-small btn-flag" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                        <line x1="4" y1="22" x2="4" y2="15"></line>
                    </svg>
                    Flag for Follow Up
                </button>
            </div>
        `;
    }

    card.innerHTML = cardContent;

    if (isAdmin()) {
        card.querySelector('.btn-edit').addEventListener('click', () => {
            openModal(category, item);
        });

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
    } else {
        card.querySelector('.btn-flag').addEventListener('click', () => {
            const title = `${item.jurisdiction} - License #${item.licenseNumber}`;
            flagForFollowUp(category, item.id, title);
        });
    }

    return card;
}

// Helper function to format month (YYYY-MM) to readable format
function formatMonth(monthStr) {
    if (!monthStr) return 'N/A';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Helper function to check if registration renewal is within 30 days
function isRegistrationWithin30Days(monthStr) {
    if (!monthStr) return false;
    // Month format is YYYY-MM, use the first of that month
    const renewalDate = new Date(monthStr + '-01T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    // Check if the renewal month starts within the next 30 days or has already started this month
    const endOfRenewalMonth = new Date(renewalDate.getFullYear(), renewalDate.getMonth() + 1, 0);
    return endOfRenewalMonth >= today && renewalDate <= thirtyDaysFromNow;
}

// Helper function to check if license expiration is within 30 days
function isLicenseExpiringWithin30Days(dateStr) {
    if (!dateStr) return false;
    const expirationDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    // Check if the expiration date is within the next 30 days (and not already expired more than 30 days ago)
    return expirationDate >= today && expirationDate <= thirtyDaysFromNow;
}

// Auto-flag vehicles with registration renewal within 30 days
async function autoFlagVehicleRenewals() {
    if (!currentUser) return;

    try {
        const vehiclesSnapshot = await db.collection('vehicles').get();
        const followupsSnapshot = await db.collection('followups').get();

        // Get existing flagged vehicle IDs to avoid duplicates
        const existingFlaggedIds = new Set();
        followupsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.category === 'vehicles') {
                existingFlaggedIds.add(data.itemId);
            }
        });

        // Check each vehicle for upcoming registration renewal
        for (const doc of vehiclesSnapshot.docs) {
            const vehicle = doc.data();
            if (isRegistrationWithin30Days(vehicle.registrationRenewalDate) && !existingFlaggedIds.has(doc.id)) {
                // Auto-flag this vehicle
                await db.collection('followups').add({
                    category: 'vehicles',
                    itemId: doc.id,
                    itemTitle: `${vehicle.driver} - ${vehicle.year} ${vehicle.make} ${vehicle.model} - Registration Renewal`,
                    flaggedBy: 'system',
                    flaggedByEmail: 'Auto-flagged',
                    flaggedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Auto-flagged vehicle: ${vehicle.driver} - ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
            }
        }
    } catch (error) {
        console.error('Error auto-flagging vehicle renewals:', error);
    }
}

// Auto-flag business licenses expiring within 30 days
async function autoFlagLicenseExpirations() {
    if (!currentUser) return;

    try {
        const licensesSnapshot = await db.collection('licenses').get();
        const followupsSnapshot = await db.collection('followups').get();

        // Get existing flagged license IDs to avoid duplicates
        const existingFlaggedIds = new Set();
        followupsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.category === 'licenses') {
                existingFlaggedIds.add(data.itemId);
            }
        });

        // Check each license for upcoming expiration
        for (const doc of licensesSnapshot.docs) {
            const license = doc.data();
            if (isLicenseExpiringWithin30Days(license.expirationDate) && !existingFlaggedIds.has(doc.id)) {
                // Auto-flag this license
                await db.collection('followups').add({
                    category: 'licenses',
                    itemId: doc.id,
                    itemTitle: `${license.jurisdiction} - License #${license.licenseNumber} - Expiring Soon`,
                    flaggedBy: 'system',
                    flaggedByEmail: 'Auto-flagged',
                    flaggedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Auto-flagged license: ${license.jurisdiction} - License #${license.licenseNumber}`);
            }
        }
    } catch (error) {
        console.error('Error auto-flagging license expirations:', error);
    }
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
        url: 'https://99redder.github.io/JobTracker'
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

// ============================================
// MIGRATION FUNCTION FOR EXISTING USERS
// ============================================
// This function should be run ONCE after deploying the approval system
// to auto-approve all existing users who signed up before this feature.
// Call this function from the browser console as an admin: migrateExistingUsers()
async function migrateExistingUsers() {
    if (!isAdmin()) {
        console.error('Only admins can run the migration.');
        return;
    }

    console.log('Starting migration of existing users...');

    try {
        // Check activity log for user emails (since it tracks who did what)
        const activitySnapshot = await db.collection('activity').get();
        const existingUserEmails = new Set();
        activitySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.userEmail) {
                existingUserEmails.add(data.userEmail);
            }
        });

        console.log(`Found ${existingUserEmails.size} existing user emails from activity log`);

        // For this simple migration, we'll approve the current admin user
        // and any users we find evidence of in the database
        const usersToApprove = [];

        // Always approve admins
        for (const adminUid of ADMIN_UIDS) {
            if (currentUser && currentUser.uid === adminUid) {
                usersToApprove.push({
                    uid: adminUid,
                    email: currentUser.email
                });
            }
        }

        // Check if there are any users already in approvedUsers or pendingUsers
        const approvedSnapshot = await db.collection('approvedUsers').get();
        const pendingSnapshot = await db.collection('pendingUsers').get();

        console.log(`Found ${approvedSnapshot.size} already approved users`);
        console.log(`Found ${pendingSnapshot.size} pending users`);

        // Migrate users to approvedUsers if they're not already there
        for (const user of usersToApprove) {
            const approvedDoc = await db.collection('approvedUsers').doc(user.uid).get();
            if (!approvedDoc.exists) {
                await db.collection('approvedUsers').doc(user.uid).set({
                    uid: user.uid,
                    email: user.email,
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    approvedBy: currentUser.uid,
                    signupDate: firebase.firestore.FieldValue.serverTimestamp(),
                    migratedUser: true
                });
                console.log(`✓ Approved existing user: ${user.email}`);
            } else {
                console.log(`- User already approved: ${user.email}`);
            }
        }

        console.log('Migration complete!');
        console.log('Note: Only the current admin user was migrated.');
        console.log('If you have other existing users, they will need to be approved manually from the pending users list.');

    } catch (error) {
        console.error('Migration error:', error);
    }
}

// Make the migration function available globally for console access
window.migrateExistingUsers = migrateExistingUsers;
