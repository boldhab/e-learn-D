# Phase 3 API Test Suite

Base URLs:

```powershell
$AUTH_BASE = "http://localhost:5001"
$COURSE_BASE = "http://localhost:5002"
$LEARNING_BASE = "http://localhost:5003"
```

Seeded credentials:

```powershell
# Seed data roles from auth-service/seed.js:
# Teacher: alice@teacher.com / password123
# Student: bob@student.com / password123
# Admin:   hab@admin.com / password123
```

## Setup Tokens And IDs

Run these first in Windows PowerShell. Use `curl.exe`, not the PowerShell `curl` alias.

```powershell
$teacherLogin = curl.exe -s -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"alice@teacher.com","password":"password123"}' | ConvertFrom-Json
$TEACHER_TOKEN = $teacherLogin.token
$TEACHER_ID = $teacherLogin.user.id

$studentLogin = curl.exe -s -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"bob@student.com","password":"password123"}' | ConvertFrom-Json
$STUDENT_TOKEN = $studentLogin.token
$STUDENT_ID = $studentLogin.user.id

$adminLogin = curl.exe -s -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"hab@admin.com","password":"password123"}' | ConvertFrom-Json
$ADMIN_TOKEN = $adminLogin.token
$ADMIN_ID = $adminLogin.user.id

$COURSE_ID = 1
$LESSON_ID = 1
```

Success criteria:

- All three login calls return a non-empty `token`.
- `$TEACHER_ID`, `$STUDENT_ID`, and `$ADMIN_ID` are populated.
- Seed data usually gives teacher id `1`, student id `2`, admin id `4`.

## Auth Service

### POST /auth/register

Curl:

```powershell
$uniqueEmail = "phase3.student.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
curl.exe -i -X POST "$AUTH_BASE/auth/register" `
  -H "Content-Type: application/json" `
  -d "{`"name`":`"Phase 3 Student`",`"email`":`"$uniqueEmail`",`"password`":`"password123`",`"role`":`"STUDENT`"}"
```

Expected `201` response:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": 5,
    "name": "Phase 3 Student",
    "email": "phase3.student.123@example.com",
    "role": "STUDENT",
    "is_active": true
  }
}
```

Success criteria:

- Status is `201 Created`.
- Response includes `message`.
- Response includes `user.id`, `user.email`, `user.role`, and no password.

Error cases:

```powershell
# Missing fields: expect 400
curl.exe -i -X POST "$AUTH_BASE/auth/register" `
  -H "Content-Type: application/json" `
  -d '{"email":"missing@example.com","password":"password123"}'

# Invalid role: expect 400
curl.exe -i -X POST "$AUTH_BASE/auth/register" `
  -H "Content-Type: application/json" `
  -d '{"name":"Bad Role","email":"badrole@example.com","password":"password123","role":"ADMIN"}'

# Duplicate email: expect 409
curl.exe -i -X POST "$AUTH_BASE/auth/register" `
  -H "Content-Type: application/json" `
  -d '{"name":"Duplicate","email":"alice@teacher.com","password":"password123","role":"TEACHER"}'
```

Expected errors:

```json
{ "error": "All fields are required" }
{ "error": "Role must be STUDENT or TEACHER" }
{ "error": "Email already exists" }
```

### POST /auth/login

Curl:

```powershell
curl.exe -i -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"bob@student.com","password":"password123"}'
```

Expected `200` response:

```json
{
  "token": "jwt.token.value",
  "user": {
    "id": 2,
    "name": "Bob Student",
    "email": "bob@student.com",
    "role": "STUDENT",
    "is_active": true
  }
}
```

Success criteria:

- Status is `200 OK`.
- `token` is non-empty.
- `user.role` matches the seeded account.

Error cases:

```powershell
# Missing password: expect 400
curl.exe -i -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"bob@student.com"}'

# Wrong password: expect 401
curl.exe -i -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"bob@student.com","password":"wrong"}'

# Unknown email: expect 401
curl.exe -i -X POST "$AUTH_BASE/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"nobody@example.com","password":"password123"}'
```

Expected errors:

```json
{ "error": "Email and password required" }
{ "error": "Invalid credentials" }
```

### GET /auth/me

Curl:

```powershell
curl.exe -i -X GET "$AUTH_BASE/auth/me" `
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

Expected `200` response:

```json
{
  "id": 2,
  "name": "Bob Student",
  "email": "bob@student.com",
  "role": "STUDENT",
  "is_active": true
}
```

Success criteria:

- Status is `200 OK`.
- Returned user matches the JWT owner.
- Response does not include password.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X GET "$AUTH_BASE/auth/me"

