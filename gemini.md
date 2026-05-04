# Data Schema and Maintenance Log

## Data Schema (The "Data-First" Rule)
- *Confirmed*

### `work_orders` Table Schema

**Primary Key:** Composite ID string → `{Work Order #}_{Assigned To}_{Sequence}` (e.g., `RCE-10342-DD_Sylvia_0001`)

**Input Shape (Form Submission):**
```json
{
  "work_order_date": "date",
  "work_order_number": "string",
  "region": "string (enum: Central, Eastern, Rexdale, Western)",
  "assigned_to": "string (from Supabase auth users)",
  "file_number": "string (nullable)",
  "hearing_date": "date",
  "division": "string (enum: ID, RPD, RAD, IAD)",
  "request_type": "string (enum: Full, Bench)",
  "tat": "integer (enum: 10, 5, 4, 3, 2, 1)",
  "due_date": "date",
  "audio_length": "string (nullable)",
  "word_count": "integer (nullable)",
  "character_wz_space": "integer (nullable)",
  "line_count": "integer (nullable)",
  "status": "string (nullable)",
  "del_date": "date (nullable)",
  "employee_comments": "text (nullable)",
  "regdeck_admin_comments": "text (nullable)",
  "delivery_status": "string (nullable)",
  "days_late": "integer (nullable)"
}
```

**Output Shape (Database to UI / Reports):**
```json
{
  "id": "string (composite PK)",
  "created_at": "timestamp",
  "language": "string",
  "work_order_date": "date",
  "work_order_number": "string",
  "region": "string",
  "assigned_to": "string",
  "file_number": "string",
  "hearing_date": "date",
  "division": "string",
  "request_type": "string",
  "tat": "integer",
  "due_date": "date",
  "audio_length": "string",
  "word_count": "integer",
  "character_wz_space": "integer",
  "line_count": "integer",
  "status": "string",
  "del_date": "date",
  "employee_comments": "text",
  "regdeck_admin_comments": "text",
  "delivery_status": "string",
  "days_late": "integer",
  "created_by": "uuid (User ID from Auth)"
}
```

### Dropdown Static Values
| Field | Values |
|-------|--------|
| Language | EN (English), FR (French) |
| Region | Central, Eastern, Rexdale, Western |
| Division | ID, RPD, RAD, IAD |
| Request Type | Full, Bench |
| TAT | 10, 5, 4, 3, 2, 1 |
| Assigned To | Populated from Supabase auth users |

## Maintenance Log
- *Pending Deployment Phase*
