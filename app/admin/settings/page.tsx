import CalendarUpload from '@/components/admin/calendar/CalendarUpload'
import CalendarDisplay from '@/components/admin/calendar/CalendarDisplay'
import { getCalendarDays } from '@/lib/actions/calendar'

export default async function SettingsPage() {
  // Get school year calendar data (August to following June)
  // Since we're in January 2026, fetch from Aug 2025 to Jun 2026
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1 // 1-12
  const currentYear = currentDate.getFullYear()
  
  // If it's August or later, school year is current year to next year
  // If it's before August, school year is previous year to current year
  const schoolYearStart = currentMonth >= 8 ? currentYear : currentYear - 1
  const schoolYearEnd = currentMonth >= 8 ? currentYear + 1 : currentYear
  
  const startDate = `${schoolYearStart}-08-01`
  const endDate = `${schoolYearEnd}-06-30`
  
  const calendarDays = await getCalendarDays(startDate, endDate)
  
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
      
      <div className="space-y-8">
        {/* Calendar Upload Section */}
        <CalendarUpload />

        {/* Calendar Display Section */}
        <CalendarDisplay calendarDays={calendarDays} />
      </div>
    </div>
  )
}
