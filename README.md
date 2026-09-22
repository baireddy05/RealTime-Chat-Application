# Real-Time Instant Messaging Application

A fully functional, feature-complete Real-Time Instant Messaging Application built with the MERN stack (MongoDB, Express, React, Node.js), Socket.io, and Cloudinary.

## Features
- **Secure Authentication:** Zero-LocalStorage authentication using `HttpOnly` JWT cookies (`Secure` + `SameSite=None` in production, `Lax` for local development, with a Bearer-token fallback for WebView contexts). Passwords hashed with `bcryptjs` (12 salt rounds).
- **Real-Time Communication:** Websockets authenticated via secure cookies. 1-to-1 Direct Messages and Groups.
- **Quoted Message Replies (Threading):** Quote and reply directly to any message with clickable jump-to navigation and highlight pulse.
- **Message Editing:** Edit sent messages with live socket broadcast and `(edited)` timestamp badges.
- **Custom Group Creation:** Create custom groups with name, description, and member invitations. Inspect group member directories in real time. Group admins can add or remove members.
- **Document & File Sharing:** Share documents, PDFs, zip archives, and code files with rich interactive file cards and download links.
- **Starred / Bookmarked Messages:** Bookmark important messages and manage them in the slide-over Starred Messages drawer.
- **Message Forwarding:** Search and forward any message to contacts or groups with 1 click.
- **Synthesized UI Audio:** Pure Web Audio API synthesized chimes for message sending and receiving.
- **Online/Offline Status:** Live indicators driven by active socket connections.
- **Modern UI:** Responsive, dynamic Cyber Dark Mode layout using React, Vite, and Tailwind CSS.

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas (Free Tier) Account
- Cloudinary (Free Tier) Account

### 2. Environment Variables
Create a `.env` file in the `server` directory with the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLIENT_URL=http://localhost:5173
# Push notifications (background messages & calls). Generate with: npm run gen:vapid
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000
```

### 3. Installation
**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd client
npm install
```

### 4. Running the Seed Script
To generate dummy users, rooms, and messages for testing:
```bash
cd server
npm run seed
```

### 5. Running the Application
**Server:**
```bash
cd server
npm run dev
```

**Client:**
```bash
cd client
npm run dev
```

### 6. Demo Accounts (for evaluation)

Run the seeder once (or just start the server against an empty database, which auto-seeds):

```bash
cd server
npm run seed
```

| Username | Email | Password |
|---|---|---|
| User1 | user1@example.com | password123 |
| User2 | user2@example.com | password123 |
| User3 | user3@example.com | password123 |
| User4 | user4@example.com | password123 |
| User5 | user5@example.com | password123 |

Seeded content includes a "General Group" with welcome messages, and User1 + User2 start as friends. Suggested flow: log in as User1 and User2 in two browsers, exchange text, an image, and a PDF, then try a call and a status post.

### 7. Install as an App (PWA)
Install on phones straight from the browser via Add to Home Screen for an app-like experience with background push notifications.
