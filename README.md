🩸 Blood Link - Online Blood Bank System
Blood Link is a comprehensive, web-based platform designed to bridge the gap between blood donors, recipients, and blood bank administrators. It's a single-page application (SPA) built with Vanilla JavaScript and backed by Firebase for real-time data management.

The system provides three distinct user roles:

Donors: Can register, find nearby banks, and schedule donation appointments.

Recipients: Can register and submit urgent or scheduled blood requests.

Admins: Have a full overview of the system, manage inventory, approve requests, and confirm donations.

Landing Page & Urgent Needs

Donor Dashboard (Profile, Map)

Recipient Dashboard (Request Form, History)

Admin Dashboard (Pending Requests, Inventory)

✨ Features
General Features
Role-Based Authentication: Secure login and signup for Donors and Recipients using Firebase Authentication.

Default Admin Login: Separate, secure login for the system administrator.

Dynamic Landing Page: Features real-time stats on donations, lives saved, and registered banks.

Live Urgent Needs: The landing page dynamically generates an "Urgent Needs" grid by scanning all pending high-priority recipient requests from Firestore.

🩸 Donor Dashboard
Dynamic Profile: View personal details, blood type, and total donations.

Eligibility Check: Automatically calculates donation eligibility based on the date of the last donation and rules fetched from Firestore.

Nearby Banks: Lists all registered blood banks from the database.

Interactive Map: Displays all blood bank locations on an embedded Google Map, with the user's current location as a reference.

Appointment Booking: Schedule a donation at a specific bank, which is then sent to the admin for confirmation.

Google Calendar Integration: Generates "Add to Google Calendar" links for scheduled appointments.

Donation History: A complete table of all past and scheduled appointments.

Live Health News: A "Latest Health News" widget that pulls real-time articles using the NewsAPI.

🏥 Recipient Dashboard
Submit Blood Requests: An easy-to-use form to request blood, specifying type, units, and urgency.

Urgent Request Alerts: Submitting a 'critical' or 'high' urgency request automatically sends a Pushover push notification to the admin.

View Bank Inventory: Displays the current inventory of the user's blood type at nearby banks.

Interactive Map: Displays all blood bank locations on an embedded Google Map.

Request Management: View the status of current (pending) requests and a full history of all past requests (approved, pending, rejected).

⚕️ Admin Dashboard
Analytics Overview: View key statistics: total donations, total requests, successful matches, and pending requests.

Monthly Trends: A dynamic line chart (using Chart.js) showing donation vs. request trends over the year.

Request Management:

View all pending blood requests from recipients.

Approve or Reject requests.

Approving a request automatically sends a confirmation email to the recipient using EmailJS.

Appointment Management:

View all scheduled donation appointments from donors.

Confirm or Reject appointments.

Confirming a donation automatically updates the bank's inventory, the donor's profile (total donations, last donation date), and sends a "Thank You" email via EmailJS.

Inventory Management:

View a detailed, filterable table of the current inventory for all blood banks.

Filter inventory by location or blood type.

Add New Banks:

A modal form to add a new blood bank to the system.

Uses the Google Geocoding API to automatically find and store the bank's latitude and longitude from its address.

🛠️ Technology Stack
Frontend: HTML5, CSS3, Vanilla JavaScript (ES6+)

Backend: Firebase

Firebase Authentication: For user login and registration.

Firestore: Real-time NoSQL database for all application data (users, banks, requests).

APIs & Services:

Google Maps API: To display interactive maps on donor and recipient dashboards.

Google Geocoding API: To convert addresses into coordinates when adding new banks.

EmailJS: To send transactional email notifications (request approvals, donation confirmations).

Pushover: To send real-time push notifications to the admin for urgent requests.

NewsAPI: To fetch and display live health news on the donor dashboard.

Libraries:

Chart.js: To render the analytics chart on the admin dashboard.

🚀 Setup and Installation
To run this project locally, you will need to set up several API keys.

1. Clone the Repository
Bash

git clone https://github.com/your-username/blood-link.git
cd blood-link
2. Firebase Setup
Create a new project in the Firebase Console.

Go to Authentication -> Sign-in method and enable Email/Password.

Go to Firestore Database and create a new database in test mode (or set up security rules).

In your Firebase project settings, find your "Config" object for a web app.

Open index.html and paste this config object into the <script> tag at the bottom (lines 1014-1023).

3. Firestore Database Structure
You must create the following collections and documents for the app to work:

Collection: bloodBanks

Add documents with the structure found in app.js (name, address, coordinates, inventory, etc.).

Collection: users

This will be populated automatically when donors and recipients sign up.

Collection: settings

Create one document with the ID donationRules.

Add fields to this document like donationInterval: 56, minimumAge: 18, etc. (see renderDonationRules in app.js).

4. Google Cloud (Maps & Geocoding)
Go to the Google Cloud Console.

Create a new project.

Enable the "Maps JavaScript API" and "Geocoding API".

Create an API Key.

Open index.html and paste your API key into the <script> tag in the <head> (line 12):

HTML

<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE"></script>
5. API Key Configuration
Open app.js and fill in the placeholder keys in the following functions:

EmailJS (line 8):

emailjs.init("YOUR_USER_ID_HERE");

handleApproveRequest (line 1030): Update service_id and template_id.

handleConfirmDonation (line 1121): Update service_id and template_id.

NewsAPI (line 601):

const apiKey = 'YOUR_NEWSAPI_KEY_HERE';

Pushover (line 803):

const userKey = 'YOUR_PUSHOVER_USER_KEY';

const apiToken = 'YOUR_PUSHOVER_APP_TOKEN';

6. Run the Application
You can now open the index.html file in any modern web browser. For best results (to avoid any CORS issues with APIs), run it using a simple local server.

Make sure you have Node.js installed.

Install http-server:

Bash

npm install -g http-server
Run the server from your project's root directory:

Bash

http-server
Open http://127.0.0.1:8080 in your browser.


Donor & Recipient:

Use the "Sign Up" buttons on the landing page to create new Donor or Recipient accounts. These will be stored in your Firebase Authentication and Firestore database.
