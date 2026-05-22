# TechVault — Gemini CLI UI Prompt (Functionality Only)

> Paste everything inside the prompt block below directly into Gemini CLI.

---

## PROMPT

```
Build the complete frontend UI for a web app called TechVault.
It is a simple learning platform where students watch YouTube-based courses,
tutors upload courses, and an admin manages everything.

Use React + Vite + Tailwind CSS.
Do NOT touch any backend logic, Supabase calls, API calls, or auth logic.
Only build pages and components. All data comes in as props.
Use realistic dummy data where needed so the UI is visible.

---

## PAGES

### 1. Welcome Page  /
The landing page. Explains what TechVault is in a few lines.
Has two buttons: one to Sign Up, one to Log In.
Nothing else.

### 2. Auth Page  /auth
Handles both Sign Up and Log In.
Toggle between the two forms.
Sign Up: Username, Email, Password.
Log In: Email, Password.

### 3. Student Dashboard  /dashboard
This is where a student lands after logging in.
Shows the courses they have enrolled in.
Each enrolled course shows: title, tutor name, and a button to watch
(opens the YouTube link).
Has a section to browse all available courses and enroll in new ones.
Has a button to apply to become a tutor.

### 4. Tutor Dashboard  /tutor
Only accessible to approved tutors.
Shows the courses the tutor has uploaded.
Each course shows: title, description, YouTube link, number of students enrolled.
Has a form or button to add a new course:
fields are title, description, and YouTube link.

### 5. Admin Dashboard  /admin
Only accessible to the admin.
Has two sections:
First section — Tutor Applications:
shows pending applications with the applicant username and email,
and Approve / Reject buttons.
Second section — All Users:
shows a list of all users with their username, email, and current role.

---

## COMPONENTS

### Navbar
Shows the TechVault logo.
If the user is not logged in: shows Log In and Sign Up buttons.
If the user is logged in: shows their username and a Log Out button.

### CourseCard
Displays a single course.
Shows: title, tutor name, short description.
Has an Enroll button (on browse section) or Watch button (on enrolled section).

---

## STRICT RULES

1. Frontend only. No Supabase, no fetch, no API calls.
2. All data passed as props or hardcoded dummy data.
3. Do not modify src/lib/, src/hooks/, or src/store/.
4. Tailwind only for styling and you might also dowload image online if neccessary
5. Every page must be mobile responsive.
6. Don't change the devhub logo and the devhub name
7. Take inspo for those imahe at the guidance/images file and run a=diagnostic to confirm any error after your done implementing changes
```
