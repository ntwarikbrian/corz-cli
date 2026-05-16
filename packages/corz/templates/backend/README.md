# {{projectName}} Backend

## Setup

1. Create the database:
   ```bash
   mysql -u root < database/schema.sql
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your MySQL credentials.

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

## Default User

- Username: `user`
- Password: `user123`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Login with username and password |