# Invalid token: expect 401
curl.exe -i -X GET "$AUTH_BASE/auth/me" `
  -H "Authorization: Bearer invalid-token"

# Wrong header shape: expect 401
curl.exe -i -X GET "$AUTH_BASE/auth/me" `
  -H "Authorization: $STUDENT_TOKEN"
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Invalid token" }
```

## Course Service

### POST /api/courses

Curl:

```powershell
$newCourse = curl.exe -s -X POST "$COURSE_BASE/api/courses" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d '{"title":"Phase 3 API Testing","description":"Course created by API tests.","difficulty":"BEGINNER","category":"Testing","tags":["api","phase3"]}' | ConvertFrom-Json
$NEW_COURSE_ID = $newCourse.id
$newCourse
```

Expected `201` response:

```json
{
  "id": 3,
  "title": "Phase 3 API Testing",
  "description": "Course created by API tests.",
  "teacher_id": 1,
  "teacher_name": "Alice Teacher",
  "difficulty": "BEGINNER",
  "category": "Testing",
  "tags": ["api", "phase3"],
  "approved": false,
  "created_at": "2026-06-06T..."
}
```

Success criteria:

- Status is `201 Created`.
- `teacher_id` matches `$TEACHER_ID`.
- `approved` is `false` for newly created courses.
- `$NEW_COURSE_ID` is populated.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X POST "$COURSE_BASE/api/courses" `
  -H "Content-Type: application/json" `
  -d '{"title":"No Token Course"}'

# Student token: expect 403
curl.exe -i -X POST "$COURSE_BASE/api/courses" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d '{"title":"Student Course"}'

# Missing title: expect 400
curl.exe -i -X POST "$COURSE_BASE/api/courses" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d '{"description":"No title"}'

# Invalid difficulty: expect 400
curl.exe -i -X POST "$COURSE_BASE/api/courses" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d '{"title":"Bad Difficulty","difficulty":"EXPERT"}'
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Only teachers can perform this action" }
{ "error": "Title is required" }
{ "error": "Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED" }
```

### GET /api/courses

Curl:

```powershell
curl.exe -i -X GET "$COURSE_BASE/api/courses"
```

Filtered curl:

```powershell
curl.exe -i -X GET "$COURSE_BASE/api/courses?search=React&difficulty=BEGINNER&sort=newest"
```

Teacher curl, includes teacher-owned pending courses:

```powershell
curl.exe -i -X GET "$COURSE_BASE/api/courses" `
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

Expected `200` response:

```json
[
  {
    "id": 1,
    "title": "Advanced Node.js",
    "description": "Deep dive into Node.js architecture.",
    "teacher_id": 1,
    "teacher_name": "Alice Teacher",
    "difficulty": "BEGINNER",
    "category": null,
    "tags": [],
    "approved": true,
    "lesson_count": 2,
    "created_at": "2026-06-06T..."
  }
]
```

Success criteria:

- Status is `200 OK`.
- Response is an array.
- Public/student requests only include approved courses.
- Teacher requests include approved courses plus that teacher's pending courses.

Error cases:

```powershell
# Invalid difficulty filter: expect 400
curl.exe -i -X GET "$COURSE_BASE/api/courses?difficulty=EXPERT"

# Unknown sort falls back to newest: expect 200
curl.exe -i -X GET "$COURSE_BASE/api/courses?sort=unknown"

# Invalid bearer token is ignored by this endpoint viewer lookup: expect 200 public-style result
curl.exe -i -X GET "$COURSE_BASE/api/courses" `
  -H "Authorization: Bearer invalid-token"
```

Expected error:

```json
{ "error": "Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED" }
```

### GET /api/courses/{id}

Curl:

```powershell
curl.exe -i -X GET "$COURSE_BASE/api/courses/$COURSE_ID"
```

Teacher curl for pending course:

```powershell
curl.exe -i -X GET "$COURSE_BASE/api/courses/$NEW_COURSE_ID" `
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

Expected `200` response:

```json
{
  "id": 1,
  "title": "Advanced Node.js",
  "description": "Deep dive into Node.js architecture.",
  "teacher_id": 1,
  "teacher_name": "Alice Teacher",
  "approved": true,
  "lessons": [
    {
      "id": 1,
      "course_id": 1,
      "title": "Event Loop",
      "content": "Understanding the event loop in Node.",
      "video_url": null,
      "order": 1
    }
  ]
}
```

Success criteria:

- Status is `200 OK`.
- Response contains course fields plus `lessons` array.
- Existing seeded course `1` is returned.

Error cases:

```powershell
# Missing course: expect 404
curl.exe -i -X GET "$COURSE_BASE/api/courses/999999"

# Pending course without owner/admin token: expect 403
curl.exe -i -X GET "$COURSE_BASE/api/courses/$NEW_COURSE_ID"

