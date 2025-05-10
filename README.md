# Paloparti App

A web application for managing football matches and teams.

## Tech Stack

- **Frontend**: Next.js with TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Container**: Docker and Docker Compose

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL="postgresql://paloparti:paloparti123@localhost:5432/paloparti"
JWT_SECRET="your-secret-key"
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Docker containers:
   ```bash
   docker-compose up -d
   ```
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

## Database Schema

### User

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  password      String
  avatar        String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  isCaptain     Boolean   @default(false)
  teams         TeamMember[]
  matches       MatchParticipant[]
  goals         Goal[]
}
```

### Team

```prisma
model Team {
  id          String    @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  members     TeamMember[]
  teamAMatches Match[]  @relation("TeamAMatches")
  teamBMatches Match[]  @relation("TeamBMatches")
}
```

### Match

```prisma
model Match {
  id              String    @id @default(cuid())
  name            String
  date            DateTime
  location        String
  requiredPlayers Int
  maxPlayers      Int
  teamAId         String
  teamBId         String
  result          String?   // 'win', 'loss', 'draw'
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  teamA           Team      @relation("TeamAMatches", fields: [teamAId], references: [id])
  teamB           Team      @relation("TeamBMatches", fields: [teamBId], references: [id])
  participants    MatchParticipant[]
  goals           Goal[]
}
```

## API Endpoints

### Authentication

#### Register User

- **URL**: `/api/users/register`
- **Method**: POST
- **Body**:
  ```json
  {
    "name": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Response**: User object (without password)

#### Login

- **URL**: `/api/users/login`
- **Method**: POST
- **Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "user": "User object",
    "token": "JWT token"
  }
  ```

### User Profile

#### Get Current User

- **URL**: `/api/users/me`
- **Method**: GET
- **Headers**: Authorization: Bearer {token}
- **Response**: User object

## Authentication

The application uses JWT (JSON Web Tokens) for authentication. Protected routes require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

The middleware automatically validates the token and adds the user ID to the request headers for protected routes.

## Docker Services

The application runs three Docker containers:

1. **PostgreSQL Database**

   - Port: 5432
   - Credentials:
     - User: paloparti
     - Password: paloparti123
     - Database: paloparti

2. **pgAdmin**

   - Port: 5050
   - Credentials:
     - Email: admin@paloparti.com
     - Password: admin123

3. **API Service**
   - Port: 3001
   - Environment:
     - NODE_ENV: development

## Development

### Available Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the application
- `npm start`: Start the production server
- `npx prisma studio`: Open Prisma Studio to manage database
- `npx prisma generate`: Generate Prisma Client
- `npx prisma migrate dev`: Run database migrations

### Database Management

To manage the database through pgAdmin:

1. Access pgAdmin at http://localhost:5050
2. Login with the credentials
3. Add a new server:
   - Host: db
   - Port: 5432
   - Database: paloparti
   - Username: paloparti
   - Password: paloparti123

## Configuración de la Base de Datos

Este proyecto utiliza PostgreSQL ejecutándose en Docker. Sigue estos pasos para configurar correctamente la base de datos:

1. **Asegúrate de que Docker esté instalado y en ejecución**
2. **Inicia los servicios con Docker Compose**:
   ```bash
   docker-compose up -d
   ```
3. **Verifica que la base de datos esté funcionando**:
   ```bash
   npm run check-db
   ```

### Credenciales de la Base de Datos

- **Base de datos**: PostgreSQL
- **Usuario**: paloparti
- **Contraseña**: paloparti123
- **Base de datos**: paloparti
- **Puerto**: 5432
- **URL de conexión**: postgresql://paloparti:paloparti123@localhost:5432/paloparti

### Solución de problemas

Si obtienes el error "Can't reach database server at `localhost:5432`", sigue estos pasos:

1. Verifica que Docker esté en ejecución
2. Comprueba el estado de los contenedores Docker:
   ```bash
   docker ps | grep postgres
   ```
3. Si el contenedor no está en ejecución, inicia los servicios:
   ```bash
   docker-compose up -d
   ```
4. Verifica que tu archivo `.env.local` tenga la configuración correcta:
   ```
   DATABASE_URL=postgresql://paloparti:paloparti123@localhost:5432/paloparti
   ```
5. Reinicia la aplicación:
   ```bash
   npm run dev
   ```

## Deployment on Vercel

This application is configured for deployment on Vercel with a Supabase database.

### Prerequisites

- A Vercel account
- A Supabase account with a PostgreSQL database

### Setup for Vercel Deployment

1. Fork or clone this repository to your GitHub account
2. Create a new project on Vercel and link it to your GitHub repository
3. In Vercel, add the following environment variables from your Supabase project:

```
DATABASE_URL
POSTGRES_URL
POSTGRES_PRISMA_URL
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
POSTGRES_URL_NON_POOLING
SUPABASE_JWT_SECRET
POSTGRES_USER
NEXT_PUBLIC_SUPABASE_ANON_KEY
POSTGRES_PASSWORD
POSTGRES_DATABASE
SUPABASE_SERVICE_ROLE_KEY
POSTGRES_HOST
SUPABASE_ANON_KEY
NEXTAUTH_URL
NEXTAUTH_SECRET
```

4. Set `NEXTAUTH_URL` to your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
5. Deploy the project through the Vercel dashboard

The database migration will be handled automatically during the build process with the `prisma generate` command configured in the build script.
