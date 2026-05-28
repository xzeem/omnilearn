import React, { useState, useEffect } from 'react';
import { BookOpen, Play, CheckCircle2, Search, Bell, Settings, LogOut, Clock, Star, TrendingUp, Menu, X, Plus, PlayCircle, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

const StudentDashboard = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, setProfile, clearAuth } = useAuthStore();

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'discover'
  const [searchQuery, setSearchQuery] = useState('');

  // Settings Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile?.full_name || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editAvatarSeed, setEditAvatarSeed] = useState(profile?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  // Student Data states
  const [enrollments, setEnrollments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrollStatus, setEnrollStatus] = useState(null);

  // Sync profile when loaded
  useEffect(() => {
    if (profile) {
      setEditFullName(profile.full_name || '');
      setEditUsername(profile.username || '');
      setEditAvatarSeed(profile.avatar_url || '');
    }
  }, [profile]);

  const displayName = profile?.full_name || 'Student';
  const avatarSeed = profile?.avatar_url || profile?.full_name || 'Student';
  const avatarUrl = avatarSeed.startsWith('http')
    ? avatarSeed
    : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(avatarSeed)}`;

  const handleLogout = () => {
    supabase.auth.signOut().catch((err) => console.error('Logout error:', err));
    clearAuth();
    navigate('/');
  };

  // Fetch student data and explore catalog
  const fetchStudentData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch Enrollments
      const { data: enrollData, error: enrollError } = await supabase
        .from('enrollments')
        .select('*, courses(*, profiles(full_name), lessons(id))')
        .eq('user_id', profile.id)
        .order('enrolled_at', { ascending: false });

      if (enrollError) throw enrollError;

      const enrolledCourseIds = (enrollData || []).map((e) => e.course_id);
      setEnrollments(enrollData || []);

      // 2. Fetch Catalog (Courses student is not enrolled in yet)
      const { data: catalogData, error: catalogError } = await supabase
        .from('courses')
        .select('*, profiles(full_name), lessons(id)')
        .order('created_at', { ascending: false });

      if (catalogError) throw catalogError;

      const filteredCatalog = (catalogData || []).filter(
        (c) => !enrolledCourseIds.includes(c.id)
      );
      setCatalog(filteredCatalog);
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [profile]);

  // Quick Enroll function
  const handleEnroll = async (courseId) => {
    if (!profile) return;
    setEnrollStatus(courseId);
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert([{ user_id: profile.id, course_id: courseId, progress: 0 }]);

      if (error) throw error;
      await fetchStudentData();
    } catch (err) {
      alert('Could not enroll: ' + err.message);
    } finally {
      setEnrollStatus(null);
    }
  };

  // Settings Save
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editFullName,
        username: editUsername,
        avatar_url: editAvatarSeed,
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

  // Image upload handler
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 250;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > max) { h *= max / w; w = max; }
          } else {
            if (h > max) { w *= max / h; h = max; }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
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
      const compressed = await compressImage(file);
      const path = `${profile.id}/${Date.now()}.jpg`;
      const { error: upError } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true });

      if (upError) throw upError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      setEditAvatarSeed(publicUrl);
      setSettingsSuccess('Photo uploaded successfully! Save to apply.');
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSwitchToTutor = async () => {
    if (!profile) return;
    if (!window.confirm('Are you sure you want to change your role to Tutor? This will reload the application with your new dashboard.')) {
      return;
    }
    
    setIsSwitchingRole(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'instructor',
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        role: 'instructor'
      });

      setSettingsSuccess('Role updated successfully! Redirecting to Tutor Portal...');
      
      setTimeout(() => {
        window.location.href = '/tutor';
      }, 1000);
    } catch (err) {
      console.error(err);
      setSettingsError(err.message || 'Failed to switch role to Tutor.');
      setIsSwitchingRole(false);
    }
  };

  // Active Hero course (lowest progress course or most recently enrolled)
  const activeHero = enrollments.find((e) => e.progress < 100) || enrollments[0];

  const filteredCatalog = catalog.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-50 font-sans flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 shrink-0 sticky top-0 h-screen justify-between">
        <div className="flex-1 py-6 flex flex-col">
          <div className="flex items-center gap-3 px-6 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <BookOpen size={20} className="text-white" />
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight text-gray-900">omniLearn.</span>
          </div>
          <nav className="px-4 space-y-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left text-sm ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={18} /> My Dashboard
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left text-sm ${
                activeTab === 'discover'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Search size={18} /> Discover
            </button>
            {(profile?.role === 'instructor' || profile?.role === 'admin') && (
              <Link
                to="/tutor"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              >
                <LayoutDashboard size={18} /> Tutor Portal
              </Link>
            )}
          </nav>
        </div>
        <div className="p-6 border-t border-gray-100">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl font-medium transition-colors text-left text-sm"
          >
            <Settings size={18} /> Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-medium transition-colors text-left text-sm"
          >
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 lg:p-12 w-full overflow-hidden">
        {/* Top Header */}
        <header className="flex justify-between items-center gap-4 mb-8 sm:mb-12">
          <div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-gray-900">Welcome, {displayName}! 👋</h1>
            <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base hidden sm:block">
              {activeTab === 'dashboard'
                ? `You are enrolled in ${enrollments.length} courses.`
                : 'Explore new courses and skill up today.'}
            </p>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 border-2 border-white shadow-sm overflow-hidden hidden sm:block">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl bg-white border border-gray-200 shadow-sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <>
            {/* Jump Back In Banner */}
            {activeHero && (
              <section className="mb-12">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 sm:gap-8 items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -z-10"></div>

                  <Link
                    to={`/course?id=${activeHero.courses.id}`}
                    className="w-full lg:w-1/3 aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group cursor-pointer shadow-lg block"
                  >
                    {activeHero.courses.thumbnail_url ? (
                      <img
                        src={activeHero.courses.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full bg-indigo-900 flex items-center justify-center">
                        <PlayCircle size={40} className="text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Play size={24} className="text-white fill-white ml-1" />
                      </div>
                    </div>
                  </Link>

                  <div className="flex-1 w-full">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold text-xs mb-4">
                      <Clock size={14} /> Continue Learning
                    </div>
                    <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900 mb-2">
                      {activeHero.courses.title}
                    </h2>
                    <p className="text-gray-500 mb-6 font-medium text-sm sm:text-base">
                      By {activeHero.courses.profiles?.full_name || 'Instructor'}
                    </p>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-700">Progress</span>
                        <span className="text-indigo-600">{activeHero.progress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${activeHero.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <Link
                      to={`/course?id=${activeHero.courses.id}`}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      Resume Lesson <Play size={16} className="fill-white" />
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* My Learning Grid */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-gray-900">My Learning</h2>
              </div>
              {enrollments.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-500 font-bold mb-4">You are not enrolled in any courses yet.</p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    Explore Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {enrollments.map((e) => (
                    <Link
                      to={`/course?id=${e.courses.id}`}
                      key={e.id}
                      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow block"
                    >
                      <div className="aspect-video bg-gray-100 rounded-xl mb-4 overflow-hidden relative">
                        {e.courses.thumbnail_url ? (
                          <img src={e.courses.thumbnail_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-indigo-950 flex items-center justify-center">
                            <PlayCircle size={32} className="text-white/20" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-gray-900">
                          {e.courses.lessons?.length || 0} Lessons
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{e.courses.title}</h3>
                      <p className="text-sm text-gray-500 mb-4 font-medium">
                        By {e.courses.profiles?.full_name || 'Instructor'}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${e.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-gray-700">{e.progress}%</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          /* Catalog Tab */
          <section>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
              <div className="flex-1 max-w-md flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search courses or instructors…"
                  className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent placeholder:text-gray-400"
                />
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 text-gray-400 font-medium">
                No Lessons Uploaded Yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredCatalog.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-video bg-gray-100 rounded-xl mb-4 overflow-hidden relative">
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-indigo-950 flex items-center justify-center">
                            <PlayCircle size={32} className="text-white/20" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-gray-900">
                          {c.lessons?.length || 0} Lessons
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{c.title}</h3>
                      <p className="text-sm text-gray-500 mb-4 font-medium">
                        By {c.profiles?.full_name || 'Instructor'}
                      </p>
                      {c.category && (
                        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-bold px-2.5 py-1 rounded-full mb-4">
                          {c.category}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleEnroll(c.id)}
                      disabled={enrollStatus === c.id}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
                    >
                      {enrollStatus === c.id ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Enroll Now'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="relative w-64 bg-white h-full flex flex-col justify-between p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center">
                    <BookOpen size={20} className="text-white" />
                  </div>
                  <span className="font-bold text-xl text-gray-900">omniLearn.</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-2">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left text-sm ${
                    activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
                  }`}
                >
                  <BookOpen size={18} /> My Dashboard
                </button>
                <button
                  onClick={() => {
                    setActiveTab('discover');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left text-sm ${
                    activeTab === 'discover' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'
                  }`}
                >
                  <Search size={18} /> Discover
                </button>
                {(profile?.role === 'instructor' || profile?.role === 'admin') && (
                  <Link
                    to="/tutor"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  >
                    <LayoutDashboard size={18} /> Tutor Portal
                  </Link>
                )}
              </nav>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 rounded-xl font-semibold text-sm"
              >
                <Settings size={18} /> Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-semibold text-sm"
              >
                <LogOut size={18} /> Log Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
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
                  src={
                    editAvatarSeed.startsWith('http')
                      ? editAvatarSeed
                      : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                          editAvatarSeed || 'User'
                        )}`
                  }
                  alt="Live Preview"
                  className="w-full h-full object-cover"
                />
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Avatar Seed (Try different words!)
                </label>
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
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>

            {/* Switch to Tutor Account Option */}
            {profile?.role === 'student' && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <h3 className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tutor Account</h3>
                <p className="text-xs text-gray-400 mb-4 font-medium">Want to create and teach courses? Switch your account to a tutor profile.</p>
                <button
                  type="button"
                  onClick={handleSwitchToTutor}
                  disabled={isSwitchingRole}
                  className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition-all border border-indigo-100 hover:border-indigo-200 flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                >
                  <LayoutDashboard size={16} /> Switch to Tutor Profile
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen role transition loader overlay */}
      {isSwitchingRole && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
          <div className="flex flex-col items-center gap-4 animate-bounce">
            <div className="w-16 h-16 border-4 border-indigo-400 border-t-white rounded-full animate-spin"></div>
            <h2 className="text-2xl font-black uppercase tracking-widest mt-4">Upgrading your Account...</h2>
            <p className="text-indigo-200 font-bold tracking-wide">Configuring your Tutor Dashboard</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