# Pending course with student token: expect 403
curl.exe -i -X GET "$COURSE_BASE/api/courses/$NEW_COURSE_ID" `
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

Expected errors:

```json
{ "error": "Course not found" }
{ "error": "Course is awaiting approval" }
```

### POST /api/lessons

Curl:

```powershell
$lesson = curl.exe -s -X POST "$COURSE_BASE/api/lessons" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d "{`"course_id`":$COURSE_ID,`"title`":`"Phase 3 Lesson`",`"content`":`"Lesson created by API tests.`",`"video_url`":`"https://example.com/video`",`"order`":3}" | ConvertFrom-Json
$LESSON_ID = $lesson.id
$lesson
```

Expected `201` response:

```json
{
  "id": 5,
  "course_id": 1,
  "title": "Phase 3 Lesson",
  "content": "Lesson created by API tests.",
  "video_url": "https://example.com/video",
  "order": 3
}
```

Success criteria:

- Status is `201 Created`.
- `course_id` matches the request.
- Lesson is attached to a course owned by the teacher.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X POST "$COURSE_BASE/api/lessons" `
  -H "Content-Type: application/json" `
  -d "{`"course_id`":$COURSE_ID,`"title`":`"No Token Lesson`"}"

# Student token: expect 403
curl.exe -i -X POST "$COURSE_BASE/api/lessons" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"course_id`":$COURSE_ID,`"title`":`"Student Lesson`"}"

# Missing course_id/title: expect 400
curl.exe -i -X POST "$COURSE_BASE/api/lessons" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d '{"content":"Missing required fields"}'

# Missing course: expect 404
curl.exe -i -X POST "$COURSE_BASE/api/lessons" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d '{"course_id":999999,"title":"Missing Course Lesson"}'
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Only teachers can perform this action" }
{ "error": "Course ID and title required" }
{ "error": "Course not found" }
```

## Learning Service

### POST /api/enroll

Curl:

```powershell
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d '{"course_id":2}'
```

Expected `201` response:

```json
{
  "message": "Successfully enrolled",
  "enrollment": {
    "id": 4,
    "student_id": 2,
    "course_id": 2,
    "progress": 0,
    "enrolled_at": "2026-06-06T...",
    "updated_at": "2026-06-06T..."
  }
}
```

Success criteria:

- Status is `201 Created` for first-time enrollment.
- `enrollment.student_id` matches `$STUDENT_ID`.
- `enrollment.progress` starts at `0`.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" `
  -H "Content-Type: application/json" `
  -d '{"course_id":2}'

# Teacher cannot enroll: expect 403
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TEACHER_TOKEN" `
  -d '{"course_id":2}'

# Missing course_id: expect 400
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d '{}'

# Duplicate enrollment, seeded student is already enrolled in course 1: expect 409
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d '{"course_id":1}'

# Missing course: expect 404 or 500 if downstream course-service returns an unhandled non-404 error
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d '{"course_id":999999}'
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Only students can enroll" }
{ "error": "Course ID required" }
{ "error": "Already enrolled in this course" }
{ "error": "Course not found" }
```

### GET /api/my-courses/{studentId}

Curl:

```powershell
curl.exe -i -X GET "$LEARNING_BASE/api/my-courses/$STUDENT_ID" `
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

Teacher curl:

```powershell
curl.exe -i -X GET "$LEARNING_BASE/api/my-courses/$STUDENT_ID" `
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

Expected `200` response:

```json
[
  {
    "id": 1,
    "title": "Advanced Node.js",
    "description": "Deep dive into Node.js architecture.",
    "teacher_id": 1,
    "approved": true,
    "lessons": [],
    "progress": 50,
    "enrolled_at": "2026-06-06T..."
  }
]
```

Success criteria:

- Status is `200 OK`.
- Student can view only their own enrolled courses.
- Teacher can view a student's enrolled courses.
- Each item includes course fields plus `progress` and `enrolled_at`.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X GET "$LEARNING_BASE/api/my-courses/$STUDENT_ID"

# Student trying to read another student id: expect 403
curl.exe -i -X GET "$LEARNING_BASE/api/my-courses/3" `
  -H "Authorization: Bearer $STUDENT_TOKEN"

# Unknown student id with teacher token: expect 200 empty array
curl.exe -i -X GET "$LEARNING_BASE/api/my-courses/999999" `
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Access denied" }
```

### PUT /api/progress

Curl:

```powershell
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":1,`"progress`":75}"
```

Expected `200` response:

```json
{
  "message": "Progress updated",
  "enrollment": {
    "id": 1,
    "student_id": 2,
    "course_id": 1,
    "progress": 75,
    "enrolled_at": "2026-06-06T...",
    "updated_at": "2026-06-06T..."
  },
  "quiz_completion": null,
  "certificate": null
}
```

Success criteria:

- Status is `200 OK`.
- `enrollment.progress` equals requested progress.
- Student can update only their own progress.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":1,`"progress`":75}"

