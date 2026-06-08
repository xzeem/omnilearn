import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Users, LayoutDashboard, Settings, LogOut, ShieldCheck,
  TrendingUp, AlertCircle, Menu, X, Plus, Bell, Search,
  Download, Trash2, ChevronDown, GraduationCap, PlaySquare,
  RefreshCw, UserCheck, MoreVertical, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const ROLE_COLORS = {
  student: 'bg-gray-100 text-gray-600',
  instructor: 'bg-indigo-50 text-indigo-600',
  admin: 'bg-rose-50 text-rose-600',
};

const exportCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, setProfile, clearAuth } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Platform Stats
  const [stats, setStats] = useState({ totalUsers: 0, totalCourses: 0, totalEnrollments: 0, newUsersThisWeek: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Users
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [updatingRole, setUpdatingRole] = useState(null);

  // Courses
  const [courses, setCourses] = useState([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [deletingCourse, setDeletingCourse] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [lastSeen] = useState(() => localStorage.getItem('admin_notif_seen') || '1970-01-01');
  const unreadCount = notifications.filter(n => n.enrolled_at > lastSeen).length;

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile?.full_name || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editAvatarSeed, setEditAvatarSeed] = useState(profile?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  useEffect(() => {
    if (profile) {
      setEditFullName(profile.full_name || '');
      setEditUsername(profile.username || '');
      setEditAvatarSeed(profile.avatar_url || '');
    }
  }, [profile]);

  const avatarSeed = profile?.avatar_url || profile?.full_name || 'Admin';
  const avatarUrl = avatarSeed.startsWith('http')
    ? avatarSeed
    : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(avatarSeed)}`;

  const fetchPlatformStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const [{ count: uCount }, { count: cCount }, { count: eCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }),
      ]);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: newU } = await supabase.from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());
      setStats({ totalUsers: uCount || 0, totalCourses: cCount || 0, totalEnrollments: eCount || 0, newUsersThisWeek: newU || 0 });
    } catch (err) { console.error(err); }
    finally { setIsLoadingStats(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); }
    finally { setIsLoadingUsers(false); }
  }, []);

  const fetchCourses = useCallback(async () => {
    setIsLoadingCourses(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*, lessons(id), enrollments(count), profiles(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCourses((data || []).map(c => ({
        ...c,
        lessonsCount: c.lessons?.length || 0,
        studentsCount: c.enrollments?.[0]?.count || 0,
        instructorName: c.profiles?.full_name || 'Unknown',
      })));
    } catch (err) { console.error(err); }
    finally { setIsLoadingCourses(false); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('enrollments')
        .select('enrolled_at, profiles(full_name), courses(title)')
        .order('enrolled_at', { ascending: false })
        .limit(10);
      setNotifications((data || []).map(n => ({
        enrolled_at: n.enrolled_at,
        user: n.profiles?.full_name || 'A student',
        course: n.courses?.title || 'a course',
      })));
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchPlatformStats();
    fetchUsers();
    fetchCourses();
    fetchNotifications();
  }, [fetchPlatformStats, fetchUsers, fetchCourses, fetchNotifications]);

  const handleRoleChange = async (userId, newRole) => {
    if (userId === profile.id) {
      alert("You cannot change your own role from the user directory. This is a safety measure to prevent accidental lockout.");
      return;
    }

    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    
    setUpdatingRole(userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("No rows were updated. This usually means you don't have permission (Check RLS policies).");
      }
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert(`Role updated successfully to ${newRole}!`);
    } catch (err) { 
      console.error('Role update error:', err);
      alert('Could not update role: ' + (err.message || 'Unknown error')); 
    }
    finally { setUpdatingRole(null); }
  };

  const handleDeleteCourse = async (courseId) => {
    setDeletingCourse(courseId);
    try {
      // 1. First attempt the delete
      const { error, count } = await supabase
        .from('courses')
        .delete({ count: 'exact' })
        .eq('id', courseId);

      if (error) throw error;

      // 2. If count is 0, it means RLS blocked it or course doesn't exist
      if (count === 0) {
        throw new Error("Course not found or deletion blocked by security policies (RLS).");
      }

      setCourses(prev => prev.filter(c => c.id !== courseId));
      setStats(s => ({ ...s, totalCourses: s.totalCourses - 1 }));
      alert('Course deleted successfully.');
    } catch (err) { 
      console.error('Delete error:', err);
      alert('Could not delete course: ' + err.message); 
    }
    finally { setDeletingCourse(null); setConfirmDelete(null); }
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(console.error);
    clearAuth();
    navigate('/');
  };

  const compressImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image(); img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 250;
        let w = img.width, h = img.height;
        if (w > h) { if (w > max) { h *= max / w; w = max; } } else { if (h > max) { w *= max / h; h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file), 'image/jpeg', 0.8);
      };
    };
    reader.onerror = () => resolve(file);
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploadingImage(true);
    try {
      const compressed = await compressImage(file);
      const path = `${profile.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setEditAvatarSeed(publicUrl);
      setSettingsSuccess('Photo uploaded! Save to apply.');
    } catch (err) { setSettingsError(err.message); }
    finally { setIsUploadingImage(false); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault(); setIsSaving(true); setSettingsError(''); setSettingsSuccess('');
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editFullName, username: editUsername, avatar_url: editAvatarSeed, updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, full_name: editFullName, username: editUsername, avatar_url: editAvatarSeed });
      setSettingsSuccess('Profile updated!');
      setTimeout(() => { setIsSettingsOpen(false); setSettingsSuccess(''); }, 1200);
    } catch (err) { setSettingsError(err.message); }
    finally { setIsSaving(false); }
  };

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    const matchSearch = (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const filteredCourses = courses.filter(c =>
    (c.title || '').toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.instructorName || '').toLowerCase().includes(courseSearch.toLowerCase())
  );

  const navItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'courses', icon: BookOpen, label: 'Courses' },
  ];

  // --- SIDEBAR ----------------------------------------------------------------
  const Sidebar = ({ mobile = false }) => (
    <div className={mobile ? '' : 'flex flex-col h-full'}>
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div><p className="font-black text-white text-sm">OmniLearn Admin</p><p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Command Center</p></div>
        </div>
        <div className="flex items-center gap-3">
          <img src={avatarUrl} alt="avatar" className="w-9 h-9 rounded-full object-cover border-2 border-gray-700" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{profile?.full_name || 'Admin'}</p>
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">Admin</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left ${activeTab === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800 space-y-1">
        <a
          href="https://quazeem.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-2 rounded-xl text-xs font-black tracking-wide transition-all group"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
          }}
        >
          <span className="text-indigo-200 font-semibold text-[10px] uppercase tracking-widest">Built by</span>
          <span
            className="text-white font-black text-sm tracking-tight group-hover:tracking-wide transition-all duration-200"
            style={{ letterSpacing: '0.04em' }}
          >
            Olyth
          </span>
          <span className="text-indigo-300 text-[10px]">↗</span>
        </a>
        <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-medium transition-colors text-left text-sm">
          <Settings size={18} /> Profile Settings
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-medium transition-colors text-left text-sm">
          <LogOut size={18} /> Log Out
        </button>
      </div>
    </div>
  );

  // --- OVERVIEW TAB ------------------------------------------------------------
  const OverviewTab = () => (
    <div>
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'indigo', badge: `+${stats.newUsersThisWeek} this week` },
          { label: 'Active Courses', value: stats.totalCourses, icon: BookOpen, color: 'emerald', badge: null },
          { label: 'Total Enrollments', value: stats.totalEnrollments, icon: GraduationCap, color: 'violet', badge: null },
          { label: 'New Users / Week', value: stats.newUsersThisWeek, icon: TrendingUp, color: 'rose', badge: null },
        ].map(({ label, value, icon: Icon, color, badge }) => (
          <motion.div key={label} variants={fadeUp}
            className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 bg-${color}-50 text-${color}-600 rounded-2xl flex items-center justify-center`}>
                <Icon size={22} />
              </div>
              {badge && <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">{badge}</span>}
            </div>
            <p className="text-gray-500 font-medium text-sm">{label}</p>
            <h3 className="font-black text-3xl text-gray-900 mt-1">
              {isLoadingStats ? <span className="inline-block w-16 h-8 bg-gray-100 rounded-lg animate-pulse" /> : value.toLocaleString()}
            </h3>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Notifications Feed */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">Recent Enrollments</h2>
          <button onClick={() => { fetchPlatformStats(); fetchNotifications(); }}
            className="text-gray-400 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 transition-all">
            <RefreshCw size={16} />
          </button>
        </div>
        <ul className="divide-y divide-gray-50">
          {notifications.length === 0 ? (
            <li className="py-10 text-center text-gray-400 font-medium">No recent enrollments</li>
          ) : notifications.map((n, i) => (
            <motion.li key={i} variants={fadeUp} initial="hidden" animate="show"
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                <GraduationCap size={16} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  <span className="text-indigo-600">{n.user}</span> enrolled in <span className="font-bold">{n.course}</span>
                </p>
                <p className="text-xs text-gray-400">{new Date(n.enrolled_at).toLocaleString()}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );

  // --- USERS TAB ---------------------------------------------------------------
  const UsersTab = () => (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
            placeholder="Search by name or username…"
            className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent placeholder:text-gray-400" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm outline-none cursor-pointer">
          <option value="all">All Roles</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={() => exportCSV(filteredUsers.map(u => ({ name: u.full_name || '', username: u.username || '', role: u.role, joined: u.created_at })), 'users.csv')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-sm shadow-indigo-600/20 transition-all">
          <Download size={15} /> Export CSV
        </button>
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoadingUsers ? (
          <div className="py-20 flex justify-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['User', 'Role', 'Joined', 'Change Role'].map(h => (
                  <th key={h} className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-medium">No users found</td></tr>
                ) : filteredUsers.map(u => (
                  <motion.tr key={u.id} variants={fadeUp} initial="hidden" animate="show"
                    className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <img src={(u.avatar_url || '').startsWith('http') ? u.avatar_url : `https://api.dicebear.com/7.x/notionists/svg?seed=${u.full_name || 'u'}`}
                          alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100 shrink-0" />
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{u.full_name || '—'}</p>
                          <p className="text-xs text-gray-400">@{u.username || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                    </td>
                    <td className="py-4 px-5 text-xs text-gray-500 font-medium">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-5">
                      {updatingRole === u.id ? (
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 outline-none cursor-pointer bg-white hover:border-indigo-400 transition-colors">
                          <option value="student">Student</option>
                          <option value="instructor">Instructor</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // --- COURSES TAB -------------------------------------------------------------
  const CoursesTab = () => (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
            placeholder="Search courses or instructors…"
            className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent placeholder:text-gray-400" />
        </div>
        <button onClick={() => exportCSV(filteredCourses.map(c => ({ title: c.title, instructor: c.instructorName, category: c.category || '', level: c.level || '', students: c.studentsCount, lessons: c.lessonsCount })), 'courses.csv')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-sm shadow-indigo-600/20 transition-all">
          <Download size={15} /> Export CSV
        </button>
      </div>
      {isLoadingCourses ? (
        <div className="py-20 flex justify-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-4">
          {filteredCourses.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-gray-100 text-gray-400 font-medium">No courses found</div>
          ) : filteredCourses.map(c => (
            <motion.div key={c.id} variants={fadeUp}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 overflow-hidden shrink-0 flex items-center justify-center">
                {c.thumbnail_url
                  ? <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <PlaySquare size={24} className="text-indigo-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">{c.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">by {c.instructorName}
                  {c.category && <span className="ml-2 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">{c.category}</span>}
                  {c.level && <span className="ml-1 bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-semibold">{c.level}</span>}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500"><Users size={12} className="text-indigo-500" /> {c.studentsCount} students</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500"><PlaySquare size={12} className="text-indigo-500" /> {c.lessonsCount} lessons</span>
                </div>
              </div>
              <button onClick={() => setConfirmDelete(c)}
                className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                <Trash2 size={17} />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );

  // --- RENDER ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 shrink-0 fixed top-0 left-0 h-full z-30">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25 }}
              className="fixed top-0 left-0 h-full w-64 bg-gray-900 z-50 md:hidden flex flex-col">
              <div className="flex justify-end p-4">
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800">
                  <X size={20} />
                </button>
              </div>
              <Sidebar mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-5 sm:p-8 lg:p-10 min-h-screen">

        {/* Top Header */}
        <header className="flex justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="font-black text-2xl sm:text-3xl text-gray-900">
              {activeTab === 'overview' ? 'Command Center' : activeTab === 'users' ? 'User Directory' : 'Course Library'}
            </h1>
            <p className="text-gray-400 font-medium mt-1 text-sm hidden sm:block">
              {activeTab === 'overview' ? 'Platform overview and live analytics.' : activeTab === 'users' ? 'Manage all platform users and roles.' : 'Browse, search, and manage all courses.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button onClick={() => {
                setShowNotifs(v => !v);
                if (!showNotifs) { localStorage.setItem('admin_notif_seen', new Date().toISOString()); }
              }} className="p-2.5 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all relative">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {showNotifs && (
                  <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 top-12 w-80 bg-white rounded-3xl border border-gray-100 shadow-2xl z-50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <p className="font-bold text-gray-900 text-sm">Recent Enrollments</p>
                      <span className="text-xs text-gray-400">{notifications.length} total</span>
                    </div>
                    <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {notifications.map((n, i) => (
                        <li key={i} className="px-5 py-3 flex items-start gap-3">
                          <CheckCircle2 size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{n.user} enrolled in <b>{n.course}</b></p>
                            <p className="text-[11px] text-gray-400">{new Date(n.enrolled_at).toLocaleString()}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Mobile Menu */}
            <button className="md:hidden p-2.5 text-gray-600 bg-white border border-gray-200 rounded-2xl shadow-sm"
              onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'courses' && <CoursesTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Trash2 size={28} className="text-rose-500" />
              </div>
              <h3 className="text-center font-black text-xl text-gray-900 mb-2">Delete Course?</h3>
              <p className="text-center text-gray-500 text-sm mb-6">
                "<b>{confirmDelete.title}</b>" and all its lessons will be permanently removed. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all">
                  Cancel
                </button>
                <button onClick={() => handleDeleteCourse(confirmDelete.id)} disabled={deletingCourse === confirmDelete.id}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20">
                  {deletingCourse === confirmDelete.id
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl p-7 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-black text-xl text-gray-900">Profile Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={22} />
                </button>
              </div>
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-indigo-50 border-4 border-white shadow-md overflow-hidden mb-3 relative group">
                  <img src={editAvatarSeed.startsWith('http') ? editAvatarSeed : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(editAvatarSeed || 'Admin')}`}
                    alt="Preview" className="w-full h-full object-cover" />
                  <label htmlFor="avatar-upload-admin" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold">
                    <Plus size={16} className="mb-0.5" /> Upload
                  </label>
                  {isUploadingImage && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                </div>
                <input type="file" id="avatar-upload-admin" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full">{isUploadingImage ? 'Uploading…' : 'Hover to upload photo'}</span>
              </div>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                {settingsError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100">{settingsError}</div>}
                {settingsSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm font-semibold rounded-xl border border-emerald-100">{settingsSuccess}</div>}
                {[
                  { label: 'Full Name', value: editFullName, setter: setEditFullName, placeholder: 'Enter full name', required: true },
                  { label: 'Username', value: editUsername, setter: setEditUsername, placeholder: 'Enter username', required: false },
                  { label: 'Avatar Seed / URL', value: editAvatarSeed, setter: setEditAvatarSeed, placeholder: 'Nickname or image URL', required: false },
                ].map(({ label, value, setter, placeholder, required }) => (
                  <div key={label}>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</label>
                    <input type="text" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} required={required}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-medium text-gray-900 text-sm" />
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsSettingsOpen(false)}
                    className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-2xl transition-all">Cancel</button>
                  <button type="submit" disabled={isSaving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
                    {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
