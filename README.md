# Chat Support - Node.js + MySQL + Socket.io (Example)

## What is included
- Express server with Socket.io for realtime chat
- Simple Bootstrap frontend for customer (`/index.html`) and agent (`/admin.html`)
- MySQL schema to store messages `db/schema.sql`

## Setup (local)
1. Install Node.js (v16+ recommended) and MySQL.
2. Import the database:
   - `mysql -u root -p < db/schema.sql`
3. Edit `server.js` to set your MySQL user/password if not using defaults.
4. Install dependencies:
   - `npm install`
5. Run:
   - `npm start`
6. Open in browser:
   - Customer: `http://localhost:3000/index.html`
   - Agent: `http://localhost:3000/admin.html`

## Notes
- This is a minimal example. For production, add authentication, validation, error handling, and use connection pools.
