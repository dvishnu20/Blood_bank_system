# 🩸 Blood Link - Online Blood Bank System

**Blood Link** is a comprehensive, real-time, web-based platform designed to bridge the gap between **blood donors**, **recipients**, and **blood bank administrators**. It’s a **single-page application (SPA)** built with **Vanilla JavaScript** and backed by **Firebase** for authentication and a live database.

---

## 🌍 Overview

Blood Link simplifies the process of **donating and receiving blood** by connecting all stakeholders on one platform.

### 👤 User Roles
- **Donors**: Register, find nearby blood banks (via Google Maps), and schedule donation appointments.
- **Recipients**: Register and submit urgent or scheduled blood requests.
- **Admins**: Manage inventory, approve requests, confirm donations, and oversee the entire system.

---

## ✨ Core Features

### 🏠 Landing Page & Public Features
- **Dynamic Hero Stats**: The main page displays live statistics for total donations, lives saved, and the number of registered blood banks, all pulled from Firestore.
- **Urgent Needs Section**: A real-time view of urgent blood requirements.
- **Multi-Role Authentication**: A clean modal for **Login** and **Sign Up** for Donors and Recipients, plus a separate login for the Admin.

### 🩸 Donor Dashboard
- **Dynamic Profile**: View personal details, blood type, total donations, and last donation date.
- **Automatic Eligibility Check**: Automatically calculates and displays donation eligibility based on the 56-day waiting period from the `lastDonation` date in Firestore.
- **Interactive Geolocation Map**: Asks for user's permission to display their current location with a custom blue marker and plots all nearby blood banks with red markers.
- **Appointment Booking**: Donors can schedule a donation appointment, which appears on the Admin dashboard for approval.
- **Donation History**: View a full table of all past and scheduled donations with their statuses (`scheduled`, `completed`).

### 🏥 Recipient Dashboard
- **Blood Request Form**: Submit new requests specifying blood type, units, and urgency level.
- **View Bank Inventory**: Shows available stock by blood type for all registered blood banks.
- **Request Management**: Track the status (`pending`, `approved`) of all submitted requests in real-time.

### ⚕️ Admin Dashboard
- **Dynamic Analytics Overview**: View live-calculated stats for total donations, total requests, successful matches, and current pending requests.
- **Monthly Trends Graph**: A dynamic **Chart.js** line graph showing total donations vs. total requests for each month of the year, based on all user data in Firestore.
- **Request Management**:
  - View all pending blood requests from recipients.
  - Approve requests, which automatically deducts the units from the selected bank's inventory and updates the recipient's request status.
- **Appointment Management**:
  - View all scheduled donation appointments from donors.
  - Confirm a donation, which marks it "completed" for the donor, updates their `lastDonation` date and `totalDonations` count, and increments the blood bank's inventory.
- **Inventory Management**:
  - View a filterable list of all blood banks and their complete inventories.
  - Filter the view by location or a specific blood type.
- **Add New Banks**:
  - A modal form allows the admin to add a new blood bank, including its initial inventory, directly to the Firestore database.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| **Backend** | Firebase (Authentication & Firestore Real-Time Database) |
| **APIs & Services** | Google Maps JavaScript API, Google Geocoding API, EmailJS, Pushover, NewsAPI |
| **Libraries** | Chart.js |

---

## 🚀 Setup and Installation

### 1️⃣ Clone the Repository
```bash
git clone [https://github.com/your-username/blood-link.git](https://github.com/your-username/blood-link.git)
cd blood-link
```
---

### 2️⃣ Firebase Setup

Create a new project in the Firebase Console.

Enable Email/Password authentication.

Create a Firestore Database (Test Mode for development).

Copy your Firebase Web Config Object and paste it inside index.html (lines 1014–1023).

🔧 Firestore Structure
```
Collections:
  ├── bloodBanks
  ├── users
  └── settings
        └── donationRules
            ├── donationInterval: 56
            ├── minimumAge: 18
```
---

### 3️⃣ Google Cloud Setup

Create a project in Google Cloud Console.

Enable the following APIs:

✅ Maps JavaScript API

✅ Geocoding API

Generate an API Key and replace in index.html:
```
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE"></script>
```
---
4️⃣ API Key Configuration

Edit app.js and replace the placeholder keys:

```
| Service                    | Location  | Key                                       |
| -------------------------- | --------- | ----------------------------------------- |
| EmailJS                    | Line 8    | `emailjs.init("YOUR_USER_ID_HERE");`      |
| EmailJS (Approve Request)  | Line 1030 | `service_id`, `template_id`               |
| EmailJS (Confirm Donation) | Line 1121 | `service_id`, `template_id`               |
| NewsAPI                    | Line 601  | `const apiKey = 'YOUR_NEWSAPI_KEY_HERE';` |
| Pushover                   | Line 803  | `const userKey`, `const apiToken`         |

```
---
5️⃣ Run the Application

To avoid CORS issues, run with a local server:
```
npm install -g http-server
http-server
```

Then open in your browser:
```
http://127.0.0.1:8080
```
---
## 👩‍💻 Usage

### 🩸 Donor / Recipient

Use the Sign Up options on the landing page.
Your details will be stored in Firebase Authentication and Firestore.

### 🧑‍⚕️ Admin

Use the Admin Login option with default credentials configured in the system.
