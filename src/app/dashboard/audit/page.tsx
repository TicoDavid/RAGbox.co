import { redirect } from 'next/navigation'

/**
 * /dashboard/audit — redirects to main dashboard with audit panel open.
 * The DashboardLayout handles audit as a right-rail panel, not a separate route.
 */
export default function AuditPage() {
  redirect('/dashboard?panel=audit')
}
