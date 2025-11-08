// Blood Link - Online Blood Bank System
// Application Data and State Management with FIREBASE AUTH + FIRESTORE

class BloodLinkApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'landingPage';
        
        // FIRESTORE: Initialize Firebase services
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.geocoder = new google.maps.Geocoder(); // <-- INITIALIZE GEOCODER
        emailjs.init("Dg8Oz6TP9DViEf1mw");

        // FIRESTORE: Data will be loaded from Firestore, so initialize as empty arrays
        this.bloodBanks = [];
        this.urgentNeeds = []; // This will be generated dynamically now
        this.donationRules = {};
        this.allUsers = []; // Cache for all user data

        this.initializeEventListeners();
        this.listenForAuthStateChanges();

        console.log('BloodLinkApp initialized with Firestore');
    }

    // =================================================================
    // =========== 🚀 MODIFIED DATA LOADING & AUTH 🚀 =================
    // =================================================================

    async loadData() {
        console.log("Loading data from Firestore...");
        try {
            // Load Blood Banks
            const banksSnapshot = await this.db.collection('bloodBanks').get();
            this.bloodBanks = banksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Load All Users (for stats and urgent needs)
            const usersSnapshot = await this.db.collection('users').get();
            this.allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Load Donation Rules
            const rulesDoc = await this.db.collection('settings').doc('donationRules').get();
            if(rulesDoc.exists) this.donationRules = rulesDoc.data();
            
            console.log("Data loaded successfully.");

        } catch (error) {
            console.error("Error loading data from Firestore: ", error);
            alert("Could not load data from the database. Please check your connection and Firestore setup.");
        }
    }

    initializeEventListeners() {
        const authForm = document.getElementById('authForm');
        if (authForm) authForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleAuth(); });
        
        const bloodRequestForm = document.getElementById('bloodRequestForm');
        if (bloodRequestForm) bloodRequestForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleBloodRequest(); });

        const addBankForm = document.getElementById('addBankForm');
        if (addBankForm) addBankForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleAddBank(); });
    }
    
   listenForAuthStateChanges() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is logged in. Silently fetch their data.
                const userDocRef = this.db.collection('users').doc(user.uid);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    this.currentUser = { id: userDoc.id, ...userDoc.data() };
                } else {
                    // User exists in Auth, but not Firestore. Log them out to be safe.
                    console.error("User document not found, logging out.");
                    this.logout(); // This will re-trigger the listener.
                    return; // Stop execution here.
                }
            } else {
                // User is logged out.
                this.currentUser = null;
            }

            // --- This part runs for EVERYONE (logged in or out) ---
            // Load all the app data (banks, all users, etc.)
            await this.loadData(); 
            
            // Show the landing page
            this.showPage('landingPage'); 
            
            // Render the landing page content (stats, urgent needs)
            this.renderLandingPage();
        });
    }

    async handleAuth() {
        const modal = document.getElementById('authModal');
        const form = document.getElementById('authForm');
        const formData = new FormData(form);
        const role = modal.dataset.role;
        const type = modal.dataset.type;
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            let user; // Variable to hold the new user's data
            if (type === 'login') {
                // Step 1: Sign in
                const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
                
                // Step 2: Get the user's data from Firestore
                const userDocRef = this.db.collection('users').doc(userCredential.user.uid);
                const userDoc = await userDocRef.get();
                if (!userDoc.exists) {
                    throw new Error("User data not found in database.");
                }
                user = { id: userDoc.id, ...userDoc.data() };
                
                // Step 3: Check if the role matches
                if (user.role !== role) {
                    // Log them out and throw an error
                    await this.auth.signOut();
                    throw new Error(`You are trying to log in as a ${role}, but this account is a ${user.role}.`);
                }

            } else if (type === 'signup') {
                // Step 1: Create auth user
                const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
                const authUser = userCredential.user;

                // Step 2: Create the user object for Firestore
                const newUser = {
                    name: formData.get('fullName'), email, bloodType: formData.get('bloodType'),
                    phone: formData.get('phone'), address: formData.get('address'), role,
                };
    
                if (role === 'donor') {
                    Object.assign(newUser, {
                        age: parseInt(formData.get('age')), weight: parseInt(formData.get('weight')),
                        totalDonations: 0, donationHistory: [], eligibleTodonate: true, lastDonation: null
                    });
                } else { // Recipient
                    Object.assign(newUser, { requestHistory: [], currentRequests: [] });
                }
                
                // Step 3: Save to Firestore
                await this.db.collection('users').doc(authUser.uid).set(newUser);
                
                user = { id: authUser.uid, ...newUser }; // Set the user for navigation
            }

            // --- THIS IS THE KEY ---
            // Step 4: Manually set the currentUser and navigate
            this.currentUser = user;
            await this.loadData(); // Load data for the new user
            this.hideAuth();
            this.navigateToDashboard(this.currentUser.role); // <-- EXPLICIT NAVIGATION

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    logout() {
        if (this.currentUser && this.currentUser.role === 'admin') {
            this.currentUser = null;
            this.showPage('landingPage');
            return;
        }
        this.auth.signOut().catch(error => console.error("Logout Error:", error));
    }
    
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        }
    }

    showAuth(role, type) {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authTitle');
        const fieldsContainer = document.getElementById('authFields');
        
        modal.classList.remove('hidden');
        title.textContent = `${type === 'login' ? 'Login' : 'Sign Up'} - ${role.charAt(0).toUpperCase() + role.slice(1)}`;
        fieldsContainer.innerHTML = this.generateAuthFields(role, type);
        
        modal.dataset.role = role;
        modal.dataset.type = type;
    }

    hideAuth() { document.getElementById('authModal').classList.add('hidden'); }
    
    generateAuthFields(role, type) {
        let fields = `
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" name="email" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" name="password" required>
            </div>
        `;
        if (type === 'signup') {
            fields += `
                <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input type="text" class="form-control" name="fullName" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Address</label>
                    <input type="text" class="form-control" name="address" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" name="phone" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Blood Type</label>
                    <select class="form-control" name="bloodType" required>
                        <option value="">Select Blood Type</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                    </select>
                </div>
            `;
            if (role === 'donor') {
                fields += `
                    <div class="form-group">
                        <label class="form-label">Age</label>
                        <input type="number" class="form-control" name="age" min="18" max="65" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Weight (kg)</label>
                        <input type="number" class="form-control" name="weight" min="50" required>
                    </div>
                `;
            }
        }
        return fields;
    }

    navigateToDashboard(role) {
        const dashboards = {
            donor: () => this.renderDonorDashboard(),
            recipient: () => this.renderRecipientDashboard(),
            admin: () => this.renderAdminDashboard()
        };
        this.showPage(`${role}Dashboard`);
        if(dashboards[role]) dashboards[role]();
    }

    // =================================================================
    // =========== 🚀 LANDING PAGE FUNCTIONS (ALL FIXED) 🚀 ============
    // =================================================================

    renderLandingPage() {
        this.generateUrgentNeedsFromRequests(); // <-- Generate needs first
        this.renderUrgentNeeds(); // <-- Then render them
        this.renderHeroStats();
    }

    /**
     * MODIFIED as per your request
     * Dynamically generates the urgent needs list by scanning
     * all recipient users for 'critical', 'high', and 'moderate' requests.
     */
    generateUrgentNeedsFromRequests() {
        console.log("Generating urgent needs from user requests...");
        const needsSummary = {};

        // Filter for recipients and iterate through their requests
        this.allUsers
            .filter(user => (user.role && user.role.toLowerCase() === 'recipient'))
            .forEach(recipient => {
                // Combine currentRequests and pending entries from requestHistory to be robust
                const current = Array.isArray(recipient.currentRequests) ? recipient.currentRequests : [];
                const pendingFromHistory = (Array.isArray(recipient.requestHistory) ? recipient.requestHistory.filter(r => r.status === 'pending') : []);
                const requests = current.concat(pendingFromHistory);

                requests.forEach(reqRaw => {
                    // Support multiple possible field names and normalize
                    const req = reqRaw || {};
                    const urgency = (req.urgency || req.priority || '').toString().toLowerCase();
                    const units = parseInt(req.units || req.quantity || 0, 10) || 0;
                    const bloodType = req.bloodType || req.blood_type || req.type;

                    // Ignore if no blood type or units
                    if (!bloodType || units <= 0) return;

                    // Only include high-priority needs (exclude 'low')
                    if (urgency === 'low' || urgency === '') return;

                    // Initialize if this blood type is new
                    if (!needsSummary[bloodType]) {
                        needsSummary[bloodType] = {
                            bloodType: bloodType,
                            totalUnitsNeeded: 0,
                            requestCount: 0,
                            // Default to 'moderate', upgrade if higher priority is found
                            priority: urgency || 'moderate'
                        };
                    }

                    // Add units and increment request count
                    needsSummary[bloodType].totalUnitsNeeded += units;
                    needsSummary[bloodType].requestCount++;

                    // Set highest priority (critical > high > moderate)
                    if (urgency === 'critical') {
                        needsSummary[bloodType].priority = 'critical';
                    } else if (urgency === 'high' && needsSummary[bloodType].priority !== 'critical') {
                        needsSummary[bloodType].priority = 'high';
                    }
                });
            });

        // Convert the summary object to an array and store it
        this.urgentNeeds = Object.values(needsSummary).sort((a, b) => {
             // Sort by priority (critical first, then high, then moderate)
             const priorityOrder = { 'critical': 1, 'high': 2, 'moderate': 3 };
             const priorityA = priorityOrder[a.priority] || 4;
             const priorityB = priorityOrder[b.priority] || 4;
             
             if (priorityA !== priorityB) {
                 return priorityA - priorityB;
             }
             
             // Then sort by units needed (highest first)
             return b.totalUnitsNeeded - a.totalUnitsNeeded;
        });
        
        console.log("Generated needs (excluding low priority):", this.urgentNeeds);
    }

    renderHeroStats() {
        document.getElementById('donationsMadeStat').textContent = this.allUsers.filter(u => u.role === 'donor').reduce((sum, d) => sum + (d.totalDonations || 0), 0);
        document.getElementById('livesSavedStat').textContent = this.allUsers.filter(u => u.role === 'recipient').reduce((sum, r) => sum + (r.requestHistory?.filter(req => req.status !== 'pending').length || 0), 0);
        document.getElementById('bloodBanksStat').textContent = this.bloodBanks.length;
    }

    /**
     * =========== 🩹 THIS IS THE CRITICAL FIX 🩹 ===========
     * Renders the urgent needs based on the dynamically generated list.
     * Corrects the variable name from 'container' to 'gridContainer' to fix the error.
     */
    renderUrgentNeeds() {
        const gridContainer = document.getElementById('urgentGrid');
        
        // Find the <h2> tag
        const title = document.querySelector('#urgent h2'); 

        // Guard against missing elements
        if (!gridContainer || !title) {
             console.error("Could not find #urgentGrid or its <h2> title element.");
             return; 
        }
        
        // Add a check for empty needs
        if (this.urgentNeeds.length === 0) {
            title.textContent = 'No Urgent Needs Currently';
            gridContainer.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); grid-column: 1 / -1; font-size: var(--font-size-lg); padding: 1rem 0;">All blood requests are currently being met. Thank you, donors!</p>';
            return;
        }

        // Update the title if there *are* needs
        title.textContent = 'Urgent Needs';
        
        // --- THIS WAS THE BUG ---
        // Populate the grid with cards using the correct variable name 'gridContainer'
        gridContainer.innerHTML = this.urgentNeeds.map(need => {
            // Use the priority from the 'need' object, which is now 'critical', 'high', or 'moderate'
            return `
                <div class="urgent-card">
                    <div class="urgent-header">
                        <div class="blood-type">${need.bloodType}</div>
                        <span class="priority ${need.priority}">${need.priority}</span>
                    </div>
                    <div class="units-info">
                        <p style="margin-bottom: 0; font-size: var(--font-size-lg);"><strong>${need.totalUnitsNeeded}</strong> unit(s) needed</p>
                    </div>
                    <div class="locations" style="margin-top: 16px;">
                        From <strong>${need.requestCount}</strong> pending patient request(s)
                    </div>
                </div>
            `;
        }).join('');
    }

    // =================================================================
    // ================== DONOR DASHBOARD FUNCTIONS ====================
    // =================================================================

    renderDonorDashboard() {
        document.getElementById('donorWelcome').textContent = `Welcome, ${this.currentUser.name}`;

        if (this.currentUser.lastDonation) {
            const lastDonationDate = new Date(this.currentUser.lastDonation);
            const currentDate = new Date();
            const interval = (this.donationRules.donationInterval || 56); // Use default
            const diffTime = Math.abs(currentDate - lastDonationDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            this.currentUser.eligibleTodonate = diffDays >= interval;
        } else {
            this.currentUser.eligibleTodonate = true;
        }
        
        this.renderDonorProfile();
        this.renderEligibilityStatus();
        this.renderNearbyBanks();
        this.renderRecentAppointments(); 
        this.renderDonationHistory();
        this.renderDonationRules();
        this.renderMap();
        this.renderHealthNews();
    }

    renderMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof google === 'undefined') return;

    // ⬇️ *** PASTE YOUR NEW MAP ID HERE *** ⬇️
    const mapId = "6f0cc6b7adc4b222ae28c16b"; 

    const defaultCenter = this.bloodBanks.length > 0 ? this.bloodBanks[0].coordinates : { lat: 12.9165, lng: 79.1325 };

    const createMap = (center) => {
        const map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: center,
            mapId: mapId // <-- Required for Advanced Markers
        });

        // --- THIS IS THE NEW MARKER CODE ---
        if (center !== defaultCenter) {
            // Create a custom image element for the "Your Location" marker
            const userMarkerImg = document.createElement('img');
            userMarkerImg.src = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
            userMarkerImg.style.width = '24px';
            userMarkerImg.style.height = '24px';

            new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: center,
                title: "Your Location",
                content: userMarkerImg // Use the image element as content
            });
        }

        this.bloodBanks.forEach(bank => {
            new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: bank.coordinates,
                title: `${bank.name}\n${bank.address}`
            });
        });
        // --- END OF NEW MARKER CODE ---
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                createMap(userLocation);
            },
            () => {
                createMap(defaultCenter);
            }
        );
    } else {
        createMap(defaultCenter);
    }
}

    renderDonorProfile() {
        document.getElementById('donorProfile').innerHTML = `
            <div class="profile-item"><span class="profile-label">Name:</span><span class="profile-value">${this.currentUser.name}</span></div>
            <div class="profile-item"><span class="profile-label">Blood Type:</span><span class="profile-value">${this.currentUser.bloodType}</span></div>
            <div class="profile-item"><span class="profile-label">Total Donations:</span><span class="profile-value">${this.currentUser.totalDonations || 0}</span></div>
            <div class="profile-item"><span class="profile-label">Last Donation:</span><span class="profile-value">${this.currentUser.lastDonation || 'Never'}</span></div>
        `;
    }

    renderEligibilityStatus() {
        const container = document.getElementById('eligibilityStatus');
        const eligible = this.currentUser.eligibleTodonate;
        let detailsHTML = '';

        if (!eligible && this.currentUser.lastDonation) {
            const lastDonationDate = new Date(this.currentUser.lastDonation);
            const interval = this.donationRules.donationInterval || 56;
            
            const nextEligibleDate = new Date(lastDonationDate.getTime());
            nextEligibleDate.setDate(nextEligibleDate.getDate() + interval);
            
            detailsHTML = `<p class="next-eligible">Next eligible date: ${nextEligibleDate.toLocaleDateString('en-CA')}</p>`;
        }
        
        container.innerHTML = `
            <div class="eligibility-status ${eligible ? 'eligible' : 'not-eligible'}">
                <span>${eligible ? '✓' : '✗'}</span>
                <span>${eligible ? 'Eligible to Donate' : 'Not Yet Eligible'}</span>
            </div>
            ${detailsHTML}
            <p>Donation interval: ${this.donationRules.donationInterval || 56} days minimum</p>
        `;
    }

    // --- 🌟 MODIFIED FUNCTION 🌟 ---
    renderNearbyBanks() {
        const container = document.getElementById('nearbyBanks');
        container.innerHTML = this.bloodBanks.map(bank => `
            <div class="bank-item">
                <div class="bank-name">${bank.name}</div>
                <div class="bank-address">${bank.address}</div>
                <div class="bank-hours">Hours: ${bank.operatingHours}</div>
                <button class="btn btn--primary btn--sm mt-8" onclick="bookDonation('${bank.id}')">Book Appointment</button>
                </div>
        `).join('');
    }
    // --- 🌟 END OF MODIFIED FUNCTION 🌟 ---

    generateCalendarLink(title, date, location) {
        const startDate = new Date(`${date}T09:00:00`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        const formatDate = (dt) => {
            return dt.toISOString().replace(/-|:|\.\d+/g, "");
        };

        const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;
        
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: title,
            dates: dates,
            location: location,
            details: "Remember to bring ID and drink plenty of water!",
        });
        
        return `https://www.google.com/calendar/render?${params.toString()}`;
    }

    renderRecentAppointments() {
        const container = document.getElementById('recentAppointments');
        if (!container) return;
        const history = this.currentUser.donationHistory || [];
        if (history.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: var(--color-text-secondary);">You have no recent appointments.</p>';
            return;
        }
        const recent = [...history].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
        
        container.innerHTML = recent.map(appt => {
            let calendarButton = "";
            if (appt.status === "scheduled") {
                const bank = this.bloodBanks.find(b => b.name === appt.location);
                const address = bank ? bank.address : appt.location;
                const title = `Blood Donation at ${appt.location}`;
                const calendarLink = this.generateCalendarLink(title, appt.date, address);

                calendarButton = `
                    <a href="${calendarLink}" target="_blank" class="btn btn--outline btn--sm" style="margin-top: 12px; width: 100%;">
                        Add to Google Calendar
                    </a>`;
            }

            return `
                <div class="bank-item" style="margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="margin:0; font-weight: 500;">${appt.date}</p>
                            <p style="margin: 4px 0 0 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);">${appt.location}</p>
                        </div>
                        <span class="status-badge status-${appt.status}">${appt.status}</span>
                    </div>
                    ${calendarButton} 
                </div>
            `;
        }).join("");
    }

    renderDonationHistory() {
        const tbody = document.querySelector('#donationHistory tbody');
        const history = this.currentUser.donationHistory || [];
        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No donation history</td></tr>';
            return;
        }
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        tbody.innerHTML = sortedHistory.map(donation => `
            <tr>
                <td>${donation.date}</td><td>${donation.location}</td>
                <td>${this.currentUser.bloodType}</td>
                <td><span class="status-badge status-${donation.status}">${donation.status}</span></td>
            </tr>
        `).join('');
    }

    renderDonationRules() {
        const container = document.getElementById('donationRules');
        if(!container) return;

        const rules = (this.donationRules && this.donationRules.minimumAge) 
            ? this.donationRules 
            : {
                minimumAge: 18, maximumAge: 65, minimumWeight: 50, donationInterval: 56,
                healthRequirements: [
                    "No recent illness or infection",
                    "No recent tattoos or piercings (within 6 months)",
                    "No high-risk activities", "Adequate hemoglobin levels"
                ]
            };

        container.innerHTML = `
            <div class="rule-section"><h5>Basic Requirements</h5><ul class="rule-list">
                <li>Age: ${rules.minimumAge} - ${rules.maximumAge} years</li>
                <li>Minimum weight: ${rules.minimumWeight} kg</li>
                <li>Donation interval: ${rules.donationInterval} days</li>
            </ul></div>
            <div class="rule-section"><h5>Health Requirements</h5><ul class="rule-list">
                ${rules.healthRequirements.map(req => `<li>${req}</li>`).join('')}
            </ul></div>
        `;
    }

    async renderHealthNews() {
        const newsContainer = document.getElementById('news-content');
        if (!newsContainer) return;

        // --- ⚠️ DELETE THE API KEY VARIABLE ---
        // const apiKey = '...'; // <-- DELETE THIS LINE
        // const url = `...`; // <-- DELETE THIS LINE

        try {
            // --- NEW CODE ---
            // Fetch from our own serverless function
            const response = await fetch('/api/get-news'); 
            // --- END NEW CODE ---

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.articles && data.articles.length > 0) {
                // (The rest of the function is the same)
                newsContainer.innerHTML = data.articles.slice(0, 5).map(article => `
                    <div class="news-article">
                        <a href="${article.url}" target="_blank">
                            <p class="news-article-title">${article.title}</p>
                        </a>
                        <p class="news-article-source">${article.source.name}</p>
                    </div>
                `).join('');
            } else {
                newsContainer.innerHTML = '<p>No recent health news found.</p>';
            }
        } catch (error) {
            console.error("Could not fetch health news:", error);
            newsContainer.innerHTML = '<p>Could not load news at this time.</p>';
        }
    }
    // 🌟 END OF NEW FUNCTION 🌟

    async bookDonation(bankId) {
    if (!this.currentUser.eligibleTodonate) {
        alert('You are not currently eligible to donate.');
        return;
    }
    const bank = this.bloodBanks.find(b => b.id === bankId);

    const newAppointment = {
        date: new Date().toLocaleDateString('en-CA'),
        location: bank.name,
        status: 'scheduled'
    };

    try {
        const userDocRef = this.db.collection('users').doc(this.currentUser.id);
        await userDocRef.update({
            donationHistory: firebase.firestore.FieldValue.arrayUnion(newAppointment)
        });

        this.currentUser.donationHistory.push(newAppointment);
        this.renderDonationHistory();
        this.renderRecentAppointments(); 

        alert(`Appointment successfully scheduled at ${bank.name}.`); // This line is already here

    } catch (error) {
        console.error("Error booking appointment: ", error);
        alert("Could not book appointment. Please try again.");
    }
}

    // =================================================================
    // ================= RECIPIENT DASHBOARD FUNCTIONS =================
    // =================================================================

    // --- 🌟 MODIFIED FUNCTION 🌟 ---
    renderRecipientDashboard() {
        document.getElementById('recipientWelcome').textContent = `Welcome, ${this.currentUser.name}`;
        this.renderAvailableBanks();
        this.renderCurrentRequests();
        this.renderRequestHistory();
        this.renderRecipientMap(); // <-- NEW FUNCTION CALL
    }
    // --- 🌟 END OF MODIFIED FUNCTION 🌟 ---

    renderAvailableBanks() {
        const container = document.getElementById('availableBanks');
        container.innerHTML = this.bloodBanks.map(bank => {
            const availability = bank.inventory[this.currentUser.bloodType] || {units: 0};
            return `
                <div class="bank-item">
                    <div class="bank-name">${bank.name}</div>
                    <div class="availability-info"><strong>${this.currentUser.bloodType}:</strong> 
                        <span class="units-${availability.units < 10 ? 'critical' : 'normal'}">${availability.units} units</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderCurrentRequests() {
        const container = document.getElementById('currentRequests');
        const requests = this.currentUser.currentRequests || [];

        if (requests.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: var(--color-text-secondary); padding: 20px 0;">No current requests.</p>';
            return;
        }
        
        const sortedRequests = [...requests].sort((a,b) => new Date(b.requestDate) - new Date(a.requestDate));
        container.innerHTML = sortedRequests.map(req => {
            const urgencyText = req.urgency.charAt(0).toUpperCase() + req.urgency.slice(1);
            // Use CSS classes from your stylesheet for priority
            const statusClass = `priority ${req.urgency}`;
            return `
                <div class="bank-item" style="border-left: 4px solid var(--medical-blue); margin-bottom: 1rem;">
                    <div class="flex items-center justify-between mb-8">
                        <span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--medical-blue);">${req.units} unit(s) of ${req.bloodType}</span>
                        <span class="status-badge ${statusClass}">${urgencyText}</span>
                    </div>
                    <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Requested on: ${req.requestDate}</div>
                </div>
            `;
        }).join('');
    }

    renderRequestHistory() {
        const tbody = document.querySelector('#requestHistory tbody');
        const history = this.currentUser.requestHistory || [];
        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No request history</td></tr>';
            return;
        }
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        tbody.innerHTML = sortedHistory.map(req => `
            <tr>
                <td>${req.date}</td><td>${req.bloodType}</td><td>${req.units}</td>
                <td>${req.location}</td><td><span class="status-badge status-${req.status === 'fulfilled' ? 'completed' : req.status}">${req.status}</span></td>
            </tr>
        `).join('');
    }

    // --- 🌟 NEW FUNCTION FOR RECIPIENT MAP 🌟 ---
    renderRecipientMap() {
    const mapElement = document.getElementById('recipientMap');
    if (!mapElement || typeof google === 'undefined') return;

    // ⬇️ *** PASTE YOUR NEW MAP ID HERE *** ⬇️
    const mapId = "6f0cc6b7adc4b222ae28c16b"; // <-- Must be the same ID as above

    const defaultCenter = this.bloodBanks.length > 0 ? this.bloodBanks[0].coordinates : { lat: 12.9165, lng: 79.1325 };

    const createMap = (center) => {
        const map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: center,
            mapId: mapId // <-- Required for Advanced Markers
        });

        // --- THIS IS THE NEW MARKER CODE ---
        if (center !== defaultCenter) {
            // Create a custom image element for the "Your Location" marker
            const userMarkerImg = document.createElement('img');
            userMarkerImg.src = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
            userMarkerImg.style.width = '24px';
            userMarkerImg.style.height = '24px';

            new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: center,
                title: "Your Location",
                content: userMarkerImg // Use the image element as content
            });
        }

        this.bloodBanks.forEach(bank => {
            new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: bank.coordinates,
                title: `${bank.name}\n${bank.address}`
            });
        });
        // --- END OF NEW MARKER CODE ---
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                createMap(userLocation);
            },
            () => {
                createMap(defaultCenter);
            }
        );
    } else {
        createMap(defaultCenter);
    }
    }
    // --- 🌟 END OF NEW FUNCTION 🌟 ---

    // --- 🌟 NEW FUNCTION ADDED HERE 🌟 ---
    async sendAdminAlert(message, title = "Blood Link Alert") {
        // --- ⚠️ DELETE THE API KEY VARIABLES ---
        // const userKey = '...'; // <-- DELETE THIS LINE
        // const apiToken = '...'; // <-- DELETE THIS LINE

        try {
            // --- NEW CODE ---
            await fetch('/api/send-alert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: title,
                    message: message
                })
            });
            // --- END NEW CODE ---
            console.log("Admin alert sent successfully.");
        } catch (error) {
            console.error("Failed to send Pushover alert:", error);
        }
    }
    // --- 🌟 END OF NEW FUNCTION 🌟 ---

    async handleBloodRequest() {
        const form = document.getElementById('bloodRequestForm');
        const formData = new FormData(form);

        const newRequest = {
            bloodType: formData.get('bloodType'),
            units: parseInt(formData.get('units')),
            urgency: formData.get('urgency'),
            requestDate: new Date().toLocaleDateString('en-CA')
        };

        if (!newRequest.bloodType || !newRequest.units || !newRequest.urgency) {
            alert('Please fill out all fields.');
            return;
        }
        
        const newHistoryItem = { ...newRequest, date: newRequest.requestDate, location: 'Pending Assignment', status: 'pending' };

        try {
            const userDocRef = this.db.collection('users').doc(this.currentUser.id);
            await userDocRef.update({
                currentRequests: firebase.firestore.FieldValue.arrayUnion(newRequest),
                requestHistory: firebase.firestore.FieldValue.arrayUnion(newHistoryItem)
            });

            this.currentUser.currentRequests.push(newRequest);
            this.currentUser.requestHistory.push(newHistoryItem);
            
            this.renderCurrentRequests();
            this.renderRequestHistory();
            alert('Blood request submitted successfully.');
            form.reset();
            
            // --- 🌟 NEW CHECK ADDED HERE 🌟 ---
            if (newRequest.urgency !== 'low') {
                const alertMessage = `CRITICAL: ${newRequest.units} unit(s) of ${newRequest.bloodType} blood requested by ${this.currentUser.name}.`;
                this.sendAdminAlert(alertMessage, "Critical Blood Request!");
            }
            // --- 🌟 END OF NEW CODE 🌟 ---

        } catch(error) {
            console.error("Error submitting blood request:", error);
            alert("Could not submit request. Please try again.");
        }
    }

    // =================================================================
    // =================== ADMIN DASHBOARD FUNCTIONS ===================
    // =================================================================

    async renderAdminDashboard() {
        await this.loadData();
        this.renderOverviewStats();
        this.renderAnalyticsChart();
        this.renderPendingRequests(); 
        this.renderScheduledAppointments();
        this.renderInventoryTable();
        this.populateLocationFilter();
    }
    
    renderOverviewStats() {
        const donors = this.allUsers.filter(u => u.role === 'donor');
        const recipients = this.allUsers.filter(u => u.role === 'recipient');
        const totalDonations = donors.reduce((sum, donor) => sum + (donor.totalDonations || 0), 0);
        const totalRequests = recipients.reduce((sum, rec) => sum + (rec.requestHistory?.length || 0), 0);
        const successfulMatches = recipients.reduce((sum, rec) => sum + (rec.requestHistory?.filter(r => r.status === 'approved' || r.status === 'fulfilled').length || 0), 0);
        const pendingRequests = recipients.reduce((sum, rec) => sum + (rec.requestHistory?.filter(r => r.status === 'pending').length || 0), 0);
        
        document.getElementById('totalDonationsStat').textContent = totalDonations;
        document.getElementById('totalRequestsStat').textContent = totalRequests;
        document.getElementById('successfulMatchesStat').textContent = successfulMatches;
        document.getElementById('pendingRequestsStat').textContent = pendingRequests;
    }

    renderAnalyticsChart() {
        const canvas = document.getElementById('trendsChart');
        if (!canvas) return;

        const trends = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            .map(m => ({ month: m, donations: 0, requests: 0 }));

        this.allUsers.forEach(user => {
            if (user.role === 'donor') {
                (user.donationHistory || []).forEach(d => {
                    const date = new Date(d.date);
                    if (d.status === 'completed' && date.getFullYear() === new Date().getFullYear()) {
                        trends[date.getMonth()].donations++;
                    }
                });
            } else if (user.role === 'recipient') {
                (user.requestHistory || []).forEach(r => {
                    const date = new Date(r.date);
                     if (date.getFullYear() === new Date().getFullYear()) {
                        trends[date.getMonth()].requests++;
                    }
                });
            }
        });

        const chartData = {
            labels: trends.map(t => t.month),
            datasets: [
                { label: 'Donations', data: trends.map(t => t.donations), borderColor: '#1FB8CD', tension: 0.1 },
                { label: 'Requests', data: trends.map(t => t.requests), borderColor: '#FFC185', tension: 0.1 }
            ]
        };

        if (window.trendsChart instanceof Chart) window.trendsChart.destroy();
        window.trendsChart = new Chart(canvas.getContext('2d'), { type: 'line', data: chartData });
    }
    
    populateLocationFilter() {
        const select = document.getElementById('locationFilter');
        select.innerHTML = '<option value="">All Locations</option>';
        this.bloodBanks.forEach(bank => {
            select.innerHTML += `<option value="${bank.id}">${bank.name}</option>`;
        });
    }

    renderInventoryTable(locationFilter = '', bloodTypeFilter = '') {
        const container = document.getElementById('inventoryTable');
        let banksToDisplay = this.bloodBanks;
        if (locationFilter) {
            banksToDisplay = banksToDisplay.filter(bank => bank.id === locationFilter);
        }

        if (banksToDisplay.length === 0) {
            container.innerHTML = '<p class="text-center" style="padding: 1rem;">No matching blood banks found.</p>';
            return;
        }

        container.innerHTML = banksToDisplay.map(bank => {
            let inventoryEntries = Object.entries(bank.inventory);
            if (bloodTypeFilter) {
                inventoryEntries = inventoryEntries.filter(([type]) => type === bloodTypeFilter);
            }

            let inventoryHTML = inventoryEntries.map(([type, data]) => {
                const statusClass = data.units < 10 ? 'critical' : 'normal';
                return `<div class="blood-type-cell"><div class="blood-type-header">${type}</div><div class="blood-units units-${statusClass}">${data.units}</div></div>`;
            }).join('');

            if(inventoryHTML === '') inventoryHTML = `<p class="text-center" style="grid-column: 1 / -1; padding: 1rem; color: var(--color-text-secondary);">No matching blood types.</p>`
            
            return `<div class="inventory-bank"><div class="bank-header-info"><div class="bank-title">${bank.name}</div></div><div class="inventory-grid">${inventoryHTML}</div></div>`;
        }).join('');
    }

    geocodeAddress(address) {
        return new Promise((resolve, reject) => {
            this.geocoder.geocode({ 'address': address }, (results, status) => {
                if (status === 'OK') {
                    const location = results[0].geometry.location;
                    resolve({ lat: location.lat(), lng: location.lng() });
                } else {
                    reject(`Geocode was not successful for the following reason: ${status}. Make sure the Geocoding API is enabled in your Google Cloud project.`);
                }
            });
        });
    }

    async handleAddBank() {
        const form = document.getElementById('addBankForm');
        const formData = new FormData(form);
        const name = formData.get('name');
        const address = formData.get('address');

        if (!name || !address) return alert('Bank Name and Address are required.');

        let bankCoordinates;
        
        try {
            bankCoordinates = await this.geocodeAddress(address);
        } catch (error) {
            console.error("Geocoding Error:", error);
            alert("Error finding coordinates for the address. Please check the address. The bank will be added with default coordinates.");
            bankCoordinates = { lat: 12.9165, lng: 79.1325 }; // Default to Vellore
        }

        const newBank = {
            name, address,
            phone: formData.get('phone'),
            operatingHours: formData.get('operatingHours'),
            coordinates: bankCoordinates, 
            inventory: {
                "A+": { units: parseInt(formData.get('inv_A_plus')) || 0 }, "A-": { units: parseInt(formData.get('inv_A_minus')) || 0 },
                "B+": { units: parseInt(formData.get('inv_B_plus')) || 0 }, "B-": { units: parseInt(formData.get('inv_B_minus')) || 0 },
                "AB+": { units: parseInt(formData.get('inv_AB_plus')) || 0 }, "AB-": { units: parseInt(formData.get('inv_AB_minus')) || 0 },
                "O+": { units: parseInt(formData.get('inv_O_plus')) || 0 }, "O-": { units: parseInt(formData.get('inv_O_minus')) || 0 }
            }
        };

        try {
            await this.db.collection('bloodBanks').add(newBank);
            alert(`${name} has been successfully added!`);
            form.reset();
            hideAddBankModal();
            this.renderAdminDashboard(); 
        } catch(error) {
            console.error("Error adding new blood bank to Firestore: ", error);
        }
    }
    
    getPendingRequests() {
        const pending = [];
        this.allUsers.filter(u => u.role === 'recipient').forEach(user => {
            (user.requestHistory || []).filter(req => req.status === 'pending').forEach(request => {
                pending.push({ recipientId: user.id, recipientName: user.name, request });
            });
        });
        return pending.sort((a,b) => new Date(b.request.date) - new Date(a.request.date));
    }

    renderPendingRequests() {
        const container = document.getElementById('pendingRequestsContainer');
        const allPending = this.getPendingRequests();

        if (allPending.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: var(--color-text-secondary); padding: 20px 0;">No pending requests.</p>';
            return;
        }

        const bankOptions = this.bloodBanks.map(bank => `<option value="${bank.id}">${bank.name}</option>`).join('');
        container.innerHTML = allPending.map(item => {
            const req = item.request;
            const selectId = `select-bank-${item.recipientId}-${req.date.replace(/-/g, '')}`;
            return `
                <div class="bank-item" style="border-left: 4px solid var(--medical-orange); margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <p style="margin: 0 0 4px 0;"><strong>Recipient:</strong> ${item.recipientName}</p>
                            <p style="margin: 0 0 8px 0;"><strong>Request:</strong> ${req.units} unit(s) of ${req.bloodType}</p>
                            <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);"><strong>Date:</strong> ${req.date}</p>
                        </div>
                        <div style="text-align: right; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <div class="form-group" style="margin-bottom: 0;"><select id="${selectId}" class="form-control" style="min-width: 200px;">${bankOptions}</select></div>
                            
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn--primary btn--sm" onclick="approveRequest('${item.recipientId}', '${req.date}')">Approve</button>
                                <button class="btn btn--outline btn--sm" onclick="rejectRequest('${item.recipientId}', '${req.date}')">Reject</button>
                            </div>
                            </div>
                    </div>
                </div>`;
        }).join('');
    }

    async handleApproveRequest(recipientId, requestDate) {
        const selectId = `select-bank-${recipientId}-${requestDate.replace(/-/g, '')}`;
        const fromBankId = document.getElementById(selectId).value;
        const bankRef = this.db.collection('bloodBanks').doc(fromBankId);
        const userRef = this.db.collection('users').doc(recipientId);

        // --- NEW ---
        // Variable to hold email data, declared outside the transaction
        let emailParams; 
        
        try {
            await this.db.runTransaction(async (transaction) => {
                const [bankDoc, userDoc] = await Promise.all([transaction.get(bankRef), transaction.get(userRef)]);
                if (!bankDoc.exists || !userDoc.exists) throw "Bank or User not found!";

                const bankData = bankDoc.data();
                const userData = userDoc.data();
                const request = userData.requestHistory.find(r => r.date === requestDate && r.status === 'pending');
                
                if (!request) throw "Request not found or already processed.";
                if (bankData.inventory[request.bloodType].units < request.units) throw `Insufficient inventory at ${bankData.name}.`;

                const newUnits = bankData.inventory[request.bloodType].units - request.units;
                transaction.update(bankRef, { [`inventory.${request.bloodType}.units`]: newUnits });

                const newHistory = userData.requestHistory.map(r => (r.date === requestDate && r.status === 'pending' ? { ...r, status: 'approved', location: bankData.name } : r));
                const newCurrentRequests = userData.currentRequests.filter(cr => cr.requestDate !== request.date || cr.bloodType !== request.bloodType);
                transaction.update(userRef, { requestHistory: newHistory, currentRequests: newCurrentRequests });

                // --- NEW EMAILJS CODE ---
                // Populate the email parameters *inside* the successful transaction
                emailParams = {
                    recipient_name: userData.name,
                    recipient_email: userData.email, // Make sure recipient email is stored!
                    units: request.units,
                    blood_type: request.bloodType,
                    bank_name: bankData.name
                };
                // --- END OF NEW CODE ---
            });

            alert('Request approved successfully!');

            // --- NEW EMAILJS CODE ---
            // Send the email *after* the transaction is successful
            if (emailParams) {
                emailjs.send("service_yvmb4gx", "template_opfzpek", emailParams)
                    .then((response) => {
                       console.log('SUCCESS! Recipient approval email sent.', response.status);
                    }, (error) => {
                       console.log('FAILED to send recipient email.', error);
                    });
            }
            // --- END OF NEW CODE ---

            this.renderAdminDashboard();
        } catch (error) {
            console.error("Transaction failed: ", error);
            alert("Error approving request: " + error);
        }
    }

    async handleRejectRequest(recipientId, requestDate) {
        const userRef = this.db.collection('users').doc(recipientId);
        
        try {
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw "Recipient not found!";
            
            const userData = userDoc.data();
            const request = userData.requestHistory.find(r => r.date === requestDate && r.status === 'pending');
            if (!request) throw "Request not found or already processed.";

            // Update the request history
            const newHistory = userData.requestHistory.map(r => 
                (r.date === requestDate && r.status === 'pending') 
                ? { ...r, status: 'rejected', location: 'N/A' } 
                : r
            );
            
            // Remove from current requests
            const newCurrentRequests = userData.currentRequests.filter(cr => 
                cr.requestDate !== request.date || cr.bloodType !== request.bloodType
            );

            // Update Firestore
            await userRef.update({ 
                requestHistory: newHistory, 
                currentRequests: newCurrentRequests 
            });

            alert('Request rejected successfully.');
            
            // --- EMAILJS CODE REMOVED ---
            // The email sending logic that was here is now gone.

            this.renderAdminDashboard(); // Refresh the dashboard

        } catch (error) {
            console.error("Error rejecting request: ", error);
            alert("Error rejecting request: " + error);
        }
    }

    getScheduledAppointments() {
        const scheduled = [];
        this.allUsers.filter(u => u.role === 'donor').forEach(user => {
            (user.donationHistory || []).filter(appt => appt.status === 'scheduled').forEach(appointment => {
                scheduled.push({ donorId: user.id, donorName: user.name, donorBloodType: user.bloodType, appointment });
            });
        });
        return scheduled.sort((a,b) => new Date(b.appointment.date) - new Date(a.appointment.date));
    }

    renderScheduledAppointments() {
        const container = document.getElementById('scheduledAppointmentsContainer');
        const allScheduled = this.getScheduledAppointments();
        if (allScheduled.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: var(--color-text-secondary); padding: 1rem 0;">No scheduled appointments.</p>';
            return;
        }
        container.innerHTML = allScheduled.map(item => {
            const appt = item.appointment;
            return `
                <div class="bank-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <p style="margin:0; font-weight: 500;">${item.donorName} (${item.donorBloodType})</p>
                        <p style="margin: 4px 0 0 0; font-size: var(--font-size-sm); color: var(--color-text-secondary);">${appt.location} on ${appt.date}</p>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn--primary btn--sm" onclick="confirmDonation('${item.donorId}', '${appt.date}')">Confirm</button>
                        <button class="btn btn--outline btn--sm" onclick="rejectDonation('${item.donorId}', '${appt.date}')">Reject</button>
                    </div>
                    </div>
            `;
        }).join('');
    }
    
    async handleConfirmDonation(donorId, appointmentDate) {
        const userRef = this.db.collection('users').doc(donorId);
        try {
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw "Donor not found!";

            const userData = userDoc.data();
            const appointment = userData.donationHistory.find(a => a.date === appointmentDate && a.status === 'scheduled');
            if (!appointment) throw "Appointment not found or already processed.";
            
            const bank = this.bloodBanks.find(b => b.name === appointment.location);
            if (!bank) throw "Blood bank not found!";
            const bankRef = this.db.collection('bloodBanks').doc(bank.id);

            const newHistory = userData.donationHistory.map(a => (a.date === appointmentDate && a.status === 'scheduled' ? { ...a, status: 'completed' } : a));
            
            await userRef.update({
                donationHistory: newHistory,
                totalDonations: firebase.firestore.FieldValue.increment(1),
                lastDonation: appointment.date
            });
            await bankRef.update({
                [`inventory.${userData.bloodType}.units`]: firebase.firestore.FieldValue.increment(1)
            });

            alert(`Donation from ${userData.name} confirmed successfully!`);

            // --- NEW EMAILJS CODE ---
            const templateParams = {
                donor_name: userData.name,
                donor_email: userData.email, // Make sure donor email is stored!
                donation_date: appointment.date,
                bank_name: appointment.location
            };
            
            emailjs.send("service_yvmb4gx", "template_jpx2j4e", templateParams)
                .then((response) => {
                   console.log('SUCCESS! Donor confirmation email sent.', response.status);
                }, (error) => {
                   console.log('FAILED to send donor email.', error);
                });
            // --- END OF NEW CODE ---

            this.renderAdminDashboard();
        } catch (error) {
            console.error("Donation confirmation failed: ", error);
        }
    }

    // --- 🌟 MODIFIED FUNCTION (EMAILJS REMOVED) 🌟 ---
    async handleRejectDonation(donorId, appointmentDate) {
        const userRef = this.db.collection('users').doc(donorId);
        try {
            const userDoc = await userRef.get();
            if (!userDoc.exists) throw "Donor not found!";

            const userData = userDoc.data();
            const appointment = userData.donationHistory.find(a => a.date === appointmentDate && a.status === 'scheduled');
            if (!appointment) throw "Appointment not found or already processed.";

            // Update the history to mark this appointment as 'rejected'
            const newHistory = userData.donationHistory.map(a => 
                (a.date === appointmentDate && a.status === 'scheduled') 
                ? { ...a, status: 'rejected' } 
                : a
            );
            
            // Update the user document in Firestore
            await userRef.update({
                donationHistory: newHistory
                // We DON'T increment totalDonations or update lastDonation
            });

            alert(`Donation from ${userData.name} has been rejected.`);

            // --- EMAILJS CODE REMOVED ---
            // The email sending logic that was here is now gone.

            this.renderAdminDashboard(); // Refresh the dashboard

        } catch (error) {
            console.error("Donation rejection failed: ", error);
        }
    }
    
    applyFilters() {
        const bloodType = document.getElementById('bloodTypeFilter').value;
        const location = document.getElementById('locationFilter').value;
        this.renderInventoryTable(location, bloodType);
    }
}

// Global functions
let app;
function showAuth(role, type) { if (app) app.showAuth(role, type); }
function hideAuth() { if (app) app.hideAuth(); }
function logout() { if (app) app.logout(); }
function applyFilters() { if (app) app.applyFilters(); }
function bookDonation(bankId) { if (app) app.bookDonation(bankId); }
function approveRequest(recipientId, requestDate) { if (app) app.handleApproveRequest(recipientId, requestDate); }
function confirmDonation(donorId, appointmentDate) { if (app) app.handleConfirmDonation(donorId, appointmentDate); }
function showAddBankModal() { document.getElementById('addBankModal').classList.remove('hidden'); }
function hideAddBankModal() { document.getElementById('addBankModal').classList.add('hidden'); }
// --- 🌟 NEW GLOBAL FUNCTIONS ADDED 🌟 ---
function rejectRequest(recipientId, requestDate) { if (app) app.handleRejectRequest(recipientId, requestDate); }
function rejectDonation(donorId, appointmentDate) { if (app) app.handleRejectDonation(donorId, appointmentDate); }
// --- 🌟 END OF NEW GLOBAL FUNCTIONS 🌟 ---

// This function is no longer needed to be called by the Maps API, 
// but we leave it here so the map on the donor page doesn't break.
function initMap() { 
    // The renderMap function in the app class will handle map creation.
}


// =================================================================
// =========== 🚀 FIXED DOMContentLoaded LISTENER 🚀 ==============
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    app = new BloodLinkApp();
    window.app = app;
    // We NO LONGER call app.loadData() here.
    // The BloodLinkApp constructor already sets the auth listener,
    // which handles all data loading and initial page rendering.
});