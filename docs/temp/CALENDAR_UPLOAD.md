# Calendar CSV Upload Guide

## Overview
The calendar upload feature allows administrators to bulk import A/B day schedules via CSV file.

## CSV Format

The CSV file must have exactly two columns:
- `date` - Date in YYYY-MM-DD format
- `day_type` - One of: `A`, `B`, or `off`

### Example CSV
```csv
date,day_type
2025-08-21,A
2025-08-22,B
2025-08-25,A
2025-08-26,B
2025-08-27,A
2025-08-28,B
2025-08-29,A
2025-09-02,off
2025-09-03,B
```

### Day Types
- **A** - A day (is_school_day=true, ab_designation='a_day')
- **B** - B day (is_school_day=true, ab_designation='b_day')  
- **off** - Day off/break (is_school_day=false, ab_designation=null)

## Usage

1. Navigate to `/admin/settings`
2. Click "Choose File" and select your CSV
3. Review the preview (first 10 rows)
4. Click "Upload Calendar"
5. System will:
   - Delete existing calendar days
   - Import all days from CSV
   - Show success message with count

## Notes

- **Re-uploading will replace all existing calendar data**
- Weekends are typically omitted from the CSV (system treats them as non-school days by default)
- Invalid rows are reported but don't stop the upload
- Case-insensitive: `a`, `A`, `off`, `OFF` all work

## Creating Your CSV

### From Google Sheets
1. Open your school's A/B calendar in Google Sheets
2. Add two columns: date, day_type
3. Fill in dates and types
4. File → Download → Comma-separated values (.csv)

### From Excel
1. Create spreadsheet with date and day_type columns
2. Save As → CSV (Comma delimited)

### Manual Creation
A sample CSV is available in `docs/sample-calendar.csv` for reference.
