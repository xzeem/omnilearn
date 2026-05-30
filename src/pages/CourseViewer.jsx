import React, { useState, useEffect } from 'react';
import { ArrowLeft, PlayCircle, CheckCircle2, Circle, ChevronLeft, ChevronRight, ChevronDown, Play, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

const CourseViewer = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile curriculum
  const [isLessonIndexOpen, setIsLessonIndexOpen] = useState(false); // Inline lesson index

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Read course ID from URL query parameters
  const courseId = new URLSearchParams(window.location.search).get('id');

  const fetchCourseData = async () => {
    if (!courseId || !profile) return;
    setLoading(true);
    try {
      // 1. Fetch Course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*, profiles(full_name)')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // 2. Fetch Lessons for this course ordered by "order"
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order', { ascending: true });

      if (lessonsError) throw lessonsError;
      setLessons(lessonsData || []);

      // 3. Load completed lesson state from local storage
      const stored = localStorage.getItem(`completed_lessons_${profile.id}_${courseId}`);
      const completedList = stored ? JSON.parse(stored) : [];
      setCompletedLessons(completedList);

      // 4. Default to first lesson (or first incomplete lesson)
      if (lessonsData && lessonsData.length > 0) {
        const firstIncomplete = lessonsData.find((l) => !completedList.includes(l.id));
        setActiveLesson(firstIncomplete || lessonsData[0]);
      }
    } catch (err) {
      console.error('Error fetching course syllabus:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && courseId) {
      fetchCourseData();
    } else if (!courseId) {
      navigate('/dashboard');
    }
  }, [courseId, profile]);

  const handleToggleComplete = async (lessonId) => {
    if (!profile || !courseId || !lessons.length) return;

    let updatedCompleted = [];
    if (completedLessons.includes(lessonId)) {
      updatedCompleted = completedLessons.filter((id) => id !== lessonId);
    } else {
      updatedCompleted = [...completedLessons, lessonId];
    }

    setCompletedLessons(updatedCompleted);
    localStorage.setItem(
      `completed_lessons_${profile.id}_${courseId}`,
      JSON.stringify(updatedCompleted)
    );

    // Calculate percentage
    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((updatedCompleted.length / lessons.length) * 100))
    );

    try {
      const { error } = await supabase
        .from('enrollments')
        .update({ progress: progressPercent })
        .eq('user_id', profile.id)
        .eq('course_id', courseId);

      if (error) throw error;
    } catch (err) {
      console.error('Could not save progress to database:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Course not found.</h2>
        <Link to="/dashboard" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Helper to extract clean youtube embed URL
  const getEmbedUrl = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') {
        return `https://www.youtube.com/embed/${parsed.pathname.substring(1)}`;
      }
      if (parsed.searchParams.has('v')) {
        return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  const activeLessonCompleted = activeLesson && completedLessons.includes(activeLesson.id);
  const progressPercent = lessons.length
    ? Math.round((completedLessons.length / lessons.length) * 100)
    : 0;

  // Derived navigation helpers
  const activeIndex = lessons.findIndex((l) => l.id === activeLesson?.id);
  const prevLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;

  const goToLesson = (lesson) => {
    if (!lesson) return;
    setActiveLesson(lesson);
    setIsSidebarOpen(false);
    // Scroll video back into view smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans flex flex-col">
      {/* Top Navigation */}
      <nav className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="hidden md:block w-px h-8 bg-gray-200"></div>
          <div>
            <h1 className="font-heading font-bold text-gray-900 line-clamp-1">{course.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3">
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-sm font-bold text-gray-700">{progressPercent}% Complete</span>
          </div>

          {/* Mobile Curriculum Toggle */}
          <button
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Main Learning Workspace */}
      <div className="flex-1 flex flex-col lg:w-[90%] lg:mt-3 mx-auto lg:flex-row overflow-hidden relative">
        {/* Left Column: Video & Lesson Info */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {activeLesson ? (
            <>
              {/* Video Player Area */}
              <div className="w-full bg-black aspect-video relative shadow-md">
                {activeLesson.video_url ? (
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={getEmbedUrl(activeLesson.video_url)}
                    title={activeLesson.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center text-white font-medium">
                    No video provided for this lesson.
                  </div>
                )}
              </div>

              {/* Below Video Controls */}
              <div className="bg-white border-b border-gray-100 px-4 lg:px-8 py-3 flex flex-wrap md:flex-nowrap items-center gap-3">
                {/* Prev Button */}
                <button
                  onClick={() => goToLesson(prevLesson)}
                  disabled={!prevLesson}
                  title={prevLesson ? `Previous: ${prevLesson.title}` : 'No previous lesson'}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                    prevLesson
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                {/* Center: title + complete */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
                  <h2 className="font-heading font-bold text-base lg:text-lg text-gray-900 line-clamp-1 flex-1">
                    <span className="text-indigo-400 font-semibold mr-1.5 text-sm">{activeIndex + 1}/{lessons.length}</span>
                    {activeLesson.title}
                  </h2>
                  <button
                    onClick={() => handleToggleComplete(activeLesson.id)}
                    className={`shrink-0 px-5 py-2 font-bold rounded-xl transition-colors text-sm flex items-center gap-2 ${
                      activeLessonCompleted
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    <CheckCircle2 size={16} />
                    {activeLessonCompleted ? 'Completed' : 'Mark Complete'}
                  </button>
                </div>

                {/* Next Button */}
                <button
                  onClick={() => goToLesson(nextLesson)}
                  disabled={!nextLesson}
                  title={nextLesson ? `Next: ${nextLesson.title}` : 'No next lesson'}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                    nextLesson
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                      : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Lesson Index Panel */}
              <div className="bg-white border-b border-gray-100">
                <button
                  onClick={() => setIsLessonIndexOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 lg:px-8 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Play size={14} className="text-indigo-500 fill-indigo-500" />
                    <span className="font-bold text-sm text-gray-800">Course Lessons</span>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {lessons.length} lessons
                    </span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 transition-transform duration-300 ${
                      isLessonIndexOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isLessonIndexOpen && (
                  <div className="border-t border-gray-50 max-h-72 overflow-y-auto">
                    {lessons.map((lesson, idx) => {
                      const isCurrent = lesson.id === activeLesson?.id;
                      const isDone = completedLessons.includes(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => goToLesson(lesson)}
                          className={`w-full flex items-center gap-3 px-4 lg:px-8 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${
                            isCurrent
                              ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                              : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="shrink-0">
                            {isDone ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : isCurrent ? (
                              <Play size={16} className="text-indigo-600 fill-indigo-600" />
                            ) : (
                              <Circle size={16} className="text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold truncate ${
                              isCurrent ? 'text-indigo-800' : isDone ? 'text-gray-500' : 'text-gray-700'
                            }`}>
                              {idx + 1}. {lesson.title}
                            </p>
                          </div>
                          {isCurrent && (
                            <span className="shrink-0 text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Playing
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Overview Details */}
              <div className="p-4 lg:p-8 max-w-4xl pb-24 lg:pb-8">
                <div className="flex items-center gap-6 border-b border-gray-100 mb-8 pb-4">
                  <button className="text-indigo-600 font-bold border-b-2 border-indigo-600 pb-4 -mb-4">
                    Overview
                  </button>
                </div>

                <div className="prose prose-indigo max-w-none">
                  <h3 className="font-heading font-bold text-2xl text-gray-900 mb-4">About this lesson</h3>
                  <div 
                    className="text-gray-600 leading-relaxed mb-8 lesson-html-content"
                    dangerouslySetInnerHTML={{ __html: activeLesson.content || 'No description provided for this lesson.' }}
                  />
                  <style>{`
                    .lesson-html-content h2 { font-size: 1.5rem; font-weight: 800; color: #111827; margin-top: 2rem; margin-bottom: 1rem; }
                    .lesson-html-content h3 { font-size: 1.25rem; font-weight: 800; color: #111827; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                    .lesson-html-content p { margin-bottom: 1.25rem; }
                    .lesson-html-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.25rem; }
                    .lesson-html-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.25rem; }
                    .lesson-html-content b, .lesson-html-content strong { font-weight: 700; color: #111827; }
                  `}</style>

                  {/* Instructor Bio */}
                  <div className="flex items-center gap-4 mt-12 pt-8 border-t border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-indigo-50 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                      <img
                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                          course.profiles?.full_name || 'Instructor'
                        )}`}
                        className="w-full h-full object-cover"
                        alt="Instructor"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Instructor</p>
                      <p className="font-bold text-gray-900">{course.profiles?.full_name || 'Instructor'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <PlayCircle size={48} className="text-indigo-500 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">No lessons available in this course.</h3>
              <p className="text-gray-500 text-sm mt-1">Please contact your instructor to publish lessons.</p>
            </div>
          )}
        </div>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Right Column: Syllabus Curriculum Sidebar */}
        <div
          className={`fixed inset-y-0 right-0 z-50 w-80 bg-white border-l border-gray-100 flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:w-96 lg:h-full shrink-0 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-gray-900">Course Syllabus</h3>
              <p className="text-sm text-gray-500 font-medium">{lessons.length} Lessons total</p>
            </div>
            <button className="lg:hidden text-gray-500" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lessons.map((lesson, idx) => {
              const isCurrent = activeLesson && activeLesson.id === lesson.id;
              const isChecked = completedLessons.includes(lesson.id);

              return (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setActiveLesson(lesson);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 p-4 border-b border-gray-50 transition-colors text-left ${
                    isCurrent
                      ? 'bg-indigo-50 border-l-4 border-indigo-600'
                      : 'hover:bg-indigo-50/20 border-l-4 border-transparent'
                  }`}
                >
                  {isChecked ? (
                    <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle size={18} className="text-gray-300 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p
                      className={`font-semibold text-sm leading-tight ${
                        isCurrent ? 'text-indigo-950 font-bold' : 'text-gray-700'
                      }`}
                    >
                      {idx + 1}. {lesson.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseViewer;
