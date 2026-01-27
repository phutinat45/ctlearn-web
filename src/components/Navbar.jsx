import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // ✅ ต้องมีบรรทัดนี้

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalXP: 0,
    streak: 0 
  });

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  // --- ฟังก์ชันคำนวณ Streak (คงเดิม) ---
  const calculateStreak = (progressData) => {
    if (!progressData || progressData.length === 0) return 0;

    const toLocalDateStr = (dateStr) => {
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const uniqueDates = new Set(progressData.map(p => toLocalDateStr(p.created_at)));

    let streak = 0;
    let d = new Date(); 

    const todayStr = toLocalDateStr(d);
    const hasToday = uniqueDates.has(todayStr);
    
    d.setDate(d.getDate() - 1); 
    const yesterdayStr = toLocalDateStr(d);
    const hasYesterday = uniqueDates.has(yesterdayStr);

    if (!hasToday && !hasYesterday) return 0;

    let checkDate = new Date();
    if (!hasToday) checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
        const dateStr = toLocalDateStr(checkDate);
        if (uniqueDates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1); 
        } else {
            break; 
        }
    }
    return streak;
  };

  // --- ฟังก์ชันดึงข้อมูล (คงเดิม) ---
  const fetchUserStats = async () => {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return;

        const user = JSON.parse(userStr);

        const { data: progressData, error: progressError } = await supabase
            .from('progress')
            .select('lesson_id, created_at') 
            .eq('student_id', user.id)
            .eq('passed', true);

        if (progressError) throw progressError;

        let currentStreak = 0;
        let totalXP = 0;

        if (progressData && progressData.length > 0) {
            currentStreak = calculateStreak(progressData);

            const lessonIds = progressData.map(p => p.lesson_id);
            const { data: lessonsData, error: lessonsError } = await supabase
                .from('lessons')
                .select('xp')
                .in('id', lessonIds);

            if (lessonsError) throw lessonsError;

            if (lessonsData) {
                totalXP = lessonsData.reduce((sum, item) => sum + (item.xp || 0), 0);
            }
        }

        setStats({
            totalXP: totalXP,
            streak: currentStreak
        });

    } catch (err) {
        console.error("Navbar Error:", err.message);
    }
  };

  useEffect(() => {
    fetchUserStats(); 
    window.addEventListener('xp-updated', fetchUserStats);
    return () => {
      window.removeEventListener('xp-updated', fetchUserStats);
    };
  }, []);

  // 🔥🔥🔥 แก้ไขจุดนี้: ฟังก์ชัน Logout แบบล้างบาง (Force Refresh) 🔥🔥🔥
  const handleLogout = async () => {
    // 1. ลบข้อมูล User ที่เราเก็บเอง
    localStorage.removeItem('currentUser');

    // 2. สั่ง Supabase ให้ตัดการเชื่อมต่อ (สำคัญ! ล้าง Session ที่ค้างใน Browser)
    await supabase.auth.signOut();

    // 3. ใช้ window.location.href แทน navigate 
    // คำสั่งนี้จะบังคับให้ Browser โหลดหน้าใหม่ 100% เหมือนกด F5
    // ข้อมูลเก่าของ Admin/Student จะถูกล้างหายไปแน่นอน
    window.location.href = '/login'; 
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        
        <Link to="/dashboard" className="logo-link">
            <div className="logo-icon">
                <i className="fa-solid fa-star"></i>
            </div>
            <div className="logo-text">
                CT<span className="text-blue">Learn</span>
            </div>
        </Link>

        {/* เมนูตรงกลาง */}
        <div className="nav-center">
            <Link to="/dashboard" className={`nav-item ${isActive('/dashboard')}`}>
                <i className="fa-solid fa-house"></i> <span>หน้าแรก</span>
            </Link>
            <Link to="/lessons" className={`nav-item ${isActive('/lessons')}`}>
                <i className="fa-solid fa-book-open"></i> <span>บทเรียน</span>
            </Link>
            <Link to="/rank" className={`nav-item ${isActive('/rank')}`}>
                <i className="fa-solid fa-trophy"></i> <span>อันดับ</span>
            </Link>
            <Link to="/profile" className={`nav-item ${isActive('/profile')}`}>
                <i className="fa-regular fa-user"></i> <span>โปรไฟล์</span>
            </Link>
        </div>

        {/* ส่วนขวา */}
        <div className="nav-right">
            <div className="streak-chip">
                <i className="fa-solid fa-fire" style={{color: '#ff5722'}}></i> {stats.streak}
            </div>
            
            <div className="xp-chip" key={stats.totalXP} style={{ animation: 'popIn 0.3s ease-out' }}>
                <i className="fa-solid fa-star"></i> {stats.totalXP} XP
            </div>
            
            <div className="divider-vertical"></div> 

            {/* ปุ่มออกจากระบบ */}
            <button className="btn-logout-text" onClick={handleLogout}>
                <i className="fa-solid fa-right-from-bracket"></i> ออกจากระบบ
            </button>
        </div>

      </div>
    </nav>
  );
}

export default Navbar;