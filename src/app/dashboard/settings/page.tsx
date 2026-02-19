import { redirect } from 'next/navigation'

/**
 * /dashboard/settings — redirects to main dashboard with settings panel open.
 * The DashboardLayout handles settings as a right-rail panel, not a separate route.
 */
export default function SettingsPage() {
  redirect('/dashboard?panel=settings')
}
