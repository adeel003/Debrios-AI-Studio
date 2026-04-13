# Debrios SaaS Logistics Platform

Debrios is a professional, multi-tenant logistics management platform designed for waste management and logistics operations. It provides a comprehensive suite of tools for dispatchers, admins, and drivers to coordinate loads, manage assets, and track operational performance.

## 🚀 Features

- **Multi-Tenant Architecture**: Secure data isolation for different organizations.
- **Command Center**: Real-time operational visibility with a Dispatcher Map and Dashboard.
- **Operations Management**: Efficiently manage loads, dispatching, and dumpyards.
- **Asset Tracking**: Inventory management for dumpsters and other equipment.
- **People Management**: Role-based access control for Admins, Dispatchers, and Drivers.
- **Customer Directory**: Manage client sites and contact information.
- **Finance & Billing**: Track platform fees and billing history.
- **Audit Logs**: Comprehensive logging of all critical system actions.
- **Driver App**: Specialized mobile-friendly interface for drivers to manage assigned loads.

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React (Icons), Motion (Animations)
- **Backend/Database**: Supabase (PostgreSQL, Auth, RLS)
- **Charts & Data**: Recharts, D3.js
- **Routing**: React Router 7

## 📋 Prerequisites

- Node.js (v18 or higher)
- A Supabase project

## ⚙️ Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd debrios-logistics
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Database Setup**:
   Execute the SQL scripts located in the `supabase/migrations` folder in your Supabase SQL Editor to set up the schema and RLS policies. Start with `supabase_schema.sql`.

5. **Run the development server**:
   ```bash
   npm run dev
   ```

## 🏗 Project Structure

The project follows a feature-based module architecture:

- `src/components`: Shared UI components and layout.
- `src/contexts`: Global state management (Auth, etc.).
- `src/core`: Guards and core utilities.
- `src/features`: Domain-specific modules (Operations, Assets, People, etc.).
- `src/lib`: Third-party library initializations (Supabase).
- `src/types`: TypeScript definitions.

## 🔒 Security

This platform uses **Supabase Row Level Security (RLS)** to ensure that users can only access data belonging to their own tenant. Access is further restricted by user roles (Admin, Dispatcher, Driver).

## 📄 License

This project is private and proprietary.
