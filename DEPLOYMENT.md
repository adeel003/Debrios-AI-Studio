# Debrios Deployment Checklist

Follow these steps to deploy Debrios to production (e.g., Vercel, Netlify, or Cloud Run).

## 1. Supabase Project Setup
- [ ] Create a new Supabase project.
- [ ] Run the database migrations (SQL provided in the project) to create `tenants`, `profiles`, `customers`, `drivers`, `loads`, `team_invites`, and `platform_fees` tables.
- [ ] Enable Row Level Security (RLS) on all tables and apply the provided policies.

## 2. Environment Variables
Configure the following environment variables in your deployment platform:
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key.
- `GEMINI_API_KEY`: Required if using AI features.
- `APP_URL`: The public URL of your deployed application.

## 3. Supabase Auth Settings
- [ ] **Site URL**: Set this to your deployed application's URL (e.g., `https://debrios.vercel.app`).
- [ ] **Redirect URIs**: Add your application URL to the "Additional Redirect URIs" list in Supabase Auth settings.
- [ ] **Email Templates**: (Optional) Customize the magic link and signup email templates.

## 4. Security Audit
- [ ] Verify that `VITE_SUPABASE_ANON_KEY` is used in the frontend, NOT `service_role`.
- [ ] Ensure RLS policies are strictly enforced.
- [ ] Test that drivers cannot access dispatcher/admin routes.

## 5. Final Verification
- [ ] Test the signup flow (Company Onboarding).
- [ ] Test the login flow (Password and Magic Link).
- [ ] Test load creation and assignment.
- [ ] Test driver hub functionality.
- [ ] Verify that all pages show loading states and handle errors gracefully.

## 6. Build & Deploy
- [ ] Run `npm run build` to ensure the project compiles without errors.
- [ ] Deploy the `dist` folder to your hosting provider.