# Missing fields: expect 400
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":1}"

# Progress below range: expect 400
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":1,`"progress`":-1}"

# Progress above range: expect 400
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":1,`"progress`":101}"

# Updating another user's progress: expect 403
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d '{"student_id":3,"course_id":1,"progress":75}'

# Enrollment not found: expect 404
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":999999,`"progress`":75}"

# Completion to 100 may require passed quizzes: expect 200 if quizzes complete, otherwise 400
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $STUDENT_TOKEN" `
  -d "{`"student_id`":$STUDENT_ID,`"course_id`":1,`"progress`":100}"
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Missing required fields" }
{ "error": "Progress must be between 0 and 100" }
{ "error": "You can only update your own progress" }
{ "error": "Enrollment not found" }
{
  "error": "All required quizzes must be passed before certificate generation",
  "quiz_completion": {}
}
```

### GET /api/progress/{studentId}/{courseId}

Curl:

```powershell
curl.exe -i -X GET "$LEARNING_BASE/api/progress/$STUDENT_ID/1" `
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

Teacher curl:

```powershell
curl.exe -i -X GET "$LEARNING_BASE/api/progress/$STUDENT_ID/1" `
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

Expected `200` response:

```json
{
  "id": 1,
  "student_id": 2,
  "course_id": 1,
  "progress": 75,
  "enrolled_at": "2026-06-06T...",
  "updated_at": "2026-06-06T..."
}
```

Success criteria:

- Status is `200 OK`.
- Response has the matching `student_id` and `course_id`.
- Progress matches the latest update.
- Teacher can view student progress.

Error cases:

```powershell
# Missing token: expect 401
curl.exe -i -X GET "$LEARNING_BASE/api/progress/$STUDENT_ID/1"

# Student reading another student's progress: expect 403
curl.exe -i -X GET "$LEARNING_BASE/api/progress/3/1" `
  -H "Authorization: Bearer $STUDENT_TOKEN"

# Enrollment not found: expect 404
curl.exe -i -X GET "$LEARNING_BASE/api/progress/$STUDENT_ID/999999" `
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

Expected errors:

```json
{ "error": "No token provided" }
{ "error": "Access denied" }
{ "error": "Enrollment not found" }
```

## Full Happy Path

```powershell
# 1. Login users and capture tokens
$teacherLogin = curl.exe -s -X POST "$AUTH_BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"alice@teacher.com","password":"password123"}' | ConvertFrom-Json
$TEACHER_TOKEN = $teacherLogin.token
$studentLogin = curl.exe -s -X POST "$AUTH_BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"bob@student.com","password":"password123"}' | ConvertFrom-Json
$STUDENT_TOKEN = $studentLogin.token
$STUDENT_ID = $studentLogin.user.id

# 2. Teacher creates course
$course = curl.exe -s -X POST "$COURSE_BASE/api/courses" -H "Content-Type: application/json" -H "Authorization: Bearer $TEACHER_TOKEN" -d '{"title":"Phase 3 Happy Path","description":"End-to-end test course.","difficulty":"BEGINNER"}' | ConvertFrom-Json
$NEW_COURSE_ID = $course.id

# 3. Teacher adds lesson
curl.exe -i -X POST "$COURSE_BASE/api/lessons" -H "Content-Type: application/json" -H "Authorization: Bearer $TEACHER_TOKEN" -d "{`"course_id`":$NEW_COURSE_ID,`"title`":`"Intro`",`"content`":`"Welcome`",`"order`":1}"

# 4. Use seeded approved course 2 for student enrollment because newly created courses are pending admin approval
curl.exe -i -X POST "$LEARNING_BASE/api/enroll" -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" -d '{"course_id":2}'

# 5. Update progress on seeded course 1, where Bob is already enrolled
curl.exe -i -X PUT "$LEARNING_BASE/api/progress" -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" -d "{`"student_id`":$STUDENT_ID,`"course_id`":1,`"progress`":75}"

# 6. Verify progress
curl.exe -i -X GET "$LEARNING_BASE/api/progress/$STUDENT_ID/1" -H "Authorization: Bearer $STUDENT_TOKEN"
```

## Notes

- Auth middleware requires `Authorization: Bearer <token>`.
- Course and learning services proxy token validation through auth service `/auth/me`.
- New courses created through `POST /api/courses` are pending approval by default.
- Seeded course ids `1` and `2` are approved and safe for student enrollment tests.
- Auth register and login endpoints are rate-limited. Avoid repeatedly running failure tests in a tight loop.
