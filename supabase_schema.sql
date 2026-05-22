-- 1. Create Profiles Table (links to Auth.Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Courses Table
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT,
  level TEXT CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Lessons Table
CREATE TABLE lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Enrollments Table
CREATE TABLE enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, course_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- Profiles: Anyone can view, but only owner can update
CREATE POLICY "Public profiles are viewable by everyone." ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Courses: Anyone can view, only instructors/admins can manage
CREATE POLICY "Courses are viewable by everyone." ON courses
  FOR SELECT USING (true);

CREATE POLICY "Instructors can create courses." ON courses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'instructor' OR role = 'admin')
    )
  );

CREATE POLICY "Instructors can update own courses." ON courses
  FOR UPDATE USING (
    instructor_id = auth.uid() AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'instructor' OR role = 'admin')
    )
  );

CREATE POLICY "Instructors can delete own courses." ON courses
  FOR DELETE USING (
    instructor_id = auth.uid() AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'instructor' OR role = 'admin')
    )
  );

-- Lessons: Anyone can view, only course instructor can manage
CREATE POLICY "Lessons are viewable by everyone." ON lessons
  FOR SELECT USING (true);

CREATE POLICY "Instructors can create lessons in own courses." ON lessons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update lessons in own courses." ON lessons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete lessons in own courses." ON lessons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id AND courses.instructor_id = auth.uid()
    )
  );

-- Enrollments: Users can view and manage their own enrollments
CREATE POLICY "Users can view own enrollments." ON enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can enroll themselves." ON enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Set up triggers for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();


-- ====== NEW ADDITION: AUTOMATIC PROFILE CREATION TRIGGER ======
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'student'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ====== NEW ADDITION: STORAGE BUCKETS & POLICIES ======
-- Note: Run this in Supabase SQL editor to create the avatars and courses buckets and configure RLS.

-- Avatars Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage.Objects (Avatars Bucket)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated Users Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated Users Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Courses Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('courses', 'courses', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage.Objects (Courses Bucket)
CREATE POLICY "Public Courses Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'courses');

CREATE POLICY "Authenticated Users Upload Courses"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'courses' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated Users Delete Courses"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'courses' AND auth.uid()::text = (storage.foldername(name))[1]);
