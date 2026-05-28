import React, { useState, useEffect } from 'react';
import { BookOpen, Users, PlaySquare, Plus, Settings, LogOut, Edit3, Trash2, LayoutDashboard, Menu, X, ArrowLeft, Video, Clock, Search, Award, TrendingUp, Filter, Sparkles, GraduationCap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

const BASE_CATEGORIES = [
  "Software Engineering",
  "Web Development",
  "Data Science & AI",
  "Mobile Development",
  "Cyber Security",
  "Cloud Computing",
  "Product Design (UI/UX)",
  "Digital Marketing"
];

const TutorDashboard = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, setProfile, clearAuth } = useAuthStore();

  // Navigation state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'content', 'students'

  // Settings Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile?.full_name || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editAvatarSeed, setEditAvatarSeed] = useState(profile?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Course Management states
  const [courses, setCourses] = useState([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [stats, setStats] = useState({ totalStudents: 0, publishedCourses: 0, totalLessons: 0 });
  const [activeCourseId, setActiveCourseId] = useState(null);

  // Modals for Courses CRUD
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: '', level: 'Beginner', thumbnail_url: '' });
  const [isUploadingCourseImage, setIsUploadingCourseImage] = useState(false);
  const [categories, setCategories] = useState(BASE_CATEGORIES);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Modals for Lessons CRUD
  const [activeLessons, setActiveLessons] = useState([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', video_url: '', order: 1 });

  // Students Directory Tab states
  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentStats, setStudentStats] = useState({ activeLearners: 0, completionRate: 0, newSignups: 0 });

  // My Content / Lesson Library Tab states
  const [allLessons, setAllLessons] = useState([]);
  const [isLoadingAllLessons, setIsLoadingAllLessons] = useState(false);
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');

  // Sync state with profile once loaded
  useEffect(() => {
    if (profile) {
      setEditFullName(profile.full_name || '');
      setEditUsername(profile.username || '');
      setEditAvatarSeed(profile.avatar_url || '');
    }
  }, [profile]);

  const displayName = profile?.full_name || 'User';
  const avatarSeed = profile?.avatar_url || profile?.full_name || 'User';
  const avatarUrl = avatarSeed.startsWith('http')
    ? avatarSeed
    : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(avatarSeed)}`;

  const fetchDynamicCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('category');
      
      if (error) throw error;
      
      if (data) {
        const uniqueFromDb = Array.from(new Set(data.map(c => c.category).filter(Boolean)));
        const merged = Array.from(new Set([...BASE_CATEGORIES, ...uniqueFromDb]));
        setCategories(merged);
      }
    } catch (err) {
      console.error("Error fetching dynamic categories:", err);
    }
  };

  // 1. Fetch Dynamic Data from Supabase
  const fetchTutorData = async () => {
    if (!profile) return;
    setIsLoadingCourses(true);
    try {
      // Fetch courses and join with child counts
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          lessons (id),
          enrollments (count)
        `)
        .eq('instructor_id', profile.id)
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      const mappedCourses = (coursesData || []).map(course => ({
        ...course,
        lessonsCount: course.lessons?.length || 0,
        studentsCount: course.enrollments?.[0]?.count || 0
      }));

      setCourses(mappedCourses);

      // Trigger parallel background updates for other tabs
      fetchStudentsData(mappedCourses);
      fetchAllLessons(mappedCourses);

      const totalL = mappedCourses.reduce((acc, c) => acc + c.lessonsCount, 0);
      const totalS = mappedCourses.reduce((acc, c) => acc + c.studentsCount, 0);

      setStats({
        totalStudents: totalS,
        publishedCourses: mappedCourses.length,
        totalLessons: totalL
      });
      await fetchDynamicCategories();
    } catch (err) {
      console.error("Error fetching tutor data:", err);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const fetchStudentsData = async (instructorCourses) => {
    if (!profile || !instructorCourses || instructorCourses.length === 0) {
      setStudents([]);
      setStudentStats({ activeLearners: 0, completionRate: 0, newSignups: 0 });
      return;
    }
    setIsLoadingStudents(true);
    try {
      const courseIds = instructorCourses.map(c => c.id);
      
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          progress,
          enrolled_at,
          user_id,
          course_id,
          profiles (id, full_name, username, avatar_url)
        `)
        .in('course_id', courseIds);

      if (error) throw error;

      // Group and map profiles
      const mapped = (data || []).map(item => {
        const studentProfile = item.profiles;
        const matchedCourse = instructorCourses.find(c => c.id === item.course_id);
        return {
          id: item.id,
          userId: item.user_id,
          progress: item.progress || 0,
          enrolledAt: item.enrolled_at,
          fullName: studentProfile?.full_name || studentProfile?.username || 'Student',
          username: studentProfile?.username || 'student',
          avatarUrl: studentProfile?.avatar_url || '',
          courseTitle: matchedCourse?.title || 'Unknown Course',
          courseCategory: matchedCourse?.category || 'General'
        };
      });

      setStudents(mapped);

      // Aggregate Student Stats
      const active = mapped.filter(s => s.progress > 0).length;
      const avgProgress = mapped.length > 0 
        ? Math.round(mapped.reduce((acc, s) => acc + s.progress, 0) / mapped.length)
        : 0;
      
      // Enrolled in past 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newEnrolls = mapped.filter(s => new Date(s.enrolledAt) >= oneWeekAgo).length;

      setStudentStats({
        activeLearners: active,
        completionRate: avgProgress,
        newSignups: newEnrolls
      });
    } catch (err) {
      console.error("Error fetching student directory:", err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const fetchAllLessons = async (instructorCourses) => {
    if (!profile || !instructorCourses || instructorCourses.length === 0) {
      setAllLessons([]);
      return;
    }
    setIsLoadingAllLessons(true);
    try {
      const courseIds = instructorCourses.map(c => c.id);
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(item => {
        const matchedCourse = instructorCourses.find(c => c.id === item.course_id);
        return {
          ...item,
          courseTitle: matchedCourse?.title || 'Unknown Course',
          courseCategory: matchedCourse?.category || 'General'
        };
      });

      setAllLessons(mapped);
    } catch (err) {
      console.error("Error fetching all lessons:", err);
    } finally {
      setIsLoadingAllLessons(false);
    }
  };

  const fetchLessons = async (courseId) => {
    setIsLoadingLessons(true);
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order', { ascending: true });

      if (error) throw error;
      setActiveLessons(data || []);
    } catch (err) {
      console.error("Error fetching lessons:", err);
    } finally {
      setIsLoadingLessons(false);
    }
  };

  useEffect(() => {
    fetchTutorData();
  }, [profile]);

  useEffect(() => {
    if (activeCourseId) {
      fetchLessons(activeCourseId);
    } else {
      setActiveLessons([]);
    }
  }, [activeCourseId]);

  // 2. Course CRUD Triggers
  const handleOpenCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm({ title: '', description: '', category: '', level: 'Beginner', thumbnail_url: '' });
    setShowCustomCategoryInput(false);
    setCustomCategory('');
    setIsCourseModalOpen(true);
  };

  const handleOpenEditCourse = (course, e) => {
    if (e) e.stopPropagation();
    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      description: course.description || '',
      category: course.category || '',
      level: course.level || 'Beginner',
      thumbnail_url: course.thumbnail_url || ''
    });
    setShowCustomCategoryInput(false);
    setCustomCategory('');
    setIsCourseModalOpen(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let error;
      if (editingCourse) {
        const { error: err } = await supabase
          .from('courses')
          .update({
            title: courseForm.title,
            description: courseForm.description,
            category: courseForm.category,
            level: courseForm.level,
            thumbnail_url: courseForm.thumbnail_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCourse.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('courses')
          .insert({
            title: courseForm.title,
            description: courseForm.description,
            category: courseForm.category,
            level: courseForm.level,
            thumbnail_url: courseForm.thumbnail_url || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop`,
            instructor_id: profile.id
          });
        error = err;
      }

      if (error) throw error;

      setIsCourseModalOpen(false);
      await fetchTutorData();
    } catch (err) {
      alert(err.message || 'Failed to save course');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this course and all its lessons? This cannot be undone.")) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("DEBUG handleDeleteCourse:", {
        profileId: profile?.id,
        authUserId: authUser?.id,
        courseId,
      });

      // 1. Delete all enrollments of this course first to avoid RLS cascade deletion blocks in Postgres
      const { error: enrollmentsError } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId);

      if (enrollmentsError) {
        console.error("Failed to delete enrollments before course deletion:", enrollmentsError);
      }

      // 2. Delete all lessons of this course first to avoid RLS cascade deletion blocks in Postgres
      const { error: lessonsError } = await supabase
        .from('lessons')
        .delete()
        .eq('course_id', courseId);

      if (lessonsError) {
        console.error("Failed to delete lessons before course deletion:", lessonsError);
      }

      // 3. Delete the course itself
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      if (activeCourseId === courseId) setActiveCourseId(null);
      await fetchTutorData();
    } catch (err) {
      alert(err.message || 'Failed to delete course');
    }
  };

  // 3. Lesson CRUD Triggers
  const handleOpenCreateLesson = () => {
    setEditingLesson(null);
    setLessonForm({
      title: '',
      content: '',
      video_url: '',
      order: activeLessons.length + 1
    });
    setIsLessonModalOpen(true);
  };

  const handleOpenEditLesson = (lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      content: lesson.content || '',
      video_url: lesson.video_url || '',
      order: lesson.order || 1
    });
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let error;
      const targetCourseId = activeCourseId || (editingLesson ? editingLesson.course_id : null);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("DEBUG handleSaveLesson:", {
        profileId: profile?.id,
        authUserId: authUser?.id,
        targetCourseId,
      });

      if (!targetCourseId) {
        throw new Error("No target course found for this lesson.");
      }

      if (editingLesson) {
        const { error: err } = await supabase
          .from('lessons')
          .update({
            title: lessonForm.title,
            content: lessonForm.content,
            video_url: lessonForm.video_url,
            order: parseInt(lessonForm.order)
          })
          .eq('id', editingLesson.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('lessons')
          .insert({
            course_id: targetCourseId,
            title: lessonForm.title,
            content: lessonForm.content,
            video_url: lessonForm.video_url,
            order: parseInt(lessonForm.order)
          });
        error = err;
      }

      if (error) throw error;

      setIsLessonModalOpen(false);
      await fetchLessons(targetCourseId);
      await fetchTutorData();
    } catch (err) {
      alert(err.message || 'Failed to save lesson');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId, courseId = null) => {
    if (!window.confirm("Are you sure you want to delete this lesson?")) return;

    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;
      
      const targetCourseId = courseId || activeCourseId;
      if (targetCourseId) {
        await fetchLessons(targetCourseId);
      }
      await fetchTutorData();
    } catch (err) {
      alert(err.message || 'Failed to delete lesson');
    }
  };

  // 4. Basic Sidebar & Settings logic
  const handleLogout = () => {
    supabase.auth.signOut().catch((err) => console.error("Logout error:", err));
    clearAuth();
    navigate('/');
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName,
          username: editUsername,
          avatar_url: editAvatarSeed,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editFullName,
        username: editUsername,
        avatar_url: editAvatarSeed
      });

      setSettingsSuccess('Profile updated successfully!');
      setTimeout(() => {
        setIsSettingsOpen(false);
        setSettingsSuccess('');
      }, 1200);
    } catch (err) {
      console.error(err);
      setSettingsError(err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.8);
        };
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setSettingsError('');
    setSettingsSuccess('');

    try {
      const compressedFile = await compressImage(file);
      const fileExt = compressedFile.name.split('.').pop();
      const filePath = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setEditAvatarSeed(publicUrl);
      setSettingsSuccess('Photo uploaded successfully! Save to apply.');
    } catch (err) {
      console.error("Upload error:", err);
      setSettingsError(err.message || 'Failed to upload photo.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCourseImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCourseImage(true);
    try {
      const compressedFile = await compressImage(file);
      const fileExt = compressedFile.name.split('.').pop();
      const filePath = `${profile.id}/course-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('courses')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('courses')
        .getPublicUrl(filePath);

      setCourseForm(prev => ({ ...prev, thumbnail_url: publicUrl }));
    } catch (err) {
      console.error("Course thumbnail upload error:", err);
      alert(err.message || 'Failed to upload cover image.');
    } finally {
      setIsUploadingCourseImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-100 flex flex-col justify-between w-64 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:top-0 md:h-screen ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="p-6 md:p-8 flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <BookOpen size={24} />
              </div>
              <span className="font-heading font-bold text-2xl tracking-tight text-gray-900">omniLearn.</span>
            </div>
            <button className="md:hidden text-gray-500 hover:bg-gray-100 p-1 rounded-lg" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <nav className="px-4 space-y-2">
            <button 
              onClick={() => { setActiveTab('overview'); setActiveCourseId(null); setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left border border-transparent ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm shadow-indigo-600/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-100'}`}
            >
              <LayoutDashboard size={20} /> Overview
            </button>
            <button 
              onClick={() => { setActiveTab('content'); setActiveCourseId(null); setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left border border-transparent ${activeTab === 'content' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm shadow-indigo-600/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-100'}`}
            >
              <PlaySquare size={20} /> My Content
            </button>
            <button 
              onClick={() => { setActiveTab('students'); setActiveCourseId(null); setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left border border-transparent ${activeTab === 'students' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm shadow-indigo-600/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-100'}`}
            >
              <Users size={20} /> Students
            </button>
            <Link 
              to="/dashboard"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left border border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-100"
            >
              <GraduationCap size={20} /> Student View
            </Link>
          </nav>
        </div>
        <div className="p-6 border-t border-gray-100">
          <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl font-medium transition-colors text-left">
            <Settings size={20} /> Settings
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-medium transition-colors text-left">
            <LogOut size={20} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 lg:p-12 w-full overflow-hidden">
        {/* Top Header */}
        <header className="flex justify-between items-center gap-4 mb-8 sm:mb-12">
          <div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-gray-900">Tutor Portal 🚀</h1>
            <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base hidden sm:block">Manage your courses and inspire your students.</p>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 border-2 border-white shadow-sm overflow-hidden hidden sm:block">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 text-gray-600 hover:bg-gray-200 rounded-xl bg-white border border-gray-200 shadow-sm"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </header>

        {activeCourseId && (courses.find(c => c.id === activeCourseId)) ? (() => {
          const activeCourse = courses.find(c => c.id === activeCourseId);
          return (
            <div>
              {/* Header / Back Action */}
              <div className="flex items-center gap-4 mb-6">
                <button 
                  onClick={() => setActiveCourseId(null)}
                  className="p-2 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-gray-600 flex items-center justify-center"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {activeCourse.level} • {activeCourse.category || 'General'}
                  </span>
                  <h1 className="font-heading font-black text-2xl sm:text-3xl text-gray-900 mt-1">{activeCourse.title}</h1>
                </div>
              </div>

              {/* Course Description Card */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-48 aspect-video bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden shrink-0">
                  <img src={activeCourse.thumbnail_url} className="w-full h-full object-cover" alt={activeCourse.title} />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">Course Overview</h3>
                    <p className="text-gray-500 font-medium text-sm leading-relaxed">{activeCourse.description || 'No description provided.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4 text-xs font-bold text-gray-500 bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50 w-fit">
                    <span>🎓 {activeCourse.studentsCount} Students Enrolled</span>
                    <span>📚 {activeCourse.lessonsCount} Total Lessons</span>
                  </div>
                </div>
              </div>

              {/* Lessons Timeline & Management */}
              <section>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900">Course Curriculum</h2>
                  <button 
                    onClick={handleOpenCreateLesson}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2 text-sm"
                  >
                    <Plus size={18} /> Add Lesson
                  </button>
                </div>

                {isLoadingLessons ? (
                  <div className="w-full py-12 flex justify-center items-center text-indigo-600 font-bold">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-3"></div>
                    Loading curriculum...
                  </div>
                ) : activeLessons.length === 0 ? (
                  <div className="bg-indigo-50/20 rounded-3xl p-12 border border-dashed border-indigo-200/60 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 border border-gray-100 shadow-sm mb-4">
                      <Video size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">No Lessons Uploaded Yet</h3>
                    <p className="text-sm text-gray-500 font-medium max-w-sm mb-6">Create your first lesson to build out your curriculum and let students start learning!</p>
                    <button 
                      onClick={handleOpenCreateLesson}
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2"
                    >
                      <Plus size={20} /> Create Your First Lesson
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeLessons.map((lesson) => (
                      <div 
                        key={lesson.id}
                        className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-indigo-100 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 font-black text-sm border border-indigo-100/50">
                            {lesson.order}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{lesson.title}</h4>
                            <div className="flex gap-3 text-xs text-gray-400 font-semibold mt-1">
                              <span className="flex items-center gap-1"><Video size={12} /> {lesson.video_url ? 'Video Included' : 'Text Content Only'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50">
                          <button 
                            onClick={() => handleOpenEditLesson(lesson)}
                            className="flex-1 sm:flex-initial px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          );
        })() : (
          <div>
            {activeTab === 'overview' && (
              <>
                {/* Stats Grid */}
                <section className="mb-12 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm flex items-center gap-4 sm:gap-6">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Users size={24} />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-xs sm:text-sm">Total Students</p>
                        <h3 className="font-heading font-black text-2xl sm:text-3xl text-gray-900">
                          {isLoadingCourses ? '...' : stats.totalStudents.toLocaleString()}
                        </h3>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm flex items-center gap-4 sm:gap-6">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                        <PlaySquare size={24} />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-xs sm:text-sm">Published Courses</p>
                        <h3 className="font-heading font-black text-2xl sm:text-3xl text-gray-900">
                          {isLoadingCourses ? '...' : stats.publishedCourses}
                        </h3>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm flex items-center gap-4 sm:gap-6">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-xs sm:text-sm">Total Lessons</p>
                        <h3 className="font-heading font-black text-2xl sm:text-3xl text-gray-900">
                          {isLoadingCourses ? '...' : stats.totalLessons}
                        </h3>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Courses Grid */}
                <section className="animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900">My Courses</h2>
                  </div>
                  
                  {isLoadingCourses ? (
                    <div className="w-full py-16 flex justify-center items-center text-indigo-600 font-bold">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-3"></div>
                      Loading your courses...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {/* Create New Course Action */}
                      <div 
                        onClick={handleOpenCreateCourse}
                        className="bg-indigo-50/50 rounded-3xl p-6 border-2 border-indigo-200 border-dashed hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer flex flex-col items-center justify-center text-center h-[300px] group shadow-sm"
                      >
                        <div className="w-16 h-16 bg-white text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform border border-indigo-100">
                          <Plus size={32} />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Create New Course</h3>
                        <p className="text-sm text-gray-500 font-medium px-4">Start drafting a new course curriculum and upload lessons.</p>
                      </div>

                      {courses.map((course) => (
                        <div 
                          key={course.id}
                          onClick={() => setActiveCourseId(course.id)}
                          className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-[300px]"
                        >
                          <div className="aspect-video bg-gray-100 rounded-2xl mb-4 overflow-hidden relative shrink-0">
                            <img src={course.thumbnail_url} className="w-full h-full object-cover" alt={course.title} />
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold text-gray-900 shadow-sm">
                              {course.lessonsCount} Lessons
                            </div>
                          </div>
                          <h3 className="font-bold text-gray-900 mb-1 text-lg line-clamp-1 group-hover:text-indigo-600 transition-colors">{course.title}</h3>
                          <div className="flex justify-between text-sm text-gray-500 font-medium mb-4">
                            <span>🎓 {course.studentsCount} Students</span>
                            <span className="text-emerald-600 font-bold uppercase text-[10px] tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md">{course.level}</span>
                          </div>
                          
                          <div className="flex gap-2 mt-auto">
                            <button 
                              onClick={(e) => handleOpenEditCourse(course, e)}
                              className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              <Edit3 size={16} /> Edit
                            </button>
                            <button 
                              onClick={(e) => handleDeleteCourse(course.id, e)}
                              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl transition-colors flex items-center justify-center"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === 'content' && (
              <section className="animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="font-heading font-black text-2xl text-gray-900">Lesson Library 📚</h2>
                    <p className="text-gray-500 font-medium mt-1 text-sm">Search, manage, and edit all your lessons in one centralized interface.</p>
                  </div>
                </div>

                {/* Filters Header */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:w-80">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Search size={18} />
                    </span>
                    <input 
                      type="text"
                      value={contentSearchQuery}
                      onChange={(e) => setContentSearchQuery(e.target.value)}
                      placeholder="Search lessons by title..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all text-sm font-medium text-gray-900"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                      <Filter size={14} /> Filter by course
                    </span>
                    <select
                      value={selectedCourseFilter}
                      onChange={(e) => setSelectedCourseFilter(e.target.value)}
                      className="w-full sm:w-56 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all text-sm font-semibold text-gray-700"
                    >
                      <option value="all">All Courses</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isLoadingAllLessons ? (
                  <div className="w-full py-16 flex justify-center items-center text-indigo-600 font-bold">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-3"></div>
                    Loading your content library...
                  </div>
                ) : (() => {
                  const filtered = allLessons.filter(lesson => {
                    const matchesSearch = lesson.title.toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
                      (lesson.content && lesson.content.toLowerCase().includes(contentSearchQuery.toLowerCase()));
                    const matchesCourse = selectedCourseFilter === 'all' || lesson.course_id === selectedCourseFilter;
                    return matchesSearch && matchesCourse;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                          <PlaySquare size={28} />
                        </div>
                        <h3 className="font-heading font-bold text-gray-900 text-lg mb-2">No Lessons Found</h3>
                        <p className="text-sm text-gray-500 font-medium max-w-sm">
                          {contentSearchQuery || selectedCourseFilter !== 'all' 
                            ? "Try refining your search terms or course filter selection." 
                            : "Create courses and add curriculum items to populate your library."}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 gap-4">
                      {filtered.map(lesson => (
                        <div 
                          key={lesson.id}
                          className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 font-black text-sm border border-indigo-100/50">
                              {lesson.order}
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider line-clamp-1 max-w-[200px]">
                                  {lesson.courseTitle}
                                </span>
                              </div>
                              <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors text-base truncate">{lesson.title}</h4>
                              <div className="flex items-center gap-4 text-xs text-gray-400 font-semibold">
                                <span className="flex items-center gap-1"><Video size={12} className="text-gray-400" /> {lesson.video_url ? 'Video Included' : 'Text Content Only'}</span>
                                {lesson.created_at && (
                                  <span className="flex items-center gap-1"><Clock size={12} /> {new Date(lesson.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50 justify-end">
                            <button 
                              onClick={() => handleOpenEditLesson(lesson)}
                              className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5"
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteLesson(lesson.id, lesson.course_id)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>
            )}

            {activeTab === 'students' && (
              <section className="animate-in fade-in duration-300">
                <div className="mb-8">
                  <h2 className="font-heading font-black text-2xl text-gray-900">Student Directory 🎓</h2>
                  <p className="text-gray-500 font-medium mt-1 text-sm">Monitor student enrollments, course completions, and performance statistics.</p>
                </div>

                {/* Directory Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
                  <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium text-xs">Active Learners</p>
                      <h3 className="font-heading font-black text-xl text-gray-900">
                        {isLoadingStudents ? '...' : studentStats.activeLearners}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                      <Award size={20} />
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium text-xs">Average Progress</p>
                      <h3 className="font-heading font-black text-xl text-gray-900">
                        {isLoadingStudents ? '...' : `${studentStats.completionRate}%`}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium text-xs">New Signups (7d)</p>
                      <h3 className="font-heading font-black text-xl text-gray-900">
                        {isLoadingStudents ? '...' : studentStats.newSignups}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Directory Table */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h3 className="font-heading font-bold text-gray-900 text-base">Enrolled Students</h3>
                  </div>

                  {isLoadingStudents ? (
                    <div className="w-full py-16 flex justify-center items-center text-indigo-600 font-bold">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-3"></div>
                      Loading student roster...
                    </div>
                  ) : students.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <Users size={28} />
                      </div>
                      <h3 className="font-heading font-bold text-gray-900 text-lg mb-2">No Students Enrolled Yet</h3>
                      <p className="text-sm text-gray-500 font-medium max-w-sm">
                        As soon as learners sign up and enroll in any of your courses, their progress tracking will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <th className="px-6 py-4">Student</th>
                            <th className="px-6 py-4">Course Enrolled</th>
                            <th className="px-6 py-4">Date Joined</th>
                            <th className="px-6 py-4">Progress</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {students.map((student) => {
                            const studentAvatarSeed = student.avatarUrl || student.fullName || 'Student';
                            const studentAvatarUrl = studentAvatarSeed.startsWith('http')
                              ? studentAvatarSeed
                              : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(studentAvatarSeed)}`;
                            return (
                              <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 overflow-hidden shrink-0">
                                      <img src={studentAvatarUrl} alt={student.fullName} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-gray-900 text-sm leading-tight">{student.fullName}</h4>
                                      <span className="text-xs text-gray-400 font-medium">@{student.username || 'student'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div>
                                    <h4 className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">{student.courseTitle}</h4>
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50/50 border border-indigo-100/30 px-2 py-0.5 rounded mt-1 inline-block">
                                      {student.courseCategory}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm font-semibold text-gray-500">
                                    {new Date(student.enrolledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3 w-44">
                                    <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden relative">
                                      <div 
                                        className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                                        style={{ width: `${student.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 w-8 shrink-0">{student.progress}%</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => alert(`Pinged ${student.fullName}! A motivational prompt has been queued.`)}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl text-xs transition-colors"
                                  >
                                    Ping Student
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Course Modal */}
        {isCourseModalOpen && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl p-6 sm:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900">
                  {editingCourse ? 'Edit Course Details' : 'Create New Course'}
                </h2>
                <button 
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setIsCourseModalOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveCourse} className="space-y-4">
                {settingsError && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100 flex items-center gap-2">
                    <span>⚠️</span> {settingsError}
                  </div>
                )}
                {settingsSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-600 text-sm font-semibold rounded-xl border border-emerald-100 flex items-center gap-2">
                    <span>✅</span> {settingsSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Course Title</label>
                  <input 
                    type="text" 
                    value={courseForm.title} 
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm sm:text-base"
                    placeholder="e.g. Advanced JavaScript & Patterns"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                    <select 
                      value={showCustomCategoryInput ? "custom" : courseForm.category} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setShowCustomCategoryInput(true);
                          setCourseForm({ ...courseForm, category: customCategory });
                        } else {
                          setShowCustomCategoryInput(false);
                          setCourseForm({ ...courseForm, category: val });
                        }
                      }}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-semibold text-gray-900 text-sm sm:text-base animate-none"
                      required
                    >
                      <option value="" disabled>Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="custom">+ Add Custom Category...</option>
                    </select>
                    {showCustomCategoryInput && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        <input
                          type="text"
                          placeholder="Enter custom category"
                          value={customCategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomCategory(val);
                            setCourseForm({ ...courseForm, category: val });
                          }}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-semibold text-gray-900"
                          required
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Difficulty Level</label>
                    <select 
                      value={courseForm.level} 
                      onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-semibold text-gray-900 text-sm sm:text-base"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Course Cover Image</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-center p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                    {courseForm.thumbnail_url ? (
                      <div className="w-32 aspect-video rounded-xl overflow-hidden border border-gray-200 shadow-sm shrink-0 bg-white relative group">
                        <img src={courseForm.thumbnail_url} className="w-full h-full object-cover" alt="Course Cover Preview" />
                        <label 
                          htmlFor="course-cover-upload"
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer"
                        >
                          <Plus size={16} className="mb-0.5" />
                          Change Image
                        </label>
                      </div>
                    ) : (
                      <div className="w-32 aspect-video rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center shrink-0 bg-white text-gray-400">
                        <PlaySquare size={20} />
                        <span className="text-[9px] font-bold mt-1">No Image</span>
                      </div>
                    )}
                    
                    <div className="flex-1 flex flex-col items-start gap-1 w-full sm:w-auto">
                      <label 
                        htmlFor="course-cover-upload"
                        className="px-4 py-2.5 bg-white border border-gray-200 hover:border-indigo-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                      >
                        {isUploadingCourseImage ? 'Uploading...' : 'Choose Cover File'}
                      </label>
                      <span className="text-[10px] text-gray-400 font-medium">JPEG or PNG. Auto-compressed for performance.</span>
                    </div>
                  </div>
                  
                  <input 
                    type="file" 
                    id="course-cover-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleCourseImageUpload} 
                    disabled={isUploadingCourseImage}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Course Description</label>
                  <textarea 
                    value={courseForm.description} 
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm leading-relaxed"
                    placeholder="Provide a comprehensive introduction to your course..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all"
                    onClick={() => setIsCourseModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : editingCourse ? 'Save Changes' : 'Create Course'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lesson Modal */}
        {isLessonModalOpen && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl p-6 sm:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900">
                  {editingLesson ? 'Edit Lesson Curriculum' : 'Add New Lesson'}
                </h2>
                <button 
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setIsLessonModalOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveLesson} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lesson Title</label>
                    <input 
                      type="text" 
                      value={lessonForm.title} 
                      onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm sm:text-base"
                      placeholder="e.g. Setting Up Your Environment"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order</label>
                    <input 
                      type="number" 
                      min="1"
                      value={lessonForm.order} 
                      onChange={(e) => setLessonForm({ ...lessonForm, order: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-bold text-gray-900 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lesson Video URL (Optional)</label>
                  <input 
                    type="text" 
                    value={lessonForm.video_url} 
                    onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-[13px] sm:text-sm"
                    placeholder="https://example.com/lesson-video.mp4"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lesson Content</label>
                  <textarea 
                    value={lessonForm.content} 
                    onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                    rows={5}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-[13px] sm:text-sm leading-relaxed"
                    placeholder="Write detailed lesson texts or resources here..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all"
                    onClick={() => setIsLessonModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : editingLesson ? 'Save Changes' : 'Add Lesson'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
            <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 shadow-2xl p-6 sm:p-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900">Profile Settings</h2>
                <button 
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Live Avatar Preview */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-indigo-50 border-4 border-white shadow-md overflow-hidden mb-3 relative group">
                  <img 
                    src={editAvatarSeed.startsWith('http') ? editAvatarSeed : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(editAvatarSeed || 'User')}`} 
                    alt="Live Preview" 
                    className="w-full h-full object-cover"
                  />
                  {/* Upload Overlay */}
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold"
                  >
                    <Plus size={16} className="mb-0.5" />
                    Upload Photo
                  </label>
                  
                  {isUploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload} 
                  disabled={isUploadingImage}
                />
                <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">
                  {isUploadingImage ? 'Uploading image...' : 'Click portrait to upload photo'}
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveSettings} className="space-y-4">
                {settingsError && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100 flex items-center gap-2">
                    <span>⚠️</span> {settingsError}
                  </div>
                )}
                {settingsSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-600 text-sm font-semibold rounded-xl border border-emerald-100 flex items-center gap-2">
                    <span>✅</span> {settingsSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input 
                    type="text" 
                    value={editFullName} 
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm sm:text-base"
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
                  <input 
                    type="text" 
                    value={editUsername} 
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm sm:text-base"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Avatar Seed (Try different words!)</label>
                  <input 
                    type="text" 
                    value={editAvatarSeed} 
                    onChange={(e) => setEditAvatarSeed(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm sm:text-base"
                    placeholder="Enter custom nickname for avatar"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default TutorDashboard;
