# Real-Time Instant Messaging Application

A fully functional, highly secure, production-ready Real-Time Instant Messaging Application built with the MERN stack (MongoDB, Express, React, Node.js), Socket.io, and Cloudinary.

## Features
- **Secure Authentication:** Zero-LocalStorage authentication using `HttpOnly`, `Secure`, and `SameSite=Strict` JWT cookies. Passwords hashed with `bcryptjs`.
- **Real-Time Communication:** Websockets authenticated via secure cookies. 1-to-1 Direct Messages and Group Channels.
- **Quoted Message Replies (Threading):** Quote and reply directly to any message with clickable jump-to navigation and highlight pulse.
- **Message Editing:** Edit sent messages with live socket broadcast and `(edited)` timestamp badges.
- **Custom Group & Channel Creation:** Create custom channels with name, description, and member invitations. Inspect group member directories in real time.
- **Document & File Sharing:** Share documents, PDFs, zip archives, and code files with rich interactive file cards and download links.
- **Starred / Bookmarked Messages:** Bookmark important messages and manage them in the slide-over Starred Messages drawer.
- **Message Forwarding:** Search and forward any message to contacts or channels with 1 click.
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
